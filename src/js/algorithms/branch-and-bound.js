/**
 * Branch and bound on 0/1 knapsack and on the travelling salesman, with the
 * bound as a swappable parameter - because the bound is the algorithm.
 *
 * Exhaustive search enumerates 2^n subsets. Branch and bound enumerates the
 * same tree and refuses to descend into a subtree whose *best possible* value
 * cannot beat the best solution already found. Everything depends on the
 * bound: it must never underestimate what a subtree can achieve (or the search
 * discards the optimum and returns a confidently wrong answer), and the closer
 * it is to the truth the more it prunes.
 *
 * The two bounds here differ only in tightness, and the difference is several
 * orders of magnitude in explored nodes on the same instance. The trivial
 * bound - "assume the rest of the capacity fills with the best density seen" -
 * is admissible and useless; the fractional relaxation is admissible and
 * strong, because the LP relaxation of 0/1 knapsack *is* fractional knapsack
 * and its optimum is a genuine ceiling on the integral one.
 *
 * `inadmissible` exists so the failure is demonstrable: a bound that
 * occasionally underestimates prunes more and returns the wrong answer without
 * any signal, which is the thing to be afraid of.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BranchAndBound = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return {
      nodes: 0, pruned: 0, incumbentUpdates: 0, boundCalls: 0,
      maxDepth: 0, leaves: 0, budgetExhausted: false
    };
  }

  /* ------------------------------------------------------------- knapsack */

  function byDensity(items) {
    return items.slice().sort(function (a, b) {
      return (b.value / b.weight) - (a.value / a.weight);
    });
  }

  /** The fractional relaxation: fill greedily by density and allow the last
   *  item to be split. It is the LP optimum, so no integral solution in this
   *  subtree can beat it. */
  function fractionalBound(sorted, at, taken, room) {
    let bound = taken;
    let remaining = room;
    for (let i = at; i < sorted.length && remaining > 0; i += 1) {
      if (sorted[i].weight <= remaining) {
        bound += sorted[i].value;
        remaining -= sorted[i].weight;
      } else {
        bound += sorted[i].value * (remaining / sorted[i].weight);
        remaining = 0;
      }
    }
    return bound;
  }

  /** The lazy bound: every remaining unit of capacity is worth the best
   *  density left. Admissible, and so loose that it barely prunes. */
  function densityBound(sorted, at, taken, room) {
    let best = 0;
    for (let i = at; i < sorted.length; i += 1) best = Math.max(best, sorted[i].value / sorted[i].weight);
    return taken + best * room;
  }

  /** Deliberately wrong: 90% of the fractional bound. It prunes beautifully
   *  and it discards the optimum, which is the point. */
  function brokenBound(sorted, at, taken, room) {
    return taken + 0.9 * (fractionalBound(sorted, at, taken, room) - taken);
  }

  const BOUNDS = {
    fractional: { label: 'fractional relaxation', admissible: true, fn: fractionalBound },
    density: { label: 'best remaining density', admissible: true, fn: densityBound },
    inadmissible: { label: '90% of the relaxation (wrong)', admissible: false, fn: brokenBound }
  };

  /**
   * 0/1 knapsack by branch and bound, depth-first with the take branch first
   * so an incumbent appears immediately and starts pruning.
   */
  function knapsack(items, capacity, options) {
    const settings = options || {};
    const report = emptyReport();
    const budget = settings.nodeBudget || 5000000;
    const bound = (BOUNDS[settings.bound] || BOUNDS.fractional).fn;
    const sorted = byDensity(items);
    let incumbent = { value: 0, chosen: [] };
    const picked = [];

    function descend(at, taken, room) {
      if (report.nodes >= budget) { report.budgetExhausted = true; return; }
      report.nodes += 1;
      report.maxDepth = Math.max(report.maxDepth, at);

      if (taken > incumbent.value) {
        incumbent = { value: taken, chosen: picked.slice() };
        report.incumbentUpdates += 1;
      }
      if (at === sorted.length) { report.leaves += 1; return; }

      report.boundCalls += 1;
      if (bound(sorted, at, taken, room) <= incumbent.value) { report.pruned += 1; return; }

      if (sorted[at].weight <= room) {
        picked.push(sorted[at]);
        descend(at + 1, taken + sorted[at].value, room - sorted[at].weight);
        picked.pop();
      }
      descend(at + 1, taken, room);
    }

    descend(0, 0, capacity);
    return {
      value: incumbent.value,
      chosen: incumbent.chosen.map(function (item) { return item.id; }).sort(function (a, b) { return a - b; }),
      report: report,
      bound: settings.bound || 'fractional',
      admissible: (BOUNDS[settings.bound] || BOUNDS.fractional).admissible
    };
  }

  /** Exhaustive search over all 2^n subsets: the oracle every bound is checked
   *  against, and the node count the pruning is measured against. */
  function knapsackExhaustive(items, capacity) {
    const report = emptyReport();
    let best = 0;
    let bestMask = 0;

    for (let mask = 0; mask < (1 << items.length); mask += 1) {
      report.nodes += 1;
      let weight = 0;
      let value = 0;
      for (let i = 0; i < items.length; i += 1) {
        if (!(mask & (1 << i))) continue;
        weight += items[i].weight;
        value += items[i].value;
      }
      if (weight > capacity) continue;
      report.leaves += 1;
      if (value > best) { best = value; bestMask = mask; }
    }

    const chosen = [];
    for (let i = 0; i < items.length; i += 1) {
      if (bestMask & (1 << i)) chosen.push(items[i].id);
    }
    return { value: best, chosen: chosen, report: report };
  }

  /* -------------------------------------------------------------- the TSP */

  /** A lower bound on any completion of a partial tour: what is already
   *  travelled, plus the cheapest edge out of every unvisited city. */
  function tspBound(matrix, visited, current, travelled) {
    let bound = travelled;
    for (let city = 0; city < matrix.length; city += 1) {
      if (visited[city] && city !== current) continue;
      let cheapest = Infinity;
      for (let next = 0; next < matrix.length; next += 1) {
        if (next === city) continue;
        if (visited[next] && next !== 0) continue;
        cheapest = Math.min(cheapest, matrix[city][next]);
      }
      if (cheapest !== Infinity) bound += cheapest;
    }
    return bound;
  }

  /**
   * TSP by branch and bound over a distance matrix. Small instances only - the
   * point is the shape of the search and the gap between bound and incumbent,
   * not a competitive solver.
   */
  function travellingSalesman(matrix, options) {
    const settings = options || {};
    const report = emptyReport();
    const budget = settings.nodeBudget || 2000000;
    const n = matrix.length;
    const visited = new Array(n).fill(false);
    const tour = [0];
    let incumbent = { length: settings.useBound === false ? Infinity : Infinity, tour: null };

    visited[0] = true;

    function descend(current, travelled, depth) {
      if (report.nodes >= budget) { report.budgetExhausted = true; return; }
      report.nodes += 1;
      report.maxDepth = Math.max(report.maxDepth, depth);

      if (depth === n) {
        report.leaves += 1;
        const total = travelled + matrix[current][0];
        if (total < incumbent.length) {
          incumbent = { length: total, tour: tour.concat([0]) };
          report.incumbentUpdates += 1;
        }
        return;
      }

      if (settings.useBound !== false) {
        report.boundCalls += 1;
        if (tspBound(matrix, visited, current, travelled) >= incumbent.length) {
          report.pruned += 1;
          return;
        }
      }

      for (let next = 0; next < n; next += 1) {
        if (visited[next]) continue;
        visited[next] = true;
        tour.push(next);
        descend(next, travelled + matrix[current][next], depth + 1);
        tour.pop();
        visited[next] = false;
      }
    }

    descend(0, 0, 1);
    return { length: incumbent.length, tour: incumbent.tour, report: report };
  }

  /** A symmetric Euclidean distance matrix from points, so the instances the
   *  demo shows obey the triangle inequality. */
  function distanceMatrix(points) {
    return points.map(function (a) {
      return points.map(function (b) {
        return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
      });
    });
  }

  return {
    bounds: BOUNDS,
    boundKinds: Object.keys(BOUNDS),
    fractionalBound: fractionalBound,
    densityBound: densityBound,
    knapsack: knapsack,
    knapsackExhaustive: knapsackExhaustive,
    travellingSalesman: travellingSalesman,
    distanceMatrix: distanceMatrix
  };
}));
