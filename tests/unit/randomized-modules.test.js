'use strict';

/**
 * Property tests for the M19 modules, against brute-force references.
 *
 * A randomised algorithm fails by returning a plausible answer and an
 * approximation fails by returning an infeasible one, so nothing here is
 * checked by eye. Every claim is either compared against an enumeration oracle
 * or asserted as an invariant that holds for every input.
 */

const test = require('node:test');
const assert = require('node:assert');

const Random = require('../../src/js/utils/random.js');
const Karger = require('../../src/js/algorithms/karger.js');
const MonteCarlo = require('../../src/js/algorithms/monte-carlo.js');
const Mcmc = require('../../src/js/algorithms/mcmc.js');
const Finger = require('../../src/js/algorithms/fingerprinting.js');
const Approx = require('../../src/js/algorithms/approximation.js');
const Lp = require('../../src/js/algorithms/lp-rounding.js');
const Fptas = require('../../src/js/algorithms/fptas.js');
const Derand = require('../../src/js/algorithms/derandomize.js');
const ApproxLab = require('../../src/js/machines/approx-lab.js');

function randomGraph(seed, n, density) {
  const rng = Random.seeded(seed);
  const edges = [];

  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (rng.next() < density) edges.push({ from: i, to: j, weight: 1 });
    }
  }
  return { n: n, edges: edges, directed: false, name: 'test' };
}

/* ----------------------------------------------------------- 19.2 Karger */

test('karger: every run returns a cut at or above the true minimum', function () {
  for (let seed = 1; seed <= 12; seed += 1) {
    const graph = randomGraph(seed, 10, 0.4);
    if (graph.edges.length === 0) continue;
    const exact = Karger.bruteForceMinCut(graph);

    for (let t = 0; t < 30; t += 1) {
      const run = Karger.contract(graph, { rng: Random.seeded(t * 41 + seed) });
      assert.ok(run.cut >= exact.cut,
        'seed ' + seed + ' trial ' + t + ': contraction returned ' + run.cut +
        ' below the true minimum ' + exact.cut);
      assert.strictEqual(run.contractions, graph.n - 2,
        'contracting to two supernodes takes exactly n − 2 merges');
      assert.strictEqual(run.supernodes.length, 2, 'two supernodes remain');
    }
  }
});

test('karger: the cut a run reports is the weight of its own partition', function () {
  const graph = randomGraph(5, 12, 0.35);

  for (let t = 0; t < 40; t += 1) {
    const run = Karger.contract(graph, { rng: Random.seeded(t + 3) });
    const mask = Karger.canonicalMask(run.groups);
    assert.strictEqual(run.cut, Karger.cutWeight(graph, mask),
      'the reported cut must equal the weight of the partition it induces');
  }
});

test('karger: the cycle attains both the bound and the counting corollary', function () {
  [8, 10, 12].forEach(function (n) {
    const edges = [];
    for (let i = 0; i < n; i += 1) edges.push({ from: i, to: (i + 1) % n, weight: 1 });
    const graph = { n: n, edges: edges, directed: false, name: 'cycle' };
    const exact = Karger.bruteForceMinCut(graph);

    assert.strictEqual(exact.cut, 2, 'a cycle falls apart when any two edges go');
    assert.strictEqual(exact.optimalCuts, n * (n - 1) / 2,
      'C' + n + ' attains the n(n−1)/2 maximum on minimum cuts');

    const run = Karger.repeat(graph, { trials: 3000, optimum: exact.cut,
      targetMask: exact.mask, makeRng: function (t) { return Random.seeded(t * 131 + 17); } });
    assert.ok(run.exactCutRate >= run.predictedRate * 0.6,
      'the measured rate for a nominated cut, ' + run.exactCutRate +
      ', must be near the bound ' + run.predictedRate);
    assert.strictEqual(run.distinctCutsFound, exact.optimalCuts,
      '3 000 runs on a cycle should turn up every minimum cut');
  });
});

test('karger: the uniform-supernode rule is measurably worse than the uniform-edge rule', function () {
  const edges = [];
  for (let side = 0; side < 2; side += 1) {
    for (let i = 0; i < 6; i += 1) {
      for (let j = i + 1; j < 6; j += 1) edges.push({ from: side * 6 + i, to: side * 6 + j, weight: 1 });
    }
  }
  edges.push({ from: 0, to: 6, weight: 1 });
  edges.push({ from: 1, to: 7, weight: 1 });
  const graph = { n: 12, edges: edges, directed: false, name: 'two-cliques' };
  const make = function (t) { return Random.seeded(t * 131 + 17); };

  const proper = Karger.repeat(graph, { trials: 2000, optimum: 2, makeRng: make });
  const wrong = Karger.repeat(graph, { trials: 2000, optimum: 2, pickBy: 'pair', makeRng: make });

  assert.ok(proper.empiricalRate > wrong.empiricalRate,
    'drawing uniformly from edges must beat drawing a supernode first: ' +
    proper.empiricalRate + ' against ' + wrong.empiricalRate);
});

