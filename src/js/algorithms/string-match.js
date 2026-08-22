/**
 * The naive matcher, the filters people bolt onto it, and the shared shape
 * every other matcher in M15 follows.
 *
 * One interface: `search(text, pattern, options)` returns
 * `{ positions, report }`, where `report` counts *character comparisons* -
 * not iterations, not shifts, not milliseconds. Comparisons are the only
 * currency in which these algorithms can be compared honestly, because they
 * are what each one is trying to avoid and they do not depend on a JIT, a
 * cache or a machine.
 *
 * The naive matcher is here as the oracle rather than as a straw man. It is
 * the reference every other matcher is checked against, and on natural
 * language with a first-character filter it is very hard to beat.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StringMatch = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { comparisons: 0, alignments: 0, shifts: 0, skipped: 0, entered: 0,
      preprocessing: 0, states: 0 };
  }

  /**
   * Every alignment tried, every character compared, left to right. `filter`
   * skips an alignment whose first character cannot match without entering
   * the inner loop - which is what a `memchr`-style scan does in C and what
   * most standard libraries do before escalating to anything cleverer.
   *
   * The filter changes NO comparison count: the check it performs is the same
   * character comparison the inner loop would have made first. What it changes
   * is which loop that comparison happens in, and a specialised byte scan does
   * sixteen of them per instruction where an interpreted inner loop does one.
   * `entered` is therefore the column that moves, and the section says so
   * rather than pretending the comparison count fell.
   */
  function naive(text, pattern, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const positions = [];

    if (pattern.length === 0) return { positions: positions, report: report };

    for (let start = 0; start + pattern.length <= text.length; start += 1) {
      report.alignments += 1;

      if (settings.filter && text[start] !== pattern[0]) {
        report.skipped += 1;
        report.comparisons += 1;
        continue;
      }
      report.entered += 1;
      let i = 0;

      while (i < pattern.length) {
        report.comparisons += 1;

        if (text[start + i] !== pattern[i]) break;
        i += 1;
      }

      if (i < pattern.length) continue;
      positions.push(start);
    }
    return { positions: positions, report: report };
  }

  /**
   * The input that realises the O(nm) bound: a pattern that agrees with the
   * text on every character but the last. `aaaa...ab` in `aaaa...a` forces the
   * inner loop to run to completion at every alignment and find nothing.
   */
  function adversarialFor(length, patternLength) {
    return { text: 'a'.repeat(length), pattern: 'a'.repeat(patternLength - 1) + 'b' };
  }

  /** The same shape with the pattern present exactly once, at the end. */
  function adversarialWithMatch(length, patternLength) {
    const pattern = 'a'.repeat(patternLength - 1) + 'b';

    return { text: 'a'.repeat(Math.max(0, length - patternLength)) + pattern, pattern: pattern };
  }

  /* --------------------------------------------------------------- checks */

  /** Do two matchers agree on the occurrence list? The only check that means
   *  anything, because every matcher here fails by finding *most* of them. */
  function agree(a, b) {
    if (a.length !== b.length) return { agree: false, missing: differenceOf(a, b), extra: differenceOf(b, a) };
    const same = a.every(function (value, i) { return value === b[i]; });

    return { agree: same, missing: differenceOf(a, b), extra: differenceOf(b, a) };
  }

  function differenceOf(a, b) {
    const other = new Set(b);

    return a.filter(function (value) { return !other.has(value); });
  }

  /**
   * Verify each reported position against the text directly, which catches the
   * matcher and the oracle sharing a bug. A position list is not a proof;
   * `text.substr(p, m) === pattern` is.
   */
  function verify(text, pattern, positions) {
    let wrong = 0;

    positions.forEach(function (start) {
      if (text.substr(start, pattern.length) === pattern) return;
      wrong += 1;
    });
    return { wrong: wrong, valid: wrong === 0, count: positions.length };
  }

  return {
    emptyReport: emptyReport, naive: naive,
    adversarialFor: adversarialFor, adversarialWithMatch: adversarialWithMatch,
    agree: agree, verify: verify
  };
}));
