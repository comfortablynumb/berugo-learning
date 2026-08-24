'use strict';

/**
 * Property tests for the M20 search modules, against brute-force references.
 *
 * The four things checked here are the four ways these modules can be wrong
 * while still returning something plausible. A QBF evaluator can fold the
 * prefix in the wrong direction and agree with a truth table on most
 * instances. A reduction rule can be very slightly unsafe and return a smaller
 * cover for an instance that has none. A metaheuristic can overrun its budget
 * or return a tour that skips a city, and the cost column cannot detect
 * either. An encoding can be satisfiable where its source is not.
 *
 * So every solver is checked against an oracle that shares no code with it,
 * every returned answer is validated against the original instance, and every
 * budget is checked as a ceiling rather than a suggestion.
 */

const test = require('node:test');
const assert = require('node:assert');

const Random = require('../../src/js/utils/random.js');
const GraphCore = require('../../src/js/algorithms/graph-core.js');
const Sat = require('../../src/js/algorithms/sat-basics.js');
const Qbf = require('../../src/js/algorithms/qbf.js');
const Fpt = require('../../src/js/algorithms/fpt.js');
const Meta = require('../../src/js/algorithms/metaheuristics.js');
const Encodings = require('../../src/js/algorithms/encodings.js');
const Rostering = require('../../src/js/algorithms/rostering.js');

/* ---------------------------------------------------------------- 20.4 QBF */

test('qbf: the evaluator agrees with the truth-table oracle on every prefix shape', function () {
  const patterns = ['E', 'A', 'EA', 'AE', 'EAE', 'AEA', 'AEAE'];
  let trues = 0;
  let falses = 0;

  patterns.forEach(function (pattern) {
    for (let seed = 1; seed <= 20; seed += 1) {
      const qbf = Qbf.randomQbf({ variables: 8, clauses: 14, pattern: pattern, seed: seed });
      const evaluated = Qbf.evaluate(qbf);
      const oracle = Qbf.bruteForceQbf(qbf);

      assert.strictEqual(evaluated.exhausted, false, pattern + ' seed ' + seed);
      assert.strictEqual(evaluated.value, oracle.value,
        pattern + ' seed ' + seed + ': evaluator said ' + evaluated.value);
      if (oracle.value) trues += 1; else falses += 1;
    }
  });
  assert.ok(trues > 20 && falses > 20,
    'the sweep must exercise both answers: ' + trues + ' true, ' + falses + ' false');
});

test('qbf: the matching game is true and its mirror is false, on identical clauses', function () {
  for (let pairs = 1; pairs <= 5; pairs += 1) {
    const forward = Qbf.matchingGame(pairs);
    const swapped = Qbf.swappedGame(pairs);

    assert.deepStrictEqual(forward.qbf.clauses, swapped.qbf.clauses,
      pairs + ' rounds: the two games must differ only in the prefix');
    assert.strictEqual(Qbf.evaluate(forward.qbf).value, true, pairs + ' rounds, forward');
    assert.strictEqual(Qbf.evaluate(swapped.qbf).value, false, pairs + ' rounds, swapped');
    assert.strictEqual(Sat.dpll(Qbf.asSat(swapped.qbf)).satisfiable, true,
      pairs + ' rounds: as plain SAT the swapped game is satisfiable, which is the point');
  }
});

test('qbf: expanding the universals preserves the answer exactly', function () {
  ['EA', 'AE', 'EAE'].forEach(function (pattern) {
    for (let seed = 1; seed <= 15; seed += 1) {
      const qbf = Qbf.randomQbf({ variables: 8, clauses: 12, pattern: pattern, seed: seed });
      const expansion = Qbf.expandUniversals(qbf, { cap: 12 });

      assert.strictEqual(expansion.built, true, pattern + ' seed ' + seed);
      assert.strictEqual(Sat.dpll(expansion.formula, { budget: 500000 }).satisfiable,
        Qbf.evaluate(qbf).value,
        pattern + ' seed ' + seed + ': the expansion must be equisatisfiable with the sentence');
    }
  });
});

