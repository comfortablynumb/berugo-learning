/**
 * Sequence alignment: edit distance, LCS, Hirschberg's linear-space
 * reconstruction, and the two scoring schemes that turn one table into global
 * and local alignment.
 *
 * The section this serves is about *space*, so the memory is measured rather
 * than described. `peakCells` is the largest number of table cells alive at
 * once, and it is the figure that separates the four implementations here
 * while their answers stay identical:
 *
 *   full table        (m + 1)(n + 1)   and the traceback is free
 *   two rows          2(n + 1)         and the traceback is impossible
 *   Hirschberg        2(n + 1)         and the traceback costs 2x the time
 *
 * The middle row is the trap. Dropping to two rows is a three-line change that
 * keeps the distance exactly right and quietly deletes the alignment, so a
 * function that still returns an `alignment` field after the change returns
 * one that is not an alignment of anything. `checkAlignment` is the assertion
 * that catches it: strip the gaps from each row and you must get the inputs
 * back, and every column must be one of the three legal moves.
 *
 * Affine gaps need three tables rather than one, because "am I already inside
 * a gap" is state. With a linear penalty a run of k gaps costs k·g whatever
 * its shape, so the aligner has no reason to keep gaps together, and the
 * alignments it produces are visibly shredded - which is why real aligners do
 * not use it.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DpSequence = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const GAP = '-';

  function emptyReport() {
    return { states: 0, transitions: 0, peakCells: 0, splits: 0, maxDepth: 0 };
  }

  function noteCells(report, cells) {
    report.peakCells = Math.max(report.peakCells, cells);
  }

  function defaultCosts(options) {
    const settings = options || {};
    return {
      substitute: settings.substitute === undefined ? 1 : settings.substitute,
      insert: settings.insert === undefined ? 1 : settings.insert,
      remove: settings.remove === undefined ? 1 : settings.remove,
      transpose: settings.transpose === undefined ? null : settings.transpose
    };
  }

  /* --------------------------------------------------------- edit distance */

  /**
   * The full table. `costs.transpose` being non-null turns this into
   * Damerau-Levenshtein, which is a different distance and not a refinement:
   * "ab" -> "ba" is 2 without it and 1 with, so a caller comparing two
   * distances computed under different settings is comparing nothing.
   */
  function editDistance(a, b, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const costs = defaultCosts(settings.costs);
    const table = [];

    for (let i = 0; i <= a.length; i += 1) {
      table.push(new Array(b.length + 1).fill(0));
      table[i][0] = i * costs.remove;
    }

    for (let j = 0; j <= b.length; j += 1) table[0][j] = j * costs.insert;
    noteCells(report, (a.length + 1) * (b.length + 1));

    for (let i = 1; i <= a.length; i += 1) {
      for (let j = 1; j <= b.length; j += 1) {
        report.states += 1;
        report.transitions += 3;
        const same = a[i - 1] === b[j - 1];
        let best = Math.min(table[i - 1][j] + costs.remove, table[i][j - 1] + costs.insert,
          table[i - 1][j - 1] + (same ? 0 : costs.substitute));

        if (costs.transpose !== null && i > 1 && j > 1 &&
            a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          report.transitions += 1;
          best = Math.min(best, table[i - 2][j - 2] + costs.transpose);
        }
        table[i][j] = best;
      }
    }
    return { distance: table[a.length][b.length], table: table,
      alignment: traceAlignment(a, b, table, costs), report: report };
  }

  /**
   * Walk the table backwards, preferring the diagonal. The preference is not
   * cosmetic: at a tie between a diagonal match and a gap pair, the diagonal
   * is one column and the gaps are two, so a traceback without the preference
   * returns a longer alignment of the same cost.
   */
  function traceAlignment(a, b, table, costs) {
    const top = [];
    const bottom = [];
    let i = a.length;
    let j = b.length;

    while (i > 0 || j > 0) {
      const same = i > 0 && j > 0 && a[i - 1] === b[j - 1];

      if (i > 0 && j > 0 && table[i][j] === table[i - 1][j - 1] + (same ? 0 : costs.substitute)) {
        top.push(a[i - 1]); bottom.push(b[j - 1]); i -= 1; j -= 1;
        continue;
      }

      if (i > 0 && table[i][j] === table[i - 1][j] + costs.remove) {
        top.push(a[i - 1]); bottom.push(GAP); i -= 1;
        continue;
      }
      top.push(GAP); bottom.push(b[j - 1]); j -= 1;
    }
    return { top: top.reverse().join(''), bottom: bottom.reverse().join('') };
  }

  /** The distance in two rows. Correct, and it cannot reconstruct - which is
   *  why it returns no alignment field at all rather than a wrong one. */
  function editDistanceRows(a, b, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const costs = defaultCosts(settings.costs);
    let previous = [];

    for (let j = 0; j <= b.length; j += 1) previous.push(j * costs.insert);
    noteCells(report, 2 * (b.length + 1));

    for (let i = 1; i <= a.length; i += 1) {
      const current = [i * costs.remove];

      for (let j = 1; j <= b.length; j += 1) {
        report.states += 1;
        report.transitions += 3;
        const same = a[i - 1] === b[j - 1];
        current.push(Math.min(previous[j] + costs.remove, current[j - 1] + costs.insert,
          previous[j - 1] + (same ? 0 : costs.substitute)));
      }
      previous = current;
    }
    return { distance: previous[b.length], report: report };
  }

  /* ------------------------------------------------------------ Hirschberg */

  /**
   * The distance of every prefix of `a` against all of `b`, in one row. This
   * is the primitive Hirschberg is built from: run it forwards on the left
   * half and backwards on the right half, and the column minimising the sum is
   * where the optimal alignment crosses the midpoint.
   */
  function lastRow(a, b, costs, report) {
    let previous = [];

    for (let j = 0; j <= b.length; j += 1) previous.push(j * costs.insert);
    noteCells(report, 2 * (b.length + 1));

    for (let i = 1; i <= a.length; i += 1) {
      const current = [i * costs.remove];

      for (let j = 1; j <= b.length; j += 1) {
        report.states += 1;
        report.transitions += 3;
        const same = a[i - 1] === b[j - 1];
        current.push(Math.min(previous[j] + costs.remove, current[j - 1] + costs.insert,
          previous[j - 1] + (same ? 0 : costs.substitute)));
      }
      previous = current;
    }
    return previous;
  }

  function reverse(text) {
    return text.split('').reverse().join('');
  }

  /** The base cases, where the recursion stops and a whole small table is
   *  cheap enough to build. */
  function hirschbergBase(a, b, costs, report) {
    if (a.length === 0) return { top: GAP.repeat(b.length), bottom: b };

    if (b.length === 0) return { top: a, bottom: GAP.repeat(a.length) };
    const full = editDistance(a, b, { costs: costs, report: report });
    return full.alignment;
  }

  function hirschbergSplit(a, b, costs, report, depth) {
    const mid = Math.floor(a.length / 2);
    const forward = lastRow(a.slice(0, mid), b, costs, report);
    const backward = lastRow(reverse(a.slice(mid)), reverse(b), costs, report);
    let bestAt = 0;
    let bestCost = Infinity;

    for (let j = 0; j <= b.length; j += 1) {
      const total = forward[j] + backward[b.length - j];

      if (total >= bestCost) continue;
      bestCost = total;
      bestAt = j;
    }
    report.splits += 1;
    const left = hirschbergAlign(a.slice(0, mid), b.slice(0, bestAt), costs, report, depth + 1);
    const right = hirschbergAlign(a.slice(mid), b.slice(bestAt), costs, report, depth + 1);
    return { top: left.top + right.top, bottom: left.bottom + right.bottom };
  }

  function hirschbergAlign(a, b, costs, report, depth) {
    report.maxDepth = Math.max(report.maxDepth, depth);

    if (a.length <= 1 || b.length === 0) return hirschbergBase(a, b, costs, report);
    return hirschbergSplit(a, b, costs, report, depth);
  }

  /**
   * The public entry. The distance comes from the row version, so the claim
   * "the same answer in linear space" is asserted by construction rather than
   * by recomputing the full table.
   */
  function hirschberg(a, b, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const costs = defaultCosts(settings.costs);
    const alignment = hirschbergAlign(a, b, costs, report, 0);
    return { distance: lastRow(a, b, costs, report)[b.length], alignment: alignment, report: report };
  }

  /* ------------------------------------------------------------------ LCS */

  /** Longest common subsequence, which is edit distance with substitution
   *  forbidden - the connection `git diff` is built on. */
  function longestCommonSubsequence(a, b, options) {
    const report = (options || {}).report || emptyReport();
    const table = [];

    for (let i = 0; i <= a.length; i += 1) table.push(new Array(b.length + 1).fill(0));
    noteCells(report, (a.length + 1) * (b.length + 1));

    for (let i = 1; i <= a.length; i += 1) {
      for (let j = 1; j <= b.length; j += 1) {
        report.states += 1;
        report.transitions += 2;
        table[i][j] = a[i - 1] === b[j - 1] ? table[i - 1][j - 1] + 1
          : Math.max(table[i - 1][j], table[i][j - 1]);
      }
    }

    const out = [];
    let i = a.length;
    let j = b.length;

    while (i > 0 && j > 0) {
      if (a[i - 1] === b[j - 1]) { out.push(a[i - 1]); i -= 1; j -= 1; continue; }

      if (table[i - 1][j] >= table[i][j - 1]) i -= 1; else j -= 1;
    }
    return { length: table[a.length][b.length], sequence: out.reverse().join(''),
      table: table, report: report };
  }

  /** The unified-diff script the LCS implies: the operations `git diff` would
   *  print, which is what makes the connection concrete rather than asserted. */
  function diffScript(a, b) {
    const lcs = longestCommonSubsequence(a, b, {});
    const script = [];
    let i = 0;
    let j = 0;

    lcs.sequence.split('').forEach(function (common) {
      while (a[i] !== common) { script.push({ op: 'remove', value: a[i] }); i += 1; }

      while (b[j] !== common) { script.push({ op: 'add', value: b[j] }); j += 1; }
      script.push({ op: 'keep', value: common });
      i += 1;
      j += 1;
    });

    while (i < a.length) { script.push({ op: 'remove', value: a[i] }); i += 1; }

    while (j < b.length) { script.push({ op: 'add', value: b[j] }); j += 1; }
    return script;
  }

  /* ---------------------------------------------------- scoring alignments */

  const SCORES = { match: 2, mismatch: -1, gapOpen: -3, gapExtend: -1 };

  function scoreOf(options) {
    return Object.assign({}, SCORES, (options || {}).scores || {});
  }

  /**
   * Needleman-Wunsch (global) and Smith-Waterman (local) on one table. The
   * only differences are the initial row/column and whether a cell may fall to
   * zero - and that single `Math.max(0, …)` is what turns "align these two
   * whole strings" into "find the best-matching region", which is a different
   * question with a different answer on the same input.
   */
  function alignScored(a, b, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const scores = scoreOf(settings);
    const local = settings.mode === 'local';
    const table = [];

    for (let i = 0; i <= a.length; i += 1) {
      table.push(new Array(b.length + 1).fill(0));
      table[i][0] = local ? 0 : i * scores.gapExtend;
    }

    for (let j = 0; j <= b.length; j += 1) table[0][j] = local ? 0 : j * scores.gapExtend;
    noteCells(report, (a.length + 1) * (b.length + 1));
    let best = { score: local ? 0 : -Infinity, i: 0, j: 0 };

    for (let i = 1; i <= a.length; i += 1) {
      for (let j = 1; j <= b.length; j += 1) {
        report.states += 1;
        report.transitions += 3;
        const step = a[i - 1] === b[j - 1] ? scores.match : scores.mismatch;
        let value = Math.max(table[i - 1][j - 1] + step, table[i - 1][j] + scores.gapExtend,
          table[i][j - 1] + scores.gapExtend);

        if (local) value = Math.max(0, value);
        table[i][j] = value;

        if (value > best.score) best = { score: value, i: i, j: j };
      }
    }

    if (!local) best = { score: table[a.length][b.length], i: a.length, j: b.length };
    return { score: best.score, at: { i: best.i, j: best.j }, table: table,
      mode: local ? 'local' : 'global', report: report };
  }

  /**
   * Affine gaps: three tables, because "already inside a gap" is state. `M` is
   * "the last column was a pair", `X` is "inside a gap in b", `Y` is "inside a
   * gap in a". Opening costs gapOpen + gapExtend and continuing costs
   * gapExtend, so a run of k costs gapOpen + k·gapExtend rather than k·gap.
   */
  function alignAffine(a, b, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const scores = scoreOf(settings);
    const NEG = -1e9;
    const grid = function () {
      const out = [];

      for (let i = 0; i <= a.length; i += 1) out.push(new Array(b.length + 1).fill(NEG));
      return out;
    };
    const M = grid();
    const X = grid();
    const Y = grid();

    M[0][0] = 0;
    noteCells(report, 3 * (a.length + 1) * (b.length + 1));

    for (let i = 1; i <= a.length; i += 1) X[i][0] = scores.gapOpen + i * scores.gapExtend;

    for (let j = 1; j <= b.length; j += 1) Y[0][j] = scores.gapOpen + j * scores.gapExtend;

    for (let i = 1; i <= a.length; i += 1) {
      for (let j = 1; j <= b.length; j += 1) {
        report.states += 3;
        report.transitions += 7;
        const step = a[i - 1] === b[j - 1] ? scores.match : scores.mismatch;
        M[i][j] = Math.max(M[i - 1][j - 1], X[i - 1][j - 1], Y[i - 1][j - 1]) + step;
        X[i][j] = Math.max(M[i - 1][j] + scores.gapOpen + scores.gapExtend,
          X[i - 1][j] + scores.gapExtend);
        Y[i][j] = Math.max(M[i][j - 1] + scores.gapOpen + scores.gapExtend,
          Y[i][j - 1] + scores.gapExtend);
      }
    }
    return { score: Math.max(M[a.length][b.length], X[a.length][b.length], Y[a.length][b.length]),
      report: report };
  }

  /* ---------------------------------------------------------- the oracles */

  /** Exhaustive edit distance, for strings short enough to recurse without
   *  memoisation. The reference every table above is checked against. */
  function editDistanceBruteForce(a, b) {
    function go(i, j) {
      if (i === a.length) return b.length - j;

      if (j === b.length) return a.length - i;

      if (a[i] === b[j]) return go(i + 1, j + 1);
      return 1 + Math.min(go(i + 1, j), go(i, j + 1), go(i + 1, j + 1));
    }
    return go(0, 0);
  }

  /**
   * Is this a real alignment of these two strings? Strip the gaps from each
   * row and the inputs must come back, the rows must be the same length, and
   * no column may be two gaps. This is the check that catches a traceback
   * walked over a table that no longer exists.
   */
  function checkAlignment(a, b, alignment) {
    const strip = function (row) { return row.split(GAP).join(''); };
    const problems = [];

    if (alignment.top.length !== alignment.bottom.length) problems.push('rows differ in length');

    if (strip(alignment.top) !== a) problems.push('the top row is not the first input');

    if (strip(alignment.bottom) !== b) problems.push('the bottom row is not the second input');

    for (let i = 0; i < alignment.top.length; i += 1) {
      if (alignment.top[i] !== GAP || alignment.bottom[i] !== GAP) continue;
      problems.push('column ' + i + ' is a gap against a gap');
      break;
    }
    return { valid: problems.length === 0, problems: problems, columns: alignment.top.length };
  }

  /** The cost an alignment actually incurs, recomputed from its columns. */
  function alignmentCost(alignment, options) {
    const costs = defaultCosts((options || {}).costs);
    let total = 0;

    for (let i = 0; i < alignment.top.length; i += 1) {
      const top = alignment.top[i];
      const bottom = alignment.bottom[i];

      if (top === GAP) total += costs.insert;
      else if (bottom === GAP) total += costs.remove;
      else if (top !== bottom) total += costs.substitute;
    }
    return total;
  }

  return {
    GAP: GAP, emptyReport: emptyReport, defaultCosts: defaultCosts,
    editDistance: editDistance, editDistanceRows: editDistanceRows,
    editDistanceBruteForce: editDistanceBruteForce,
    hirschberg: hirschberg, lastRow: lastRow,
    longestCommonSubsequence: longestCommonSubsequence, diffScript: diffScript,
    alignScored: alignScored, alignAffine: alignAffine,
    checkAlignment: checkAlignment, alignmentCost: alignmentCost
  };
}));