test('karger: Karger–Stein never beats the optimum and finds it far more often than one plain run',
  function () {
    let steinHits = 0;
    let plainHits = 0;
    const seeds = 40;

    for (let seed = 1; seed <= seeds; seed += 1) {
      const graph = randomGraph(seed * 7, 14, 0.45);
      const exact = Karger.bruteForceMinCut(graph);
      const stein = Karger.kargerStein(graph, {
        makeRng: function (s) { return Random.seeded(s * 29 + seed); } });
      const plain = Karger.contract(graph, { rng: Random.seeded(seed * 101 + 7) });

      assert.ok(stein.cut >= exact.cut, 'seed ' + seed + ': it can never beat the true minimum');
      assert.ok(plain.cut >= exact.cut, 'and neither can a single contraction run');
      if (stein.cut === exact.cut) steinHits += 1;
      if (plain.cut === exact.cut) plainHits += 1;
    }
    /* It is a randomised algorithm: one call succeeds with probability
       Omega(1/log n), not with certainty. What must hold is that recursing
       beats a single flat run by a wide margin. */
    assert.ok(steinHits >= seeds * 0.8,
      'Karger–Stein found the minimum on ' + steinHits + ' of ' + seeds + ' graphs');
    assert.ok(steinHits > plainHits,
      'and it must beat one plain contraction run: ' + steinHits + ' against ' + plainHits);
  });

/* ------------------------------------------------------ 19.3 Monte Carlo */

test('monte carlo: the normal tail matches known values to machine precision', function () {
  const known = [[0, 0.5], [1, 0.15865525393145707], [2, 0.022750131948179195],
    [3, 0.0013498980316300933], [4, 3.167124183311998e-5], [5, 2.866515718791939e-7]];

  known.forEach(function (pair) {
    const got = MonteCarlo.normalTail(pair[0]);
    assert.ok(Math.abs(got - pair[1]) <= 1e-14 * Math.max(pair[1], 1e-14),
      'Q(' + pair[0] + ') = ' + got + ' against ' + pair[1]);
  });
});

test('monte carlo: every estimator is unbiased over many seeds', function () {
  const target = { exact: Math.E - 1, f: function (u) { return Math.exp(u); },
    control: function (u) { return u; }, controlMean: 0.5 };
  const methods = [MonteCarlo.plain, MonteCarlo.antithetic, MonteCarlo.control,
    MonteCarlo.stratified];

  methods.forEach(function (method, index) {
    let total = 0;
    const repeats = 200;
    for (let r = 0; r < repeats; r += 1) {
      total += method(target, { rng: Random.seeded(r * 337 + 19), samples: 2000 }).estimate;
    }
    assert.ok(Math.abs(total / repeats - target.exact) < 5e-3,
      'estimator ' + index + ' averaged ' + (total / repeats) + ' against ' + target.exact);
  });
});

test('monte carlo: the van der Corput sequence has the discrepancy it claims', function () {
  [16, 64, 256, 1024].forEach(function (n) {
    const points = [];
    for (let i = 0; i < n; i += 1) points.push(MonteCarlo.vanDerCorput(i + 1, 2));
    const discrepancy = MonteCarlo.starDiscrepancy(points);

    assert.ok(discrepancy <= 2 / n + 1e-12,
      'at n = ' + n + ' the star discrepancy is ' + discrepancy + ', above 2/n');
    const set = new Set(points);
    assert.strictEqual(set.size, n, 'the first n points are distinct');
  });
});

