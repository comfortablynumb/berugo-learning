/**
 * Approximation schemes, on the problem that has the best one there is.
 *
 * A PTAS takes an accuracy epsilon and runs in time polynomial in n for each
 * fixed epsilon - which permits n^(1/epsilon), so halving the error can square
 * the runtime. An FPTAS is polynomial in n AND in 1/epsilon, which makes the
 * dial usable: you name the error you will tolerate and pay for exactly that
 * much accuracy. Knapsack has one; unless P = NP most NP-hard problems do not,
 * and the gap between "has a PTAS" and "has an FPTAS" is where a lot of the
 * practical difference lives.
 *
 * The construction is one idea. The exact DP indexed by PROFIT rather than by
 * weight runs in O(n·P) where P is the largest profit - already polynomial in
 * the numbers, just not in their encoding length. Divide every profit by
 * K = epsilon·P_max/n and round down; each item loses less than K, so the
 * chosen set loses less than nK = epsilon·P_max <= epsilon·OPT, and the table
 * shrinks from n·P to n²/epsilon. The error is paid in the rounding and the
 * saving is taken in the table size, and the two are the same number.
 *
 * The scaling also shows why weight-indexed DP is the wrong axis to scale:
 * rounding weights changes FEASIBILITY, so a rounded solution can exceed the
 * capacity, while rounding profits only changes the objective. `scaleWeights`
 * exists to demonstrate exactly that failure, because it is the mistake the
 * construction is designed to avoid and it is invisible until something
 * overflows.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Fptas = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* --------------------------------------------------------------- the DP */

  /**
   * Minimum weight achieving each profit level. `cells` is the table size,
   * which is the quantity the scheme trades against accuracy, so it is a
   * reported field rather than an implementation detail.
   */
  function profitDp(items, capacity) {
    let total = 0;
    items.forEach(function (item) { total += item.profit; });
    const best = new Array(total + 1).fill(Infinity);
    const take = [];
    best[0] = 0;

    for (let i = 0; i < items.length; i += 1) {
      const row = new Array(total + 1).fill(false);
      for (let p = total; p >= items[i].profit; p -= 1) {
        const candidate = best[p - items[i].profit] + items[i].weight;
        if (candidate >= best[p]) continue;
        best[p] = candidate;
        row[p] = true;
      }
      take.push(row);
    }
    let value = 0;
    for (let p = total; p >= 0; p -= 1) { if (best[p] <= capacity) { value = p; break; } }
    return { value: value, weight: best[value], cells: items.length * (total + 1),
      chosen: recover(items, take, best, value), profitRange: total };
  }

  function recover(items, take, best, value) {
    const chosen = [];
    let p = value;

    for (let i = items.length - 1; i >= 0 && p > 0; i -= 1) {
      if (!take[i][p]) continue;
      chosen.push(i);
      p -= items[i].profit;
    }
    return chosen.reverse();
  }

  /** The exact answer, for the ratio to be measured rather than assumed. */
  function exact(items, capacity) {
    return profitDp(items, capacity);
  }

  /* ---------------------------------------------------------------- FPTAS */

  /**
   * Scale profits by K = epsilon·P_max/n, floor, solve exactly, then report
   * the TRUE profit of the chosen set - not the scaled one, which would
   * understate the answer and make the guarantee look tighter than it is.
   */
  function fptas(items, capacity, epsilon) {
    let maxProfit = 0;
    items.forEach(function (item) { maxProfit = Math.max(maxProfit, item.profit); });
    const k = Math.max(epsilon * maxProfit / items.length, Number.MIN_VALUE);
    const scaled = items.map(function (item) {
      return { profit: Math.floor(item.profit / k), weight: item.weight, label: item.label };
    });
    const run = profitDp(scaled, capacity);
    let value = 0;
    let weight = 0;
    run.chosen.forEach(function (i) { value += items[i].profit; weight += items[i].weight; });

    return { value: value, weight: weight, chosen: run.chosen, cells: run.cells,
      scale: k, epsilon: epsilon, scaledValue: run.value,
      feasible: weight <= capacity, lostBound: epsilon * maxProfit };
  }

  /**
   * The same scaling applied to WEIGHTS, which is the natural-looking variant
   * that does not work. Rounding weights down lets the chosen set exceed the
   * capacity; rounding them up makes the answer arbitrarily bad. The result is
   * returned with `feasible` false rather than corrected, so the demo can show
   * the overflow instead of describing it.
   */
  function scaleWeights(items, capacity, epsilon) {
    let maxWeight = 0;
    items.forEach(function (item) { maxWeight = Math.max(maxWeight, item.weight); });
    const k = Math.max(epsilon * maxWeight / items.length, Number.MIN_VALUE);
    const scaled = items.map(function (item) {
      return { profit: item.profit, weight: Math.floor(item.weight / k), label: item.label };
    });
    const run = profitDp(scaled, Math.floor(capacity / k));
    let weight = 0;
    let value = 0;
    run.chosen.forEach(function (i) { weight += items[i].weight; value += items[i].profit; });

    return { value: value, weight: weight, capacity: capacity, chosen: run.chosen,
      feasible: weight <= capacity, overflow: Math.max(0, weight - capacity),
      cells: run.cells, scale: k };
  }

  /* --------------------------------------------------------------- greedy */

  /**
   * Density greedy, then the best single item, whichever is larger. The
   * combination is a 1/2-approximation and either half alone is unbounded:
   * density greedy loses on one heavy valuable item, and best-single-item
   * loses on many light ones.
   */
  function greedyHalf(items, capacity) {
    const order = items.map(function (item, index) {
      return { index: index, density: item.profit / item.weight };
    }).sort(function (a, b) { return b.density - a.density; });
    let weight = 0;
    let value = 0;
    const chosen = [];

    order.forEach(function (entry) {
      if (weight + items[entry.index].weight > capacity) return;
      weight += items[entry.index].weight;
      value += items[entry.index].profit;
      chosen.push(entry.index);
    });
    const single = bestSingle(items, capacity);
    if (single.value > value) {
      return { value: single.value, weight: single.weight, chosen: [single.index],
        via: 'single item', ratioBound: 0.5 };
    }
    return { value: value, weight: weight, chosen: chosen, via: 'density', ratioBound: 0.5 };
  }

  function bestSingle(items, capacity) {
    let best = { value: 0, weight: 0, index: -1 };
    items.forEach(function (item, index) {
      if (item.weight > capacity || item.profit <= best.value) return;
      best = { value: item.profit, weight: item.weight, index: index };
    });
    return best;
  }

  /**
   * The PTAS: enumerate every subset of size at most k, fill the rest
   * greedily by density. The ratio is 1 - 1/(k+1) and the runtime is
   * O(n^(k+1)) - polynomial for each fixed k, and unusable past k = 3, which
   * is exactly the difference an FPTAS removes.
   */
  function ptas(items, capacity, k) {
    let best = { value: 0, chosen: [], weight: 0 };
    const counter = { subsets: 0 };
    enumerateSubsets(items, k, function (subset) {
      counter.subsets += 1;
      const filled = fillGreedily(items, capacity, subset);
      if (filled.value > best.value) best = filled;
    });
    return { value: best.value, weight: best.weight, chosen: best.chosen,
      subsets: counter.subsets, k: k, ratioBound: 1 - 1 / (k + 1) };
  }

  function enumerateSubsets(items, k, visit) {
    const current = [];

    function walk(start, depth) {
      visit(current.slice());
      if (depth === k) return;
      for (let i = start; i < items.length; i += 1) {
        current.push(i);
        walk(i + 1, depth + 1);
        current.pop();
      }
    }
    walk(0, 0);
  }

  function fillGreedily(items, capacity, subset) {
    const inSubset = new Set(subset);
    let weight = 0;
    let value = 0;
    subset.forEach(function (i) { weight += items[i].weight; value += items[i].profit; });
    if (weight > capacity) return { value: 0, weight: weight, chosen: [] };

    const rest = items.map(function (item, index) {
      return { index: index, density: item.profit / item.weight };
    }).filter(function (entry) { return !inSubset.has(entry.index); })
      .sort(function (a, b) { return b.density - a.density; });
    const chosen = subset.slice();

    rest.forEach(function (entry) {
      if (weight + items[entry.index].weight > capacity) return;
      weight += items[entry.index].weight;
      value += items[entry.index].profit;
      chosen.push(entry.index);
    });
    return { value: value, weight: weight, chosen: chosen };
  }

  /* ------------------------------------------------------------ instances */

  /** Random items with profits large enough that scaling actually bites. */
  function randomInstance(options) {
    const settings = options || {};
    const rng = settings.rng;
    const count = settings.count === undefined ? 40 : settings.count;
    const items = [];

    for (let i = 0; i < count; i += 1) {
      items.push({ profit: 1 + rng.int(settings.maxProfit === undefined ? 1000
        : settings.maxProfit), weight: 1 + rng.int(100), label: 'item ' + i });
    }
    let total = 0;
    items.forEach(function (item) { total += item.weight; });
    return { items: items, capacity: Math.floor(total / 2) };
  }

  /**
   * Strongly correlated items: profit = weight + a constant. This is the
   * classic hard family for knapsack because every item has almost the same
   * density, so density greedy has nothing to sort by and the DP cannot
   * prune - and it is the family where scaling actually costs something,
   * which is what makes the epsilon dial visible at all.
   */
  function stronglyCorrelatedInstance(options) {
    const settings = options || {};
    const rng = settings.rng;
    const count = settings.count === undefined ? 20 : settings.count;
    const spread = settings.spread === undefined ? 1000 : settings.spread;
    const offset = settings.offset === undefined ? 100 : settings.offset;
    const items = [];
    let total = 0;

    for (let i = 0; i < count; i += 1) {
      const weight = 1 + rng.int(spread);
      items.push({ profit: weight + offset, weight: weight, label: 'item ' + i });
      total += weight;
    }
    return { items: items, capacity: Math.floor(total / 2), correlated: true };
  }

  /** The instance density greedy loses on: one heavy item worth almost
   *  everything, and one light item with a better ratio. */
  function greedyTrapInstance(capacity) {
    return { items: [{ profit: 2, weight: 1, label: 'light, best density' },
      { profit: capacity, weight: capacity, label: 'heavy, all the value' }],
    capacity: capacity, optimum: capacity };
  }

  return {
    profitDp: profitDp, exact: exact, fptas: fptas, scaleWeights: scaleWeights,
    greedyHalf: greedyHalf, ptas: ptas, randomInstance: randomInstance,
    greedyTrapInstance: greedyTrapInstance, bestSingle: bestSingle,
    stronglyCorrelatedInstance: stronglyCorrelatedInstance
  };
}));