test('qbf: a prefix that omits a variable has it appended as existential', function () {
  const built = Qbf.createQbf([{ quantifier: Qbf.FORALL, variable: 1 }], [[1, 2]], 3);

  assert.strictEqual(built.prefix.length, 3, 'every variable must be quantified');
  assert.strictEqual(built.prefix[1].quantifier, Qbf.EXISTS);
  assert.strictEqual(Qbf.evaluate(built).value, true,
    'for all x1 there is an x2 making (x1 or x2) true');
});

test('qbf: the game tree reports what it truncated', function () {
  const qbf = Qbf.randomQbf({ variables: 8, clauses: 12, pattern: 'AE', seed: 3 });
  const shallow = Qbf.gameTree(qbf, { maxDepth: 2 });
  const deep = Qbf.gameTree(qbf, { maxDepth: 4 });

  assert.ok(shallow.truncated > 0, 'a depth-2 view of an 8-variable prefix truncates');
  assert.ok(deep.nodes > shallow.nodes, 'a deeper view holds more nodes');
  assert.strictEqual(shallow.root.value, Qbf.evaluate(qbf).value,
    'the root of the drawn tree must carry the sentence’s own answer');
});

/* ---------------------------------------------------------------- 20.5 FPT */

function randomGraph(seed, n, m) {
  return GraphCore.randomGraph(n, m, Random.seeded(seed));
}

test('fpt: branch and reduce agrees with brute force at every budget', function () {
  for (let seed = 1; seed <= 20; seed += 1) {
    const graph = randomGraph(seed, 12, 20);
    for (let k = 0; k <= 9; k += 1) {
      const truth = Fpt.bruteForceCover(graph, k).found;

      [{ rule: 'edge', reduce: false }, { rule: 'edge', reduce: true },
        { rule: 'degree', reduce: false }, { rule: 'degree', reduce: true }]
        .forEach(function (options) {
          const run = Fpt.branchAndReduce(graph, k, options);
          assert.strictEqual(run.found, truth,
            'seed ' + seed + ' k=' + k + ' ' + options.rule +
              (options.reduce ? '+rules' : '') + ': expected ' + truth);
          if (!run.found) return;
          assert.ok(run.cover.length <= k, 'the cover must fit the budget');
          assert.strictEqual(Fpt.coversAll(graph, run.cover), true,
            'and it must cover every edge');
        });
    }
  }
});

test('fpt: edge branching without the rules is exactly 2^(k+1) − 1 nodes on a NO instance', function () {
  const graph = randomGraph(4, 30, 80);

  for (let k = 8; k <= 14; k += 1) {
    const run = Fpt.branchAndReduce(graph, k, { rule: 'edge', reduce: false, budget: 1e7 });
    if (run.found) continue;
    assert.strictEqual(run.nodes, Math.pow(2, k + 1) - 1,
      'k=' + k + ': expected ' + (Math.pow(2, k + 1) - 1) + ' nodes, got ' + run.nodes);
  }
});

test('fpt: degree branching measures a base below two and edge branching measures two', function () {
  const graph = randomGraph(4, 30, 80);
  const seriesFor = function (rule) {
    const runs = [];
    for (let k = 8; k <= 16; k += 1) {
      const run = Fpt.branchAndReduce(graph, k, { rule: rule, reduce: false, budget: 1e7 });
      runs.push({ k: k, nodes: run.nodes, found: run.found, exhausted: run.exhausted });
    }
    return Fpt.branchingFactor(runs.filter(function (run) {
      return !run.found && !run.exhausted;
    }));
  };
  const edge = seriesFor('edge');
  const degree = seriesFor('degree');

  assert.ok(Math.abs(edge.base - 2) < 0.01, 'edge branching should fit 2, got ' + edge.base);
  assert.ok(degree.base < 1.5, 'degree branching should fit below 1.5, got ' + degree.base);
  assert.ok(degree.base > 1, 'and above 1, got ' + degree.base);
});

