/**
 * MatchLab - the harness every M15 section drives.
 *
 * One job above all others: run every matcher over the same corpus and report
 * whether they returned the same occurrence list. A matcher fails by finding
 * *most* of the occurrences, and a comparison count next to a wrong answer is
 * worse than no comparison count at all - so `compareMatchers` reports the
 * disagreement as a field, verifies every reported position against the text
 * directly, and only then quotes the work.
 *
 * The corpora are chosen so that the ranking between matchers inverts across
 * them. English is where the naive scan with a first-character filter is hard
 * to beat and Boyer-Moore's skips are largest; DNA has a four-letter alphabet
 * where skipping barely helps; and the adversarial corpus is the input the
 * O(nm) bound is about.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MatchLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function modules() {
    if (typeof module !== 'undefined' && module.exports) {
      return {
        Naive: require('../algorithms/string-match.js'),
        Kmp: require('../algorithms/kmp.js'),
        Z: require('../algorithms/z-algorithm.js'),
        Bm: require('../algorithms/boyer-moore.js'),
        Rk: require('../algorithms/rabin-karp.js'),
        Ac: require('../algorithms/aho-corasick.js'),
        Corpus: require('./text-corpus.js'),
        Random: require('../utils/random.js')
      };
    }
    return { Naive: scope.StringMatch, Kmp: scope.Kmp, Z: scope.ZAlgorithm,
      Bm: scope.BoyerMoore, Rk: scope.RabinKarp, Ac: scope.AhoCorasick,
      Corpus: scope.TextCorpus, Random: scope.Random };
  }

  const CORPORA = ['english', 'source', 'dna', 'logs', 'adversarial', 'binary', 'repeated'];

  /* ------------------------------------------------------------- corpora */

  /**
   * Every corpus is a `{ text, pattern, alphabet, name }` triple, because a
   * matcher's cost is a property of the pair rather than of either half - a
   * pattern that occurs often and one that never occurs behave completely
   * differently on the same text.
   */
  function corpus(name, options) {
    const settings = options || {};
    const M = modules();
    const size = settings.size || 4000;

    if (name === 'source') return sourceCorpus(M, settings);

    if (name === 'dna') return dnaCorpus(M, size, settings);

    if (name === 'logs') return logCorpus(M, settings);

    if (name === 'adversarial') return adversarialCorpus(M, size, settings);

    if (name === 'binary') return binaryCorpus(M, size, settings);

    if (name === 'repeated') return repeatedCorpus(size, settings);
    return englishCorpus(M, size, settings);
  }

  function englishCorpus(M, size, settings) {
    const words = M.Corpus.words();
    let text = '';

    while (text.length < size) text += words[text.length % words.length] + ' ';
    return { name: 'english', text: text.slice(0, size),
      pattern: settings.pattern || 'the', alphabet: alphabetOf(text.slice(0, size)) };
  }

  function sourceCorpus(M, settings) {
    const text = M.Corpus.source();

    return { name: 'source', text: text, pattern: settings.pattern || 'function',
      alphabet: alphabetOf(text) };
  }

  function dnaCorpus(M, size, settings) {
    const text = M.Corpus.dna(size, settings.seed || 1);

    return { name: 'dna', text: text, pattern: settings.pattern || 'GATTACA',
      alphabet: 'ACGT' };
  }

  function logCorpus(M, settings) {
    const lines = M.Corpus.logs(settings.lines || 400);
    const text = lines.join('\n');

    return { name: 'logs', text: text, pattern: settings.pattern || '/api/orders',
      alphabet: alphabetOf(text), lines: lines };
  }

  /** The O(nm) input: every alignment agrees on all but the last character. */
  function adversarialCorpus(M, size, settings) {
    const m = settings.patternLength || 12;
    const built = M.Naive.adversarialFor(size, m);

    return { name: 'adversarial', text: built.text, pattern: built.pattern, alphabet: 'ab' };
  }

  function binaryCorpus(M, size, settings) {
    const random = M.Random.seeded(settings.seed || 1);
    let text = '';

    for (let i = 0; i < size; i += 1) text += random.int(2) === 0 ? '0' : '1';
    return { name: 'binary', text: text, pattern: settings.pattern || '0101010101',
      alphabet: '01' };
  }

  /** A single repeated character: the case where the pattern occurs at nearly
   *  every position, so the match handling rather than the skip decides. */
  function repeatedCorpus(size, settings) {
    return { name: 'repeated', text: 'a'.repeat(size),
      pattern: settings.pattern || 'aaaa', alphabet: 'a' };
  }

  function alphabetOf(text) {
    return Array.from(new Set(text.split(''))).sort().join('');
  }

  /* ------------------------------------------------------------- matchers */

  const MATCHERS = [
    { key: 'naive', name: 'naive — every alignment, left to right' },
    { key: 'naive-filter', name: 'naive with a first-character filter' },
    { key: 'kmp', name: 'KMP — the border array' },
    { key: 'z', name: 'Z-algorithm — concatenate and scan' },
    { key: 'boyer-moore', name: 'Boyer-Moore — both rules' },
    { key: 'horspool', name: 'Horspool — bad character only' },
    { key: 'sunday', name: 'Sunday — the character past the window' },
    { key: 'rabin-karp', name: 'Rabin-Karp — rolling hash' }
  ];

  function runMatcher(key, text, pattern) {
    const M = modules();

    if (key === 'naive-filter') return M.Naive.naive(text, pattern, { filter: true });

    if (key === 'kmp') return M.Kmp.search(text, pattern, {});

    if (key === 'z') return M.Z.search(text, pattern, {});

    if (key === 'boyer-moore') return M.Bm.search(text, pattern, {});

    if (key === 'horspool') return M.Bm.horspool(text, pattern, {});

    if (key === 'sunday') return M.Bm.sunday(text, pattern, {});

    if (key === 'rabin-karp') return M.Rk.search(text, pattern, {});
    return M.Naive.naive(text, pattern, {});
  }

  /**
   * Every matcher on one corpus. `agree` is the field that matters; the work
   * columns are only meaningful once it is true, and the note in every section
   * that quotes them says so.
   */
  function compareMatchers(instance, options) {
    const settings = options || {};
    const M = modules();
    const text = instance.text;
    const pattern = settings.pattern || instance.pattern;
    const truth = M.Naive.naive(text, pattern, {}).positions;
    const rows = MATCHERS.map(function (entry) {
      const run = runMatcher(entry.key, text, pattern);
      const check = M.Naive.agree(run.positions, truth);

      /* Rabin-Karp's character comparisons only happen on a hash hit, so
         quoting them beside a scanning matcher's is a category error. `work`
         adds the per-position operations each algorithm actually performs. */
      const work = (run.report.comparisons || 0) + (run.report.rolls || 0);

      return { key: entry.key, name: entry.name, positions: run.positions,
        report: run.report, work: work, agree: check.agree, missing: check.missing.length,
        extra: check.extra.length,
        valid: M.Naive.verify(text, pattern, run.positions).valid };
    });

    return { rows: rows, truth: truth, occurrences: truth.length,
      text: text, pattern: pattern, name: instance.name,
      disagreements: rows.filter(function (row) { return !row.agree; }).length,
      best: rows.slice().sort(function (a, b) { return a.work - b.work; })[0] };
  }

  /**
   * Comparisons per text character as the pattern grows. Boyer-Moore is the
   * only row that FALLS, and that is the section's whole claim - so it is a
   * table rather than a sentence.
   */
  function lengthSweep(instance, options) {
    const settings = options || {};
    const lengths = settings.lengths || [2, 4, 8, 16, 32];
    const text = instance.text;

    return lengths.map(function (m) {
      const pattern = settings.pattern
        ? settings.pattern.slice(0, m) : text.substr(settings.from || 100, m);
      const run = compareMatchers({ text: text, pattern: pattern, name: instance.name }, {});
      const rates = {};

      run.rows.forEach(function (row) { rates[row.key] = row.work / text.length; });
      return { length: m, pattern: pattern, occurrences: run.occurrences, rates: rates,
        agree: run.disagreements === 0 };
    });
  }

  /** Which Boyer-Moore rule decided each shift, and what each is worth alone. */
  function ruleSweep(instance, options) {
    const M = modules();
    const settings = options || {};
    const pattern = settings.pattern || instance.pattern;

    return ['both', 'bad-character', 'good-suffix'].map(function (rules) {
      const run = M.Bm.search(instance.text, pattern, { rules: rules });

      return { rules: rules, comparisons: run.report.comparisons,
        alignments: run.report.alignments, shifts: run.report.shifts,
        badWins: run.report.badCharacterWins, goodWins: run.report.goodSuffixWins,
        ties: run.report.ties, found: run.positions.length };
    });
  }

  /* -------------------------------------------------------- multi-pattern */

  /**
   * Aho-Corasick against running the naive matcher once per pattern. The
   * saving is the whole point of the automaton, and it grows with the pattern
   * count while the automaton's cost does not.
   */
  function multiRun(instance, options) {
    const M = modules();
    const settings = options || {};
    const patterns = settings.patterns || defaultPatterns(instance);
    const automaton = M.Ac.build(patterns, { outputLinks: settings.outputLinks !== false });
    const run = M.Ac.search(automaton, instance.text, {});
    const truth = M.Ac.bruteForce(patterns, instance.text);
    let separate = 0;

    patterns.forEach(function (pattern) {
      separate += M.Naive.naive(instance.text, pattern, {}).report.comparisons;
    });
    return { automaton: automaton, matches: run.matches, truth: truth,
      compare: M.Ac.compare(run.matches, truth),
      patterns: patterns, states: automaton.report.states,
      comparisons: run.report.comparisons, separate: separate,
      saving: separate / Math.max(1, run.report.comparisons),
      failureFollows: run.report.failureFollows, outputFollows: run.report.outputFollows };
  }

  function defaultPatterns(instance) {
    if (instance.name === 'dna') return ['GAT', 'TAC', 'ACA', 'GATTACA', 'TA'];

    if (instance.name === 'logs') return ['GET', 'POST', '200', '500', '/api'];
    return ['he', 'she', 'his', 'hers', 'her'];
  }

  /**
   * How the saving scales with the pattern count. One automaton pass is one
   * pass whatever the set size; running the naive matcher once per pattern is
   * linear in the set.
   */
  function patternCountSweep(instance, options) {
    const settings = options || {};
    const pool = settings.pool || wordsFrom(instance.text, 64);

    return (settings.counts || [1, 2, 4, 8, 16, 32]).map(function (count) {
      const run = multiRun(instance, { patterns: pool.slice(0, count) });

      return { count: count, states: run.states, comparisons: run.comparisons,
        separate: run.separate, saving: run.saving, matches: run.matches.length,
        agree: run.compare.agree };
    });
  }

  function wordsFrom(text, count) {
    const seen = [];
    const words = text.split(/[^A-Za-z]+/).filter(function (w) { return w.length >= 3; });

    words.forEach(function (word) {
      if (seen.length >= count || seen.indexOf(word) !== -1) return;
      seen.push(word);
    });
    return seen;
  }

  return {
    CORPORA: CORPORA, MATCHERS: MATCHERS, modules: modules,
    corpus: corpus, runMatcher: runMatcher, compareMatchers: compareMatchers,
    lengthSweep: lengthSweep, ruleSweep: ruleSweep,
    multiRun: multiRun, patternCountSweep: patternCountSweep, alphabetOf: alphabetOf
  };
}));
