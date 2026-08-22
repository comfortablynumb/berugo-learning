/**
 * ReductionLab - named reductions with a forward map, a solve and a backward
 * map, each one checked by *round-tripping*.
 *
 * The modelling skill this milestone is about is not implementing flow. It is
 * recognising that "which items do I select to maximise profit given
 * prerequisites", "which pixels are foreground", "which tasks can share a
 * slot" and "how many workers can be assigned" are four statements of three
 * graph problems. Each entry here does the whole loop: build the target
 * instance, solve it with the target algorithm, map the answer back, and then
 * *verify the mapped answer against the source problem's own definition*.
 *
 * That last step is what makes a reduction trustworthy. A forward map with an
 * off-by-one produces a target instance that solves cleanly and maps back to
 * something that is not a solution to anything, and nothing else notices.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ReductionLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function modules() {
    if (typeof module !== 'undefined' && module.exports) {
      return {
        MaxFlow: require('../algorithms/max-flow.js'),
        Matching: require('../algorithms/matching.js'),
        Coloring: require('../algorithms/coloring.js'),
        TwoSat: require('../algorithms/two-sat.js'),
        Random: require('../utils/random.js')
      };
    }
    return { MaxFlow: scope.MaxFlow, Matching: scope.Matching, Coloring: scope.Coloring,
      TwoSat: scope.TwoSat, Random: scope.Random };
  }

  const NAMES = ['matching-to-flow', 'cover-to-matching', 'closure-to-cut',
    'independent-to-clique', 'scheduling-to-2sat'];

  /* --------------------------------------------- matching as maximum flow */

  /** Source to every left vertex, every edge, every right vertex to the sink,
   *  all at capacity one. Integrality does the rest: a max flow of value k is
   *  k edge-disjoint unit paths, which is a matching of size k. */
  function matchingToFlow(instance) {
    const M = modules();
    const left = instance.left;
    const source = left + instance.right;
    const sink = source + 1;
    const edges = [];

    for (let a = 0; a < left; a += 1) edges.push({ from: source, to: a, capacity: 1 });
    instance.edges.forEach(function (edge) {
      edges.push({ from: edge.from, to: left + edge.to, capacity: 1 });
    });

    for (let b = 0; b < instance.right; b += 1) {
      edges.push({ from: left + b, to: sink, capacity: 1 });
    }
    const network = { n: sink + 1, edges: edges, source: source, sink: sink };
    const run = M.MaxFlow.dinic(network, source, sink, {});
    const matchLeft = new Array(left).fill(-1);
    const matchRight = new Array(instance.right).fill(-1);

    M.MaxFlow.flowOnEdges(run.network).forEach(function (entry) {
      if (entry.flow <= 0 || entry.from >= left || entry.to < left || entry.to >= source) return;
      matchLeft[entry.from] = entry.to - left;
      matchRight[entry.to - left] = entry.from;
    });
    const mapped = { matchLeft: matchLeft, matchRight: matchRight,
      size: matchLeft.filter(function (r) { return r !== -1; }).length };
    const direct = M.Matching.kuhn(instance, {});

    return { target: network, targetValue: run.value, mapped: mapped, direct: direct.size,
      valid: M.Matching.checkMatching(instance, mapped).valid && mapped.size === run.value &&
        run.value === direct.size,
      note: 'a unit-capacity flow of value ' + run.value + ' IS a matching of size ' + mapped.size };
  }

  /* ------------------------------------- vertex cover as a maximum matching */

  /** Koenig: on a bipartite graph the minimum vertex cover has exactly the
   *  size of the maximum matching, and the cover is read off an alternating
   *  search. On a general graph this is false and the problem is NP-hard. */
  function coverToMatching(instance) {
    const M = modules();
    const matching = M.Matching.kuhn(instance, {});
    const cover = M.Matching.vertexCover(instance, matching);
    const check = M.Matching.checkCover(instance, cover);

    return { target: matching, targetValue: matching.size, mapped: cover,
      direct: matching.size,
      valid: check.valid && cover.size === matching.size,
      note: 'maximum matching ' + matching.size + ' equals minimum vertex cover ' + cover.size +
        ', and the cover covers all ' + instance.edges.length + ' edges' };
  }

  /* ----------------------------------------- project selection as a min cut */

  /**
   * Maximum closure: choose a set of projects closed under prerequisites, to
   * maximise profit. Profitable projects get a source arc worth their profit,
   * costly ones a sink arc worth their cost, and every prerequisite an arc of
   * infinite capacity - which is what makes any finite cut respect it. The
   * answer is (total positive profit) minus the minimum cut.
   */
  function closureToCut(instance) {
    const M = modules();
    const n = instance.profit.length;
    const source = n;
    const sink = n + 1;
    const edges = [];
    let positive = 0;

    instance.profit.forEach(function (value, v) {
      if (value > 0) { edges.push({ from: source, to: v, capacity: value }); positive += value; }
      else if (value < 0) edges.push({ from: v, to: sink, capacity: -value });
    });
    instance.requires.forEach(function (pair) {
      edges.push({ from: pair[0], to: pair[1], capacity: Infinity });
    });
    const network = { n: n + 2, edges: edges, source: source, sink: sink };
    const run = M.MaxFlow.dinic(network, source, sink, {});
    const cut = M.MaxFlow.minCut(run.network, source);
    const chosen = [];

    for (let v = 0; v < n; v += 1) {
      if (!cut.side[v]) continue;
      chosen.push(v);
    }
    const profit = chosen.reduce(function (sum, v) { return sum + instance.profit[v]; }, 0);

    return { target: network, targetValue: run.value, mapped: { chosen: chosen, profit: profit },
      direct: closureByBruteForce(instance),
      valid: isClosed(instance, chosen) && profit === positive - run.value &&
        profit === closureByBruteForce(instance),
      note: 'total positive profit ' + positive + ' minus a minimum cut of ' + run.value +
        ' is ' + profit };
  }

  /** Every prerequisite of a chosen project must itself be chosen. */
  function isClosed(instance, chosen) {
    const set = new Set(chosen);
    let broken = 0;

    instance.requires.forEach(function (pair) {
      if (!set.has(pair[0]) || set.has(pair[1])) return;
      broken += 1;
    });
    return broken === 0;
  }

  /** Every subset, tested for closure and scored. The only oracle that owes
   *  nothing to the cut construction. */
  function closureByBruteForce(instance) {
    const n = instance.profit.length;

    if (n > 18) return null;
    let best = 0;

    for (let mask = 0; mask < (1 << n); mask += 1) {
      const chosen = [];

      for (let v = 0; v < n; v += 1) {
        if ((mask & (1 << v)) === 0) continue;
        chosen.push(v);
      }

      if (!isClosed(instance, chosen)) continue;
      best = Math.max(best, chosen.reduce(function (sum, v) {
        return sum + instance.profit[v];
      }, 0));
    }
    return best;
  }

  /* ------------------------------------- independent set as a clique problem */

  /** An independent set in G is a clique in the complement of G, and the
   *  complement of a maximum independent set is a minimum vertex cover. Three
   *  problems, one computation, and no algorithm changes at all. */
  function independentToClique(instance) {
    const M = modules();
    const complement = M.Coloring.complement(instance.adjacency);
    const run = M.Coloring.bronKerbosch(complement, {});
    let best = [];

    run.cliques.forEach(function (clique) {
      if (clique.length <= best.length) return;
      best = clique;
    });
    const cover = [];

    for (let v = 0; v < instance.adjacency.length; v += 1) {
      if (best.indexOf(v) !== -1) continue;
      cover.push(v);
    }
    const independent = M.Coloring.checkIndependent(instance.adjacency, best);
    const clique = M.Coloring.checkClique(complement, best);

    return { target: complement, targetValue: best.length,
      mapped: { independent: best, cover: cover },
      direct: best.length,
      valid: independent.valid && clique.valid && coversEverything(instance.adjacency, cover),
      note: 'a clique of ' + best.length + ' in the complement is an independent set of ' +
        best.length + ', and the other ' + cover.length + ' vertices are a vertex cover' };
  }

  function coversEverything(adjacency, cover) {
    const set = new Set(cover);
    let uncovered = 0;

    adjacency.forEach(function (list, v) {
      list.forEach(function (w) {
        if (set.has(v) || set.has(w)) return;
        uncovered += 1;
      });
    });
    return uncovered === 0;
  }

  /* ----------------------------------------------- scheduling as 2-SAT */

  /**
   * Each task picks one of two slots, and a conflicting pair must not share
   * one. Two slots is exactly what makes this 2-SAT: with three the clauses
   * gain a third literal and the whole approach collapses into NP-hardness.
   */
  function schedulingToTwoSat(instance) {
    const M = modules();
    const model = M.TwoSat.schedulingModel(instance.tasks, instance.conflicts);
    const run = M.TwoSat.solve(model.variables, model.clauses, {});
    const truth = M.TwoSat.solveByBruteForce(model.variables, model.clauses);

    if (!run.satisfiable) {
      return { target: model, targetValue: 0, mapped: null, direct: truth.satisfiable,
        valid: truth.satisfiable === false,
        note: 'unsatisfiable: variables ' + run.contradictions.join(', ') +
          ' share a component with their own negation' };
    }
    const slots = run.assignment.map(function (value) { return value ? 0 : 1; });
    let broken = 0;

    instance.conflicts.forEach(function (pair) {
      if (slots[pair[0]] !== slots[pair[1]]) return;
      broken += 1;
    });
    return { target: model, targetValue: model.clauses.length,
      mapped: { slots: slots, brokenConflicts: broken }, direct: truth.satisfiable,
      valid: broken === 0 && truth.satisfiable,
      note: model.clauses.length + ' clauses over ' + model.variables +
        ' tasks, and every conflict respected' };
  }

  /* ---------------------------------------------------------- the registry */

  function run(name, instance) {
    if (name === 'matching-to-flow') return matchingToFlow(instance);

    if (name === 'cover-to-matching') return coverToMatching(instance);

    if (name === 'closure-to-cut') return closureToCut(instance);

    if (name === 'independent-to-clique') return independentToClique(instance);
    return schedulingToTwoSat(instance);
  }

  /* --------------------------------------------------------- the instances */

  function bipartiteInstance(seed, options) {
    const settings = options || {};
    const random = modules().Random.seeded(seed);
    const left = settings.left || 7;
    const right = settings.right || 7;
    const edges = [];
    const seen = {};

    for (let i = 0; i < (settings.m || 16); i += 1) {
      const a = random.int(left);
      const b = random.int(right);
      const key = a + '>' + b;

      if (seen[key]) continue;
      seen[key] = true;
      edges.push({ from: a, to: b });
    }
    return { left: left, right: right, edges: edges };
  }

  function projectInstance(seed, options) {
    const settings = options || {};
    const random = modules().Random.seeded(seed);
    const count = settings.count || 8;
    const profit = [];

    for (let v = 0; v < count; v += 1) profit.push(random.int(21) - 8);
    const requires = [];
    const seen = {};

    for (let i = 0; i < (settings.links || 8); i += 1) {
      const a = random.int(count);
      const b = random.int(count);
      const key = a + '>' + b;

      if (a === b || seen[key]) continue;
      seen[key] = true;
      requires.push([a, b]);
    }
    return { profit: profit, requires: requires };
  }

  function generalInstance(seed, options) {
    const settings = options || {};
    const random = modules().Random.seeded(seed);
    const n = settings.n || 10;
    const adjacency = [];

    for (let v = 0; v < n; v += 1) adjacency.push([]);
    const seen = {};

    for (let i = 0; i < (settings.m || 18); i += 1) {
      const a = random.int(n);
      const b = random.int(n);
      const key = Math.min(a, b) + '-' + Math.max(a, b);

      if (a === b || seen[key]) continue;
      seen[key] = true;
      adjacency[a].push(b);
      adjacency[b].push(a);
    }
    return { adjacency: adjacency };
  }

  function schedulingInstance(seed, options) {
    const settings = options || {};
    const random = modules().Random.seeded(seed);
    const tasks = settings.tasks || 8;
    const conflicts = [];
    const seen = {};

    for (let i = 0; i < (settings.conflicts || 7); i += 1) {
      const a = random.int(tasks);
      const b = random.int(tasks);
      const key = Math.min(a, b) + '-' + Math.max(a, b);

      if (a === b || seen[key]) continue;
      seen[key] = true;
      conflicts.push([a, b]);
    }
    return { tasks: tasks, conflicts: conflicts };
  }

  function instanceFor(name, seed, options) {
    if (name === 'closure-to-cut') return projectInstance(seed, options);

    if (name === 'independent-to-clique') return generalInstance(seed, options);

    if (name === 'scheduling-to-2sat') return schedulingInstance(seed, options);
    return bipartiteInstance(seed, options);
  }

  return {
    NAMES: NAMES, run: run, instanceFor: instanceFor,
    matchingToFlow: matchingToFlow, coverToMatching: coverToMatching,
    closureToCut: closureToCut, independentToClique: independentToClique,
    schedulingToTwoSat: schedulingToTwoSat,
    isClosed: isClosed, closureByBruteForce: closureByBruteForce,
    bipartiteInstance: bipartiteInstance, projectInstance: projectInstance,
    generalInstance: generalInstance, schedulingInstance: schedulingInstance
  };
}));
