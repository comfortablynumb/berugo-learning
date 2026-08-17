/**
 * The inverted index: term to sorted list of document ids, plus the encoding
 * and intersection machinery that decides what a query costs.
 *
 * The data structure is trivial and the engineering is not. Three things
 * dominate a query, and all three are here so they can be measured against
 * each other rather than asserted:
 *
 *   - **Intersection.** `linear` walks both lists in step. `skip` uses skip
 *     pointers every √n entries to jump over runs that cannot match.
 *     `galloping` probes exponentially ahead then binary-searches the bracket,
 *     which is O(m log(n/m)) for lists of very different lengths - the shape a
 *     real query has, where one term is rare and one is common.
 *   - **Compression.** Postings are gaps, not ids, and the gaps are small, so
 *     `varbyte` stores most of them in one byte. The measurement that matters
 *     is bits per posting, and it moves with the document count and the term's
 *     frequency, not with the encoder alone.
 *   - **Positions.** A phrase query needs positions, which roughly triples the
 *     index and is the reason phrase search is a feature you enable rather
 *     than one you always have.
 *
 * Construction is a single in-memory pass here. `mergeRuns` shows the external
 * shape: sort each block, spill it, then k-way merge - which is how an index
 * larger than memory is actually built.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.InvertedIndex = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const STRATEGIES = ['linear', 'skip', 'galloping'];

  function newStats() {
    return { comparisons: 0, probes: 0, skipsTaken: 0, postingsVisited: 0, queries: 0, documents: 0, tokens: 0 };
  }

  /** Lowercase alphanumeric runs. Deliberately simple: tokenisation is a
   *  language problem, and pretending otherwise inside a data-structures
   *  section hides where the real difficulty is. */
  function tokenize(text) {
    return text.toLowerCase().split(/[^a-z0-9]+/).filter(function (token) { return token.length > 0; });
  }

  /* ------------------------------------------------------- compression */

  /** Gaps between consecutive ids. The first gap is the id itself. */
  function toGaps(list) {
    const gaps = [];
    let previous = 0;
    list.forEach(function (id) { gaps.push(id - previous); previous = id; });
    return gaps;
  }

  function fromGaps(gaps) {
    const list = [];
    let running = 0;
    gaps.forEach(function (gap) { running += gap; list.push(running); });
    return list;
  }

  /** Variable-byte: seven bits of payload per byte, the top bit a
   *  continuation flag. One byte covers gaps up to 127, which on a dense
   *  posting list is nearly all of them. */
  function varbyteBytes(gaps) {
    return gaps.reduce(function (total, gap) {
      let value = gap;
      let bytes = 1;
      while (value > 127) { value = Math.floor(value / 128); bytes += 1; }
      return total + bytes;
    }, 0);
  }

  /** Simple-9's idea, measured rather than implemented: pack as many equal-width
   *  values into a 32-bit word as fit, 4 bits of selector. The cost is the
   *  number of words, and the width is set by the largest gap in the block. */
  function simple9Words(gaps) {
    const PLANS = [[1, 28], [2, 14], [3, 9], [4, 7], [5, 5], [7, 4], [9, 3], [14, 2], [28, 1]];
    let at = 0;
    let words = 0;

    while (at < gaps.length) {
      let chosen = PLANS[PLANS.length - 1];
      for (let p = 0; p < PLANS.length; p += 1) {
        const width = PLANS[p][0];
        const count = PLANS[p][1];
        const limit = Math.pow(2, width) - 1;
        let fits = 0;
        while (fits < count && at + fits < gaps.length && gaps[at + fits] <= limit) fits += 1;
        if (fits === count || at + fits >= gaps.length) { chosen = PLANS[p]; break; }
      }
      at += Math.min(chosen[1], gaps.length - at);
      words += 1;
    }
    return words;
  }

  /* ------------------------------------------------------ intersection */

  function linearIntersect(a, b, stats) {
    const out = [];
    let i = 0;
    let j = 0;

    while (i < a.length && j < b.length) {
      stats.comparisons += 1;
      stats.postingsVisited += 2;
      if (a[i] === b[j]) { out.push(a[i]); i += 1; j += 1; continue; }
      if (a[i] < b[j]) i += 1;
      else j += 1;
    }
    return out;
  }

  /** Skip pointers every √n entries: from position `at`, jump while the entry
   *  a stride ahead is still below the target. */
  function skipIntersect(a, b, stats) {
    const strideA = Math.max(1, Math.floor(Math.sqrt(a.length)));
    const strideB = Math.max(1, Math.floor(Math.sqrt(b.length)));
    const out = [];
    let i = 0;
    let j = 0;

    const advance = function (list, at, target, stride) {
      let cursor = at;
      while (cursor + stride < list.length && list[cursor + stride] <= target) {
        stats.skipsTaken += 1;
        stats.comparisons += 1;
        cursor += stride;
      }
      while (cursor < list.length && list[cursor] < target) {
        stats.comparisons += 1;
        stats.postingsVisited += 1;
        cursor += 1;
      }
      return cursor;
    };

    while (i < a.length && j < b.length) {
      stats.comparisons += 1;
      if (a[i] === b[j]) { out.push(a[i]); i += 1; j += 1; continue; }
      if (a[i] < b[j]) i = advance(a, i, b[j], strideA);
      else j = advance(b, j, a[i], strideB);
    }
    return out;
  }

  /** Galloping: from the shorter list, probe 1, 2, 4, 8 … ahead in the longer
   *  one until the target is bracketed, then binary-search the bracket. */
  function gallopingIntersect(a, b, stats) {
    const short = a.length <= b.length ? a : b;
    const long = a.length <= b.length ? b : a;
    const out = [];
    let at = 0;

    short.forEach(function (target) {
      if (at >= long.length) return;

      let step = 1;
      let low = at;
      stats.probes += 1;
      stats.comparisons += 1;

      while (low + step < long.length && long[low + step] < target) {
        stats.probes += 1;
        stats.comparisons += 1;
        low += step;
        step *= 2;
      }

      let high = Math.min(low + step, long.length - 1);
      while (low <= high) {
        const mid = (low + high) >> 1;
        stats.comparisons += 1;
        stats.postingsVisited += 1;
        if (long[mid] === target) { out.push(target); low = mid + 1; break; }
        if (long[mid] < target) low = mid + 1;
        else high = mid - 1;
      }
      at = low;
    });
    return out.sort(function (x, y) { return x - y; });
  }

  function intersect(a, b, strategy, stats) {
    if (strategy === 'skip') return skipIntersect(a, b, stats);
    if (strategy === 'galloping') return gallopingIntersect(a, b, stats);
    return linearIntersect(a, b, stats);
  }

  /* -------------------------------------------------------------- index */

  function create(options) {
    const settings = options || {};
    const withPositions = settings.positions !== false;
    let stats = newStats();

    const postings = new Map();
    const positions = new Map();
    const lengths = [];
    let documents = 0;

    function add(text) {
      const id = documents;
      documents += 1;
      stats.documents += 1;

      const tokens = tokenize(text);
      lengths.push(tokens.length);
      stats.tokens += tokens.length;

      const seen = new Set();
      tokens.forEach(function (term, at) {
        if (!postings.has(term)) { postings.set(term, []); positions.set(term, new Map()); }
        if (!seen.has(term)) { postings.get(term).push(id); seen.add(term); }
        if (withPositions) {
          const perDoc = positions.get(term);
          if (!perDoc.has(id)) perDoc.set(id, []);
          perDoc.get(id).push(at);
        }
      });
      return id;
    }

    function addAll(list) {
      list.forEach(add);
    }

    function lookup(term) {
      return postings.get(term) || [];
    }

    /** Every document holding all the terms. The lists are intersected shortest
     *  first, which is the one optimisation that matters most and costs
     *  nothing: the result can only shrink. */
    function search(query, strategy) {
      stats.queries += 1;
      const terms = tokenize(query);
      if (!terms.length) return [];

      const lists = terms.map(lookup).sort(function (a, b) { return a.length - b.length; });
      if (lists.some(function (list) { return !list.length; })) return [];

      let result = lists[0];
      for (let i = 1; i < lists.length; i += 1) {
        result = intersect(result, lists[i], strategy || 'linear', stats);
        if (!result.length) return [];
      }
      return result;
    }

    /** A phrase: intersect the documents, then require the positions to be
     *  consecutive. Without positions this is not answerable at all. */
    function phrase(query, strategy) {
      if (!withPositions) throw new Error('inverted-index: this index carries no positions');
      const terms = tokenize(query);
      if (!terms.length) return [];

      const candidates = search(query, strategy);
      return candidates.filter(function (id) {
        const first = positions.get(terms[0]).get(id) || [];
        return first.some(function (start) {
          return terms.every(function (term, offset) {
            const at = positions.get(term).get(id) || [];
            return at.indexOf(start + offset) !== -1;
          });
        });
      });
    }

    /** Postings-list size under each encoding, for the compression column. */
    function encodingReport() {
      let raw = 0;
      let varbyte = 0;
      let simple9 = 0;
      let entries = 0;

      postings.forEach(function (list) {
        const gaps = toGaps(list);
        entries += list.length;
        raw += list.length * 4;
        varbyte += varbyteBytes(gaps);
        simple9 += simple9Words(gaps) * 4;
      });

      return {
        entries: entries,
        rawBytes: raw,
        varbyteBytes: varbyte,
        simple9Bytes: simple9,
        rawBitsPerPosting: entries ? 32 : 0,
        varbyteBitsPerPosting: entries ? varbyte * 8 / entries : 0,
        simple9BitsPerPosting: entries ? simple9 * 8 / entries : 0
      };
    }

    function positionBytes() {
      let total = 0;
      positions.forEach(function (perDoc) {
        perDoc.forEach(function (list) { total += varbyteBytes(toGaps(list)); });
      });
      return total;
    }

    function checkInvariants() {
      const errors = [];

      postings.forEach(function (list, term) {
        for (let i = 1; i < list.length; i += 1) {
          if (list[i] <= list[i - 1]) {
            errors.push('the postings for "' + term + '" are not strictly increasing at ' + i);
            break;
          }
        }
        if (withPositions) {
          const perDoc = positions.get(term);
          list.forEach(function (id) {
            if (!perDoc.has(id)) errors.push('"' + term + '" is in document ' + id + ' with no positions');
          });
        }
      });
      return { ok: errors.length === 0, errors: errors.slice(0, 5) };
    }

    return {
      name: 'inverted-index',
      add: add,
      addAll: addAll,
      lookup: lookup,
      search: search,
      phrase: phrase,
      terms: function () { return Array.from(postings.keys()).sort(); },
      vocabulary: function () { return postings.size; },
      documents: function () { return documents; },
      averageLength: function () {
        return documents ? lengths.reduce(function (a, b) { return a + b; }, 0) / documents : 0;
      },
      encodingReport: encodingReport,
      positionBytes: positionBytes,
      checkInvariants: checkInvariants,
      stats: function () { return Object.assign({ vocabulary: postings.size }, stats); },
      resetStats: function () { stats = newStats(); }
    };
  }

  /** External construction, in the shape it really has: sort each block that
   *  fits in memory, spill it, then k-way merge the runs. What is returned is
   *  the merged term-document pairs plus the counters that make the cost
   *  visible - one pass over the input, one over each run. */
  function mergeRuns(documents, blockSize) {
    const runs = [];
    let pairs = 0;

    for (let start = 0; start < documents.length; start += blockSize) {
      const block = [];
      documents.slice(start, start + blockSize).forEach(function (text, offset) {
        tokenize(text).forEach(function (term) { block.push([term, start + offset]); });
      });
      block.sort(function (a, b) { return a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : a[1] - b[1]); });
      pairs += block.length;
      runs.push(block);
    }

    const cursors = runs.map(function () { return 0; });
    const merged = [];
    let comparisons = 0;

    for (;;) {
      let best = -1;
      for (let r = 0; r < runs.length; r += 1) {
        if (cursors[r] >= runs[r].length) continue;
        if (best === -1) { best = r; continue; }
        comparisons += 1;
        const a = runs[r][cursors[r]];
        const b = runs[best][cursors[best]];
        if (a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])) best = r;
      }
      if (best === -1) break;
      merged.push(runs[best][cursors[best]]);
      cursors[best] += 1;
    }

    return { runs: runs.length, pairs: pairs, merged: merged, comparisons: comparisons };
  }

  return {
    create: create,
    tokenize: tokenize,
    toGaps: toGaps,
    fromGaps: fromGaps,
    varbyteBytes: varbyteBytes,
    simple9Words: simple9Words,
    intersect: intersect,
    linearIntersect: linearIntersect,
    skipIntersect: skipIntersect,
    gallopingIntersect: gallopingIntersect,
    mergeRuns: mergeRuns,
    newStats: newStats,
    STRATEGIES: STRATEGIES
  };
}));