test('monte carlo: importance sampling is unbiased and the weight ESS falls when over-shifted', function () {
  const exact = MonteCarlo.normalTail(4);
  let total = 0;
  const repeats = 60;

  for (let r = 0; r < repeats; r += 1) {
    total += MonteCarlo.importance({ rng: Random.seeded(r * 53 + 1), samples: 5000,
      threshold: 4, shift: 4 }).estimate;
  }
  assert.ok(Math.abs(total / repeats - exact) / exact < 0.02,
    'the average of ' + repeats + ' shifted estimates is ' + (total / repeats));

  const good = MonteCarlo.importance({ rng: Random.seeded(7), samples: 20000, threshold: 4, shift: 4 });
  const over = MonteCarlo.importance({ rng: Random.seeded(7), samples: 20000, threshold: 4, shift: 8 });
  assert.ok(over.hits > good.hits, 'the over-shifted proposal has MORE hits');
  assert.ok(over.weightEss < good.weightEss / 4,
    'and a far smaller weight ESS: ' + over.weightEss + ' against ' + good.weightEss);
});

/* ------------------------------------------------------------- 19.4 MCMC */

test('mcmc: the chain recovers the moments of a distribution it can only evaluate unnormalised', function () {
  const target = Mcmc.correlatedNormal(0.5);
  const run = Mcmc.metropolis(target, { rng: Random.seeded(11), steps: 40000, width: 2.4,
    startX: 0, startY: 0 });

  assert.ok(Math.abs(run.mean) < 4 * run.honestError,
    'the mean is 0; estimated ' + run.mean + ' with an honest bar of ' + run.honestError);
  assert.ok(Math.abs(run.variance - 1) < 0.15,
    'the marginal variance is 1; estimated ' + run.variance);
});

test('mcmc: effective sample size never exceeds the draw count and falls with the width', function () {
  const target = Mcmc.mixture({});
  const widths = [0.05, 0.3, 2.4];
  const runs = widths.map(function (width) {
    return Mcmc.metropolis(target, { rng: Random.seeded(42), steps: 20000, width: width });
  });

  runs.forEach(function (run) {
    assert.ok(run.ess <= run.steps + 1e-9, 'ESS above N is impossible');
    assert.ok(run.autocorrelationTime >= 1, 'tau is at least 1 by construction');
    assert.ok(run.honestError >= run.naiveError - 1e-12,
      'the honest bar is never narrower than the naive one');
  });
  assert.ok(runs[0].ess < runs[2].ess,
    'a tiny proposal must be worth fewer effective samples than a well-sized one');
});

test('mcmc: R-hat detects chains that disagree and passes chains that do not', function () {
  const target = Mcmc.mixture({});
  const stuck = [-3, -1, 1, 3].map(function (start, index) {
    return Mcmc.metropolis(target, { rng: Random.seeded(index * 313 + 7), steps: 8000,
      width: 0.1, startX: start }).chainX;
  });
  const mixed = [-3, -1, 1, 3].map(function (start, index) {
    return Mcmc.metropolis(target, { rng: Random.seeded(index * 313 + 7), steps: 8000,
      width: 2.4, startX: start }).chainX;
  });

  assert.ok(Mcmc.gelmanRubin(stuck).rHat > 1.05,
    'chains stuck in separate modes must show a large R-hat');
  assert.ok(Mcmc.gelmanRubin(mixed).rHat < 1.02,
    'well-mixed chains must not, measured ' + Mcmc.gelmanRubin(mixed).rHat);
});

test('mcmc: Gibbs on the correlated normal accepts everything and still has structure', function () {
  const target = Mcmc.correlatedNormal(0.9);
  const run = Mcmc.gibbs(target, { rng: Random.seeded(3), steps: 20000 });

  assert.strictEqual(run.accepted, run.steps, 'every conditional draw is accepted by construction');
  assert.ok(run.autocorrelationTime > 1,
    'and the draws are still correlated, measured tau = ' + run.autocorrelationTime);
});

/* ---------------------------------------------------- 19.5 fingerprinting */

test('freivalds: it never rejects a correct product, over many seeds and sizes', function () {
  [6, 12, 20].forEach(function (n) {
    const setup = Random.seeded(n * 3 + 1);
    const a = Finger.randomMatrix(n, setup, 10);
    const b = Finger.randomMatrix(n, setup, 10);
    const c = Finger.multiply(a, b).matrix;

    for (let t = 0; t < 50; t += 1) {
      const run = Finger.freivalds({ a: a, b: b, c: c },
        { rng: Random.seeded(t * 17 + n), rounds: 8 });
      assert.strictEqual(run.rejected, false,
        'a correct product was rejected at n = ' + n + ', seed ' + t);
    }
  });
});

