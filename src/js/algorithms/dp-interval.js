/**
 * Interval DP - the family whose evaluation order is the difficulty, and the
 * family where an optimisation with an unchecked precondition gives a fast
 * wrong answer.
 *
 * The order is "by increasing interval length", and the reason is that
 * `best[i][j]` depends on strictly shorter intervals; iterating i and j in the
 * natural nested order reads cells that have not been written and produces a
 * plausible number from zeros. `evaluationOrder()` returns the (i, j) pairs in
 * the order they are settled, so a section can show the diagonal sweep rather
 * than assert it.
 *
 * **Knuth's optimisation is the point of this file.** It narrows the split
 * search at [i, j] to `[opt[i][j-1], opt[i+1][j]]`, taking O(n³) to O(n²) -
 * but only if the cost function satisfies the quadrangle inequality. When it
 * does not, the narrowed range can exclude the true optimum and the result is
 * a *smaller number of iterations and a wrong optimum*, with nothing raised.
 * So `checkQuadrangle` is a real test that runs over the actual cost function,
 * `knuthOptimalBst` refuses to run when it fails, and the demo can point at a
 * cost function where it fails and show the two answers diverging.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DpInterval = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { states: 0, transitions: 0, splitTests: 0, peakCells: 0, narrowed: false };
  }

  function square(n, fill) {
    const out = [];

    for (let i = 0; i < n; i += 1) out.push(new Array(n).fill(fill));
    return out;
  }

  /**
   * The order the cells are settled in, as data. Length 2 first, then 3, and
   * so on - which is exactly the sweep a table view animates.
   */
  function evaluationOrder(n) {
    const order = [];

    for (let length = 2; length <= n; length += 1) {
      for (let i = 0; i + length - 1 < n; i += 1) order.push({ i: i, j: i + length - 1, length: length });
    }
    return order;
  }

  /* ------------------------------------------------------- matrix chain */

  /**
   * Matrix-chain multiplication over dimensions `[d0, d1, … dn]`, so matrix k
   * is d[k] x d[k+1]. `split[i][j]` is kept so the parenthesisation comes
   * back, because the scalar count alone does not say which order to use and
   * the order is the answer a caller wants.
   */
  function matrixChain(dimensions, options) {
    const report = (options || {}).report || emptyReport();
    const n = dimensions.length - 1;
    const best = square(n, 0);
    const split = square(n, -1);

    report.peakCells = 2 * n * n;
    evaluationOrder(n).forEach(function (cell) {
      report.states += 1;
      best[cell.i][cell.j] = Infinity;

      for (let k = cell.i; k < cell.j; k += 1) {
        report.transitions += 1;
        report.splitTests += 1;
        const cost = best[cell.i][k] + best[k + 1][cell.j] +
          dimensions[cell.i] * dimensions[k + 1] * dimensions[cell.j + 1];

        if (cost >= best[cell.i][cell.j]) continue;
        best[cell.i][cell.j] = cost;
        split[cell.i][cell.j] = k;
      }
    });
    return { cost: n === 0 ? 0 : best[0][n - 1], table: best, split: split,
      parenthesisation: parenthesise(split, 0, n - 1), report: report };
  }

  function parenthesise(split, i, j) {
    if (i > j) return '';

    if (i === j) return 'M' + i;
    return '(' + parenthesise(split, i, split[i][j]) + ' ' +
      parenthesise(split, split[i][j] + 1, j) + ')';
  }

  /** Every parenthesisation, for chains short enough to enumerate. The
   *  reference: a matrix-chain bug returns a plausible scalar count. */
  function matrixChainBruteForce(dimensions) {
    const n = dimensions.length - 1;

    function go(i, j) {
      if (i === j) return 0;
      let best = Infinity;

      for (let k = i; k < j; k += 1) {
        best = Math.min(best, go(i, k) + go(k + 1, j) +
          dimensions[i] * dimensions[k + 1] * dimensions[j + 1]);
      }
      return best;
    }
    return n === 0 ? 0 : go(0, n - 1);
  }

  /* ---------------------------------------------------- optimal BST */

  function prefixSums(weights) {
    const sums = [0];

    weights.forEach(function (weight, i) { sums.push(sums[i] + weight); });
    return sums;
  }

  /**
   * The unoptimised O(n³) optimal binary search tree: every split tested at
   * every interval. `splitTests` is the figure Knuth's version is measured
   * against.
   */
  function optimalBst(weights, options) {
    const report = (options || {}).report || emptyReport();
    const n = weights.length;
    const sums = prefixSums(weights);
    const best = square(n + 1, 0);
    const root = square(n + 1, -1);

    report.peakCells = 2 * (n + 1) * (n + 1);

    for (let i = 0; i < n; i += 1) { best[i][i] = weights[i]; root[i][i] = i; }

    for (let length = 2; length <= n; length += 1) {
      for (let i = 0; i + length - 1 < n; i += 1) {
        const j = i + length - 1;
        report.states += 1;
        settleInterval({ best: best, root: root, sums: sums, report: report },
          i, j, { from: i, to: j });
      }
    }
    return { cost: n === 0 ? 0 : best[0][n - 1], table: best, root: root, report: report };
  }

  /** One interval of the optimal-BST recurrence, with the split range handed
   *  in - which is the single line Knuth's optimisation changes. */
  function settleInterval(context, i, j, range) {
    const weight = context.sums[j + 1] - context.sums[i];
    let bestCost = Infinity;
    let bestRoot = range.from;

    for (let r = range.from; r <= range.to; r += 1) {
      context.report.transitions += 1;
      context.report.splitTests += 1;
      const left = r > i ? context.best[i][r - 1] : 0;
      const right = r < j ? context.best[r + 1][j] : 0;

      if (left + right >= bestCost) continue;
      bestCost = left + right;
      bestRoot = r;
    }
    context.best[i][j] = bestCost + weight;
    context.root[i][j] = bestRoot;
  }

  /**
   * The same recurrence with the split range narrowed to
   * `[root[i][j-1], root[i+1][j]]`. Refuses to run unless the quadrangle
   * inequality holds, because the failure mode is a wrong answer rather than
   * an error - and a fast wrong answer is the worst kind.
   */
  function knuthOptimalBst(weights, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const check = checkQuadrangle(weights);

    if (!check.holds && !settings.force) {
      return { cost: null, refused: true, quadrangle: check, report: report };
    }
    const n = weights.length;
    const sums = prefixSums(weights);
    const best = square(n + 1, 0);
    const root = square(n + 1, -1);

    report.peakCells = 2 * (n + 1) * (n + 1);
    report.narrowed = true;

    for (let i = 0; i < n; i += 1) { best[i][i] = weights[i]; root[i][i] = i; }

    for (let length = 2; length <= n; length += 1) {
      for (let i = 0; i + length - 1 < n; i += 1) {
        const j = i + length - 1;
        report.states += 1;
        settleInterval({ best: best, root: root, sums: sums, report: report }, i, j,
          { from: root[i][j - 1], to: root[i + 1][j] });
      }
    }
    return { cost: n === 0 ? 0 : best[0][n - 1], table: best, root: root,
      refused: false, quadrangle: check, report: report };
  }

  /**
   * The precondition, tested rather than assumed: for the interval weight
   * `w(i, j)`, the quadrangle inequality is
   * `w(a, c) + w(b, d) <= w(a, d) + w(b, c)` for `a <= b <= c <= d`, plus
   * monotonicity on nested intervals. Non-negative weights satisfy both, so
   * the interesting call is with a weight that can go negative.
   *
   * **The tolerance is not optional.** `w(i, j)` is a difference of prefix
   * sums, so a weight set of nine two-decimal probabilities violates the
   * inequality by 1.11e-16 - and an exact `<=` therefore rejects the textbook
   * instance Knuth's optimisation was written for. The tolerance scales with
   * the total weight, because the error does.
   */
  function checkQuadrangle(weights, options) {
    const sums = prefixSums(weights);
    const w = function (i, j) { return sums[j + 1] - sums[i]; };
    const n = weights.length;
    const total = Math.abs(sums[n]);
    const epsilon = (options || {}).epsilon !== undefined
      ? options.epsilon : 1e-9 * Math.max(1, total);

    for (let a = 0; a < n; a += 1) {
      for (let b = a; b < n; b += 1) {
        for (let c = b; c < n; c += 1) {
          const problem = quadrangleAt(w, { a: a, b: b, c: c, n: n, epsilon: epsilon });

          if (problem) return problem;
        }
      }
    }
    return { holds: true, witness: null, epsilon: epsilon };
  }

  function quadrangleAt(w, at) {
    for (let d = at.c; d < at.n; d += 1) {
      const slack = (w(at.a, d) + w(at.b, at.c)) - (w(at.a, at.c) + w(at.b, d));
      const inequality = w(at.a, at.c) + w(at.b, d) <= w(at.a, d) + w(at.b, at.c) + at.epsilon;
      const monotone = w(at.b, at.c) <= w(at.a, d) + at.epsilon;

      if (inequality && monotone) continue;
      return { holds: false, epsilon: at.epsilon,
        witness: { a: at.a, b: at.b, c: at.c, d: d, inequality: inequality,
          monotone: monotone, slack: slack } };
    }
    return null;
  }

  /** The expected comparisons a given BST shape costs, recomputed from the
   *  root table - the check that the reported cost is the tree's cost. */
  function bstCostOf(weights, root, i, j, depth) {
    if (i > j) return 0;
    const r = root[i][j];
    return weights[r] * (depth + 1) + bstCostOf(weights, root, i, r - 1, depth + 1) +
      bstCostOf(weights, root, r + 1, j, depth + 1);
  }

  /* --------------------------------------------- palindrome partitioning */

  /** Fewest cuts making every piece a palindrome, with the pieces returned.
   *  The palindrome table is itself an interval DP, which is why it is here. */
  function palindromePartition(text, options) {
    const report = (options || {}).report || emptyReport();
    const n = text.length;
    const isPalindrome = square(n, false);

    report.peakCells = n * n + n;

    for (let length = 1; length <= n; length += 1) {
      for (let i = 0; i + length - 1 < n; i += 1) {
        const j = i + length - 1;
        report.states += 1;
        report.transitions += 1;
        isPalindrome[i][j] = text[i] === text[j] && (length <= 2 || isPalindrome[i + 1][j - 1]);
      }
    }

    const cuts = new Array(n + 1).fill(Infinity);
    const from = new Array(n + 1).fill(-1);

    cuts[0] = 0;

    for (let j = 1; j <= n; j += 1) {
      for (let i = 0; i < j; i += 1) {
        report.transitions += 1;

        if (!isPalindrome[i][j - 1] || cuts[i] + 1 >= cuts[j]) continue;
        cuts[j] = cuts[i] + 1;
        from[j] = i;
      }
    }
    return { cuts: n === 0 ? 0 : cuts[n] - 1, pieces: partsOf(text, from, n), report: report };
  }

  function partsOf(text, from, n) {
    const parts = [];
    let at = n;

    while (at > 0) { parts.push(text.slice(from[at], at)); at = from[at]; }
    return parts.reverse();
  }

  /* --------------------------------------------------------- burst balloons */

  /**
   * Burst balloons, included because its state is the one people get wrong:
   * the natural "which balloon do I burst first" recursion has no optimal
   * substructure, and the working state is "which do I burst *last* in this
   * interval" - at which point the two sides become independent.
   */
  function burstBalloons(values, options) {
    const report = (options || {}).report || emptyReport();
    const padded = [1].concat(values, [1]);
    const n = padded.length;
    const best = square(n, 0);

    report.peakCells = n * n;

    for (let length = 3; length <= n; length += 1) {
      for (let i = 0; i + length - 1 < n; i += 1) {
        const j = i + length - 1;
        report.states += 1;

        for (let k = i + 1; k < j; k += 1) {
          report.transitions += 1;
          report.splitTests += 1;
          best[i][j] = Math.max(best[i][j],
            best[i][k] + best[k][j] + padded[i] * padded[k] * padded[j]);
        }
      }
    }
    return { coins: best[0][n - 1], report: report };
  }

  /** Every burst order, for the short instances the section uses. */
  function burstBruteForce(values) {
    function go(list) {
      if (list.length === 0) return 0;
      let best = 0;

      for (let k = 0; k < list.length; k += 1) {
        const left = k > 0 ? list[k - 1] : 1;
        const right = k < list.length - 1 ? list[k + 1] : 1;
        const rest = list.slice(0, k).concat(list.slice(k + 1));
        best = Math.max(best, left * list[k] * right + go(rest));
      }
      return best;
    }
    return go(values);
  }

  return {
    emptyReport: emptyReport, evaluationOrder: evaluationOrder,
    matrixChain: matrixChain, matrixChainBruteForce: matrixChainBruteForce,
    optimalBst: optimalBst, knuthOptimalBst: knuthOptimalBst,
    checkQuadrangle: checkQuadrangle, bstCostOf: bstCostOf,
    palindromePartition: palindromePartition,
    burstBalloons: burstBalloons, burstBruteForce: burstBruteForce
  };
}));
