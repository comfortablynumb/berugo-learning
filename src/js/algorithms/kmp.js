/**
 * KMP, and the prefix function that is worth more than KMP is.
 *
 * `prefixFunction(s)[i]` is the length of the longest proper border of
 * `s[0..i]` - the longest string that is both a prefix and a suffix of it and
 * is not the whole thing. That one array answers period detection, string
 * powers, occurrence counting of every prefix and minimal rotation, and the
 * matcher is only its most famous consumer.
 *
 * The matcher's distinctive property is that it never moves backwards in the
 * text. On a mismatch it slides the pattern by an amount the border array
 * already knows, and the text index only ever increases - which is why it
 * works on a stream that cannot be rewound.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Kmp = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { comparisons: 0, alignments: 0, shifts: 0, skipped: 0,
      preprocessing: 0, states: 0 };
  }

  /**
   * The border array, in one left-to-right pass. `length` is the border of the
   * previous position; on a mismatch it falls back through the chain of
   * borders-of-borders, which is why the whole thing is linear despite the
   * inner loop: `length` rises at most once per position, so it can fall at
   * most n times in total.
   */
  function prefixFunction(pattern, options) {
    const report = (options || {}).report || emptyReport();
    const border = new Array(pattern.length).fill(0);
    let length = 0;

    for (let i = 1; i < pattern.length; i += 1) {
      while (length > 0 && pattern[i] !== pattern[length]) {
        report.preprocessing += 1;
        length = border[length - 1];
      }
      report.preprocessing += 1;

      if (pattern[i] === pattern[length]) length += 1;
      border[i] = length;
    }
    return border;
  }

  /** The naive O(n²) border array, as the oracle for the linear one. */
  function bordersByBruteForce(pattern) {
    const out = [];

    for (let i = 0; i < pattern.length; i += 1) {
      const prefix = pattern.slice(0, i + 1);
      let best = 0;

      for (let length = i; length >= 1; length -= 1) {
        if (prefix.slice(0, length) !== prefix.slice(prefix.length - length)) continue;
        best = length;
        break;
      }
      out.push(best);
    }
    return out;
  }

  /**
   * The scan. `matched` is how much of the pattern is currently aligned; the
   * text index never decreases, which is the property that separates KMP from
   * every backtracking matcher.
   */
  function search(text, pattern, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const positions = [];

    if (pattern.length === 0) return { positions: positions, report: report, border: [] };
    const border = prefixFunction(pattern, { report: report });
    let matched = 0;

    for (let i = 0; i < text.length; i += 1) {
      while (matched > 0 && text[i] !== pattern[matched]) {
        report.comparisons += 1;
        report.shifts += 1;
        matched = border[matched - 1];
      }
      report.comparisons += 1;

      if (text[i] === pattern[matched]) matched += 1;

      if (matched < pattern.length) continue;
      positions.push(i - pattern.length + 1);
      matched = border[matched - 1];
    }
    report.alignments = text.length;
    return { positions: positions, report: report, border: border };
  }

  /* ------------------------------------------------ what the borders buy */

  /**
   * The smallest period: `n - border[n-1]` is a period of the string, and it
   * is the smallest one. The string is a whole number of repetitions of it
   * exactly when the period divides n.
   */
  function period(pattern) {
    if (pattern.length === 0) return { period: 0, repetitions: 0, exact: true };
    const border = prefixFunction(pattern, {});
    const smallest = pattern.length - border[pattern.length - 1];

    return { period: smallest, exact: pattern.length % smallest === 0,
      repetitions: pattern.length % smallest === 0 ? pattern.length / smallest : 1,
      border: border[pattern.length - 1] };
  }

  /** Every period, by definition, for the oracle. */
  function periodsByBruteForce(pattern) {
    const out = [];

    for (let p = 1; p <= pattern.length; p += 1) {
      let ok = true;

      for (let i = 0; i + p < pattern.length; i += 1) {
        if (pattern[i] === pattern[i + p]) continue;
        ok = false;
        break;
      }

      if (ok) out.push(p);
    }
    return out;
  }

  /**
   * How many times each prefix of the pattern occurs in the pattern itself,
   * which the border array answers by counting backwards along the border
   * chain. A textbook use of the array that has nothing to do with searching.
   */
  function prefixOccurrences(pattern) {
    const n = pattern.length;
    const border = prefixFunction(pattern, {});
    const count = new Array(n + 1).fill(0);

    for (let i = 0; i < n; i += 1) count[border[i]] += 1;

    for (let length = n; length > 0; length -= 1) {
      count[border[length - 1]] += count[length];
    }

    for (let length = 0; length <= n; length += 1) count[length] += 1;
    return count.slice(1);
  }

  /**
   * The automaton view: `next[state][symbol]` is the state after reading that
   * symbol, so matching is one table lookup per character and no fallback loop
   * at all. It costs `|alphabet| x (m + 1)` cells, which is the trade.
   */
  function automaton(pattern, alphabet, options) {
    const report = (options || {}).report || emptyReport();
    const border = prefixFunction(pattern, { report: report });
    const symbols = alphabet.split('');
    const next = [];

    for (let state = 0; state <= pattern.length; state += 1) {
      const row = {};

      symbols.forEach(function (symbol) {
        if (state < pattern.length && symbol === pattern[state]) { row[symbol] = state + 1; return; }
        row[symbol] = state === 0 ? 0 : next[border[state - 1]][symbol];
      });
      next.push(row);
      report.states += 1;
    }
    return { next: next, states: next.length, cells: next.length * symbols.length };
  }

  /** Matching by the automaton: one lookup per character, no inner loop. */
  function searchByAutomaton(text, pattern, table, options) {
    const report = (options || {}).report || emptyReport();
    const positions = [];
    let state = 0;

    for (let i = 0; i < text.length; i += 1) {
      report.comparisons += 1;
      const row = table.next[state];

      state = row[text[i]] === undefined ? 0 : row[text[i]];

      if (state < pattern.length) continue;
      positions.push(i - pattern.length + 1);
    }
    return { positions: positions, report: report };
  }

  return {
    emptyReport: emptyReport,
    prefixFunction: prefixFunction, bordersByBruteForce: bordersByBruteForce,
    search: search, period: period, periodsByBruteForce: periodsByBruteForce,
    prefixOccurrences: prefixOccurrences,
    automaton: automaton, searchByAutomaton: searchByAutomaton
  };
}));