test('freivalds: a single corrupted entry is missed at about the 2^-k rate', function () {
  const n = 16;
  const setup = Random.seeded(9);
  const a = Finger.randomMatrix(n, setup, 9);
  const b = Finger.randomMatrix(n, setup, 9);
  const product = Finger.multiply(a, b);
  const wrong = Finger.corrupt(product.matrix, { rng: setup, cells: 1, delta: 1 });

  [1, 2, 3].forEach(function (rounds) {
    let missed = 0;
    const trials = 2000;
    for (let t = 0; t < trials; t += 1) {
      if (!Finger.freivalds({ a: a, b: b, c: wrong.matrix },
        { rng: Random.seeded(t * 53 + rounds), rounds: rounds }).rejected) missed += 1;
    }
    const bound = Math.pow(0.5, rounds);
    assert.ok(missed / trials <= bound * 1.25,
      'at k = ' + rounds + ' the miss rate is ' + (missed / trials) + ', bound ' + bound);
  });
});

test('schwartz-zippel: true identities are always accepted and false ones fail at their bound', function () {
  Finger.polynomialClaims().forEach(function (claim) {
    Finger.FIELDS.forEach(function (field) {
      let accepted = 0;
      const trials = 1000;
      for (let t = 0; t < trials; t += 1) {
        if (Finger.identityTest(claim, { rng: Random.seeded(t * 7 + field), field: field,
          trials: 1 }).equal) accepted += 1;
      }
      if (claim.holds) {
        assert.strictEqual(accepted, trials,
          'the true claim "' + claim.name + '" was rejected over ℤ mod ' + field);
        return;
      }
      const bound = Math.min(1, claim.degree / field);
      assert.ok(accepted / trials <= bound * 1.5 + 0.005,
        '"' + claim.name + '" over ℤ mod ' + field + ' was accepted ' + (accepted / trials) +
        ' of the time against a bound of ' + bound);
    });
  });
});

test('fingerprints: a one-position difference never collides, and a built pair attains d/p', function () {
  Finger.FIELDS.forEach(function (field) {
    const ordinary = Finger.randomPair({ rng: Random.seeded(12), length: 2000, field: field });
    const plain = Finger.compareByFingerprint(ordinary, { rng: Random.seeded(field), trials: 3000 });
    assert.strictEqual(plain.collisions, 0,
      'a monomial difference has no reachable root, so it cannot collide over ℤ mod ' + field);

    const built = Finger.adversarialPair({ rng: Random.seeded(field + 3), field: field, roots: 8 });
    const attack = Finger.compareByFingerprint(built, { rng: Random.seeded(field), trials: 4000 });
    const expected = 8 / field;
    assert.ok(attack.rate <= attack.bound * 2 + 0.01,
      'the built pair collides at ' + attack.rate + ' against a bound of ' + attack.bound);
    if (expected < 0.001) return;
    assert.ok(attack.rate >= expected * 0.4,
      'and it should be near d/p = ' + expected + ', measured ' + attack.rate);
  });
});

test('merkle: a valid proof verifies and any modification is rejected', function () {
  const leaves = [];
  for (let i = 0; i < 50; i += 1) leaves.push('chunk-' + i);
  const tree = Finger.merkleTree(leaves);

  for (let i = 0; i < leaves.length; i += 1) {
    const proof = Finger.merkleProof(tree, i);
    assert.strictEqual(proof.length, tree.proofLength, 'every proof is the same length');
    assert.ok(Finger.verifyProof(leaves[i], proof, tree.root).valid,
      'the honest proof for leaf ' + i + ' must verify');
    assert.ok(!Finger.verifyProof(leaves[i] + '!', proof, tree.root).valid,
      'and a modified leaf must not');
  }
});

/* --------------------------------------------------- 19.6 approximations */

test('approximation: every vertex cover is feasible and inside its bound', function () {
  for (let seed = 1; seed <= 40; seed += 1) {
    const graph = randomGraph(seed * 11, 12, 0.35);
    if (graph.edges.length === 0) continue;
    const exact = ApproxLab.exactVertexCover(graph);
    const matching = Approx.vertexCoverMatching(graph);
    const degree = Approx.vertexCoverGreedyDegree(graph);

    assert.ok(Approx.coversEveryEdge(graph, matching.cover).valid, 'the matching cover is a cover');
    assert.ok(Approx.coversEveryEdge(graph, degree.cover).valid, 'the degree cover is a cover');
    assert.ok(matching.size <= 2 * exact.size,
      'seed ' + seed + ': ' + matching.size + ' exceeds twice the optimum ' + exact.size);
    assert.ok(matching.lowerBound <= exact.size,
      'the matching size is a valid lower bound on the optimum');
  }
});

