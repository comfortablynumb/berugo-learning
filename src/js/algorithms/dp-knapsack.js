/**
 * The knapsack family - and the two things about it that are usually taught
 * wrong.
 *
 * **"Polynomial" is a lie about the wrong input.** The 0/1 table is
 * O(n·capacity), which is polynomial in the *capacity's value* and exponential
 * in the number of bits used to write it down. `bitCost` reports both, so a
 * section can show the runtime doubling when one digit is added to the
 * capacity rather than asserting the phrase "weakly NP-hard".
 *
 * **Space reduction breaks reconstruction, and does it silently.** Collapsing
 * the table to one row gives the same optimal *value* and destroys the
 * information the traceback needs, so a solver that keeps its traceback code
 * unchanged returns a plausible item list that does not sum to its own answer.
 * Every function here reports `chosen`, and `verify()` exists to check that
 * the chosen set actually weighs and is worth what was claimed - which is the
 * assertion that catches it.
 *
 * The bounded knapsack is implemented three ways on one interface - naive
 * expansion, binary splitting and a monotonic deque - because the three agree
 * on every value and differ by two orders of magnitude in transitions, which
 * is a fact about evaluation order rather than about knapsacks.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DpKnapsack = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { states: 0, transitions: 0, cells: 0, peakCells: 0, expandedItems: 0 };
  }

  function noteCells(report, cells) {
    report.cells = cells;
    report.peakCells = Math.max(report.peakCells, cells);
  }

  /* ----------------------------------------------------------- 0/1 knapsack */

  /**
   * The full table, so the traceback has something to walk. `keep[i][c]` is
   * the decision at that cell rather than a recomputed comparison, because
   * recomputing it from the values is where ties silently pick the wrong item.
   */
  function knapsack01(items, capacity, options) {
    const report = (options || {}).report || emptyReport();
    const rows = items.length + 1;
    const best = [];
    const keep = [];

    for (let i = 0; i < rows; i += 1) {
      best.push(new Array(capacity + 1).fill(0));
      keep.push(new Array(capacity + 1).fill(false));
    }
    noteCells(report, rows * (capacity + 1));

    for (let i = 1; i < rows; i += 1) {
      const item = items[i - 1];

      for (let c = 0; c <= capacity; c += 1) {
        report.states += 1;
        report.transitions += 1;
        best[i][c] = best[i - 1][c];

        if (item.weight > c) continue;
        report.transitions += 1;
        const take = best[i - 1][c - item.weight] + item.value;

        if (take <= best[i][c]) continue;
        best[i][c] = take;
        keep[i][c] = true;
      }
    }
    return { value: best[items.length][capacity], table: best,
      chosen: traceback(items, keep, capacity), report: report };
  }

  function traceback(items, keep, capacity) {
    const chosen = [];
    let c = capacity;

    for (let i = items.length; i > 0; i -= 1) {
      if (!keep[i][c]) continue;
      chosen.push(i - 1);
      c -= items[i - 1].weight;
    }
    return chosen.reverse();
  }

  /**
   * One row, iterated downwards. The direction is the whole thing: descending
   * means each item is read from the *previous* row and used once, ascending
   * means it is read from the row being written and used unboundedly. Two
   * different problems, one character apart.
   */
  function knapsack01Rolling(items, capacity, options) {
    const report = (options || {}).report || emptyReport();
    const best = new Array(capacity + 1).fill(0);

    noteCells(report, capacity + 1);
    items.forEach(function (item) {
      for (let c = capacity; c >= item.weight; c -= 1) {
        report.states += 1;
        report.transitions += 1;
        best[c] = Math.max(best[c], best[c - item.weight] + item.value);
      }
    });
    return { value: best[capacity], chosen: null, report: report };
  }

  /** The same loop ascending: each item may be taken any number of times. */
  function knapsackUnbounded(items, capacity, options) {
    const report = (options || {}).report || emptyReport();
    const best = new Array(capacity + 1).fill(0);
    const from = new Array(capacity + 1).fill(-1);

    noteCells(report, capacity + 1);
    items.forEach(function (item, index) {
      for (let c = item.weight; c <= capacity; c += 1) {
        report.states += 1;
        report.transitions += 1;

        if (best[c - item.weight] + item.value <= best[c]) continue;
        best[c] = best[c - item.weight] + item.value;
        from[c] = index;
      }
    });

    const counts = {};
    let c = capacity;

    while (c > 0 && from[c] !== -1) {
      counts[from[c]] = (counts[from[c]] || 0) + 1;
      c -= items[from[c]].weight;
    }
    return { value: best[capacity], counts: counts, report: report };
  }

  /* -------------------------------------------------------- bounded knapsack */

  /** Expand every copy into its own 0/1 item. Correct, and the thing binary
   *  splitting exists to avoid: an item with 1 000 copies becomes 1 000 rows. */
  function boundedNaive(items, capacity, options) {
    const report = (options || {}).report || emptyReport();
    const expanded = [];

    items.forEach(function (item) {
      for (let copy = 0; copy < item.count; copy += 1) {
        expanded.push({ value: item.value, weight: item.weight, source: item });
      }
    });
    report.expandedItems = expanded.length;
    const run = knapsack01Rolling(expanded, capacity, { report: report });
    return { value: run.value, expanded: expanded.length, report: report };
  }

  /**
   * Binary splitting: 1, 2, 4, … copies bundled into single items, with the
   * remainder as a last bundle. Every count from 0 to `count` is representable
   * as a subset of the bundles, so the answer is unchanged and the item count
   * drops from `count` to ⌊log2(count)⌋ + 1.
   */
  function boundedBinary(items, capacity, options) {
    const report = (options || {}).report || emptyReport();
    const bundles = [];

    items.forEach(function (item) {
      let left = item.count;
      let size = 1;

      while (left > 0) {
        const take = Math.min(size, left);
        bundles.push({ value: item.value * take, weight: item.weight * take, source: item });
        left -= take;
        size *= 2;
      }
    });
    report.expandedItems = bundles.length;
    const run = knapsack01Rolling(bundles, capacity, { report: report });
    return { value: run.value, expanded: bundles.length, report: report };
  }

  /**
   * The monotonic-deque version: for one item, cells sharing a residue modulo
   * its weight form a chain, and the best predecessor within `count` steps is
   * a sliding-window maximum. That makes the whole item O(capacity) with no
   * dependence on its count at all - the same amortisation argument as M11.7,
   * reused.
   */
  function boundedQueue(items, capacity, options) {
    const report = (options || {}).report || emptyReport();
    let best = new Array(capacity + 1).fill(0);

    noteCells(report, 2 * (capacity + 1));
    items.forEach(function (item) {
      const next = best.slice();

      for (let residue = 0; residue < item.weight && residue <= capacity; residue += 1) {
        slideResidue(best, next, item, { residue: residue, capacity: capacity, report: report });
      }
      best = next;
    });
    return { value: best[capacity], expanded: items.length, report: report };
  }

  /** One residue chain of `boundedQueue`, as its own function so the deque
   *  bookkeeping is readable and the caller stays inside the size limit. */
  function slideResidue(best, next, item, context) {
    const deque = [];

    for (let k = 0; context.residue + k * item.weight <= context.capacity; k += 1) {
      const c = context.residue + k * item.weight;
      const candidate = best[c] - k * item.value;

      while (deque.length && deque[0].k < k - item.count) deque.shift();

      while (deque.length && deque[deque.length - 1].candidate <= candidate) deque.pop();
      deque.push({ k: k, candidate: candidate });
      context.report.states += 1;
      context.report.transitions += 1;
      next[c] = Math.max(next[c], deque[0].candidate + k * item.value);
    }
  }

  /* ------------------------------------------------------------- subset sum */

  /** Reachable sums as a boolean row, with the traceback kept in a separate
   *  "which item first reached this sum" array so the subset comes back. */
  function subsetSum(values, target, options) {
    const report = (options || {}).report || emptyReport();
    const reachable = new Array(target + 1).fill(false);
    const from = new Array(target + 1).fill(-1);

    reachable[0] = true;
    noteCells(report, target + 1);
    values.forEach(function (value, index) {
      for (let sum = target; sum >= value; sum -= 1) {
        report.states += 1;
        report.transitions += 1;

        if (!reachable[sum - value] || reachable[sum]) continue;
        reachable[sum] = true;
        from[sum] = index;
      }
    });

    if (!reachable[target]) return { reachable: false, chosen: [], report: report };
    const chosen = [];
    let sum = target;

    while (sum > 0) { chosen.push(from[sum]); sum -= values[from[sum]]; }
    return { reachable: true, chosen: chosen.reverse(), report: report };
  }

  /** The split closest to half the total - equal partition when the halves
   *  meet, and the standard oracle target when they cannot. */
  function equalPartition(values, options) {
    const total = values.reduce(function (a, b) { return a + b; }, 0);
    const half = Math.floor(total / 2);
    const report = (options || {}).report || emptyReport();
    const reachable = new Array(half + 1).fill(false);

    reachable[0] = true;
    noteCells(report, half + 1);
    values.forEach(function (value) {
      for (let sum = half; sum >= value; sum -= 1) {
        report.states += 1;
        report.transitions += 1;
        reachable[sum] = reachable[sum] || reachable[sum - value];
      }
    });
    let bestHalf = 0;

    for (let sum = half; sum >= 0; sum -= 1) {
      if (!reachable[sum]) continue;
      bestHalf = sum;
      break;
    }
    return { total: total, bestHalf: bestHalf, difference: total - 2 * bestHalf,
      equal: total % 2 === 0 && bestHalf === half, report: report };
  }

  /* ---------------------------------------------------------- the oracles */

  /** Exhaustive over subsets. The reference for every 0/1 claim above. */
  function bruteForce(items, capacity) {
    let best = { value: 0, chosen: [] };

    for (let mask = 0; mask < (1 << items.length); mask += 1) {
      let weight = 0;
      let value = 0;
      const chosen = [];

      for (let bit = 0; bit < items.length; bit += 1) {
        if ((mask & (1 << bit)) === 0) continue;
        weight += items[bit].weight;
        value += items[bit].value;
        chosen.push(bit);
      }

      if (weight > capacity || value <= best.value) continue;
      best = { value: value, chosen: chosen };
    }
    return best;
  }

  /**
   * Does the reported set actually weigh what it claims and fit? The check
   * that catches a traceback walked over a space-reduced table, which is the
   * one failure in this file that produces a plausible answer.
   */
  function verify(items, capacity, chosen, value) {
    let weight = 0;
    let total = 0;

    (chosen || []).forEach(function (index) {
      weight += items[index].weight;
      total += items[index].value;
    });
    return { fits: weight <= capacity, weight: weight, value: total, matches: total === value };
  }

  /**
   * The pseudo-polynomial statement, in the two units that disagree. `cells`
   * grows linearly in the capacity's value; `bits` is how long the capacity is
   * to write down. Adding one decimal digit multiplies the work by ten while
   * lengthening the input by about 3.3 bits.
   */
  function bitCost(itemCount, capacity) {
    return {
      capacity: capacity,
      bits: Math.max(1, Math.ceil(Math.log2(capacity + 1))),
      cells: itemCount * (capacity + 1),
      perBit: (itemCount * (capacity + 1)) / Math.max(1, Math.ceil(Math.log2(capacity + 1)))
    };
  }

  return {
    emptyReport: emptyReport,
    knapsack01: knapsack01, knapsack01Rolling: knapsack01Rolling,
    knapsackUnbounded: knapsackUnbounded,
    boundedNaive: boundedNaive, boundedBinary: boundedBinary, boundedQueue: boundedQueue,
    subsetSum: subsetSum, equalPartition: equalPartition,
    bruteForce: bruteForce, verify: verify, bitCost: bitCost
  };
}));
