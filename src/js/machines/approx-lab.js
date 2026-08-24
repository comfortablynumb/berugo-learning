/**
 * ApproxLab - the exact optima that make an approximation ratio a measurement.
 *
 * Every ratio quoted in M19.6-19.9 is a measured number divided by an exact
 * one, and the exact one is computed here by enumeration or by an exponential
 * DP. That is deliberately expensive, and the cost is a reported field on
 * every oracle: it is the whole reason approximation algorithms exist, so
 * hiding it would remove the motivation along with the runtime.
 *
 * The instances are therefore small - a dozen vertices, twenty clauses, eight
 * cities - and the studies run MANY of them rather than one big one, because
 * an approximation ratio is a distribution and quoting its mean, its worst or
 * its bound as though they were the same number is the mistake the whole
 * milestone is arranged against.
 *
 * A second discipline runs through the file: an approximation's answer is
 * checked for FEASIBILITY separately from its cost. A vertex cover that misses
 * an edge is small and looks excellent; a tour that skips a city is short. The
 * ratio column cannot detect either, so every study reports a validity count
 * next to it.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.ApproxLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const Random = scope && scope.Random ? scope.Random : require('../utils/random.js');
  const Approx = scope && scope.Approximation ? scope.Approximation
    : require('../algorithms/approximation.js');
  const Lp = scope && scope.LpRounding ? scope.LpRounding : require('../algorithms/lp-rounding.js');
  const Fptas = scope && scope.Fptas ? scope.Fptas : require('../algorithms/fptas.js');
  const Derand = scope && scope.Derandomize ? scope.Derandomize
    : require('../algorithms/derandomize.js');

  const ENUMERATION_LIMIT = 22;

  /* --------------------------------------------------------- exact oracles */

  /** Every subset, smallest first, stopping at the first valid cover. */
  function exactVertexCover(graph) {
    guard(graph.n);
    const total = 1 << graph.n;
    let examined = 0;

    for (let size = 0; size <= graph.n; size += 1) {
      for (let mask = 0; mask < total; mask += 1) {
        if (popcount(mask) !== size) continue;
        examined += 1;
        if (!coversAll(graph, mask)) continue;
        return { size: size, mask: mask, subsetsExamined: examined, subsets: total };
      }
    }
    return { size: graph.n, mask: total - 1, subsetsExamined: examined, subsets: total };
  }

  function coversAll(graph, mask) {
    for (let i = 0; i < graph.edges.length; i += 1) {
      const edge = graph.edges[i];
      if (!((mask >>> edge.from) & 1) && !((mask >>> edge.to) & 1)) return false;
    }
    return true;
  }

  function popcount(value) {
    let v = value;
    let count = 0;
    while (v > 0) { count += v & 1; v >>>= 1; }
    return count;
  }

  function guard(n) {
    if (n > ENUMERATION_LIMIT) {
      throw new Error('the exact oracle is exponential; n = ' + n + ' exceeds ' + ENUMERATION_LIMIT);
    }
  }

  /** Minimum-cost subfamily covering the universe, by subset enumeration. */
  function exactSetCover(instance) {
    guard(instance.sets.length);
    const total = 1 << instance.sets.length;
    let best = Infinity;
    let bestMask = 0;

    for (let mask = 1; mask < total; mask += 1) {
      const scored = scoreFamily(instance, mask);
      if (!scored.covers || scored.cost >= best) continue;
      best = scored.cost;
      bestMask = mask;
    }
    return { cost: best, mask: bestMask, subsets: total, chosen: membersOf(bestMask) };
  }

  function scoreFamily(instance, mask) {
    const covered = new Array(instance.universe).fill(false);
    let cost = 0;

    for (let s = 0; s < instance.sets.length; s += 1) {
      if (!((mask >>> s) & 1)) continue;
      cost += instance.sets[s].cost === undefined ? 1 : instance.sets[s].cost;
      instance.sets[s].members.forEach(function (e) { covered[e] = true; });
    }
    for (let e = 0; e < instance.universe; e += 1) { if (!covered[e]) return { covers: false, cost: cost }; }
    return { covers: true, cost: cost };
  }

  function membersOf(mask) {
    const out = [];
    let v = mask;
    let index = 0;
    while (v > 0) { if (v & 1) out.push(index); v >>>= 1; index += 1; }
    return out;
  }

  /** Held-Karp: the exact tour in O(2ⁿ·n²), which is the cost the
   *  2-approximation is bought to avoid. */
  function exactTsp(matrix) {
    const n = matrix.length;
    if (n > 15) throw new Error('Held-Karp is exponential; n = ' + n + ' exceeds 15');
    const full = 1 << n;
    const best = [];
    for (let mask = 0; mask < full; mask += 1) best.push(new Array(n).fill(Infinity));
    best[1][0] = 0;
    let states = 0;

    for (let mask = 1; mask < full; mask += 1) {
      for (let last = 0; last < n; last += 1) {
        if (best[mask][last] === Infinity) continue;
        states += 1;
        for (let next = 0; next < n; next += 1) {
          if ((mask >>> next) & 1) continue;
          const candidate = best[mask][last] + matrix[last][next];
          if (candidate < best[mask | (1 << next)][next]) best[mask | (1 << next)][next] = candidate;
        }
      }
    }
    let tour = Infinity;
    for (let last = 1; last < n; last += 1) {
      tour = Math.min(tour, best[full - 1][last] + matrix[last][0]);
    }
    return { length: tour, states: states, cells: full * n };
  }

  /** The best cut, by enumeration - the reference the |E|/2 bound is not. */
  function exactMaxCut(graph) {
    guard(graph.n);
    const total = 1 << (graph.n - 1);
    let best = -1;
    let bestSide = null;

    for (let mask = 0; mask < total; mask += 1) {
      const side = [];
      for (let v = 0; v < graph.n; v += 1) side.push((mask >>> v) & 1);
      const cut = Derand.cutValue(graph, side);
      if (cut > best) { best = cut; bestSide = side; }
    }
    return { cut: best, side: bestSide, assignments: total,
      halfBound: Derand.totalWeight(graph) / 2 };
  }

  function exactMaxSat(formula) {
    guard(formula.variables);
    const total = 1 << formula.variables;
    let best = -1;

    for (let mask = 0; mask < total; mask += 1) {
      const assignment = [];
      for (let v = 0; v < formula.variables; v += 1) assignment.push(Boolean((mask >>> v) & 1));
      best = Math.max(best, Derand.countSatisfied(formula, assignment));
    }
    return { satisfied: best, assignments: total, clauses: formula.clauses.length };
  }

  /** Every choice of k centres, scored by the covering radius. */
  function exactKCentre(matrix, k) {
    const n = matrix.length;
    let best = Infinity;
    let bestSet = null;
    let examined = 0;
    const chosen = new Array(k).fill(0);

    function walk(depth, start) {
      if (depth === k) {
        examined += 1;
        const radius = radiusOf(matrix, chosen);
        if (radius < best) { best = radius; bestSet = chosen.slice(); }
        return;
      }
      for (let i = start; i < n; i += 1) { chosen[depth] = i; walk(depth + 1, i + 1); }
    }
    walk(0, 0);
    return { radius: best, centres: bestSet, examined: examined };
  }

  function radiusOf(matrix, centres) {
    let worst = 0;

    for (let v = 0; v < matrix.length; v += 1) {
      let nearest = Infinity;
      for (let c = 0; c < centres.length; c += 1) nearest = Math.min(nearest, matrix[v][centres[c]]);
      worst = Math.max(worst, nearest);
    }
    return worst;
  }

  /* ------------------------------------------- 19.6 measured ratios */

  function randomInstanceGraph(options) {
    const settings = options || {};
    const rng = settings.rng;
    const n = settings.n === undefined ? 12 : settings.n;
    const edges = [];

    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        if (rng.next() < (settings.density === undefined ? 0.35 : settings.density)) {
          edges.push({ from: i, to: j, weight: 1 });
        }
      }
    }
    return { n: n, edges: edges, directed: false, name: 'random' };
  }

  /**
   * Four vertex-cover algorithms against the exact optimum on many random
   * graphs. The distribution is the answer: the matching algorithm's proven
   * ratio is 2 and its measured mean is far below it, and highest-degree
   * greedy - which has no bound - is usually the best of the four.
   */
  function coverStudy(options) {
    const settings = options || {};
    const instances = settings.instances === undefined ? 200 : settings.instances;
    const rows = [];

    for (let t = 0; t < instances; t += 1) {
      const graph = randomInstanceGraph({ rng: Random.seeded(t * 37 + 5), n: settings.n,
        density: settings.density });
      if (graph.edges.length === 0) continue;
      const exact = exactVertexCover(graph);
      rows.push({ instance: t, optimum: exact.size, subsets: exact.subsetsExamined,
        results: coverResults(graph, exact) });
    }
    return { rows: rows, methods: coverMethodNames(), summary: summariseRatios(rows),
      instances: rows.length };
  }

  function coverResults(graph, exact) {
    const matching = Approx.vertexCoverMatching(graph);
    const degree = Approx.vertexCoverGreedyDegree(graph);
    const relaxation = Lp.vertexCoverLp(graph);
    const rounded = Lp.roundVertexCover(graph, relaxation);
    const primalDual = Lp.primalDualVertexCover(graph);

    return [
      score('maximal matching', matching.size, exact.size, graph, matching.cover, 2),
      score('highest degree', degree.size, exact.size, graph, degree.cover, null),
      score('LP + rounding', rounded.size, exact.size, graph, rounded.cover, 2),
      score('primal-dual', primalDual.size, exact.size, graph, primalDual.cover, 2),
      /* A lower bound, not an approximation: its ratio is below 1 by
         construction and there is no bound for it to violate. */
      { method: 'LP relaxation', size: relaxation.value, ratio: relaxation.value / exact.size,
        valid: true, bound: null, withinBound: true, halfIntegral: relaxation.halfIntegral }
    ];
  }

  function coverMethodNames() {
    return ['maximal matching', 'highest degree', 'LP + rounding', 'primal-dual', 'LP relaxation'];
  }

  function score(method, size, optimum, graph, cover, bound) {
    const check = Approx.coversEveryEdge(graph, cover);
    return { method: method, size: size, ratio: size / optimum, valid: check.valid,
      uncovered: check.uncovered, bound: bound, withinBound: bound === null || size <= bound * optimum };
  }

  function summariseRatios(rows) {
    const names = coverMethodNames();
    return names.map(function (name, index) {
      const ratios = rows.map(function (row) { return row.results[index].ratio; });
      const violations = rows.filter(function (row) {
        return !row.results[index].withinBound;
      }).length;
      const invalid = rows.filter(function (row) { return row.results[index].valid === false; }).length;
      return Object.assign({ method: name, violations: violations, invalid: invalid },
        spreadOf(ratios));
    });
  }

  /**
   * `min` and `max` rather than `best` and `worst`, because which end is the
   * bad one flips between a minimisation study and a maximisation one - and a
   * column labelled "worst" that silently means "largest" is how a MAX-SAT
   * table ends up quoting its best case as its guarantee.
   */
  function spreadOf(values) {
    const sorted = values.slice().sort(function (a, b) { return a - b; });
    const mean = values.reduce(function (a, b) { return a + b; }, 0) / values.length;
    return { mean: mean, median: sorted[Math.floor(sorted.length / 2)],
      max: sorted[sorted.length - 1], min: sorted[0], count: values.length };
  }

  /** Greedy set cover against the optimum on random instances, and on the
   *  instance built to attain the bound. */
  function setCoverStudy(options) {
    const settings = options || {};
    const instances = settings.instances === undefined ? 120 : settings.instances;
    const ratios = [];
    const rows = [];

    for (let t = 0; t < instances; t += 1) {
      const instance = randomSetCover(Random.seeded(t * 13 + 3), settings);
      const greedy = Approx.setCoverGreedy(instance);
      const exact = exactSetCover(instance);
      if (!greedy.covered || exact.cost === Infinity) continue;
      ratios.push(greedy.cost / exact.cost);
      rows.push({ instance: t, greedy: greedy.cost, optimum: exact.cost,
        ratio: greedy.cost / exact.cost, bound: greedy.bound, sets: instance.sets.length });
    }
    return { rows: rows, summary: spreadOf(ratios), tight: tightSetCoverRuns(settings) };
  }

  function randomSetCover(rng, settings) {
    const universe = settings.universe === undefined ? 20 : settings.universe;
    const count = settings.setCount === undefined ? 12 : settings.setCount;
    const sets = [];

    for (let s = 0; s < count; s += 1) {
      const members = [];
      for (let e = 0; e < universe; e += 1) { if (rng.next() < 0.3) members.push(e); }
      sets.push({ members: members, cost: 1 });
    }
    const spare = [];
    for (let e = 0; e < universe; e += 1) spare.push(e);
    sets.push({ members: spare, cost: Math.ceil(universe / 3) });
    return { universe: universe, sets: sets };
  }

  function tightSetCoverRuns(settings) {
    const sizes = settings.tightSizes || [4, 8, 16, 32, 64, 128];
    return sizes.map(function (n) {
      const instance = Approx.setCoverTightInstance(n);
      const greedy = Approx.setCoverGreedy(instance);
      return { n: n, greedy: greedy.cost, optimum: instance.optimum,
        ratio: greedy.cost / instance.optimum, harmonic: Approx.harmonic(n),
        naturalLog: Math.log(n), sets: greedy.chosen.length };
    });
  }

  /** Metric TSP: MST doubling and Christofides against Held-Karp. */
  function tspStudy(options) {
    const settings = options || {};
    const instances = settings.instances === undefined ? 60 : settings.instances;
    const cities = settings.cities === undefined ? 10 : settings.cities;
    const rows = [];

    for (let t = 0; t < instances; t += 1) {
      const rng = Random.seeded(t * 71 + 9);
      const points = [];
      for (let i = 0; i < cities; i += 1) points.push({ x: rng.next() * 100, y: rng.next() * 100 });
      const matrix = Approx.distanceMatrix(points);
      const exact = exactTsp(matrix);
      const doubled = Approx.mstTour(matrix);
      const chris = Approx.christofides(matrix);
      rows.push({ instance: t, optimum: exact.length, states: exact.states,
        doubled: doubled.length, christofides: chris.length, mst: doubled.mst,
        doubledRatio: doubled.length / exact.length,
        christofidesRatio: chris.length / exact.length,
        mstRatio: doubled.mst / exact.length, oddVertices: chris.oddVertices,
        points: points });
    }
    return { rows: rows, cities: cities,
      doubled: spreadOf(rows.map(function (r) { return r.doubledRatio; })),
      christofides: spreadOf(rows.map(function (r) { return r.christofidesRatio; })),
      lowerBound: spreadOf(rows.map(function (r) { return r.mstRatio; })) };
  }

  /** k-centre and list scheduling, both against their exact optima. */
  function otherRatios(options) {
    const settings = options || {};
    const rng = Random.seeded(settings.seed === undefined ? 15 : settings.seed);
    const points = [];
    const count = settings.points === undefined ? 16 : settings.points;
    for (let i = 0; i < count; i += 1) points.push({ x: rng.next() * 100, y: rng.next() * 100 });
    const matrix = Approx.distanceMatrix(points);
    const centres = [2, 3, 4].map(function (k) {
      const greedy = Approx.kCentreGreedy(matrix, k);
      const exact = exactKCentre(matrix, k);
      return { k: k, greedy: greedy.radius, optimum: exact.radius,
        ratio: greedy.radius / exact.radius, examined: exact.examined, bound: 2 };
    });
    return { centres: centres, scheduling: schedulingRuns(settings), points: points };
  }

  function schedulingRuns(settings) {
    const machines = settings.machines === undefined ? 4 : settings.machines;
    const rows = [];

    for (let t = 0; t < (settings.scheduleInstances === undefined ? 60 : settings.scheduleInstances); t += 1) {
      const rng = Random.seeded(t * 23 + 1);
      const jobs = [];
      for (let j = 0; j < 12; j += 1) jobs.push(1 + rng.int(20));
      const plain = Approx.listScheduling(jobs, machines, {});
      const lpt = Approx.listScheduling(jobs, machines, { lpt: true });
      const optimum = exactMakespan(jobs, machines);
      rows.push({ instance: t, plain: plain.makespan, lpt: lpt.makespan, optimum: optimum,
        plainRatio: plain.makespan / optimum, lptRatio: lpt.makespan / optimum });
    }
    const trap = Approx.schedulingTrapInstance(machines);
    return { rows: rows, machines: machines,
      plain: spreadOf(rows.map(function (r) { return r.plainRatio; })),
      lpt: spreadOf(rows.map(function (r) { return r.lptRatio; })),
      trap: { jobs: trap.jobs.length, optimum: trap.optimum,
        plain: Approx.listScheduling(trap.jobs, machines, {}).makespan,
        lpt: Approx.listScheduling(trap.jobs, machines, { lpt: true }).makespan,
        bound: 2 - 1 / machines } };
  }

  /** Exact makespan by assigning each job to each machine - m^n, so the job
   *  count stays at twelve and four machines. */
  function exactMakespan(jobs, machines) {
    const load = new Array(machines).fill(0);
    let best = Infinity;

    function walk(index) {
      if (index === jobs.length) { best = Math.min(best, Math.max.apply(null, load)); return; }
      const seen = new Set();
      for (let m = 0; m < machines; m += 1) {
        if (seen.has(load[m])) continue;
        seen.add(load[m]);
        load[m] += jobs[index];
        if (Math.max.apply(null, load) < best) walk(index + 1);
        load[m] -= jobs[index];
      }
    }
    walk(0);
    return best;
  }

  /* -------------------------------------------------- 19.7 LP and rounding */

  /** The measured integrality gap over random graphs, and on the complete
   *  graphs where it approaches its supremum of 2. */
  function gapStudy(options) {
    const settings = options || {};
    const instances = settings.instances === undefined ? 150 : settings.instances;
    const rows = [];

    for (let t = 0; t < instances; t += 1) {
      const graph = randomInstanceGraph({ rng: Random.seeded(t * 53 + 11), n: settings.n,
        density: settings.density });
      if (graph.edges.length === 0) continue;
      const relaxation = Lp.vertexCoverLp(graph);
      const exact = exactVertexCover(graph);
      rows.push({ instance: t, lp: relaxation.value, integer: exact.size,
        gap: exact.size / Math.max(relaxation.value, 1e-9),
        halfIntegral: relaxation.halfIntegral });
    }
    const complete = (settings.completeSizes || [3, 5, 7, 9, 11, 15]).map(function (n) {
      const instance = Lp.integralityGapInstance(n);
      const relaxation = Lp.vertexCoverLp(instance.graph);
      return { n: n, lp: relaxation.value, predictedLp: instance.lpValue,
        integer: instance.integerOptimum, gap: instance.gap };
    });
    return { rows: rows, complete: complete, halfIntegralCount: rows.filter(function (r) {
      return r.halfIntegral;
    }).length, summary: spreadOf(rows.map(function (r) { return r.gap; })) };
  }

  /**
   * MAX-SAT four ways on the same formula: a coin flip, LP rounding, the
   * better of the two, and the derandomised conditional-expectation walk,
   * all against the exact optimum.
   */
  function maxSatStudy(options) {
    const settings = options || {};
    const instances = settings.instances === undefined ? 60 : settings.instances;
    const rows = [];

    for (let t = 0; t < instances; t += 1) {
      const formula = mixedFormula(Random.seeded(t * 17 + 2), settings);
      const exact = exactMaxSat(formula);
      rows.push(Object.assign({ instance: t, optimum: exact.satisfied,
        clauses: formula.clauses.length }, satMethods(formula, exact, t)));
    }
    return { rows: rows, instances: rows.length,
      summary: ['random', 'lp', 'best-of-two', 'conditional'].map(function (key) {
        return Object.assign({ method: key },
          spreadOf(rows.map(function (row) { return row[key] / row.optimum; })));
      }) };
  }

  function satMethods(formula, exact, seed) {
    const random = Derand.randomAssignmentSat(formula, Random.seeded(seed * 91 + 7));
    const lp = maxSatLp(formula);
    const rounded = roundMaxSat(formula, lp, Random.seeded(seed * 91 + 8));
    const conditional = Derand.conditionalExpectationSat(formula);

    return { random: random.satisfied, lp: rounded.satisfied,
      'best-of-two': Math.max(random.satisfied, rounded.satisfied),
      conditional: conditional.satisfied, lpValue: lp.value,
      expectation: random.expected, optimumCheck: exact.satisfied };
  }

  /** Clauses of mixed width, because the 3/4 combination only beats each half
   *  when short and long clauses are both present. */
  function mixedFormula(rng, settings) {
    const variables = settings.variables === undefined ? 14 : settings.variables;
    const clauses = [];
    const count = settings.clauses === undefined ? 30 : settings.clauses;

    for (let c = 0; c < count; c += 1) {
      const width = 1 + rng.int(4);
      const used = new Set();
      const clause = [];
      while (clause.length < width) {
        const v = 1 + rng.int(variables);
        if (used.has(v)) continue;
        used.add(v);
        clause.push(rng.int(2) === 1 ? v : -v);
      }
      clauses.push(clause);
    }
    return { variables: variables, clauses: clauses };
  }

  /** max Σ zⱼ subject to zⱼ ≤ Σ_{i∈Pⱼ} yᵢ + Σ_{i∈Nⱼ} (1 − yᵢ), y, z in [0, 1]. */
  function maxSatLp(formula) {
    const n = formula.variables;
    const m = formula.clauses.length;
    const a = [];
    const b = [];

    formula.clauses.forEach(function (clause, j) {
      const row = new Array(n + m).fill(0);
      let negatives = 0;
      clause.forEach(function (literal) {
        const index = Math.abs(literal) - 1;
        if (literal > 0) { row[index] -= 1; return; }
        row[index] += 1;
        negatives += 1;
      });
      row[n + j] = 1;
      a.push(row);
      b.push(negatives);
    });
    addUnitBounds(a, b, n + m);
    const objective = new Array(n + m).fill(0);
    for (let j = 0; j < m; j += 1) objective[n + j] = 1;
    const solved = Lp.simplexMax({ a: a, b: b, c: objective });
    return { value: solved.value, y: solved.x.slice(0, n), z: solved.x.slice(n), pivots: solved.pivots };
  }

  function addUnitBounds(a, b, width) {
    for (let i = 0; i < width; i += 1) {
      const row = new Array(width).fill(0);
      row[i] = 1;
      a.push(row);
      b.push(1);
    }
  }

  function roundMaxSat(formula, lp, rng) {
    const assignment = lp.y.map(function (value) { return rng.next() < value; });
    return { satisfied: Derand.countSatisfied(formula, assignment), assignment: assignment,
      lpValue: lp.value, bound: (1 - 1 / Math.E) * lp.value };
  }

  /* --------------------------------------------- 19.8 the knapsack scheme */

  /** The epsilon sweep: quality, table size and the guarantee, all measured. */
  function knapsackStudy(options) {
    const settings = options || {};
    const instance = settings.correlated === false
      ? Fptas.randomInstance({ rng: Random.seeded(settings.seed === undefined ? 5 : settings.seed),
        count: settings.count })
      : Fptas.stronglyCorrelatedInstance({ rng: Random.seeded(settings.seed === undefined
        ? 5 : settings.seed), count: settings.count });
    const exact = Fptas.exact(instance.items, instance.capacity);
    const epsilons = settings.epsilons || [0.5, 0.3, 0.2, 0.1, 0.05, 0.02, 0.01];
    const rows = epsilons.map(function (epsilon) {
      const run = Fptas.fptas(instance.items, instance.capacity, epsilon);
      return { epsilon: epsilon, value: run.value, ratio: run.value / exact.value,
        guarantee: 1 - epsilon, cells: run.cells, scale: run.scale,
        cheaperThanExact: run.cells < exact.cells, feasible: run.feasible,
        meetsGuarantee: run.value >= (1 - epsilon) * exact.value };
    });
    return { rows: rows, exact: exact, instance: instance,
      greedy: Fptas.greedyHalf(instance.items, instance.capacity),
      broken: Fptas.scaleWeights(instance.items, instance.capacity, 0.5),
      trap: greedyTrapRun() };
  }

  function greedyTrapRun() {
    const trap = Fptas.greedyTrapInstance(100);
    const greedy = Fptas.greedyHalf(trap.items, trap.capacity);
    const density = densityOnly(trap.items, trap.capacity);
    return { greedy: greedy.value, densityOnly: density, optimum: trap.optimum,
      via: greedy.via, densityRatio: density / trap.optimum };
  }

  function densityOnly(items, capacity) {
    const order = items.map(function (item, index) {
      return { index: index, density: item.profit / item.weight };
    }).sort(function (a, b) { return b.density - a.density; });
    let weight = 0;
    let value = 0;
    order.forEach(function (entry) {
      if (weight + items[entry.index].weight > capacity) return;
      weight += items[entry.index].weight;
      value += items[entry.index].profit;
    });
    return value;
  }

  /** The PTAS at each k against the FPTAS at the epsilon giving the same
   *  guarantee - the comparison that shows what "fully" buys. */
  function schemeComparison(options) {
    const settings = options || {};
    const instance = Fptas.stronglyCorrelatedInstance({
      rng: Random.seeded(settings.seed === undefined ? 5 : settings.seed),
      count: settings.count === undefined ? 16 : settings.count });
    const exact = Fptas.exact(instance.items, instance.capacity);

    return (settings.ks || [1, 2, 3, 4]).map(function (k) {
      const run = Fptas.ptas(instance.items, instance.capacity, k);
      const epsilon = 1 / (k + 1);
      const scheme = Fptas.fptas(instance.items, instance.capacity, epsilon);
      return { k: k, guarantee: run.ratioBound, ptasValue: run.value,
        ptasRatio: run.value / exact.value, subsets: run.subsets,
        fptasValue: scheme.value, fptasRatio: scheme.value / exact.value,
        fptasCells: scheme.cells, epsilon: epsilon, optimum: exact.value };
    });
  }

  /* ------------------------------------------- 19.9 derandomised MAX-CUT */

  /**
   * The random assignment across many seeds, the conditional-expectation walk
   * once, the pairwise-independent space enumerated, and the exact optimum.
   * The distribution against the single deterministic number is the section.
   */
  function derandomStudy(options) {
    const settings = options || {};
    const graph = settings.graph || unitGraph(Random.seeded(settings.seed === undefined
      ? 3 : settings.seed), settings);
    const trials = settings.trials === undefined ? 500 : settings.trials;
    const cuts = [];
    let belowBound = 0;
    const bound = Derand.totalWeight(graph) / 2;

    for (let t = 0; t < trials; t += 1) {
      const cut = Derand.randomCut(graph, Random.seeded(t * 41 + 1)).cut;
      cuts.push(cut);
      if (cut < bound) belowBound += 1;
    }
    const conditional = Derand.conditionalExpectationCut(graph);
    const small = Derand.enumerateSmallSpace(graph);
    const exact = exactMaxCut(graph);

    return { graph: graph, bound: bound, trials: trials, belowBound: belowBound,
      randomSpread: spreadOf(cuts), bestRandom: Math.max.apply(null, cuts),
      conditional: conditional, small: small, exact: exact,
      profile: Derand.independenceProfile(Derand.pairwiseFamily(graph.n)) };
  }

  function unitGraph(rng, settings) {
    const graph = randomInstanceGraph({ rng: rng, n: settings.n === undefined ? 16 : settings.n,
      density: settings.density === undefined ? 0.4 : settings.density });
    graph.edges.forEach(function (edge) { edge.weight = 1; });
    return graph;
  }

  return {
    exactVertexCover: exactVertexCover, exactSetCover: exactSetCover, exactTsp: exactTsp,
    exactMaxCut: exactMaxCut, exactMaxSat: exactMaxSat, exactKCentre: exactKCentre,
    exactMakespan: exactMakespan, randomInstanceGraph: randomInstanceGraph,
    coverStudy: coverStudy, setCoverStudy: setCoverStudy, tspStudy: tspStudy,
    otherRatios: otherRatios, gapStudy: gapStudy, maxSatStudy: maxSatStudy,
    maxSatLp: maxSatLp, roundMaxSat: roundMaxSat, mixedFormula: mixedFormula,
    knapsackStudy: knapsackStudy, schemeComparison: schemeComparison,
    derandomStudy: derandomStudy, unitGraph: unitGraph, spreadOf: spreadOf,
    ENUMERATION_LIMIT: ENUMERATION_LIMIT
  };
}));