test('approximation: the degree trap has optimum k and defeats highest-degree greedy', function () {
  [20, 60, 100].forEach(function (k) {
    const instance = Approx.degreeTrapInstance(k);
    const matching = Approx.vertexCoverMatching(instance.graph);
    const degree = Approx.vertexCoverGreedyDegree(instance.graph);

    assert.ok(matching.size <= 2 * instance.optimum,
      'the matching cover stays inside its factor of 2 at k = ' + k);
    assert.ok(degree.size > 2 * instance.optimum,
      'at k = ' + k + ' greedy pays ' + degree.size + ', which must exceed 2k = ' +
      (2 * instance.optimum));
  });
});

test('approximation: greedy set cover attains H(n) exactly on the tight instance', function () {
  [4, 8, 16, 32, 64, 128].forEach(function (n) {
    const instance = Approx.setCoverTightInstance(n);
    const greedy = Approx.setCoverGreedy(instance);

    assert.ok(greedy.covered, 'the cover is complete');
    assert.strictEqual(greedy.chosen.length, n, 'greedy takes all n singletons');
    assert.ok(Math.abs(greedy.cost - Approx.harmonic(n)) < 1e-9,
      'greedy pays ' + greedy.cost + ' against H(' + n + ') = ' + Approx.harmonic(n));
  });
});

test('approximation: greedy set cover never exceeds its bound on random instances', function () {
  for (let seed = 1; seed <= 40; seed += 1) {
    const rng = Random.seeded(seed * 13 + 3);
    const universe = 16;
    const sets = [];
    for (let s = 0; s < 10; s += 1) {
      const members = [];
      for (let e = 0; e < universe; e += 1) { if (rng.next() < 0.3) members.push(e); }
      sets.push({ members: members, cost: 1 });
    }
    const all = [];
    for (let e = 0; e < universe; e += 1) all.push(e);
    sets.push({ members: all, cost: 6 });
    const instance = { universe: universe, sets: sets };

    const greedy = Approx.setCoverGreedy(instance);
    const exact = ApproxLab.exactSetCover(instance);
    assert.ok(greedy.covered, 'seed ' + seed + ': greedy must cover the universe');
    assert.ok(greedy.cost <= exact.cost * greedy.bound + 1e-9,
      'seed ' + seed + ': greedy paid ' + greedy.cost + ' against ' + exact.cost +
      ' and a bound of ' + (exact.cost * greedy.bound));
  }
});

test('approximation: both TSP tours are valid and inside their bounds', function () {
  for (let seed = 1; seed <= 25; seed += 1) {
    const rng = Random.seeded(seed * 71 + 9);
    const points = [];
    for (let i = 0; i < 9; i += 1) points.push({ x: rng.next() * 100, y: rng.next() * 100 });
    const matrix = Approx.distanceMatrix(points);
    const exact = ApproxLab.exactTsp(matrix);
    const doubled = Approx.mstTour(matrix);
    const chris = Approx.christofides(matrix);

    assert.strictEqual(new Set(doubled.order).size, points.length, 'the doubled tour visits every city once');
    assert.strictEqual(new Set(chris.order).size, points.length, 'so does the Christofides tour');
    assert.ok(doubled.mst <= exact.length + 1e-9, 'the MST is a lower bound on the optimal tour');
    assert.ok(doubled.length <= 2 * exact.length + 1e-9,
      'seed ' + seed + ': doubling gave ' + doubled.length + ' against 2 × ' + exact.length);
    assert.ok(chris.length <= 1.5 * exact.length + 1e-9,
      'seed ' + seed + ': Christofides gave ' + chris.length + ' against 1.5 × ' + exact.length);
    assert.strictEqual(chris.oddVertices % 2, 0, 'the odd-degree set always has even size');
  }
});

test('approximation: k-centre and list scheduling stay inside their bounds', function () {
  const rng = Random.seeded(15);
  const points = [];
  for (let i = 0; i < 14; i += 1) points.push({ x: rng.next() * 100, y: rng.next() * 100 });
  const matrix = Approx.distanceMatrix(points);

  [2, 3, 4].forEach(function (k) {
    const greedy = Approx.kCentreGreedy(matrix, k);
    const exact = ApproxLab.exactKCentre(matrix, k);
    assert.ok(greedy.radius <= 2 * exact.radius + 1e-9,
      'k = ' + k + ': greedy radius ' + greedy.radius + ' against 2 × ' + exact.radius);
  });

  for (let seed = 1; seed <= 30; seed += 1) {
    const jobRng = Random.seeded(seed * 23 + 1);
    const jobs = [];
    for (let j = 0; j < 11; j += 1) jobs.push(1 + jobRng.int(20));
    const machines = 4;
    const optimum = ApproxLab.exactMakespan(jobs, machines);
    const plain = Approx.listScheduling(jobs, machines, {});
    const lpt = Approx.listScheduling(jobs, machines, { lpt: true });

    assert.ok(plain.makespan <= (2 - 1 / machines) * optimum + 1e-9,
      'seed ' + seed + ': list scheduling gave ' + plain.makespan + ' against ' + optimum);
    assert.ok(lpt.makespan <= (4 / 3 - 1 / (3 * machines)) * optimum + 1e-9,
      'seed ' + seed + ': LPT gave ' + lpt.makespan + ' against ' + optimum);
  }
});

