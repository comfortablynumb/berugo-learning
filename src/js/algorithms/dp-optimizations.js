/**
 * The four DP optimisations that turn a quadratic transition into a linear or
 * logarithmic one - and the preconditions that make each of them either a
 * speed-up or a fast wrong answer.
 *
 * Every optimisation here follows the same contract, because the contract is
 * the lesson:
 *
 *   `check<Name>(instance)` tests the precondition against the actual cost
 *   function and returns a witness when it fails; the optimised solver refuses
 *   to run unless the check passes, and `force: true` is how a section shows
 *   what running it anyway produces.
 *
 * That is not defensive programming. Each of these is a *narrowing* of the
 * search, so when the precondition fails the narrowed search silently misses
 * the optimum: it returns a number that is too large, arrives faster, and
 * raises nothing. The convex hull trick with non-monotone queries, divide and
 * conquer optimisation without a monotone argmin - both are wrong in exactly
 * that shape, and both are demonstrated rather than warned about.
 *
 * `transitions` is the counter that carries the claim. The naive solver on
 * n = 2 000 evaluates ~2 000 000 transitions; the hull evaluates ~n. Quoting
 * a complexity is not evidence; the two counters side by side are.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DpOptimizations = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { states: 0, transitions: 0, hullSize: 0, popped: 0, nodes: 0, refused: false };
  }

  /* ---------------------------------------------------------- the instance */

  /**
   * The canonical CHT instance: split a sequence into groups, paying
   * `(prefix[j] - prefix[i])²  + penalty` for the group (i, j].
   *
   * `dp[j] = min over i of dp[i] + (P[j] - P[i])² + penalty`, and expanding
   * the square gives `dp[j] = P[j]² + penalty + min over i of
   * (dp[i] + P[i]²) - 2·P[i]·P[j]` - which is the minimum of a set of lines
   * `y = m·x + c` evaluated at `x = P[j]`, with `m = -2·P[i]`. That rewriting
   * *is* the convex hull trick; everything else is bookkeeping.
   */
  function groupingInstance(values, penalty) {
    const prefix = [0];

    values.forEach(function (value, i) { prefix.push(prefix[i] + value); });
    return { values: values, prefix: prefix, penalty: penalty, n: values.length };
  }

  function groupCost(instance, i, j) {
    const width = instance.prefix[j] - instance.prefix[i];
    return width * width + instance.penalty;
  }

  /** The O(n²) reference. Every optimised solver is checked against this. */
  function groupingNaive(instance, options) {
    const report = (options || {}).report || emptyReport();
    const dp = new Array(instance.n + 1).fill(Infinity);
    const from = new Array(instance.n + 1).fill(-1);

    dp[0] = 0;

    for (let j = 1; j <= instance.n; j += 1) {
      report.states += 1;

      for (let i = 0; i < j; i += 1) {
        report.transitions += 1;
        const value = dp[i] + groupCost(instance, i, j);

        if (value >= dp[j]) continue;
        dp[j] = value;
        from[j] = i;
      }
    }
    return { dp: dp, value: dp[instance.n], groups: groupsFrom(from, instance.n), report: report };
  }

  function groupsFrom(from, n) {
    const groups = [];
    let at = n;

    while (at > 0) { groups.push([from[at], at]); at = from[at]; }
    return groups.reverse();
  }

  /* --------------------------------------------------- convex hull trick */

  /**
   * A monotone hull: lines added in decreasing slope, queries in increasing x.
   * Both preconditions are asserted on every call rather than assumed, because
   * violating either makes the pointer walk skip the true minimum and return a
   * larger value with no error.
   */
  function createHull(options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const lines = [];
    let pointer = 0;
    let lastSlope = Infinity;
    let lastQuery = -Infinity;

    function bad(a, b, c) {
      return (c.c - a.c) * (a.m - b.m) <= (b.c - a.c) * (a.m - c.m);
    }

    function add(m, c) {
      if (m > lastSlope) throw new Error('convex-hull-trick: slopes must not increase');
      lastSlope = m;
      const line = { m: m, c: c };

      while (lines.length >= 2 && bad(lines[lines.length - 2], lines[lines.length - 1], line)) {
        lines.pop();
        report.popped += 1;

        if (pointer >= lines.length) pointer = Math.max(0, lines.length - 1);
      }
      lines.push(line);
      report.hullSize = Math.max(report.hullSize, lines.length);
    }

    function query(x) {
      if (x < lastQuery) throw new Error('convex-hull-trick: queries must not decrease');
      lastQuery = x;

      while (pointer + 1 < lines.length &&
             lines[pointer + 1].m * x + lines[pointer + 1].c <= lines[pointer].m * x + lines[pointer].c) {
        pointer += 1;
        report.transitions += 1;
      }
      report.transitions += 1;
      return lines[pointer].m * x + lines[pointer].c;
    }
    return { add: add, query: query, size: function () { return lines.length; },
      lines: function () { return lines.slice(); }, report: report };
  }

  /**
   * The precondition, tested on the instance rather than assumed: slopes are
   * `-2·P[i]` and queries are `P[j]`, so both are monotone exactly when the
   * prefix sums are non-decreasing - which needs the values non-negative.
   */
  function checkHullMonotone(instance) {
    for (let i = 1; i <= instance.n; i += 1) {
      if (instance.prefix[i] >= instance.prefix[i - 1]) continue;
      return { holds: false,
        witness: { at: i, prefix: instance.prefix[i], previous: instance.prefix[i - 1],
          reason: 'the prefix sums decrease, so slopes increase and queries move backwards' } };
    }
    return { holds: true, witness: null };
  }

  /** The same DP in O(n) transitions. Refuses unless the hull is monotone. */
  function groupingHull(instance, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const check = checkHullMonotone(instance);

    if (!check.holds && !settings.force) {
      report.refused = true;
      return { value: null, refused: true, monotone: check, report: report };
    }
    const dp = new Array(instance.n + 1).fill(Infinity);
    const hull = createHull({ report: report });

    dp[0] = 0;
    hull.add(-2 * instance.prefix[0], dp[0] + instance.prefix[0] * instance.prefix[0]);

    for (let j = 1; j <= instance.n; j += 1) {
      report.states += 1;
      const x = instance.prefix[j];
      dp[j] = hull.query(x) + x * x + instance.penalty;
      hull.add(-2 * instance.prefix[j], dp[j] + instance.prefix[j] * instance.prefix[j]);
    }
    return { dp: dp, value: dp[instance.n], refused: false, monotone: check, report: report };
  }

  /* -------------------------------------------------------- Li Chao tree */

  /**
   * Li Chao: the same minimum-of-lines query with *neither* precondition. It
   * costs a log factor and accepts lines in any order and queries in any
   * order, which is the trade the section is about - the hull is faster and
   * the tree is the one that is still correct when the data stops cooperating.
   */
  function createLiChao(low, high, options) {
    const report = (options || {}).report || emptyReport();
    const nodes = new Map();
    const value = function (line, x) { return line === undefined ? Infinity : line.m * x + line.c; };

    function insert(node, left, right, incoming) {
      report.nodes += 1;
      const mid = Math.floor((left + right) / 2);
      let line = incoming;
      let held = nodes.get(node);

      if (value(line, mid) < value(held, mid)) { const swap = held; held = line; line = swap; }
      nodes.set(node, held);

      if (left === right || line === undefined) return;

      if (value(line, left) < value(held, left)) insert(2 * node, left, mid, line);
      else if (value(line, right) < value(held, right)) insert(2 * node + 1, mid + 1, right, line);
    }

    function query(x) {
      let node = 1;
      let left = low;
      let right = high;
      let best = Infinity;

      while (true) {
        report.transitions += 1;
        best = Math.min(best, value(nodes.get(node), x));

        if (left === right) return best;
        const mid = Math.floor((left + right) / 2);

        if (x <= mid) { node = 2 * node; right = mid; } else { node = 2 * node + 1; left = mid + 1; }
      }
    }
    return { add: function (m, c) { insert(1, low, high, { m: m, c: c }); },
      query: query, report: report };
  }

  /* ------------------------------------------ divide and conquer optimisation */

  /**
   * Split into exactly `groups` pieces. The optimisation: if `opt(j)` - the
   * best split point for j - is non-decreasing in j, then solving the middle j
   * first bounds the range for both halves, giving O(n log n) per layer
   * instead of O(n²).
   *
   * The monotonicity is the precondition, and `checkMonotoneArgmin` computes
   * every argmin the slow way to test it. That is O(n²) and defeats the point
   * of the optimisation - which is exactly right: the check is for the section
   * and the tests, not for production.
   */
  function groupingDivideConquer(instance, groups, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const check = settings.skipCheck ? { holds: true, witness: null }
      : checkMonotoneArgmin(instance, groups);

    if (!check.holds && !settings.force) {
      report.refused = true;
      return { value: null, refused: true, monotone: check, report: report };
    }
    let previous = new Array(instance.n + 1).fill(Infinity);

    previous[0] = 0;

    for (let layer = 1; layer <= groups; layer += 1) {
      const current = new Array(instance.n + 1).fill(Infinity);
      solveLayer({ instance: instance, previous: previous, current: current, report: report },
        1, instance.n, 0, instance.n - 1);
      previous = current;
    }
    return { value: previous[instance.n], refused: false, monotone: check, report: report };
  }

  /** One divide-and-conquer layer: settle the middle, then recurse with the
   *  split range bounded by the middle's optimum on each side. */
  function solveLayer(context, jLow, jHigh, optLow, optHigh) {
    if (jLow > jHigh) return;
    const jMid = Math.floor((jLow + jHigh) / 2);
    let best = Infinity;
    let bestAt = optLow;

    context.report.states += 1;

    for (let i = optLow; i <= Math.min(jMid - 1, optHigh); i += 1) {
      context.report.transitions += 1;

      if (context.previous[i] === Infinity) continue;
      const value = context.previous[i] + groupCost(context.instance, i, jMid);

      if (value >= best) continue;
      best = value;
      bestAt = i;
    }
    context.current[jMid] = best;
    solveLayer(context, jLow, jMid - 1, optLow, bestAt);
    solveLayer(context, jMid + 1, jHigh, bestAt, optHigh);
  }

  /** Every argmin, computed exhaustively, so monotonicity is measured. */
  function checkMonotoneArgmin(instance, groups) {
    let previous = new Array(instance.n + 1).fill(Infinity);

    previous[0] = 0;

    for (let layer = 1; layer <= groups; layer += 1) {
      const current = new Array(instance.n + 1).fill(Infinity);
      const argmin = new Array(instance.n + 1).fill(-1);
      const problem = fillLayerArgmins(instance, previous, current, argmin);

      if (problem) return problem;
      previous = current;
    }
    return { holds: true, witness: null };
  }

  function fillLayerArgmins(instance, previous, current, argmin) {
    for (let j = 1; j <= instance.n; j += 1) {
      for (let i = 0; i < j; i += 1) {
        if (previous[i] === Infinity) continue;
        const value = previous[i] + groupCost(instance, i, j);

        if (value >= current[j]) continue;
        current[j] = value;
        argmin[j] = i;
      }

      if (argmin[j] === -1 || argmin[j - 1] === -1 || argmin[j] >= argmin[j - 1]) continue;
      return { holds: false,
        witness: { j: j, argmin: argmin[j], previous: argmin[j - 1],
          reason: 'the optimal split point moved backwards' } };
    }
    return null;
  }

  /* ------------------------------------------------- monotonic queue */

  /**
   * Sliding-window transitions: `dp[j] = min over i in [j - width, j - 1] of
   * dp[i] + cost(j)`. The deque holds indices whose dp values increase, so the
   * front is the window's minimum - the same amortisation as M11.7, applied to
   * a DP transition instead of an array query.
   */
  function slidingWindowDp(values, width, options) {
    const report = (options || {}).report || emptyReport();
    const dp = new Array(values.length + 1).fill(Infinity);
    const deque = [];

    dp[0] = 0;
    deque.push(0);

    for (let j = 1; j <= values.length; j += 1) {
      report.states += 1;

      while (deque.length && deque[0] < j - width) { deque.shift(); report.popped += 1; }
      report.transitions += 1;
      dp[j] = dp[deque[0]] + values[j - 1];

      while (deque.length && dp[deque[deque.length - 1]] >= dp[j]) { deque.pop(); report.popped += 1; }
      deque.push(j);
      report.hullSize = Math.max(report.hullSize, deque.length);
    }
    return { dp: dp, value: dp[values.length], report: report };
  }

  function slidingWindowNaive(values, width, options) {
    const report = (options || {}).report || emptyReport();
    const dp = new Array(values.length + 1).fill(Infinity);

    dp[0] = 0;

    for (let j = 1; j <= values.length; j += 1) {
      report.states += 1;

      for (let i = Math.max(0, j - width); i < j; i += 1) {
        report.transitions += 1;
        dp[j] = Math.min(dp[j], dp[i] + values[j - 1]);
      }
    }
    return { dp: dp, value: dp[values.length], report: report };
  }

  /* ------------------------------------------------------- the aliens trick */

  /**
   * "Exactly k groups" by binary searching a Lagrangian penalty: solve the
   * *unconstrained* problem with a penalty λ per group, and λ controls how
   * many groups the optimum uses. Binary search λ until the count is k, then
   * subtract k·λ back off.
   *
   * The precondition is convexity of `cost(k)` in k, and the honest failure is
   * that the group count *jumps over* k rather than landing on it - which is
   * reported rather than hidden, because a run that lands on k - 1 and reports
   * an answer for k is the wrong answer to the question asked.
   */
  function aliensTrick(values, groups, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const iterations = settings.iterations || 60;
    let low = 0;
    let high = settings.maxPenalty || 1e12;
    let landed = null;

    for (let step = 0; step < iterations; step += 1) {
      const penalty = (low + high) / 2;
      const run = groupingNaive(groupingInstance(values, penalty), { report: report });
      const count = run.groups.length;

      if (count === groups) landed = { penalty: penalty, value: run.value };

      if (count > groups) low = penalty; else high = penalty;
    }

    if (landed === null) {
      return { value: null, exact: false, groups: groups, report: report,
        reason: 'the group count jumps over ' + groups + ', so the penalty cannot select it' };
    }
    return { value: landed.value - groups * landed.penalty, penalty: landed.penalty,
      exact: true, report: report };
  }

  /** The reference for "exactly k groups": a full two-dimensional DP. */
  function groupingExactly(values, groups, options) {
    const report = (options || {}).report || emptyReport();
    const instance = groupingInstance(values, 0);
    let previous = new Array(values.length + 1).fill(Infinity);

    previous[0] = 0;

    for (let layer = 1; layer <= groups; layer += 1) {
      const current = new Array(values.length + 1).fill(Infinity);

      for (let j = 1; j <= values.length; j += 1) {
        report.states += 1;

        for (let i = 0; i < j; i += 1) {
          report.transitions += 1;

          if (previous[i] === Infinity) continue;
          current[j] = Math.min(current[j], previous[i] + groupCost(instance, i, j));
        }
      }
      previous = current;
    }
    return { value: previous[values.length], report: report };
  }

  return {
    emptyReport: emptyReport,
    groupingInstance: groupingInstance, groupCost: groupCost, groupingNaive: groupingNaive,
    createHull: createHull, checkHullMonotone: checkHullMonotone, groupingHull: groupingHull,
    createLiChao: createLiChao,
    groupingDivideConquer: groupingDivideConquer, checkMonotoneArgmin: checkMonotoneArgmin,
    slidingWindowDp: slidingWindowDp, slidingWindowNaive: slidingWindowNaive,
    aliensTrick: aliensTrick, groupingExactly: groupingExactly
  };
}));
