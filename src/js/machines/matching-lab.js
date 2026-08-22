/**
 * MatchingLab - the harness the two M14 matching sections drive.
 *
 * Matching fails the way flow fails: by returning a well-formed answer that is
 * one edge short. So every run here is checked three ways rather than one -
 * the matching is consistent (matchLeft and matchRight agree and every pair is
 * a real edge), it agrees in size with an independent method, and on the
 * general graphs it agrees with an exhaustive search. The disagreement count
 * is a reported field, never an exception, because a section whose whole point
 * is "this algorithm is subtly wrong here" has to be able to render the wrong
 * answer beside the right one.
 *
 * The shapes are chosen so that each one makes a different claim visible: a
 * regular graph always has a perfect matching (Hall's condition holds
 * everywhere), an unbalanced one never does, and the deficiency shape hides a
 * Hall violator that the alternating search will hand back as a witness.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MatchingLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function modules() {
    if (typeof module !== 'undefined' && module.exports) {
      return {
        Matching: require('../algorithms/matching.js'),
        Weighted: require('../algorithms/weighted-matching.js'),
        MaxFlow: require('../algorithms/max-flow.js'),
        Random: require('../utils/random.js')
      };
    }
    return { Matching: scope.Matching, Weighted: scope.WeightedMatching,
      MaxFlow: scope.MaxFlow, Random: scope.Random };
  }

  const SHAPES = ['random', 'sparse', 'dense', 'unbalanced', 'deficiency', 'regular'];

  /* ------------------------------------------------------------ generation */

  const SETTINGS = {
    random: { degree: 3 }, sparse: { degree: 2 }, dense: { degree: 5 },
    unbalanced: { degree: 3 }, deficiency: { degree: 2 }, regular: { degree: 3 }
  };

  /**
   * One entry point for every bipartite shape. `left` and `right` are the two
   * sides; `degree` is how many partners each left vertex draws, which is what
   * separates the shapes far more than the vertex count does.
   */
  function build(spec) {
    const settings = spec || {};
    const shape = settings.shape || 'random';
    const random = modules().Random.seeded(settings.seed === undefined ? 1 : settings.seed);
    const left = settings.left || 9;
    const right = shape === 'unbalanced' ? Math.max(2, Math.floor(left / 2)) : (settings.right || left);
    const degree = settings.degree || SETTINGS[shape].degree;

    if (shape === 'regular') return regularGraph(left, degree, random);

    if (shape === 'deficiency') return deficiencyGraph(left, right, degree, random);
    return spreadGraph({ left: left, right: right, degree: degree, random: random, shape: shape });
  }

  /** Each left vertex draws `degree` partners at random, deduplicated. */
  function spreadGraph(context) {
    const edges = [];
    const seen = {};

    for (let a = 0; a < context.left; a += 1) {
      for (let i = 0; i < context.degree; i += 1) {
        const b = context.random.int(context.right);
        const key = a + '>' + b;

        if (seen[key]) continue;
        seen[key] = true;
        edges.push({ from: a, to: b });
      }
    }
    return { left: context.left, right: context.right, edges: edges, name: context.shape };
  }

  /**
   * A d-regular bipartite graph, built as d edge-disjoint perfect matchings.
   * Koenig's edge-colouring theorem says such a graph decomposes into exactly
   * d perfect matchings, so this shape is the one where "the matching is
   * perfect" is a construction rather than a hope.
   */
  function regularGraph(size, degree, random) {
    const edges = [];
    const seen = {};

    for (let round = 0; round < degree; round += 1) {
      const order = [];

      for (let b = 0; b < size; b += 1) order.push(b);

      for (let i = size - 1; i > 0; i -= 1) {
        const j = random.int(i + 1);
        const swap = order[i];

        order[i] = order[j];
        order[j] = swap;
      }
      order.forEach(function (b, a) {
        const key = a + '>' + b;

        if (seen[key]) return;
        seen[key] = true;
        edges.push({ from: a, to: b });
      });
    }
    return { left: size, right: size, edges: edges, name: 'regular' };
  }

  /**
   * Three left vertices sharing two right vertices - the smallest Hall
   * violator - embedded in an otherwise matchable graph, so the deficiency is
   * one and the witness is findable rather than obvious.
   */
  function deficiencyGraph(left, right, degree, random) {
    const graph = spreadGraph({ left: left, right: right, degree: degree,
      random: random, shape: 'deficiency' });
    const edges = graph.edges.filter(function (edge) { return edge.from > 2; });

    [0, 1, 2].forEach(function (a) {
      edges.push({ from: a, to: 0 });
      edges.push({ from: a, to: 1 });
    });
    return { left: left, right: right, edges: edges, name: 'deficiency' };
  }

  /* ---------------------------------------------------------- bipartite runs */

  /**
   * Kuhn, Hopcroft-Karp and the flow reduction on the same graph. Three
   * derivations of one number: if they ever disagree, the section says so in a
   * column rather than throwing.
   */
  function compareMatchings(graph) {
    const M = modules();
    const rows = [
      row('Kuhn — one augmenting path at a time', M.Matching.kuhn(graph, {}), graph),
      row('Hopcroft-Karp — a phase of disjoint paths', M.Matching.hopcroftKarp(graph, {}), graph),
      row('unit-capacity maximum flow', viaFlow(graph), graph)
    ];
    const sizes = rows.map(function (entry) { return entry.size; });
    const disagreements = sizes.filter(function (size) { return size !== sizes[0]; }).length;

    return { rows: rows, size: sizes[0], disagreements: disagreements,
      invalid: rows.filter(function (entry) { return !entry.valid; }).length,
      agree: disagreements === 0 && rows.every(function (entry) { return entry.valid; }) };
  }

  function row(name, run, graph) {
    const check = modules().Matching.checkMatching(graph, run);

    return { name: name, size: run.size, report: run.report, valid: check.valid,
      bogus: check.bogus, inconsistent: check.inconsistent, matchLeft: run.matchLeft };
  }

  /** The reduction M14.5 is really about: a unit-capacity flow IS a matching. */
  function viaFlow(graph) {
    const M = modules();
    const source = graph.left + graph.right;
    const sink = source + 1;
    const edges = [];

    for (let a = 0; a < graph.left; a += 1) edges.push({ from: source, to: a, capacity: 1 });
    graph.edges.forEach(function (edge) {
      edges.push({ from: edge.from, to: graph.left + edge.to, capacity: 1 });
    });

    for (let b = 0; b < graph.right; b += 1) {
      edges.push({ from: graph.left + b, to: sink, capacity: 1 });
    }
    const run = M.MaxFlow.dinic({ n: sink + 1, edges: edges, source: source, sink: sink },
      source, sink, {});

    return flowToMatching(run, graph, source);
  }

  function flowToMatching(run, graph, source) {
    const M = modules();
    const matchLeft = new Array(graph.left).fill(-1);
    const matchRight = new Array(graph.right).fill(-1);

    M.MaxFlow.flowOnEdges(run.network).forEach(function (entry) {
      if (entry.flow <= 0 || entry.from >= graph.left) return;

      if (entry.to < graph.left || entry.to >= source) return;
      matchLeft[entry.from] = entry.to - graph.left;
      matchRight[entry.to - graph.left] = entry.from;
    });
    return { matchLeft: matchLeft, matchRight: matchRight, size: run.value, report: run.report };
  }

  /** Koenig and Hall on one matching, because they are two readings of it. */
  function structureRun(graph) {
    const M = modules();
    const matching = M.Matching.hopcroftKarp(graph, {});
    const cover = M.Matching.vertexCover(graph, matching);
    const violator = M.Matching.hallViolator(graph, matching);

    return { matching: matching, cover: cover, check: M.Matching.checkCover(graph, cover),
      violator: violator, perfect: matching.size === Math.min(graph.left, graph.right),
      deficiency: graph.left - matching.size };
  }

  /**
   * The phase count is the entire difference between Kuhn and Hopcroft-Karp,
   * and the claim is that it grows like sqrt(V) rather than like V. One row
   * per size, so the claim is a column the learner can read rather than a
   * complexity quoted in prose.
   */
  function phaseSweep(options) {
    const settings = options || {};
    const M = modules();

    return (settings.sizes || [8, 16, 32, 64, 128, 256]).map(function (size) {
      const graph = build({ shape: settings.shape || 'random', left: size, right: size,
        degree: settings.degree || 3, seed: settings.seed || 1 });
      const kuhn = M.Matching.kuhn(graph, {});
      const hk = M.Matching.hopcroftKarp(graph, {});

      return { size: size, matching: hk.size, agree: kuhn.size === hk.size,
        phases: hk.report.phases, longestPath: hk.report.longestPath,
        root: Math.sqrt(size), kuhnEdges: kuhn.report.edgesExamined,
        hkEdges: hk.report.edgesExamined };
    });
  }

  /* -------------------------------------------------------- stable matching */

  /** Preference lists are a permutation per person, not a graph. */
  function preferences(size, seed) {
    const random = modules().Random.seeded(seed);
    const lists = [];

    for (let who = 0; who < size; who += 1) {
      const order = [];

      for (let other = 0; other < size; other += 1) order.push(other);

      for (let i = size - 1; i > 0; i -= 1) {
        const j = random.int(i + 1);
        const swap = order[i];

        order[i] = order[j];
        order[j] = swap;
      }
      lists.push(order);
    }
    return lists;
  }

  /**
   * Both sides propose, on the same preferences. Stable, perfect and
   * proposer-optimal are three different properties, and running it twice is
   * the only way to show that the third one is real.
   */
  function stableRun(options) {
    const settings = options || {};
    const M = modules();
    const size = settings.size || 8;
    const left = preferences(size, settings.seed || 1);
    const right = preferences(size, (settings.seed || 1) + 100);
    const byLeft = M.Matching.galeShapley(left, right, {});
    const byRight = M.Matching.galeShapley(right, left, {});
    const flipped = { matchLeft: byRight.matchRight, matchRight: byRight.matchLeft };

    return { size: size, left: left, right: right, byLeft: byLeft, byRight: byRight,
      leftBlocking: M.Matching.blockingPairs(left, right, byLeft),
      rightBlocking: M.Matching.blockingPairs(left, right, flipped),
      same: sameMatching(byLeft.matchLeft, flipped.matchLeft),
      leftRank: rankSum(left, byLeft.matchLeft), rightRank: rankSum(left, flipped.matchLeft) };
  }

  function sameMatching(a, b) {
    let same = 0;

    a.forEach(function (partner, who) { if (partner === b[who]) same += 1; });
    return same;
  }

  /** How far down its own list each proposer ended up; 0 is first choice. */
  function rankSum(lists, match) {
    let total = 0;

    match.forEach(function (partner, who) { total += lists[who].indexOf(partner); });
    return total;
  }

  /* ------------------------------------------------------------ general graphs */

  /**
   * Odd cycles are where the bipartite argument dies. Bipartite-style
   * augmentation on a general graph is not slower, it is wrong, and the
   * `naive` row here is exactly that mistake so the shortfall can be counted.
   */
  function generalRun(options) {
    const settings = options || {};
    const M = modules();
    const adjacency = settings.adjacency || generalGraph(settings);
    const blossom = M.Weighted.blossomMatching(adjacency, {});
    const truth = adjacency.length <= (settings.bruteLimit || 14)
      ? M.Weighted.matchingByBruteForce(adjacency) : null;

    return { adjacency: adjacency, blossom: blossom,
      check: M.Weighted.checkGeneralMatching(adjacency, blossom.match),
      naive: naiveMatching(adjacency), truth: truth,
      optimal: truth === null ? null : blossom.size === truth };
  }

  /**
   * Greedy plus bipartite-style augmentation with no blossom contraction: the
   * search marks a vertex once and so cannot re-enter an odd cycle from the
   * other side, which is precisely the case Edmonds's contraction exists for.
   */
  function naiveMatching(adjacency) {
    const match = new Array(adjacency.length).fill(-1);
    let size = 0;

    for (let v = 0; v < adjacency.length; v += 1) {
      if (match[v] !== -1) continue;
      const seen = new Array(adjacency.length).fill(false);

      if (!naiveAugment(adjacency, v, match, seen)) continue;
      size += 1;
    }
    return { match: match, size: size };
  }

  function naiveAugment(adjacency, v, match, seen) {
    seen[v] = true;

    for (let i = 0; i < adjacency[v].length; i += 1) {
      const u = adjacency[v][i];

      if (seen[u]) continue;
      seen[u] = true;

      if (match[u] === -1 || naiveAugment(adjacency, match[u], match, seen)) {
        match[u] = v;
        match[v] = u;
        return true;
      }
    }
    return false;
  }

  /**
   * The smallest graph found by exhaustive search on which bipartite-style
   * augmentation is not slow but WRONG: two triangles sharing vertex 3, plus a
   * pendant on 4. The naive search reaches 2 and stops; the true maximum is 3,
   * and Edmonds gets there by contracting one of the odd cycles.
   */
  const ODD_CYCLE_EDGES = [[0, 1], [0, 3], [1, 3], [1, 4], [2, 4], [3, 4], [3, 5], [4, 5]];

  /**
   * The same eight edges in the order that makes the naive search fail. Sorting
   * each list ascending instead makes it succeed on the very same graph, which
   * is why the `order` argument exists: the failure depends on the neighbour
   * order, so a test that builds its adjacency lists in a convenient order will
   * never see it.
   */
  const ODD_CYCLE_FAILING = [[3, 1], [3, 4, 0], [4], [4, 0, 1, 5], [3, 2, 5, 1], [4, 3]];

  function oddCycleFixture(order) {
    if (order === 'sorted') {
      return ODD_CYCLE_FAILING.map(function (list) {
        return list.slice().sort(function (a, b) { return a - b; });
      });
    }
    return ODD_CYCLE_FAILING.map(function (list) { return list.slice(); });
  }

  /**
   * How often the naive method is short over a family of random graphs. The
   * answer is "rarely", and that is the teaching: a bug that fires on 3 inputs
   * in 60 survives every test written from examples somebody typed by hand.
   */
  function naiveFailureRate(options) {
    const settings = options || {};
    const trials = settings.trials || 60;
    let short = 0;
    let deficit = 0;

    for (let seed = 1; seed <= trials; seed += 1) {
      const adjacency = generalGraph({ n: settings.n || 14, m: settings.m || 24, seed: seed });
      const naive = naiveMatching(adjacency).size;
      const blossom = modules().Weighted.blossomMatching(adjacency, {}).size;

      if (naive >= blossom) continue;
      short += 1;
      deficit += blossom - naive;
    }
    return { trials: trials, short: short, deficit: deficit };
  }

  /** A random general graph, with a guaranteed odd cycle unless asked not to. */
  function generalGraph(options) {
    const settings = options || {};
    const random = modules().Random.seeded(settings.seed === undefined ? 1 : settings.seed);
    const n = settings.n || 12;
    const adjacency = [];
    const seen = {};

    for (let v = 0; v < n; v += 1) adjacency.push([]);

    function link(a, b) {
      const key = Math.min(a, b) + '-' + Math.max(a, b);

      if (a === b || seen[key]) return;
      seen[key] = true;
      adjacency[a].push(b);
      adjacency[b].push(a);
    }

    if (settings.oddCycle !== false) {
      for (let i = 0; i < 5; i += 1) link(i, (i + 1) % 5);
    }

    for (let i = 0; i < (settings.m || 16); i += 1) link(random.int(n), random.int(n));
    return adjacency;
  }

  /**
   * The Hungarian algorithm against an exhaustive permutation search. n! grows
   * fast, so the brute force is capped and reports whether it ran.
   */
  function assignmentRun(options) {
    const settings = options || {};
    const M = modules();
    const matrix = settings.matrix || costMatrix(settings);
    const run = M.Weighted.hungarian(matrix, {});
    const limit = settings.bruteLimit === undefined ? 8 : settings.bruteLimit;
    const truth = matrix.length <= limit ? bruteForceAssignment(matrix) : null;

    return { matrix: matrix, run: run, check: M.Weighted.checkHungarian(matrix, run),
      greedy: greedyAssignment(matrix), truth: truth,
      optimal: truth === null ? null : run.cost === truth.cost,
      permutations: truth === null ? 0 : truth.permutations };
  }

  function costMatrix(options) {
    const settings = options || {};
    const random = modules().Random.seeded(settings.seed === undefined ? 1 : settings.seed);
    const size = settings.size || 6;
    const range = settings.range || 20;
    const matrix = [];

    for (let r = 0; r < size; r += 1) {
      const row2 = [];

      for (let c = 0; c < size; c += 1) row2.push(1 + random.int(range));
      matrix.push(row2);
    }
    return matrix;
  }

  /** Take the cheapest remaining cell each time - the answer everybody writes
   *  first, and the one the section prices against the optimum. */
  function greedyAssignment(matrix) {
    const size = matrix.length;
    const used = new Array(size).fill(false);
    const assignment = new Array(size).fill(-1);
    let cost = 0;

    for (let r = 0; r < size; r += 1) {
      let best = -1;

      for (let c = 0; c < size; c += 1) {
        if (used[c]) continue;

        if (best === -1 || matrix[r][c] < matrix[r][best]) best = c;
      }
      used[best] = true;
      assignment[r] = best;
      cost += matrix[r][best];
    }
    return { assignment: assignment, cost: cost };
  }

  function bruteForceAssignment(matrix) {
    const size = matrix.length;
    const order = [];
    let best = Infinity;
    let bestOrder = null;

    for (let c = 0; c < size; c += 1) order.push(c);

    function walk(depth, used, cost) {
      if (cost >= best) return;

      if (depth === size) {
        best = cost;
        bestOrder = used.slice();
        return;
      }

      for (let c = 0; c < size; c += 1) {
        if (used.indexOf(c) !== -1) continue;
        used.push(c);
        walk(depth + 1, used, cost + matrix[depth][c]);
        used.pop();
      }
    }
    walk(0, [], 0);
    return { cost: best, assignment: bestOrder, permutations: factorial(size) };
  }

  function factorial(n) {
    let total = 1;

    for (let i = 2; i <= n; i += 1) total *= i;
    return total;
  }

  return {
    SHAPES: SHAPES, modules: modules, build: build,
    compareMatchings: compareMatchings, structureRun: structureRun, phaseSweep: phaseSweep,
    preferences: preferences, stableRun: stableRun,
    generalRun: generalRun, generalGraph: generalGraph, naiveMatching: naiveMatching,
    oddCycleFixture: oddCycleFixture, naiveFailureRate: naiveFailureRate,
    ODD_CYCLE_EDGES: ODD_CYCLE_EDGES,
    assignmentRun: assignmentRun, costMatrix: costMatrix,
    greedyAssignment: greedyAssignment, bruteForceAssignment: bruteForceAssignment
  };
}));