test('approximation: the scheduling trap attains 2 − 1/m exactly and LPT solves it', function () {
  [3, 4, 5, 6].forEach(function (machines) {
    const trap = Approx.schedulingTrapInstance(machines);
    const plain = Approx.listScheduling(trap.jobs, machines, {});
    const lpt = Approx.listScheduling(trap.jobs, machines, { lpt: true });

    assert.strictEqual(plain.makespan, 2 * machines - 1,
      'at m = ' + machines + ' the trap makes list scheduling finish at 2m − 1');
    assert.strictEqual(plain.makespan / trap.optimum, 2 - 1 / machines,
      'which is exactly the 2 − 1/m bound');
    assert.strictEqual(lpt.makespan, trap.optimum, 'and sorting solves it exactly');
  });
});

/* -------------------------------------------------------------- 19.7 LP */

test('lp: the simplex agrees with brute force on small integer programs', function () {
  for (let seed = 1; seed <= 20; seed += 1) {
    const graph = randomGraph(seed * 5 + 1, 10, 0.4);
    if (graph.edges.length === 0) continue;
    const relaxation = Lp.vertexCoverLp(graph);
    const exact = ApproxLab.exactVertexCover(graph);

    assert.ok(relaxation.value <= exact.size + 1e-6,
      'seed ' + seed + ': the LP value ' + relaxation.value + ' must not exceed the integer optimum');
    assert.ok(relaxation.halfIntegral, 'seed ' + seed + ': the basic solution must be half-integral');

    graph.edges.forEach(function (edge) {
      assert.ok(relaxation.x[edge.from] + relaxation.x[edge.to] >= 1 - 1e-6,
        'every edge constraint must be satisfied');
    });
  }
});

test('lp: rounding and the primal-dual method both stay inside a factor of two', function () {
  for (let seed = 1; seed <= 25; seed += 1) {
    const graph = randomGraph(seed * 9 + 2, 11, 0.35);
    if (graph.edges.length === 0) continue;
    const exact = ApproxLab.exactVertexCover(graph);
    const relaxation = Lp.vertexCoverLp(graph);
    const rounded = Lp.roundVertexCover(graph, relaxation);
    const dual = Lp.primalDualVertexCover(graph);

    assert.ok(rounded.feasible, 'seed ' + seed + ': the rounded cover must cover every edge');
    assert.ok(rounded.size <= 2 * exact.size, 'and stay inside its bound');
    assert.ok(Approx.coversEveryEdge(graph, dual.cover).valid, 'so must the primal-dual cover');
    assert.ok(dual.size <= 2 * exact.size, 'and it too stays inside the bound');
    assert.ok(dual.dualValue <= exact.size + 1e-9,
      'the dual it builds is a lower bound on the optimum: ' + dual.dualValue +
      ' against ' + exact.size);
  }
});

test('lp: the complete graphs attain the 2 − 2/n integrality gap exactly', function () {
  [3, 5, 7, 9, 11, 15].forEach(function (n) {
    const instance = Lp.integralityGapInstance(n);
    const relaxation = Lp.vertexCoverLp(instance.graph);

    assert.ok(Math.abs(relaxation.value - n / 2) < 1e-6,
      'K' + n + ': the LP pays ' + relaxation.value + ', expected ' + (n / 2));
    assert.strictEqual(ApproxLab.exactVertexCover(instance.graph).size, n - 1,
      'K' + n + ': the integer optimum is n − 1');
    assert.ok(Math.abs(instance.gap - (2 - 2 / n)) < 1e-12, 'and the gap is exactly 2 − 2/n');
  });
});

