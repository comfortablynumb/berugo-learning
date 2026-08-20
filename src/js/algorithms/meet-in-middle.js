/**
 * Meet in the middle: halving the exponent, and paying for it in memory.
 *
 * A subset-sum search over n items is 2^n. Split the items into two halves,
 * enumerate each half separately, sort one side and binary-search it for each
 * element of the other, and the cost becomes 2^(n/2) · n/2 - which at n = 40
 * is the difference between a trillion states and a million. The technique is
 * Horowitz and Sahni's, and it is the clearest example in this milestone of an
 * asymptotic improvement that is entirely a change of *shape* rather than of
 * cleverness about the problem.
 *
 * The price is stated rather than hidden: `halfStates` is how many partial
 * sums are held in memory at once, and it is the reason the technique tops out
 * around n = 50 whatever the machine. `projectedBruteForce` reports how long
 * the exhaustive search would have taken so the comparison is a number rather
 * than "infeasible".
 *
 * Bidirectional BFS is the same idea on a graph: two frontiers of radius d/2
 * instead of one of radius d, which is b^(d/2) + b^(d/2) rather than b^d. The
 * meeting test is the part people get wrong - a node must be checked against
 * the *other* frontier as it is generated, not after the level completes, or
 * the path found is one edge longer than the shortest.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MeetInMiddle = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return {
      statesGenerated: 0, halfStates: 0, comparisons: 0, probes: 0,
      peakMemory: 0, budgetExhausted: false
    };
  }

  /** Every subset sum of a list, as a sorted array with the subset mask kept
   *  alongside so the answer can be reconstructed rather than merely scored. */
  function subsetSums(values, report) {
    const out = [];
    const total = 1 << values.length;
    for (let mask = 0; mask < total; mask += 1) {
      let sum = 0;
      for (let i = 0; i < values.length; i += 1) {
        if (mask & (1 << i)) sum += values[i];
      }
      out.push({ sum: sum, mask: mask });
      if (report) report.statesGenerated += 1;
    }
    out.sort(function (a, b) { return a.sum - b.sum; });
    return out;
  }

  function lowerBound(sorted, target, report) {
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = lo + ((hi - lo) >> 1);
      if (report) report.probes += 1;
      if (sorted[mid].sum < target) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /**
   * The achievable subset sum closest to `target` without exceeding it, by
   * meet in the middle. Returns the chosen indices so the answer is checkable
   * against a brute-force run rather than only comparable to one.
   */
  function closestSubsetSum(values, target, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const half = Math.floor(values.length / 2);
    const left = values.slice(0, half);
    const right = values.slice(half);

    const leftSums = subsetSums(left, report);
    const rightSums = subsetSums(right, report);
    report.halfStates = Math.max(leftSums.length, rightSums.length);
    report.peakMemory = leftSums.length + rightSums.length;

    let best = { sum: -Infinity, leftMask: 0, rightMask: 0 };
    leftSums.forEach(function (entry) {
      const room = target - entry.sum;
      if (room < 0) return;
      const at = lowerBound(rightSums, room + 1, report);
      if (at === 0) return;
      const partner = rightSums[at - 1];
      report.comparisons += 1;
      if (entry.sum + partner.sum > best.sum) {
        best = { sum: entry.sum + partner.sum, leftMask: entry.mask, rightMask: partner.mask };
      }
    });

    const chosen = [];
    for (let i = 0; i < left.length; i += 1) {
      if (best.leftMask & (1 << i)) chosen.push(i);
    }
    for (let i = 0; i < right.length; i += 1) {
      if (best.rightMask & (1 << i)) chosen.push(half + i);
    }
    return { sum: best.sum === -Infinity ? 0 : best.sum, chosen: chosen, report: report };
  }

  /** The exhaustive answer, and the node count the halving is measured
   *  against. Refuses beyond `maxItems` rather than hanging the page. */
  function closestSubsetSumBruteForce(values, target, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const maxItems = settings.maxItems || 24;
    if (values.length > maxItems) {
      report.budgetExhausted = true;
      return { sum: null, chosen: null, report: report };
    }

    let best = { sum: -Infinity, mask: 0 };
    const total = 1 << values.length;
    for (let mask = 0; mask < total; mask += 1) {
      report.statesGenerated += 1;
      let sum = 0;
      for (let i = 0; i < values.length; i += 1) {
        if (mask & (1 << i)) sum += values[i];
      }
      if (sum <= target && sum > best.sum) best = { sum: sum, mask: mask };
    }

    const chosen = [];
    for (let i = 0; i < values.length; i += 1) {
      if (best.mask & (1 << i)) chosen.push(i);
    }
    return { sum: best.sum === -Infinity ? 0 : best.sum, chosen: chosen, report: report };
  }

  /**
   * How long the exhaustive search would take, from a measured rate rather
   * than from a guess: run it on a size that finishes, then extrapolate by
   * doubling. "Infeasible" is not a number and does not belong in a table.
   */
  function projectedBruteForce(n, options) {
    const settings = options || {};
    const sampleSize = settings.sampleSize || 20;
    const values = [];
    for (let i = 0; i < sampleSize; i += 1) values.push(i + 1);

    const started = Date.now();
    closestSubsetSumBruteForce(values, 1000, { maxItems: sampleSize });
    const elapsed = Math.max(1, Date.now() - started);

    const factor = Math.pow(2, n - sampleSize);
    return {
      sampleSize: sampleSize, sampleMs: elapsed, n: n,
      states: Math.pow(2, n),
      projectedMs: elapsed * factor,
      projectedYears: (elapsed * factor) / (1000 * 60 * 60 * 24 * 365)
    };
  }

  /* ------------------------------------------------- bidirectional search */

  function neighboursOf(graph, node) {
    return graph[node] || [];
  }

  /** Plain BFS, so the frontier sizes have something to be compared with. */
  function breadthFirst(graph, from, to) {
    const report = emptyReport();
    const seen = new Map([[from, 0]]);
    let frontier = [from];
    let depth = 0;

    while (frontier.length) {
      const next = [];
      for (let i = 0; i < frontier.length; i += 1) {
        report.statesGenerated += 1;
        if (frontier[i] === to) return { distance: depth, report: report };
        neighboursOf(graph, frontier[i]).forEach(function (neighbour) {
          if (seen.has(neighbour)) return;
          seen.set(neighbour, depth + 1);
          next.push(neighbour);
        });
      }
      report.peakMemory = Math.max(report.peakMemory, next.length);
      frontier = next;
      depth += 1;
    }
    return { distance: -1, report: report };
  }

  /**
   * Bidirectional BFS. The meeting test happens as each node is generated,
   * against the other side's whole visited map - checking only at the end of a
   * level reports a distance one too large on odd-length paths.
   */
  function bidirectional(graph, from, to) {
    const report = emptyReport();
    if (from === to) return { distance: 0, report: report };

    const sides = [
      { seen: new Map([[from, 0]]), frontier: [from] },
      { seen: new Map([[to, 0]]), frontier: [to] }
    ];

    while (sides[0].frontier.length && sides[1].frontier.length) {
      const which = sides[0].frontier.length <= sides[1].frontier.length ? 0 : 1;
      const here = sides[which];
      const there = sides[1 - which];
      const next = [];

      for (let i = 0; i < here.frontier.length; i += 1) {
        const node = here.frontier[i];
        report.statesGenerated += 1;
        const neighbours = neighboursOf(graph, node);
        for (let j = 0; j < neighbours.length; j += 1) {
          const neighbour = neighbours[j];
          if (here.seen.has(neighbour)) continue;
          const distance = here.seen.get(node) + 1;
          if (there.seen.has(neighbour)) {
            return { distance: distance + there.seen.get(neighbour), report: report };
          }
          here.seen.set(neighbour, distance);
          next.push(neighbour);
        }
      }
      report.peakMemory = Math.max(report.peakMemory, next.length);
      here.frontier = next;
    }
    return { distance: -1, report: report };
  }

  /** A regular graph of the given branching factor and depth, so the b^d and
   *  2·b^(d/2) counts can be compared against their formulas. */
  function regularGraph(branching, depth) {
    const graph = {};
    let frontier = [0];
    let nextId = 1;

    for (let level = 0; level < depth; level += 1) {
      const next = [];
      frontier.forEach(function (node) {
        graph[node] = graph[node] || [];
        for (let b = 0; b < branching; b += 1) {
          const child = nextId;
          nextId += 1;
          graph[node].push(child);
          graph[child] = [node];
          next.push(child);
        }
      });
      frontier = next;
    }
    return { graph: graph, nodes: nextId, deepest: frontier[0] };
  }

  return {
    emptyReport: emptyReport,
    subsetSums: subsetSums,
    closestSubsetSum: closestSubsetSum,
    closestSubsetSumBruteForce: closestSubsetSumBruteForce,
    projectedBruteForce: projectedBruteForce,
    breadthFirst: breadthFirst,
    bidirectional: bidirectional,
    regularGraph: regularGraph
  };
}));