test('fpt: the Buss kernel preserves the exact answer', function () {
  for (let seed = 1; seed <= 20; seed += 1) {
    const graph = randomGraph(seed, 12, 22);
    for (let k = 0; k <= 8; k += 1) {
      const kernel = Fpt.bussKernel(graph, k);
      const truth = Fpt.bruteForceCover(graph, k).found;

      if (kernel.decided) {
        assert.strictEqual(kernel.answer, truth,
          'seed ' + seed + ' k=' + k + ': the rules decided it as ' + kernel.answer);
        continue;
      }
      assert.ok(kernel.edges <= kernel.k * kernel.k,
        'seed ' + seed + ' k=' + k + ': an undecided kernel must satisfy the k² bound');
      assert.strictEqual(Fpt.kernelThenSearch(graph, k).found, truth,
        'seed ' + seed + ' k=' + k + ': kernel-then-search must agree with brute force');
    }
  }
});

test('fpt: the kernel maps its answer back to a cover of the original graph', function () {
  for (let seed = 1; seed <= 15; seed += 1) {
    const graph = randomGraph(seed, 14, 26);
    const exact = Fpt.bruteForceCover(graph);
    const solved = Fpt.kernelThenSearch(graph, exact.size);

    assert.strictEqual(solved.found, true, 'seed ' + seed + ' at the exact optimum');
    assert.strictEqual(Fpt.coversAll(graph, solved.cover), true,
      'seed ' + seed + ': the mapped cover must cover the ORIGINAL graph');
    assert.ok(solved.cover.length <= exact.size, 'seed ' + seed + ': and be no larger');
  }
});

test('fpt: the treewidth DP agrees with brute force, including on forests and empty graphs', function () {
  const cases = [];

  for (let seed = 1; seed <= 15; seed += 1) cases.push(randomGraph(seed, 12, 20));
  for (let seed = 1; seed <= 10; seed += 1) cases.push(randomGraph(seed, 14, 8));
  for (let seed = 1; seed <= 8; seed += 1) {
    const rng = Random.seeded(seed);
    const edges = [];
    for (let v = 1; v < 12; v += 1) edges.push({ from: rng.int(v), to: v, weight: 1 });
    cases.push(GraphCore.createGraph(12, edges));
  }
  cases.push(GraphCore.createGraph(6, []));
  cases.push(GraphCore.createGraph(1, []));

  cases.forEach(function (graph, index) {
    const dp = Fpt.coverByTreewidth(graph);
    assert.strictEqual(dp.size, Fpt.bruteForceCover(graph).size,
      'case ' + index + ': the DP gave ' + dp.size);
    assert.ok(dp.width >= 0 && dp.width < graph.n + 1, 'case ' + index + ': width in range');
  });
});

/* ------------------------------------------------------ 20.6 metaheuristics */

function tspInstance(seed, n) {
  const rng = Random.seeded(seed);
  const points = [];

  for (let i = 0; i < n; i += 1) points.push({ x: rng.next() * 100, y: rng.next() * 100 });
  return Meta.tspProblem(points);
}

function isTour(tour, n) {
  return tour !== null && tour.length === n && new Set(tour).size === n;
}

test('metaheuristics: every method returns a valid tour and respects the budget', function () {
  const problem = tspInstance(5, 20);

  Meta.NAMES.forEach(function (name) {
    const budget = Meta.createBudget(6000);
    const rng = Random.seeded(9);
    const start = Meta.nearestNeighbour(problem, budget).tour;

    if (name === 'two-opt') Meta.twoOpt(problem, budget, start);
    else if (name === 'or-opt') Meta.orOpt(problem, budget, start);
    else if (name === 'annealing') Meta.annealing(problem, budget, rng, { start: start });
    else if (name === 'tabu') Meta.tabuSearch(problem, budget, rng, { start: start });
    else if (name === 'genetic') Meta.geneticAlgorithm(problem, budget, rng);
    else if (name === 'ant-colony') Meta.antColony(problem, budget, rng);
    else if (name === 'grasp') Meta.grasp(problem, budget, rng);

    const tour = budget.bestTour();
    assert.strictEqual(isTour(tour, problem.n), true, name + ' returned an invalid tour');
    assert.ok(Math.abs(problem.cost(tour) - budget.best()) < 1e-9,
      name + ' reported ' + budget.best() + ' for a tour costing ' + problem.cost(tour));
    assert.ok(budget.spent() <= 6000 + problem.n,
      name + ' spent ' + budget.spent() + ' of a 6 000 budget');
  });
});

