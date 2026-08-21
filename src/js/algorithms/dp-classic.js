/**
 * One-dimensional dynamic programming: the family where the state is a single
 * index, and where almost every mistake is an evaluation-order mistake.
 *
 * The counters are the point. `states` is how many distinct subproblems were
 * created, `transitions` is how many edges were evaluated, and the product of
 * the two is the complexity a section claims *before* any code is written. A
 * memoised solver that reports 2n - 1 states for Fibonacci and a naive one
 * that reports 2^n calls are the same recurrence; the difference is entirely
 * in whether the answers are kept, and the counters are the only place that
 * difference is visible.
 *
 * Two things here exist because they go wrong silently:
 *
 *   - **Coin change counts combinations or permutations depending on which
 *     loop is outer**, with no error either way. Both orders are implemented,
 *     on one shared body, so the section can show the same code producing 4
 *     and 7 for the same input.
 *   - **Every solver reconstructs its answer**, not just its optimum. A DP
 *     that returns the right number from the wrong table is common, and the
 *     reconstruction is what catches it: an "increasing subsequence" that is
 *     not a subsequence of the input fails a check the value never would.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DpClassic = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { states: 0, transitions: 0, hits: 0, misses: 0, calls: 0, peakCells: 0 };
  }

  function visit(report, cells) {
    report.states += 1;
    report.misses += 1;

    if (cells !== undefined) report.peakCells = Math.max(report.peakCells, cells);
  }

  /* ------------------------------------------------------------ Fibonacci */

  /**
   * The exponential version, kept because it is the measurement the whole
   * milestone opens with. `calls` grows as 2·F(n+1) - 1, so the section can
   * quote a recomputation count rather than asserting one.
   */
  function fibNaive(n, options) {
    const report = (options || {}).report || emptyReport();

    function go(k) {
      report.calls += 1;

      if (k <= 1) return k;
      report.transitions += 2;
      return go(k - 1) + go(k - 2);
    }
    return { value: go(n), report: report };
  }

  /** The same recurrence with the answers kept. States become n + 1. */
  function fibMemo(n, options) {
    const report = (options || {}).report || emptyReport();
    const memo = new Map();

    function go(k) {
      report.calls += 1;

      if (k <= 1) return k;

      if (memo.has(k)) {
        report.hits += 1;
        return memo.get(k);
      }
      visit(report, memo.size + 1);
      report.transitions += 2;
      const value = go(k - 1) + go(k - 2);
      memo.set(k, value);
      return value;
    }
    return { value: go(n), report: report };
  }

  /** Bottom-up, and then bottom-up in two variables. Identical values, and a
   *  `peakCells` that differs by a factor of n - which is the only reason to
   *  show both. */
  function fibTable(n, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const rolling = Boolean(settings.rolling);
    const table = rolling ? [0, 1] : new Array(Math.max(2, n + 1)).fill(0);

    table[1] = 1;

    for (let k = 2; k <= n; k += 1) {
      visit(report, rolling ? 2 : k + 1);
      report.transitions += 2;
      const value = rolling ? table[0] + table[1] : table[k - 1] + table[k - 2];

      if (rolling) { table[0] = table[1]; table[1] = value; } else table[k] = value;
    }
    return { value: n <= 1 ? n : (rolling ? table[1] : table[n]), report: report };
  }

  /* --------------------------------------------------------- house robber */

  /**
   * The first problem where the state is a *choice* rather than a count, and
   * the first where the reconstruction is worth having: two different sets of
   * houses can total the same amount, and a caller that only sees the total
   * cannot tell whether the solver picked adjacent houses.
   */
  function houseRobber(values, options) {
    const report = (options || {}).report || emptyReport();
    const best = new Array(values.length + 1).fill(0);
    const took = new Array(values.length + 1).fill(false);

    for (let i = 1; i <= values.length; i += 1) {
      visit(report, i + 1);
      report.transitions += 2;
      const skip = best[i - 1];
      const take = best[Math.max(0, i - 2)] + values[i - 1];
      best[i] = Math.max(skip, take);
      took[i] = take > skip;
    }

    const chosen = [];
    let at = values.length;

    while (at > 0) {
      if (!took[at]) { at -= 1; continue; }
      chosen.push(at - 1);
      at -= 2;
    }
    return { value: best[values.length], chosen: chosen.reverse(), report: report };
  }

  /* ------------------------------------------------------- maximum subarray */

  /**
   * Kadane's algorithm, which is a one-dimensional DP with the table thrown
   * away: `running` is dp[i], the best sum of a subarray *ending at* i.
   * Stating it that way is the section's point - the algorithm looks like a
   * trick and is a recurrence.
   */
  function maxSubarray(values, options) {
    const report = (options || {}).report || emptyReport();

    if (values.length === 0) return { value: 0, from: -1, to: -1, report: report };
    let running = values[0];
    let start = 0;
    let best = { value: values[0], from: 0, to: 0 };

    for (let i = 1; i < values.length; i += 1) {
      visit(report, 1);
      report.transitions += 2;

      if (running + values[i] < values[i]) { running = values[i]; start = i; } else running += values[i];

      if (running > best.value) best = { value: running, from: start, to: i };
    }
    return { value: best.value, from: best.from, to: best.to, report: report };
  }

  /** The quadratic reference, because a Kadane bug returns a plausible sum. */
  function maxSubarrayNaive(values) {
    if (values.length === 0) return { value: 0, from: -1, to: -1 };
    let best = { value: -Infinity, from: -1, to: -1 };

    for (let i = 0; i < values.length; i += 1) {
      let sum = 0;

      for (let j = i; j < values.length; j += 1) {
        sum += values[j];

        if (sum > best.value) best = { value: sum, from: i, to: j };
      }
    }
    return best;
  }

  /* ----------------------------------------------------------- coin change */

  /** Fewest coins making `amount`, with the coins reconstructed. Infinity is
   *  reported as `null` rather than as a large number, because a caller that
   *  compares numbers must not silently treat "impossible" as "expensive". */
  function coinChangeMin(coins, amount, options) {
    const report = (options || {}).report || emptyReport();
    const best = new Array(amount + 1).fill(Infinity);
    const from = new Array(amount + 1).fill(-1);

    best[0] = 0;

    for (let value = 1; value <= amount; value += 1) {
      visit(report, amount + 1);

      coins.forEach(function (coin) {
        if (coin > value || best[value - coin] === Infinity) return;
        report.transitions += 1;

        if (best[value - coin] + 1 >= best[value]) return;
        best[value] = best[value - coin] + 1;
        from[value] = coin;
      });
    }

    if (best[amount] === Infinity) return { count: null, coins: [], report: report };
    const chosen = [];
    let at = amount;

    while (at > 0) { chosen.push(from[at]); at -= from[at]; }
    return { count: best[amount], coins: chosen, report: report };
  }

  /**
   * How many ways make `amount` - and the whole reason this function takes an
   * `order`. With the coin loop outside, each combination is counted once
   * (4 ways to make 5 from {1,2,5}); with it inside, every *ordering* is a
   * different way (7). Neither raises, both are correct answers to different
   * questions, and the loop order is the only difference in the code.
   */
  function coinChangeWays(coins, amount, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const permutations = settings.order === 'permutations';
    const ways = new Array(amount + 1).fill(0);

    ways[0] = 1;

    function step(coin, value) {
      if (coin > value) return;
      report.transitions += 1;
      ways[value] += ways[value - coin];
    }

    if (permutations) {
      for (let value = 1; value <= amount; value += 1) {
        visit(report, amount + 1);
        coins.forEach(function (coin) { step(coin, value); });
      }
    } else {
      coins.forEach(function (coin) {
        for (let value = 1; value <= amount; value += 1) {
          visit(report, amount + 1);
          step(coin, value);
        }
      });
    }
    return { ways: ways[amount], order: permutations ? 'permutations' : 'combinations', report: report };
  }

  /** Exhaustive enumeration of multisets, the oracle for `combinations`. */
  function coinWaysBruteForce(coins, amount) {
    function go(index, left) {
      if (left === 0) return 1;
      if (index >= coins.length || left < 0) return 0;
      return go(index + 1, left) + go(index, left - coins[index]);
    }
    return go(0, amount);
  }

  /* ----------------------------------------- longest increasing subsequence */

  /** The O(n²) table, with predecessor links so the subsequence itself comes
   *  back rather than only its length. */
  function lisQuadratic(values, options) {
    const report = (options || {}).report || emptyReport();
    const length = new Array(values.length).fill(1);
    const previous = new Array(values.length).fill(-1);
    let bestAt = -1;

    for (let i = 0; i < values.length; i += 1) {
      visit(report, values.length);

      for (let j = 0; j < i; j += 1) {
        report.transitions += 1;

        if (values[j] >= values[i] || length[j] + 1 <= length[i]) continue;
        length[i] = length[j] + 1;
        previous[i] = j;
      }

      if (bestAt === -1 || length[i] > length[bestAt]) bestAt = i;
    }
    return { length: bestAt === -1 ? 0 : length[bestAt],
      sequence: rebuild(values, previous, bestAt), report: report };
  }

  function rebuild(values, previous, from) {
    const out = [];
    let at = from;

    while (at !== -1) { out.push(values[at]); at = previous[at]; }
    return out.reverse();
  }

  /**
   * Patience sorting: `tails[k]` is the smallest value that can end an
   * increasing subsequence of length k + 1. The binary search is what makes it
   * O(n log n), and the `previous` array is what makes the answer a
   * subsequence rather than a copy of `tails` - which is NOT the answer, and
   * is the classic bug: `tails` is increasing and the right length, so it
   * looks like a solution and is usually not one.
   */
  function lisPatience(values, options) {
    const report = (options || {}).report || emptyReport();
    const tails = [];
    const tailIndex = [];
    const previous = new Array(values.length).fill(-1);

    values.forEach(function (value, i) {
      visit(report, tails.length + 1);
      let low = 0;
      let high = tails.length;

      while (low < high) {
        report.transitions += 1;
        const mid = (low + high) >> 1;

        if (tails[mid] < value) low = mid + 1; else high = mid;
      }

      if (low > 0) previous[i] = tailIndex[low - 1];
      tails[low] = value;
      tailIndex[low] = i;
    });

    return { length: tails.length, piles: tails.slice(),
      sequence: rebuild(values, previous, tails.length ? tailIndex[tails.length - 1] : -1),
      report: report };
  }

  /** Exhaustive, for n small enough to enumerate every subsequence. */
  function lisBruteForce(values) {
    let best = 0;

    for (let mask = 0; mask < (1 << values.length); mask += 1) {
      const picked = [];

      for (let bit = 0; bit < values.length; bit += 1) {
        if (mask & (1 << bit)) picked.push(values[bit]);
      }
      let increasing = true;

      for (let i = 1; i < picked.length; i += 1) {
        if (picked[i] > picked[i - 1]) continue;
        increasing = false;
        break;
      }

      if (increasing) best = Math.max(best, picked.length);
    }
    return best;
  }

  /** Is `candidate` a genuine subsequence of `values`? The check the length
   *  alone cannot make. */
  function isSubsequence(candidate, values) {
    let at = 0;

    values.forEach(function (value) {
      if (at < candidate.length && candidate[at] === value) at += 1;
    });
    return at === candidate.length;
  }

  /* ------------------------------------------------------------- jumps */

  /** Fewest jumps to the end, where `reach[i]` is how far index i can throw
   *  you. Unreachable is `null`, for the same reason coin change uses it. */
  function minJumps(reach, options) {
    const report = (options || {}).report || emptyReport();
    const best = new Array(reach.length).fill(Infinity);
    const from = new Array(reach.length).fill(-1);

    best[0] = 0;

    for (let i = 0; i < reach.length; i += 1) {
      visit(report, reach.length);

      if (best[i] === Infinity) continue;

      for (let step = 1; step <= reach[i] && i + step < reach.length; step += 1) {
        report.transitions += 1;

        if (best[i] + 1 >= best[i + step]) continue;
        best[i + step] = best[i] + 1;
        from[i + step] = i;
      }
    }
    const last = reach.length - 1;

    if (best[last] === Infinity) return { jumps: null, path: [], report: report };
    const path = [];
    let at = last;

    while (at !== -1) { path.push(at); at = from[at]; }
    return { jumps: best[last], path: path.reverse(), report: report };
  }

  return {
    emptyReport: emptyReport,
    fibNaive: fibNaive, fibMemo: fibMemo, fibTable: fibTable,
    houseRobber: houseRobber,
    maxSubarray: maxSubarray, maxSubarrayNaive: maxSubarrayNaive,
    coinChangeMin: coinChangeMin, coinChangeWays: coinChangeWays,
    coinWaysBruteForce: coinWaysBruteForce,
    lisQuadratic: lisQuadratic, lisPatience: lisPatience, lisBruteForce: lisBruteForce,
    isSubsequence: isSubsequence, minJumps: minJumps
  };
}));
