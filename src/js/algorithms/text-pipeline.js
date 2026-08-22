/**
 * The production half: tokenisers, similarity metrics, log-template
 * extraction, and the prefilter/verify pipeline they all end up inside.
 *
 * The number that decides the throughput of a matching pipeline is not how
 * fast the verifier is. It is how many candidates the prefilter admits per
 * result - the selectivity - because the verifier runs once per candidate and
 * the prefilter runs once per record. A verifier made twice as fast halves
 * half the cost; a prefilter that admits ten times fewer candidates removes
 * ninety per cent of it. Every function here reports candidates and results
 * separately for that reason.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TextPipeline = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { records: 0, candidates: 0, verified: 0, comparisons: 0,
      templates: 0, tokens: 0, merges: 0 };
  }

  /* ------------------------------------------------------------ tokenising */

  function whitespace(text) {
    return text.split(/\s+/).filter(function (piece) { return piece.length > 0; });
  }

  /** Letters, digits and punctuation as separate runs, which is what a rule-
   *  based tokeniser does and why `v1.2.3` becomes five tokens rather than one. */
  function ruleBased(text) {
    return text.match(/[A-Za-z]+|[0-9]+|[^\sA-Za-z0-9]/g) || [];
  }

  /**
   * Byte-pair encoding, trained on the text itself. Start from characters,
   * repeatedly merge the most frequent adjacent pair, and stop after `merges`
   * rounds. The vocabulary it learns is the argument for subword tokenisers:
   * common words become single tokens and rare ones decompose, so the token
   * count falls without the vocabulary exploding.
   */
  function bytePairEncoding(text, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const words = whitespace(text.toLowerCase());
    let pieces = words.map(function (word) { return word.split(''); });
    const vocabulary = new Set();

    pieces.forEach(function (word) { word.forEach(function (c) { vocabulary.add(c); }); });

    const rounds = settings.merges === undefined ? 40 : settings.merges;

    for (let round = 0; round < rounds; round += 1) {
      const best = bestPair(pieces);

      if (!best) break;
      pieces = pieces.map(function (word) { return mergePair(word, best.pair); });
      vocabulary.add(best.pair);
      report.merges += 1;
    }
    const tokens = pieces.reduce(function (sum, word) { return sum + word.length; }, 0);

    report.tokens = tokens;
    return { pieces: pieces, vocabulary: vocabulary, tokens: tokens,
      characters: words.join('').length, report: report };
  }

  function bestPair(pieces) {
    const counts = new Map();

    pieces.forEach(function (word) {
      for (let i = 0; i + 1 < word.length; i += 1) {
        const pair = word[i] + word[i + 1];

        counts.set(pair, (counts.get(pair) || 0) + 1);
      }
    });
    let best = null;

    counts.forEach(function (count, pair) {
      if (best !== null && (count < best.count || (count === best.count && pair >= best.pair))) return;
      best = { pair: pair, count: count };
    });
    return best;
  }

  function mergePair(word, pair) {
    const out = [];
    let i = 0;

    while (i < word.length) {
      if (i + 1 < word.length && word[i] + word[i + 1] === pair) {
        out.push(pair);
        i += 2;
        continue;
      }
      out.push(word[i]);
      i += 1;
    }
    return out;
  }

  /* ------------------------------------------------------------ similarity */

  function levenshtein(a, b) {
    let previous = [];

    for (let j = 0; j <= b.length; j += 1) previous.push(j);

    for (let i = 1; i <= a.length; i += 1) {
      const current = [i];

      for (let j = 1; j <= b.length; j += 1) {
        current.push(Math.min(previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
          previous[j] + 1, current[j - 1] + 1));
      }
      previous = current;
    }
    return previous[b.length];
  }

  function levenshteinRatio(a, b) {
    const longest = Math.max(a.length, b.length);

    return longest === 0 ? 1 : 1 - levenshtein(a, b) / longest;
  }

  /**
   * Jaro-Winkler. It weights a shared PREFIX, which is why it is the standard
   * metric for names and a poor one for identifiers: `service-a` and
   * `service-b` score 0.97 and are different things.
   */
  function jaroWinkler(a, b, options) {
    const jaro = jaroSimilarity(a, b);
    const scale = (options || {}).scale === undefined ? 0.1 : (options || {}).scale;
    let prefix = 0;

    while (prefix < 4 && prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) {
      prefix += 1;
    }
    return jaro + prefix * scale * (1 - jaro);
  }

  function jaroSimilarity(a, b) {
    if (a.length === 0 && b.length === 0) return 1;

    if (a.length === 0 || b.length === 0) return 0;
    const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
    const usedB = new Array(b.length).fill(false);
    const matchedA = [];

    for (let i = 0; i < a.length; i += 1) {
      for (let j = Math.max(0, i - window); j <= Math.min(b.length - 1, i + window); j += 1) {
        if (usedB[j] || a[i] !== b[j]) continue;
        usedB[j] = true;
        matchedA.push({ i: i, j: j });
        break;
      }
    }

    if (matchedA.length === 0) return 0;
    const m = matchedA.length;
    let transpositions = 0;
    const orderB = matchedA.slice().sort(function (x, y) { return x.j - y.j; });

    orderB.forEach(function (entry, index) {
      if (entry.i === matchedA[index].i) return;
      transpositions += 1;
    });
    return (m / a.length + m / b.length + (m - transpositions / 2) / m) / 3;
  }

  function shingles(text, size) {
    const out = new Set();

    for (let i = 0; i + size <= text.length; i += 1) out.add(text.substr(i, size));
    return out;
  }

  function jaccard(a, b) {
    let shared = 0;

    a.forEach(function (piece) { if (b.has(piece)) shared += 1; });
    const union = a.size + b.size - shared;

    return union === 0 ? 1 : shared / union;
  }

  function cosine(a, b, size) {
    const left = gramCounts(a, size);
    const right = gramCounts(b, size);
    let dot = 0;

    left.forEach(function (count, gram) { dot += count * (right.get(gram) || 0); });
    const normA = Math.sqrt(sumSquares(left));
    const normB = Math.sqrt(sumSquares(right));

    return normA === 0 || normB === 0 ? 0 : dot / (normA * normB);
  }

  function gramCounts(text, size) {
    const out = new Map();

    for (let i = 0; i + size <= text.length; i += 1) {
      const gram = text.substr(i, size);

      out.set(gram, (out.get(gram) || 0) + 1);
    }
    return out;
  }

  function sumSquares(counts) {
    let total = 0;

    counts.forEach(function (count) { total += count * count; });
    return total;
  }

  /* -------------------------------------------------------- log templates */

  /**
   * Drain-style template extraction: group by token count and first token,
   * then merge a line into an existing template when enough positions agree,
   * replacing the disagreements with a wildcard. It is a clustering heuristic
   * with a similarity threshold, and the threshold is the whole tuning
   * surface - too low and every line becomes one template, too high and every
   * line becomes its own.
   */
  function extractTemplates(lines, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const threshold = settings.threshold === undefined ? 0.5 : settings.threshold;
    const groups = new Map();

    lines.forEach(function (line) {
      report.records += 1;
      const tokens = whitespace(line);
      const key = tokens.length + '|' + (tokens[0] || '');
      const bucket = groups.get(key) || [];

      groups.set(key, bucket);
      absorb(bucket, tokens, threshold, report);
    });
    const templates = [];

    groups.forEach(function (bucket) {
      bucket.forEach(function (entry) { templates.push(entry); });
    });
    report.templates = templates.length;
    return { templates: templates.sort(function (a, b) { return b.count - a.count; }),
      report: report };
  }

  function absorb(bucket, tokens, threshold, report) {
    for (let i = 0; i < bucket.length; i += 1) {
      const score = agreement(bucket[i].tokens, tokens, report);

      if (score < threshold) continue;
      bucket[i].tokens = generalise(bucket[i].tokens, tokens);
      bucket[i].count += 1;
      return;
    }
    bucket.push({ tokens: tokens.slice(), count: 1 });
  }

  function agreement(a, b, report) {
    let same = 0;

    for (let i = 0; i < a.length; i += 1) {
      report.comparisons += 1;

      if (a[i] !== '<*>' && a[i] !== b[i]) continue;
      same += 1;
    }
    return a.length === 0 ? 1 : same / a.length;
  }

  function generalise(a, b) {
    return a.map(function (token, i) { return token === b[i] ? token : '<*>'; });
  }

  /* ---------------------------------------------------------- the pipeline */

  /**
   * Normalise, block by q-gram, verify by Jaro-Winkler. The report carries
   * candidates and results separately because the ratio between them - not
   * the verifier's speed - is what a throughput conversation is actually
   * about.
   */
  function namePipeline(query, records, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const q = settings.q || 2;
    const cutoff = settings.cutoff === undefined ? 0.85 : settings.cutoff;
    const target = normalise(query);
    const wanted = shingles(target, q);
    const matches = [];

    records.forEach(function (record) {
      report.records += 1;
      const candidate = normalise(record);

      if (settings.block !== false && jaccard(wanted, shingles(candidate, q)) < (settings.minShared || 0.2)) {
        return;
      }
      report.candidates += 1;
      report.comparisons += target.length * candidate.length;
      const score = jaroWinkler(target, candidate, {});

      if (score < cutoff) return;
      report.verified += 1;
      matches.push({ record: record, score: score });
    });
    return { matches: matches.sort(function (a, b) { return b.score - a.score; }),
      report: report,
      selectivity: report.candidates / Math.max(1, report.records),
      candidatesPerResult: report.candidates / Math.max(1, report.verified) };
  }

  /** Lower-case, strip punctuation, collapse whitespace. Normalisation before
   *  comparison is the step people skip, and it decides more matches than any
   *  metric choice does. */
  function normalise(text) {
    return text.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /** Precision and recall against a labelled set, because "it found the right
   *  ones" is two numbers and quoting one of them is the oldest trick there is. */
  function score(found, expected) {
    const truth = new Set(expected);
    const hit = found.filter(function (entry) { return truth.has(entry.record); }).length;

    return { precision: found.length === 0 ? 1 : hit / found.length,
      recall: truth.size === 0 ? 1 : hit / truth.size,
      found: found.length, expected: truth.size, hit: hit };
  }

  return {
    emptyReport: emptyReport,
    whitespace: whitespace, ruleBased: ruleBased, bytePairEncoding: bytePairEncoding,
    levenshtein: levenshtein, levenshteinRatio: levenshteinRatio,
    jaroWinkler: jaroWinkler, jaroSimilarity: jaroSimilarity,
    shingles: shingles, jaccard: jaccard, cosine: cosine,
    extractTemplates: extractTemplates, namePipeline: namePipeline,
    normalise: normalise, score: score
  };
}));