test('metaheuristics: the 2-opt and or-opt deltas are exact', function () {
  for (let seed = 1; seed <= 20; seed += 1) {
    const problem = tspInstance(seed, 16);
    const budget = Meta.createBudget(200000);
    const start = Meta.nearestNeighbour(problem, budget).tour;
    const two = Meta.twoOpt(problem, budget, start);
    const or = Meta.orOpt(problem, Meta.createBudget(200000), start);

    assert.ok(Math.abs(two.cost - problem.cost(two.tour)) < 1e-9,
      'seed ' + seed + ': the 2-opt running cost drifted from the tour');
    assert.ok(Math.abs(or.cost - problem.cost(or.tour)) < 1e-9,
      'seed ' + seed + ': the or-opt running cost drifted from the tour');
    assert.strictEqual(isTour(or.tour, problem.n), true, 'seed ' + seed + ': or-opt tour valid');
  }
});

test('metaheuristics: local search never returns a worse tour than it started from', function () {
  for (let seed = 1; seed <= 15; seed += 1) {
    const problem = tspInstance(seed, 18);
    const budget = Meta.createBudget(50000);
    const start = Meta.nearestNeighbour(problem, budget).tour;
    const before = problem.cost(start);

    assert.ok(Meta.twoOpt(problem, budget, start).cost <= before + 1e-9,
      'seed ' + seed + ': 2-opt made it worse');
    assert.ok(Meta.orOpt(problem, Meta.createBudget(50000), start).cost <= before + 1e-9,
      'seed ' + seed + ': or-opt made it worse');
  }
});

test('metaheuristics: annealing at temperature zero accepts no worsening move', function () {
  for (let seed = 1; seed <= 10; seed += 1) {
    const problem = tspInstance(seed, 18);
    const budget = Meta.createBudget(4000);
    const start = Meta.nearestNeighbour(problem, budget).tour;
    const run = Meta.annealing(problem, budget, Random.seeded(seed), { start: start,
      temperature: 0 });

    assert.strictEqual(run.worseAccepted, 0,
      'seed ' + seed + ': at temperature zero the acceptance test is delta < 0');
    assert.ok(run.cost <= problem.cost(start) + 1e-9, 'seed ' + seed + ': and it never worsens');
  }
});

test('metaheuristics: the cooling rate is derived from the budget, not fixed', function () {
  const small = Meta.coolingFor(Meta.createBudget(1000), {});
  const large = Meta.coolingFor(Meta.createBudget(100000), {});

  assert.ok(small < large, 'a smaller budget must cool faster: ' + small + ' against ' + large);
  assert.ok(Math.abs(Math.pow(small, 1000) - 1e-3) < 1e-9,
    'the temperature must fall a thousandfold across the budget');
});

test('metaheuristics: order crossover produces a permutation from two permutations', function () {
  for (let seed = 1; seed <= 40; seed += 1) {
    const rng = Random.seeded(seed);
    const a = rng.shuffle(Meta.identityTour(12));
    const b = rng.shuffle(Meta.identityTour(12));
    const child = Meta.orderCrossover(a, b, rng);

    assert.strictEqual(isTour(child, 12), true,
      'seed ' + seed + ': the child must visit every city once — got ' + child.join(','));
  }
});

/* ---------------------------------------------------------- 20.7 encodings */

function atMostOneHolds(literals, built, counter, k) {
  const n = literals.length;

  for (let mask = 0; mask < (1 << n); mask += 1) {
    let ones = 0;
    const units = [];
    for (let i = 0; i < n; i += 1) {
      const on = (mask >>> i) & 1;
      if (on) ones += 1;
      units.push([on ? (i + 1) : -(i + 1)]);
    }
    const solved = Sat.dpll(Sat.createFormula(counter.next, built.clauses.concat(units)),
      { budget: 400000 });
    if (solved.satisfiable !== (ones <= k)) return { mask: mask, ones: ones };
  }
  return null;
}

