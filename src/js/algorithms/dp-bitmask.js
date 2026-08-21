/**
 * Bitmask DP: subsets as integers, and the two identities that make the
 * family feasible at all.
 *
 * **Submask enumeration is 3ⁿ in total, not 4ⁿ.** The idiom
 * `for (sub = mask; sub; sub = (sub - 1) & mask)` visits every submask of one
 * mask, and summing over all masks counts each (submask, mask) pair once -
 * which is choosing, for each bit, whether it is in neither, in the submask,
 * or in the mask only: three options, n bits, 3ⁿ. `submaskCount` measures it,
 * because the identity is the reason anyone writes the loop.
 *
 * **Sum over subsets is n·2ⁿ, not 3ⁿ.** SOS DP computes the same aggregate as
 * the submask loop by relaxing one bit at a time, and the difference at n = 20
 * is 3.5 billion against 21 million. Both are implemented, both are checked
 * against the same brute force, and the counter is the argument.
 *
 * The memory wall is real and reported rather than described: `memoryFor`
 * gives the (mask, last) table size at each n, and the demo shows the number
 * passing anything a browser can hold somewhere around n = 25.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DpBitmask = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const INF = Infinity;

  function emptyReport() {
    return { states: 0, transitions: 0, cells: 0, peakCells: 0, submaskSteps: 0 };
  }

  function popcount(mask) {
    let count = 0;
    let value = mask;

    while (value) { value &= value - 1; count += 1; }
    return count;
  }

  /* -------------------------------------------------------- submask loops */

  /** Every submask of `mask`, including 0 and `mask` itself, in descending
   *  order. The subtraction is the trick: `sub - 1` borrows through the zeros
   *  and `& mask` snaps back onto the mask's bits. */
  function submasks(mask) {
    const out = [];
    let sub = mask;

    while (true) {
      out.push(sub);

      if (sub === 0) break;
      sub = (sub - 1) & mask;
    }
    return out;
  }

  /** The 3ⁿ identity, measured. */
  function submaskCount(n) {
    let steps = 0;

    for (let mask = 0; mask < (1 << n); mask += 1) {
      let sub = mask;

      while (true) {
        steps += 1;

        if (sub === 0) break;
        sub = (sub - 1) & mask;
      }
    }
    return { n: n, steps: steps, predicted: Math.pow(3, n), naive: Math.pow(4, n) };
  }

  /* ------------------------------------------------------ sum over subsets */

  /**
   * `out[mask] = sum of values[sub] over every sub ⊆ mask`, in n·2ⁿ.
   *
   * The loop order is the whole algorithm and is the part that looks wrong:
   * the bit loop is *outside*, so after round b every entry has absorbed its
   * submasks differing only in bits 0..b. Swapping the loops gives a table
   * that is partly relaxed and entirely plausible.
   */
  function sumOverSubsets(values, n, options) {
    const report = (options || {}).report || emptyReport();
    const out = values.slice();

    report.cells = 1 << n;
    report.peakCells = 1 << n;

    for (let bit = 0; bit < n; bit += 1) {
      for (let mask = 0; mask < (1 << n); mask += 1) {
        report.states += 1;

        if ((mask & (1 << bit)) === 0) continue;
        report.transitions += 1;
        out[mask] += out[mask ^ (1 << bit)];
      }
    }
    return { values: out, report: report };
  }

  /** The same answer by walking every submask: 3ⁿ instead of n·2ⁿ. Kept
   *  because it is the thing SOS replaces, and because it is the oracle. */
  function sumOverSubsetsBySubmask(values, n, options) {
    const report = (options || {}).report || emptyReport();
    const out = new Array(1 << n).fill(0);

    for (let mask = 0; mask < (1 << n); mask += 1) {
      report.states += 1;
      submasks(mask).forEach(function (sub) {
        report.submaskSteps += 1;
        out[mask] += values[sub];
      });
    }
    return { values: out, report: report };
  }

  /* --------------------------------------------------- travelling salesman */

  /**
   * Held-Karp: `best[mask][last]` is the cheapest path starting at 0, visiting
   * exactly `mask`, and standing on `last`. O(2ⁿ·n²), which is astronomically
   * better than n! and still hits a wall - the whole point of the section.
   */
  function travellingSalesman(matrix, options) {
    const report = (options || {}).report || emptyReport();
    const n = matrix.length;
    const size = 1 << n;
    const best = [];
    const from = [];

    for (let mask = 0; mask < size; mask += 1) {
      best.push(new Array(n).fill(INF));
      from.push(new Array(n).fill(-1));
    }
    report.cells = size * n;
    report.peakCells = size * n;
    best[1][0] = 0;

    for (let mask = 1; mask < size; mask += 1) {
      if ((mask & 1) === 0) continue;

      for (let last = 0; last < n; last += 1) {
        if (best[mask][last] === INF || (mask & (1 << last)) === 0) continue;
        report.states += 1;
        relaxFrom({ matrix: matrix, best: best, from: from, report: report }, mask, last);
      }
    }
    return closeTour(matrix, best, from, report);
  }

  /** Extend one (mask, last) state by every unvisited city. */
  function relaxFrom(context, mask, last) {
    const n = context.matrix.length;

    for (let next = 0; next < n; next += 1) {
      if (mask & (1 << next)) continue;
      context.report.transitions += 1;
      const target = mask | (1 << next);
      const cost = context.best[mask][last] + context.matrix[last][next];

      if (cost >= context.best[target][next]) continue;
      context.best[target][next] = cost;
      context.from[target][next] = last;
    }
  }

  function closeTour(matrix, best, from, report) {
    const n = matrix.length;
    const full = (1 << n) - 1;
    let bestCost = INF;
    let bestLast = 0;

    for (let last = 0; last < n; last += 1) {
      if (best[full][last] === INF) continue;
      report.transitions += 1;
      const cost = best[full][last] + matrix[last][0];

      if (cost >= bestCost) continue;
      bestCost = cost;
      bestLast = last;
    }

    const tour = [];
    let mask = full;
    let at = bestLast;

    while (at !== -1) {
      tour.push(at);
      const previous = from[mask][at];
      mask ^= (1 << at);
      at = previous;
    }
    return { length: bestCost, tour: tour.reverse().concat([0]), report: report };
  }

  /** Every permutation, for n small enough. The reference. */
  function tspBruteForce(matrix) {
    const n = matrix.length;
    const rest = [];

    for (let i = 1; i < n; i += 1) rest.push(i);
    let best = INF;

    function go(order, used, cost) {
      if (cost >= best) return;

      if (order.length === n - 1) {
        best = Math.min(best, cost + matrix[order[order.length - 1]][0]);
        return;
      }
      rest.forEach(function (city) {
        if (used.has(city)) return;
        used.add(city);
        const previous = order.length ? order[order.length - 1] : 0;
        go(order.concat([city]), used, cost + matrix[previous][city]);
        used.delete(city);
      });
    }
    go([], new Set(), 0);
    return best;
  }

  /* ---------------------------------------------------------- assignment */

  /**
   * Assign n workers to n jobs at minimum cost. The state is the set of jobs
   * already filled; the *worker* index is `popcount(mask)`, so it does not
   * need to be in the state at all. Noticing that is the difference between
   * 2ⁿ states and n·2ⁿ.
   */
  function assignment(cost, options) {
    const report = (options || {}).report || emptyReport();
    const n = cost.length;
    const size = 1 << n;
    const best = new Array(size).fill(INF);
    const from = new Array(size).fill(-1);

    best[0] = 0;
    report.cells = size;
    report.peakCells = size;

    for (let mask = 0; mask < size; mask += 1) {
      if (best[mask] === INF) continue;
      const worker = popcount(mask);
      report.states += 1;

      if (worker >= n) continue;

      for (let job = 0; job < n; job += 1) {
        if (mask & (1 << job)) continue;
        report.transitions += 1;
        const target = mask | (1 << job);
        const value = best[mask] + cost[worker][job];

        if (value >= best[target]) continue;
        best[target] = value;
        from[target] = job;
      }
    }

    const jobs = new Array(n).fill(-1);
    let mask = size - 1;

    while (mask > 0) {
      const job = from[mask];
      jobs[popcount(mask) - 1] = job;
      mask ^= (1 << job);
    }
    return { cost: best[size - 1], jobs: jobs, report: report };
  }

  function assignmentBruteForce(cost) {
    const n = cost.length;
    let best = INF;

    function go(worker, used, total) {
      if (worker === n) { best = Math.min(best, total); return; }

      for (let job = 0; job < n; job += 1) {
        if (used & (1 << job)) continue;
        go(worker + 1, used | (1 << job), total + cost[worker][job]);
      }
    }
    go(0, 0, 0);
    return best;
  }

  /* ----------------------------------------------------- broken profile */

  /**
   * Count the tilings of an m x n board by dominoes, one cell at a time with
   * the frontier as the mask. `m` is the *narrow* side deliberately: the state
   * is 2^m, so transposing a 2 x 12 board into 12 x 2 is the difference
   * between 4 states and 4 096.
   */
  function dominoTilings(rows, columns, options) {
    const report = (options || {}).report || emptyReport();
    const m = Math.min(rows, columns);
    const n = Math.max(rows, columns);
    const size = 1 << m;
    let current = new Array(size).fill(0);

    current[0] = 1;
    report.cells = size;
    report.peakCells = 2 * size;

    for (let column = 0; column < n; column += 1) {
      for (let cell = 0; cell < m; cell += 1) {
        const next = new Array(size).fill(0);

        for (let mask = 0; mask < size; mask += 1) {
          if (current[mask] === 0) continue;
          report.states += 1;
          fillCell(current, next, { mask: mask, cell: cell, m: m, report: report });
        }
        current = next;
      }
    }
    return { tilings: current[0], report: report };
  }

  /** The three moves at one cell: it is already covered, it starts a vertical
   *  domino, or it starts a horizontal one. */
  function fillCell(current, next, at) {
    const bit = 1 << at.cell;

    if (at.mask & bit) {
      at.report.transitions += 1;
      next[at.mask ^ bit] += current[at.mask];
      return;
    }
    at.report.transitions += 1;
    next[at.mask | bit] += current[at.mask];

    if (at.cell + 1 >= at.m || (at.mask & (1 << (at.cell + 1)))) return;
    at.report.transitions += 1;
    next[at.mask | (1 << (at.cell + 1))] += current[at.mask];
  }

  /* ------------------------------------------------------- the memory wall */

  /** The (mask, last) table size at each n, in cells and in bytes at eight
   *  bytes a cell. This is the number the section shows instead of saying
   *  "it does not scale". */
  function memoryFor(n) {
    const cells = Math.pow(2, n) * n;
    return { n: n, cells: cells, bytes: cells * 8, permutations: factorial(n - 1) };
  }

  function factorial(n) {
    let out = 1;

    for (let i = 2; i <= n; i += 1) out *= i;
    return out;
  }

  return {
    emptyReport: emptyReport, popcount: popcount, submasks: submasks, submaskCount: submaskCount,
    sumOverSubsets: sumOverSubsets, sumOverSubsetsBySubmask: sumOverSubsetsBySubmask,
    travellingSalesman: travellingSalesman, tspBruteForce: tspBruteForce,
    assignment: assignment, assignmentBruteForce: assignmentBruteForce,
    dominoTilings: dominoTilings, memoryFor: memoryFor
  };
}));