test('lp: the MAX-SAT relaxation bounds the integer optimum from above', function () {
  for (let seed = 1; seed <= 15; seed += 1) {
    const formula = ApproxLab.mixedFormula(Random.seeded(seed * 17 + 2),
      { variables: 10, clauses: 22 });
    const lp = ApproxLab.maxSatLp(formula);
    const exact = ApproxLab.exactMaxSat(formula);

    assert.ok(lp.value >= exact.satisfied - 1e-6,
      'seed ' + seed + ': the LP value ' + lp.value + ' must be at least the integer optimum ' +
      exact.satisfied);
    lp.y.forEach(function (value) {
      assert.ok(value >= -1e-9 && value <= 1 + 1e-9, 'every variable stays in [0, 1]');
    });
  }
});

/* -------------------------------------------------------- 19.8 the FPTAS */

test('fptas: it meets (1 − ε) and stays feasible on every instance', function () {
  for (let seed = 1; seed <= 12; seed += 1) {
    const instance = Fptas.stronglyCorrelatedInstance({ rng: Random.seeded(seed * 11 + 1),
      count: 14 });
    const exact = Fptas.exact(instance.items, instance.capacity);

    [0.5, 0.25, 0.1, 0.05, 0.01].forEach(function (epsilon) {
      const run = Fptas.fptas(instance.items, instance.capacity, epsilon);
      assert.ok(run.feasible, 'seed ' + seed + ' at ε = ' + epsilon + ': the answer must fit');
      assert.ok(run.weight <= instance.capacity, 'and its weight must be inside the capacity');
      assert.ok(run.value >= (1 - epsilon) * exact.value - 1e-9,
        'seed ' + seed + ' at ε = ' + epsilon + ': got ' + run.value + ', needed ' +
        ((1 - epsilon) * exact.value));
    });
  }
});

test('fptas: the table shrinks as ε grows, and the divisor crosses one', function () {
  const instance = Fptas.stronglyCorrelatedInstance({ rng: Random.seeded(5), count: 20 });
  const exact = Fptas.exact(instance.items, instance.capacity);
  const rows = [0.5, 0.2, 0.1, 0.05, 0.02, 0.01].map(function (epsilon) {
    return Fptas.fptas(instance.items, instance.capacity, epsilon);
  });

  for (let i = 1; i < rows.length; i += 1) {
    assert.ok(rows[i].cells > rows[i - 1].cells,
      'a tighter ε must cost more cells: ' + rows[i].cells + ' after ' + rows[i - 1].cells);
  }
  assert.ok(rows[0].cells * 5 < exact.cells,
    'at ε = 0.5 the table must be far smaller than the exact one');
  assert.ok(rows[rows.length - 1].scale < 1,
    'at ε = 0.01 the divisor falls below 1, measured ' + rows[rows.length - 1].scale);
  assert.ok(rows[rows.length - 1].cells > exact.cells,
    'and the table is then larger than the exact one');
});

test('fptas: scaling the weights instead produces an infeasible answer', function () {
  const instance = Fptas.stronglyCorrelatedInstance({ rng: Random.seeded(5), count: 20 });
  const broken = Fptas.scaleWeights(instance.items, instance.capacity, 0.5);

  assert.ok(!broken.feasible, 'weight scaling must be shown failing, not corrected');
  assert.ok(broken.overflow > 0, 'and it must report the overflow: ' + broken.overflow);
  assert.ok(broken.value > Fptas.exact(instance.items, instance.capacity).value,
    'the reported value exceeds the true optimum, which is the only visible symptom');
});

test('fptas: density greedy is unbounded and the combined rule is a half-approximation', function () {
  [50, 100, 500, 2000].forEach(function (capacity) {
    const trap = Fptas.greedyTrapInstance(capacity);
    const combined = Fptas.greedyHalf(trap.items, trap.capacity);
    const exact = Fptas.exact(trap.items, trap.capacity);

    assert.strictEqual(exact.value, capacity, 'the heavy item alone is optimal');
    assert.ok(combined.value >= exact.value / 2,
      'the combined rule is a 1/2-approximation at capacity ' + capacity);
    assert.strictEqual(combined.via, 'single item',
      'and on this instance it wins through the single-item branch');
  });
});