test('encodings: every at-most-one encoding means exactly what it says', function () {
  Encodings.AT_MOST_ONE.forEach(function (encoding) {
    for (let n = 2; n <= 7; n += 1) {
      const counter = { next: n };
      const literals = [];
      for (let i = 1; i <= n; i += 1) literals.push(i);
      const built = Encodings.atMostOne(literals, counter, { encoding: encoding, groupSize: 3 });
      const wrong = atMostOneHolds(literals, built, counter, 1);

      assert.strictEqual(wrong, null,
        encoding + ' at n=' + n + ' is wrong on ' + JSON.stringify(wrong));
    }
  });
});

test('encodings: at-most-k and at-least-k mean exactly what they say', function () {
  for (let n = 2; n <= 6; n += 1) {
    for (let k = 0; k <= n; k += 1) {
      const literals = [];
      for (let i = 1; i <= n; i += 1) literals.push(i);

      const atMost = { next: n };
      assert.strictEqual(
        atMostOneHolds(literals, Encodings.atMostK(literals, k, atMost), atMost, k), null,
        'at-most-' + k + ' over ' + n + ' is wrong');

      const atLeast = { next: n };
      const built = Encodings.atLeastK(literals, k, atLeast);
      for (let mask = 0; mask < (1 << n); mask += 1) {
        let ones = 0;
        const units = [];
        for (let i = 0; i < n; i += 1) {
          const on = (mask >>> i) & 1;
          if (on) ones += 1;
          units.push([on ? (i + 1) : -(i + 1)]);
        }
        const solved = Sat.dpll(Sat.createFormula(atLeast.next, built.clauses.concat(units)),
          { budget: 400000 });
        assert.strictEqual(solved.satisfiable, ones >= k,
          'at-least-' + k + ' over ' + n + ' is wrong on mask ' + mask);
      }
    }
  }
});

test('encodings: the pairwise count is quadratic and the counters are linear', function () {
  [10, 20, 50, 100].forEach(function (n) {
    const literals = [];
    for (let i = 1; i <= n; i += 1) literals.push(i);
    const pairwise = Encodings.atMostOne(literals, { next: n }, { encoding: 'pairwise' });
    const sequential = Encodings.atMostOne(literals, { next: n }, { encoding: 'sequential' });

    assert.strictEqual(pairwise.clauses.length, n * (n - 1) / 2, 'pairwise at n=' + n);
    assert.strictEqual(sequential.clauses.length, 3 * n - 4, 'sequential at n=' + n);
    assert.strictEqual(sequential.auxiliary, n - 1, 'sequential variables at n=' + n);
  });
});

test('encodings: every colouring model agrees with a direct search, and decodes properly', function () {
  for (let seed = 1; seed <= 10; seed += 1) {
    const graph = randomGraph(seed, 11, 22);
    for (let colours = 2; colours <= 4; colours += 1) {
      const compared = Encodings.compareEncodings(graph, colours, { budget: 1000000 });
      assert.strictEqual(compared.agreed, true,
        'seed ' + seed + ' colours ' + colours + ': the six models disagree');

      compared.rows.forEach(function (row) {
        if (!row.satisfiable) return;
        assert.strictEqual(row.proper, true,
          'seed ' + seed + ' ' + row.encoding + ': the decoded colouring is improper');
      });
    }
  }
});

test('encodings: symmetry breaking never changes the answer', function () {
  for (let seed = 1; seed <= 12; seed += 1) {
    const graph = randomGraph(seed, 12, 26);
    for (let colours = 2; colours <= 5; colours += 1) {
      const plain = Encodings.colouringToCnf(graph, colours, { encoding: 'pairwise' });
      const broken = Encodings.colouringToCnf(graph, colours,
        { encoding: 'pairwise', symmetryBreaking: true });

      assert.strictEqual(Sat.dpll(broken.formula, { budget: 2000000 }).satisfiable,
        Sat.dpll(plain.formula, { budget: 2000000 }).satisfiable,
        'seed ' + seed + ' colours ' + colours + ': symmetry breaking changed the answer');
    }
  }
});

/* --------------------------------------------------------- 20.9 rostering */

