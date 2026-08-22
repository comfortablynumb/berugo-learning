/**
 * Boyer-Moore, and the only matcher that gets faster as the pattern grows.
 *
 * Every other algorithm in this milestone scans left to right and can at best
 * look at each text character once. Boyer-Moore compares the pattern's LAST
 * character first, and a mismatch there licenses a jump of up to m positions -
 * so the longer the pattern, the more text it never looks at. On English at
 * m = 20 it examines well under one character per text position, which is
 * sublinear and is why a long search term feels instant.
 *
 * The two rules are kept separately switchable because the interesting
 * measurement is not "Boyer-Moore is fast" but which rule is doing the work,
 * and on natural language the answer is almost entirely the bad-character rule.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BoyerMoore = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { comparisons: 0, alignments: 0, shifts: 0, skipped: 0,
      preprocessing: 0, states: 0, badCharacterWins: 0, goodSuffixWins: 0, ties: 0 };
  }

  /**
   * The last occurrence of each character in the pattern. On a mismatch at
   * pattern position j against text character c, the pattern may slide so that
   * the rightmost c in the pattern lines up - or past the mismatch entirely if
   * c is absent, which is the case that produces the big jumps.
   */
  function badCharacterTable(pattern, options) {
    const report = (options || {}).report || emptyReport();
    const last = {};

    for (let i = 0; i < pattern.length; i += 1) {
      last[pattern[i]] = i;
      report.preprocessing += 1;
    }
    return last;
  }

  /**
   * The good-suffix rule, in the standard two-pass form. `shift[j]` is how far
   * to slide when the pattern matched from position j+1 rightwards and failed
   * at j. The first pass handles a re-occurrence of the matched suffix; the
   * second handles the case where only a prefix of the pattern survives, which
   * is the half people leave out and the reason their implementation is
   * quietly wrong on periodic patterns.
   */
  function goodSuffixTable(pattern, options) {
    const report = (options || {}).report || emptyReport();
    const m = pattern.length;
    const shift = new Array(m + 1).fill(0);
    const border = new Array(m + 1).fill(0);
    let i = m;
    let j = m + 1;

    border[i] = j;

    while (i > 0) {
      while (j <= m && pattern[i - 1] !== pattern[j - 1]) {
        report.preprocessing += 1;

        if (shift[j] === 0) shift[j] = j - i;
        j = border[j];
      }
      report.preprocessing += 1;
      i -= 1;
      j -= 1;
      border[i] = j;
    }
    j = border[0];

    for (let k = 0; k <= m; k += 1) {
      if (shift[k] === 0) shift[k] = j;

      if (k !== j) continue;
      j = border[j];
    }
    return shift;
  }

  /**
   * The scan, right to left within each alignment. `rules` selects which of
   * the two shifts is consulted, so the demo can price them separately - with
   * both, the shift is the larger of the two, and the report records which one
   * decided it.
   */
  function search(text, pattern, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const rules = settings.rules || 'both';
    const positions = [];

    if (pattern.length === 0) return { positions: positions, report: report };
    const bad = badCharacterTable(pattern, { report: report });
    const good = rules === 'bad-character' ? null : goodSuffixTable(pattern, { report: report });
    const m = pattern.length;
    let start = 0;

    while (start + m <= text.length) {
      report.alignments += 1;
      let j = m - 1;

      while (j >= 0) {
        report.comparisons += 1;

        if (text[start + j] !== pattern[j]) break;
        j -= 1;
      }

      if (j < 0) {
        positions.push(start);
        start += good ? good[0] : 1;
        report.shifts += 1;
        continue;
      }
      start += shiftFor({ bad: bad, good: good, rules: rules, report: report },
        text[start + j], j, m);
      report.shifts += 1;
    }
    return { positions: positions, report: report, bad: bad, good: good };
  }

  /** The larger of the two shifts, with the winner recorded. */
  function shiftFor(tables, symbol, j, m) {
    const last = tables.bad[symbol] === undefined ? -1 : tables.bad[symbol];
    const badShift = Math.max(1, j - last);
    const goodShift = tables.good ? tables.good[j + 1] : 1;

    if (tables.rules === 'bad-character') return badShift;

    if (tables.rules === 'good-suffix') return Math.max(1, goodShift);

    if (badShift > goodShift) tables.report.badCharacterWins += 1;
    else if (goodShift > badShift) tables.report.goodSuffixWins += 1;
    else tables.report.ties += 1;
    return Math.max(badShift, goodShift, 1);
  }

  /**
   * Horspool: the bad-character rule keyed on the text character *aligned with
   * the pattern's last position*, whatever the mismatch was. One table, no
   * good-suffix pass, and in practice within a few per cent of full
   * Boyer-Moore on natural language.
   */
  function horspool(text, pattern, options) {
    const report = (options || {}).report || emptyReport();
    const positions = [];

    if (pattern.length === 0) return { positions: positions, report: report };
    const m = pattern.length;
    const shift = {};

    for (let i = 0; i < m - 1; i += 1) {
      shift[pattern[i]] = m - 1 - i;
      report.preprocessing += 1;
    }
    let start = 0;

    while (start + m <= text.length) {
      report.alignments += 1;
      let j = m - 1;

      while (j >= 0) {
        report.comparisons += 1;

        if (text[start + j] !== pattern[j]) break;
        j -= 1;
      }

      if (j < 0) positions.push(start);
      const symbol = text[start + m - 1];

      start += shift[symbol] === undefined ? m : shift[symbol];
      report.shifts += 1;
    }
    return { positions: positions, report: report };
  }

  /**
   * Sunday: look at the character just PAST the current alignment, which can
   * be shifted by up to m + 1 rather than m. Shorter code than Horspool and
   * usually a little better, at the cost of touching one character outside the
   * window.
   */
  function sunday(text, pattern, options) {
    const report = (options || {}).report || emptyReport();
    const positions = [];

    if (pattern.length === 0) return { positions: positions, report: report };
    const m = pattern.length;
    const shift = {};

    for (let i = 0; i < m; i += 1) {
      shift[pattern[i]] = m - i;
      report.preprocessing += 1;
    }
    let start = 0;

    while (start + m <= text.length) {
      report.alignments += 1;
      let j = 0;

      while (j < m) {
        report.comparisons += 1;

        if (text[start + j] !== pattern[j]) break;
        j += 1;
      }

      if (j === m) positions.push(start);
      const beyond = text[start + m];

      start += beyond === undefined || shift[beyond] === undefined ? m + 1 : shift[beyond];
      report.shifts += 1;
    }
    return { positions: positions, report: report };
  }

  return {
    emptyReport: emptyReport,
    badCharacterTable: badCharacterTable, goodSuffixTable: goodSuffixTable,
    search: search, horspool: horspool, sunday: sunday
  };
}));
