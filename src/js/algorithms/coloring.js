/**
 * Graph colouring, maximum cliques, and the three problems that are one
 * problem: clique, independent set and vertex cover.
 *
 * Greedy colouring never uses more than `degeneracy + 1` colours *if it visits
 * the vertices in degeneracy order*, and the ordering is the whole algorithm -
 * the same greedy loop over a different order can use several times as many
 * colours on the same graph. On interval graphs and other perfect graphs the
 * degeneracy order makes greedy exactly optimal, which is why interval
 * scheduling is solved and register allocation is not.
 *
 * Bron-Kerbosch enumerates maximal cliques, and the pivoting rule is not a
 * micro-optimisation: it prunes whole branches that can only produce
 * non-maximal cliques, and the recursion-node counts here differ by an order
 * of magnitude on ordinary graphs.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Coloring = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { comparisons: 0, colourChecks: 0, recursionNodes: 0, maximalCliques: 0,
      pivotsUsed: 0, removals: 0 };
  }

  function neighbourSets(adjacency) {
    return adjacency.map(function (list) { return new Set(list); });
  }

  /* ------------------------------------------------------------ orderings */

  function naturalOrder(adjacency) {
    const out = [];

    for (let v = 0; v < adjacency.length; v += 1) out.push(v);
    return out;
  }

  /** Welsh-Powell: highest degree first. Cheap, and often much worse than
   *  degeneracy order despite sounding like the same idea. */
  function degreeOrder(adjacency) {
    return naturalOrder(adjacency).sort(function (a, b) {
      return adjacency[b].length - adjacency[a].length || a - b;
    });
  }

  /**
   * Degeneracy (smallest-last) order: repeatedly remove a minimum-degree
   * vertex from what is left, then reverse. The largest degree seen at removal
   * time IS the degeneracy, and colouring in this order needs at most
   * degeneracy + 1 colours - a bound that no other cheap ordering gives.
   */
  function degeneracyOrder(adjacency, options) {
    const report = (options || {}).report || emptyReport();
    const degree = adjacency.map(function (list) { return list.length; });
    const removed = new Array(adjacency.length).fill(false);
    const order = [];
    let degeneracy = 0;

    for (let step = 0; step < adjacency.length; step += 1) {
      let best = -1;

      for (let v = 0; v < adjacency.length; v += 1) {
        if (removed[v]) continue;
        report.comparisons += 1;

        if (best === -1 || degree[v] < degree[best]) best = v;
      }
      degeneracy = Math.max(degeneracy, degree[best]);
      removed[best] = true;
      report.removals += 1;
      order.push(best);
      adjacency[best].forEach(function (w) {
        if (removed[w]) return;
        degree[w] -= 1;
      });
    }
    return { order: order.reverse(), degeneracy: degeneracy, report: report };
  }

  /* ------------------------------------------------------------ colouring */

  /** First colour not used by an already-coloured neighbour. */
  function greedyColoring(adjacency, order, options) {
    const report = (options || {}).report || emptyReport();
    const colour = new Array(adjacency.length).fill(-1);

    order.forEach(function (v) {
      const taken = new Set();

      adjacency[v].forEach(function (w) {
        report.colourChecks += 1;

        if (colour[w] === -1) return;
        taken.add(colour[w]);
      });
      let pick = 0;

      while (taken.has(pick)) pick += 1;
      colour[v] = pick;
    });
    const used = new Set(colour);
    return { colour: colour, colours: used.size, report: report };
  }

  /** Two adjacent vertices sharing a colour is the only way to be wrong. */
  function checkColoring(adjacency, colour) {
    let conflicts = 0;

    adjacency.forEach(function (list, v) {
      list.forEach(function (w) {
        if (colour[v] !== colour[w]) return;
        conflicts += 1;
      });
    });
    return { conflicts: conflicts / 2, valid: conflicts === 0 };
  }

  /** The chromatic number, by trying every colouring. Exponential, and the
   *  only way to know whether greedy was optimal or merely plausible. */
  function chromaticNumber(adjacency, limit) {
    const n = adjacency.length;
    const cap = limit === undefined ? 12 : limit;

    if (n > cap) return null;
    const sets = neighbourSets(adjacency);

    for (let k = 1; k <= n; k += 1) {
      const colour = new Array(n).fill(-1);

      if (canColour(sets, colour, 0, k)) return k;
    }
    return n;
  }

  function canColour(sets, colour, v, k) {
    if (v >= colour.length) return true;

    for (let pick = 0; pick < k; pick += 1) {
      let clash = false;

      sets[v].forEach(function (w) {
        if (colour[w] !== pick) return;
        clash = true;
      });

      if (clash) continue;
      colour[v] = pick;

      if (canColour(sets, colour, v + 1, k)) return true;
      colour[v] = -1;
    }
    return false;
  }

  /* ------------------------------------------------------ Bron-Kerbosch */

  function bronKerboschStep(sets, state, context) {
    context.report.recursionNodes += 1;

    if (state.candidates.size === 0 && state.excluded.size === 0) {
      context.report.maximalCliques += 1;
      context.cliques.push(state.current.slice());
      context.largest = Math.max(context.largest, state.current.length);
      return;
    }
    const order = context.pivot
      ? withoutPivotNeighbours(sets, state, context)
      : Array.from(state.candidates);

    order.forEach(function (v) {
      if (!state.candidates.has(v)) return;
      state.current.push(v);
      bronKerboschStep(sets, {
        current: state.current,
        candidates: intersect(state.candidates, sets[v]),
        excluded: intersect(state.excluded, sets[v])
      }, context);
      state.current.pop();
      state.candidates.delete(v);
      state.excluded.add(v);
    });
  }

  /**
   * The pivot is a vertex of `candidates + excluded` with the most neighbours
   * among the candidates. Every maximal clique either contains it or excludes
   * one of its non-neighbours, so only the non-neighbours need branching.
   */
  function withoutPivotNeighbours(sets, state, context) {
    let pivot = -1;
    let best = -1;

    [state.candidates, state.excluded].forEach(function (group) {
      group.forEach(function (v) {
        let count = 0;

        state.candidates.forEach(function (w) { if (sets[v].has(w)) count += 1; });

        if (count <= best) return;
        best = count;
        pivot = v;
      });
    });
    context.report.pivotsUsed += 1;
    return Array.from(state.candidates).filter(function (v) { return !sets[pivot].has(v); });
  }

  function intersect(set, other) {
    const out = new Set();

    set.forEach(function (v) { if (other.has(v)) out.add(v); });
    return out;
  }

  /** Every maximal clique. `pivot: false` runs the unpivoted version, which is
   *  correct and explores far more of the recursion tree. */
  function bronKerbosch(adjacency, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const sets = neighbourSets(adjacency);
    const context = { report: report, cliques: [], largest: 0,
      pivot: settings.pivot !== false };

    bronKerboschStep(sets, { current: [], candidates: new Set(naturalOrder(adjacency)),
      excluded: new Set() }, context);
    return { cliques: context.cliques, largest: context.largest, report: report };
  }

  /* ------------------------------------------------------ the complement */

  /** Clique in G is independent set in the complement is the complement of a
   *  vertex cover. Three problems, one computation, and the mapping is this. */
  function complement(adjacency) {
    const sets = neighbourSets(adjacency);
    const out = [];

    for (let v = 0; v < adjacency.length; v += 1) {
      const list = [];

      for (let w = 0; w < adjacency.length; w += 1) {
        if (v === w || sets[v].has(w)) continue;
        list.push(w);
      }
      out.push(list);
    }
    return out;
  }

  /** Is this set pairwise adjacent? A "clique" that is not is the usual bug. */
  function checkClique(adjacency, vertices) {
    const sets = neighbourSets(adjacency);
    let missing = 0;

    vertices.forEach(function (v, i) {
      vertices.forEach(function (w, j) {
        if (i >= j || sets[v].has(w)) return;
        missing += 1;
      });
    });
    return { missing: missing, valid: missing === 0 };
  }

  /** Is this set pairwise non-adjacent? */
  function checkIndependent(adjacency, vertices) {
    const sets = neighbourSets(adjacency);
    let conflicts = 0;

    vertices.forEach(function (v, i) {
      vertices.forEach(function (w, j) {
        if (i >= j || !sets[v].has(w)) return;
        conflicts += 1;
      });
    });
    return { conflicts: conflicts, valid: conflicts === 0 };
  }

  /* -------------------------------------------------------- the fixtures */

  /**
   * Interval graphs: an edge whenever two intervals overlap. Greedy in
   * left-endpoint order uses exactly the maximum overlap - which is the
   * clique number - so it is optimal, and that is why room scheduling is easy
   * and register allocation is not.
   */
  function intervalGraph(intervals) {
    const adjacency = [];

    for (let v = 0; v < intervals.length; v += 1) adjacency.push([]);
    intervals.forEach(function (a, i) {
      intervals.forEach(function (b, j) {
        if (i >= j || a.end <= b.start || b.end <= a.start) return;
        adjacency[i].push(j);
        adjacency[j].push(i);
      });
    });
    return adjacency;
  }

  /** The maximum number of intervals alive at once, by sweeping endpoints. It
   *  is the clique number, and therefore a lower bound on any colouring. */
  function maxOverlap(intervals) {
    const events = [];

    intervals.forEach(function (interval) {
      events.push({ at: interval.start, delta: 1 });
      events.push({ at: interval.end, delta: -1 });
    });
    events.sort(function (a, b) { return a.at - b.at || a.delta - b.delta; });
    let alive = 0;
    let peak = 0;

    events.forEach(function (event) {
      alive += event.delta;
      peak = Math.max(peak, alive);
    });
    return peak;
  }

  function leftEndpointOrder(intervals) {
    return naturalOrder(intervals).sort(function (a, b) {
      return intervals[a].start - intervals[b].start || a - b;
    });
  }

  return {
    emptyReport: emptyReport, naturalOrder: naturalOrder, degreeOrder: degreeOrder,
    degeneracyOrder: degeneracyOrder, greedyColoring: greedyColoring,
    checkColoring: checkColoring, chromaticNumber: chromaticNumber,
    bronKerbosch: bronKerbosch, complement: complement,
    checkClique: checkClique, checkIndependent: checkIndependent,
    intervalGraph: intervalGraph, maxOverlap: maxOverlap,
    leftEndpointOrder: leftEndpointOrder
  };
}));