test('rostering: a satisfiable model decodes to a schedule the validator accepts', function () {
  const cases = [
    { nurses: 6, days: 5, demand: [1, 1, 1], maxShifts: 4, restWindow: 3 },
    { nurses: 7, days: 6, demand: [2, 1, 1], maxShifts: 5, restWindow: 3 },
    { nurses: 8, days: 6, demand: [2, 1, 1], maxShifts: 4, restWindow: 3 }
  ];

  cases.forEach(function (options, index) {
    const spec = Rostering.scenario(options);
    const model = Rostering.encode(spec);
    const solved = Sat.dpll(model.formula, { budget: 600000 });

    assert.strictEqual(solved.exhausted, false, 'case ' + index + ' must finish inside the budget');
    assert.strictEqual(solved.satisfiable, true, 'case ' + index + ' must be feasible');
    const validation = Rostering.validate(spec, Rostering.decode(spec, solved.assignment));
    assert.strictEqual(validation.satisfied, true,
      'case ' + index + ': ' + validation.checks.filter(function (check) {
        return !check.ok;
      }).map(function (check) { return check.id + ' (' + check.failures.join('; ') + ')'; })
        .join(', '));
  });
});

test('rostering: the validator rejects a schedule that breaks each requirement in turn', function () {
  const spec = Rostering.scenario({ nurses: 6, days: 6, demand: [1, 1, 1], maxShifts: 3,
    restWindow: 3 });
  const good = [
    [-1, 0, -1, 0, -1, 0], [-1, 1, -1, 1, -1, 1], [-1, 2, -1, 2, -1, 2],
    [0, -1, 0, -1, 0, -1], [1, -1, 1, -1, 1, -1], [2, -1, 2, -1, 2, -1]
  ];
  const copy = function () { return good.map(function (row) { return row.slice(); }); };

  assert.strictEqual(Rostering.validate(spec, good).satisfied, true,
    'the alternating-day roster satisfies every requirement');

  const broken = { demand: copy(), workload: copy(), rest: copy(),
    'no-day-after-night': copy() };
  broken.demand[0][1] = -1;
  broken.workload[0][0] = 0;
  broken.rest[0][0] = 1;
  broken.rest[0][2] = 1;
  broken['no-day-after-night'][2][2] = 2;
  broken['no-day-after-night'][2][3] = 0;

  Object.keys(broken).forEach(function (id) {
    const result = Rostering.validate(spec, broken[id]);
    const failed = result.checks.filter(function (check) { return !check.ok; })
      .map(function (check) { return check.id; });
    assert.ok(failed.indexOf(id) !== -1,
      'breaking ' + id + ' must make the ' + id + ' check fail; failed: ' + failed.join(', '));
  });
});

test('rostering: an infeasible-by-counting scenario is never satisfiable', function () {
  const spec = Rostering.scenario({ nurses: 4, days: 5, demand: [1, 1, 1], maxShifts: 3,
    restWindow: 3 });
  const required = spec.days * spec.demand.reduce(function (a, b) { return a + b; }, 0);

  assert.ok(spec.nurses * spec.maxShifts < required,
    'the fixture must be infeasible by capacity: ' + (spec.nurses * spec.maxShifts) +
      ' against ' + required);
  const solved = Sat.dpll(Rostering.encode(spec).formula, { budget: 300000 });
  assert.strictEqual(solved.satisfiable, false,
    'a model that reports a roster for an over-subscribed scenario is wrong');
});

test('rostering: a scenario missing a shift kind adds no clauses for the rule about it', function () {
  const spec = Rostering.scenario({ nurses: 5, days: 4, demand: [1, 1], maxShifts: 3,
    restWindow: 3 });

  spec.shifts = ['day', 'evening'];
  spec.demand = [1, 1];
  const model = Rostering.encode(spec);
  const group = model.groups.filter(function (item) {
    return item.id === 'no-day-after-night';
  })[0];

  assert.strictEqual(group.clauses.length, 0,
    'with no night shift there is nothing to forbid, and a -1 index must not reach shiftVar');
  const solved = Sat.dpll(model.formula, { budget: 300000 });
  assert.strictEqual(solved.satisfiable, true, 'and the scenario is still feasible');
  assert.strictEqual(
    Rostering.validate(spec, Rostering.decode(spec, solved.assignment)).satisfied, true,
    'and the schedule still validates');
});