test('fptas: the PTAS ratio improves with k and the subset count explodes', function () {
  const instance = Fptas.stronglyCorrelatedInstance({ rng: Random.seeded(5), count: 14 });
  const exact = Fptas.exact(instance.items, instance.capacity);
  const runs = [0, 1, 2, 3].map(function (k) {
    return Fptas.ptas(instance.items, instance.capacity, k);
  });

  runs.forEach(function (run) {
    assert.ok(run.value >= run.ratioBound * exact.value - 1e-9,
      'k = ' + run.k + ': got ' + run.value + ', needed ' + (run.ratioBound * exact.value));
  });
  for (let i = 1; i < runs.length; i += 1) {
    assert.ok(runs[i].subsets > runs[i - 1].subsets * 3,
      'the subset count grows as n^k: ' + runs[i].subsets + ' after ' + runs[i - 1].subsets);
  }
});

/* ------------------------------------------------ 19.9 derandomisation */

test('derandomisation: the conditional walk meets |E|/2 on every fixture', function () {
  for (let seed = 1; seed <= 60; seed += 1) {
    const graph = randomGraph(seed * 3 + 1, 8 + (seed % 9), 0.4);
    if (graph.edges.length === 0) continue;
    const run = Derand.conditionalExpectationCut(graph);

    assert.ok(run.cut >= Derand.totalWeight(graph) / 2,
      'seed ' + seed + ': cut ' + run.cut + ' against a bound of ' +
      (Derand.totalWeight(graph) / 2));
    assert.ok(run.meetsBound, 'and the module must agree that it met it');
  }
});

test('derandomisation: the conditional expectation never falls, and ends at the cut', function () {
  for (let seed = 1; seed <= 20; seed += 1) {
    const graph = randomGraph(seed * 7 + 2, 12, 0.45);
    if (graph.edges.length === 0) continue;
    const run = Derand.conditionalExpectationCut(graph);
    let previous = run.startingExpectation;

    run.trace.forEach(function (step) {
      assert.ok(step.expectation >= previous - 1e-9,
        'the expectation fell at vertex ' + step.vertex + ' on seed ' + seed);
      previous = step.expectation;
    });
    assert.ok(Math.abs(previous - run.cut) < 1e-9,
      'with everything decided the expectation is the cut itself');
  }
});

test('derandomisation: the small sample space averages exactly |E|/2', function () {
  for (let seed = 1; seed <= 20; seed += 1) {
    const graph = randomGraph(seed * 5 + 3, 8 + (seed % 9), 0.4);
    if (graph.edges.length === 0) continue;
    const small = Derand.enumerateSmallSpace(graph);

    assert.ok(Math.abs(small.averageOverSpace - Derand.totalWeight(graph) / 2) < 1e-9,
      'seed ' + seed + ': the family averages ' + small.averageOverSpace + ' against ' +
      (Derand.totalWeight(graph) / 2));
    assert.ok(small.cut >= small.bound, 'so its best member must meet the bound');
    assert.ok(small.points < small.fullSpace, 'and it is smaller than the full space');
  }
});

test('derandomisation: the family is exactly pairwise independent and no more', function () {
  [8, 12, 16, 20].forEach(function (n) {
    const profile = Derand.independenceProfile(Derand.pairwiseFamily(n));

    assert.ok(profile.pairwiseWorst < 1e-12,
      'at n = ' + n + ' the worst pairwise deviation is ' + profile.pairwiseWorst);
    assert.ok(profile.tripleWorst > 0.1,
      'and some triple must fail, measured ' + profile.tripleWorst);
  });
});

test('derandomisation: the MAX-SAT walk meets the random expectation on every fixture', function () {
  for (let seed = 1; seed <= 40; seed += 1) {
    const formula = Derand.randomFormula({ rng: Random.seeded(seed * 9 + 1), variables: 10,
      clauses: 25, width: 3 });
    const run = Derand.conditionalExpectationSat(formula);

    assert.ok(run.satisfied >= Derand.expectedSatisfied(formula) - 1e-9,
      'seed ' + seed + ': satisfied ' + run.satisfied + ' against an expectation of ' +
      Derand.expectedSatisfied(formula));
    assert.ok(run.satisfied <= formula.clauses.length, 'and it cannot exceed the clause count');
  }
});

test('derandomisation: a random assignment misses the bound a good fraction of the time', function () {
  const graph = randomGraph(3, 16, 0.4);
  graph.edges.forEach(function (edge) { edge.weight = 1; });
  const bound = Derand.totalWeight(graph) / 2;
  let below = 0;

  for (let t = 0; t < 500; t += 1) {
    if (Derand.randomCut(graph, Random.seeded(t * 41 + 1)).cut < bound) below += 1;
  }
  assert.ok(below > 100,
    'the whole point is that "in expectation" fails often; only ' + below + ' of 500 did');
  assert.ok(below < 400, 'and it should not fail almost always either');
});
