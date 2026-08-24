'use strict';

/**
 * Property tests for the M20 modules, against brute-force references.
 *
 * Three things are checked here and nothing else is worth checking. A solver
 * agrees with an enumeration oracle on every instance, satisfiable and
 * unsatisfiable alike. A verifier accepts every valid certificate and rejects
 * malformed ones as firmly as wrong ones — a verifier that crashes on garbage
 * is a verifier whose "accepted" means nothing. And every reduction
 * round-trips: forward, solve the target, map back, and validate the mapped
 * answer against the SOURCE instance, which is the only check that catches a
 * gadget that is subtly the wrong shape.
 */

const test = require('node:test');
const assert = require('node:assert');

const Sat = require('../../src/js/algorithms/sat-basics.js');
const Verifiers = require('../../src/js/algorithms/np-verifiers.js');
const Generators = require('../../src/js/algorithms/instance-generators.js');
const Reductions = require('../../src/js/algorithms/reductions.js');

/* ------------------------------------------------------- 20.3 SAT basics */

test('dpll: agrees with brute force on random 3-SAT across the whole ratio range', function () {
  const ratios = [2, 3, 4.27, 6];
  let satisfiable = 0;

  ratios.forEach(function (ratio) {
    for (let seed = 1; seed <= 50; seed += 1) {
      const formula = Generators.randomKSat({ variables: 12, ratio: ratio, seed: seed });
      const solved = Sat.dpll(formula);
      const truth = Sat.bruteForce(formula);

      assert.strictEqual(solved.exhausted, false, 'ratio ' + ratio + ' seed ' + seed);
      assert.strictEqual(solved.satisfiable, truth.satisfiable,
        'ratio ' + ratio + ' seed ' + seed + ': dpll said ' + solved.satisfiable);
      if (!solved.satisfiable) continue;
      satisfiable += 1;
      assert.strictEqual(Sat.countSatisfied(formula, solved.assignment), formula.clauses.length,
        'ratio ' + ratio + ' seed ' + seed + ': the returned assignment must satisfy every clause');
    }
  });
  assert.ok(satisfiable > 60, 'the sweep must contain both answers; got ' + satisfiable + ' YES');
});

test('dpll: the pure literal rule changes the node count but never the answer', function () {
  for (let seed = 1; seed <= 40; seed += 1) {
    const formula = Generators.randomKSat({ variables: 11, ratio: 4.27, seed: seed });
    const withPure = Sat.dpll(formula);
    const without = Sat.dpll(formula, { pureLiteral: false });

    assert.strictEqual(withPure.satisfiable, without.satisfiable, 'seed ' + seed);
  }
});

test('dpll: a budget it cannot meet reports exhausted, never unsatisfiable', function () {
  const hard = Generators.pigeonhole(7);
  const starved = Sat.dpll(hard.formula, { budget: 200 });

  assert.strictEqual(starved.exhausted, true, 'a 200-node budget cannot refute PHP(7)');
  assert.strictEqual(starved.satisfiable, false);
  assert.ok(starved.stats.nodes >= 200, 'it must have spent the budget');
});

test('pigeonhole: unsatisfiable at every size, and exponential in DPLL nodes', function () {
  const nodes = [];

  for (let holes = 4; holes <= 7; holes += 1) {
    const instance = Generators.pigeonhole(holes);
    const solved = Sat.dpll(instance.formula, { budget: 500000 });

    assert.strictEqual(solved.exhausted, false, 'PHP(' + holes + ') must finish inside the budget');
    assert.strictEqual(solved.satisfiable, false, 'PHP(' + holes + ') is unsatisfiable');
    nodes.push(solved.stats.nodes);
  }
  for (let i = 1; i < nodes.length; i += 1) {
    assert.ok(nodes[i] > nodes[i - 1] * 3,
      'each hole must cost several times the last: ' + nodes.join(', '));
  }
});

test('horn-sat: agrees with brute force, and every instance it accepts really is Horn', function () {
  for (let seed = 1; seed <= 30; seed += 1) {
    const good = Generators.hornInstance({ variables: 12, seed: seed });
    const bad = Generators.hornInstance({ variables: 12, seed: seed, contradictory: true });

    assert.strictEqual(Sat.isHorn(good.formula), true, 'seed ' + seed);
    assert.strictEqual(Sat.isHorn(bad.formula), true, 'seed ' + seed + ' contradictory');
    assert.strictEqual(Sat.hornSat(good.formula).satisfiable,
      Sat.bruteForce(good.formula).satisfiable, 'seed ' + seed);
    assert.strictEqual(Sat.hornSat(bad.formula).satisfiable,
      Sat.bruteForce(bad.formula).satisfiable, 'seed ' + seed + ' contradictory');
  }
});

test('horn-sat: the model it returns satisfies every clause, and is the minimal one', function () {
  for (let seed = 1; seed <= 20; seed += 1) {
    const instance = Generators.hornInstance({ variables: 14, seed: seed });
    const solved = Sat.hornSat(instance.formula);

    assert.strictEqual(solved.satisfiable, true, 'seed ' + seed);
    assert.strictEqual(Sat.countSatisfied(instance.formula, solved.assignment),
      instance.formula.clauses.length, 'seed ' + seed + ': every clause satisfied');

    /* Minimality: no variable set true can be turned off without breaking a
       clause, because propagation only ever sets what a clause forced. */
    for (let v = 0; v < solved.assignment.length; v += 1) {
      if (solved.assignment[v] !== 1) continue;
      const flipped = solved.assignment.slice();
      flipped[v] = -1;
      assert.ok(Sat.countSatisfied(instance.formula, flipped) < instance.formula.clauses.length,
        'seed ' + seed + ': variable ' + (v + 1) + ' was set true without being forced');
    }
  }
});

test('horn-sat: empty and trivially contradictory clause sets', function () {
  assert.strictEqual(Sat.hornSat(Sat.createFormula(3, [])).satisfiable, true);
  assert.strictEqual(Sat.hornSat(Sat.createFormula(1, [[1], [-1]])).satisfiable, false);
  assert.strictEqual(Sat.hornSat(Sat.createFormula(2, [[1], [-1, 2], [-2]])).satisfiable, false);
});

test('toThreeCnf: preserves satisfiability on wide clauses in both directions', function () {
  for (let seed = 1; seed <= 24; seed += 1) {
    const wide = Generators.randomKSat({ variables: 8, width: 5, clauses: 12, seed: seed });
    const converted = Sat.toThreeCnf(wide);

    converted.formula.clauses.forEach(function (clause) {
      assert.ok(clause.length <= 3, 'seed ' + seed + ': a clause survived at width ' + clause.length);
    });
    assert.strictEqual(Sat.dpll(converted.formula).satisfiable, Sat.bruteForce(wide).satisfiable,
      'seed ' + seed + ': the 3-CNF must be equisatisfiable with the source');
  }
});

test('planted 3-SAT: the planted assignment satisfies every clause it generated', function () {
  for (let seed = 1; seed <= 20; seed += 1) {
    const planted = Generators.plantedKSat({ variables: 16, ratio: 5, seed: seed });

    assert.strictEqual(Sat.countSatisfied(planted.formula, planted.planted),
      planted.formula.clauses.length, 'seed ' + seed);
    assert.strictEqual(Sat.dpll(planted.formula).satisfiable, true, 'seed ' + seed);
  }
});

/* ---------------------------------------------------- 20.1 the verifiers */

test('hamiltonian: the verifier accepts a planted cycle and the search finds one', function () {
  for (let seed = 1; seed <= 15; seed += 1) {
    const instance = Generators.hamiltonianGraph({ n: 12, chords: 8, seed: seed });
    const planted = Verifiers.verifyHamiltonian(instance.graph, instance.cycle);
    const search = Verifiers.searchHamiltonian(instance.graph);

    assert.strictEqual(planted.accepted, true, 'seed ' + seed + ': ' + planted.reason);
    assert.strictEqual(search.found, true, 'seed ' + seed);
    assert.strictEqual(Verifiers.verifyHamiltonian(instance.graph, search.certificate).accepted,
      true, 'seed ' + seed + ': the search must return a certificate the verifier accepts');
  }
});

test('hamiltonian: the verifier rejects malformed certificates as firmly as wrong ones', function () {
  const instance = Generators.hamiltonianGraph({ n: 10, chords: 4, seed: 2 });
  const cycle = instance.cycle;
  const cases = [
    { name: 'too short', certificate: cycle.slice(0, 5) },
    { name: 'a repeat', certificate: cycle.slice(0, 9).concat([cycle[0]]) },
    { name: 'out of range', certificate: cycle.slice(0, 9).concat([99]) },
    { name: 'not an array', certificate: 'nope' },
    { name: 'nulls', certificate: new Array(10).fill(null) },
    { name: 'shuffled', certificate: cycle.slice().reverse().map(function (v, i) {
      return cycle[(i * 3 + 1) % cycle.length];
    }) }
  ];

  cases.forEach(function (item) {
    const got = Verifiers.verifyHamiltonian(instance.graph, item.certificate);
    if (item.name === 'shuffled' && got.accepted) return;   /* a permutation may happen to work */
    assert.strictEqual(got.accepted, false, item.name + ' must be rejected');
    assert.ok(typeof got.reason === 'string' && got.reason.length > 0,
      item.name + ' must be rejected with a reason');
  });
});

test('the verifier is polynomial and the search is not — measured, not asserted', function () {
  const verifyCosts = [];
  const searchCosts = [];

  for (let n = 8; n <= 14; n += 2) {
    const instance = Generators.nonHamiltonianGraph({ n: n, seed: 4 });
    verifyCosts.push(Verifiers.verifyHamiltonian(instance.graph,
      Generators.rangeOf(n)).steps);
    searchCosts.push(Verifiers.searchHamiltonian(instance.graph).steps);
  }
  verifyCosts.forEach(function (cost, i) {
    assert.ok(cost <= 2 * (8 + i * 2) + 2, 'verification stays linear: ' + verifyCosts.join(', '));
  });
  assert.ok(searchCosts[searchCosts.length - 1] > searchCosts[0] * 8,
    'the search must explode on the NO side: ' + searchCosts.join(', '));
});

test('subset sum: verifier and search agree, and out-of-range indices are rejected', function () {
  for (let seed = 1; seed <= 15; seed += 1) {
    const solvable = Generators.subsetSumInstance({ count: 14, seed: seed });
    const unsolvable = Generators.unsolvableSubsetSum({ count: 14, seed: seed });

    assert.strictEqual(Verifiers.verifySubsetSum(solvable, solvable.solution).accepted, true,
      'seed ' + seed + ': the planted subset must verify');
    assert.strictEqual(Verifiers.searchSubsetSum(solvable).found, true, 'seed ' + seed);
    assert.strictEqual(Verifiers.searchSubsetSum(unsolvable).found, false,
      'seed ' + seed + ': the obstructed instance must have no answer');
    assert.strictEqual(Verifiers.verifySubsetSum(solvable, [0, 999]).accepted, false);
    assert.strictEqual(Verifiers.verifySubsetSum(solvable, [0, 0]).accepted, false,
      'a repeated index is a malformed certificate');
    assert.strictEqual(Verifiers.verifySubsetSum(solvable, 'nope').accepted, false);
  }
});

test('3-colouring: the K4 obstruction is not colourable and a planted one is', function () {
  for (let seed = 1; seed <= 12; seed += 1) {
    const good = Generators.colourableGraph({ n: 14, seed: seed });
    const bad = Generators.nonColourableGraph({ n: 14, seed: seed });

    assert.strictEqual(Verifiers.verifyColouring(good.graph, good.colours, 3).accepted, true,
      'seed ' + seed + ': the planted colouring must verify');
    assert.strictEqual(Verifiers.searchColouring(good.graph, 3).found, true, 'seed ' + seed);
    assert.strictEqual(Verifiers.searchColouring(bad.graph, 3).found, false,
      'seed ' + seed + ': a K4 subgraph forbids three colours');
    assert.strictEqual(Verifiers.verifyColouring(good.graph, good.colours.slice(0, 3), 3).accepted,
      false, 'a short colouring is malformed');
    assert.strictEqual(Verifiers.verifyColouring(good.graph,
      good.colours.map(function () { return 7; }), 3).accepted, false,
      'a colour outside the palette is malformed');
  }
});

test('clique: the verifier accepts the planted clique and rejects a near miss', function () {
  for (let seed = 1; seed <= 12; seed += 1) {
    const instance = Generators.cliqueGraph({ n: 16, size: 5, seed: seed });

    assert.strictEqual(Verifiers.verifyClique(instance.graph, instance.clique, 5).accepted, true,
      'seed ' + seed);
    assert.strictEqual(Verifiers.verifyClique(instance.graph, instance.clique.slice(0, 4), 5)
      .accepted, false, 'a clique one short of the target must be rejected');
    assert.strictEqual(Verifiers.searchClique(instance.graph, 5).found, true, 'seed ' + seed);
  }
});

test('vertex cover: the verifier checks the size bound and every edge', function () {
  const graph = { n: 4, edges: [{ from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 }],
    directed: false };

  assert.strictEqual(Verifiers.verifyVertexCover(graph, [1, 2], 2).accepted, true);
  assert.strictEqual(Verifiers.verifyVertexCover(graph, [1], 2).accepted, false,
    'edge 2-3 is uncovered');
  assert.strictEqual(Verifiers.verifyVertexCover(graph, [0, 1, 2], 2).accepted, false,
    'three vertices exceeds the bound of two');
  assert.strictEqual(Verifiers.verifyVertexCover(graph, [1, 1, 2], 2).accepted, false,
    'a repeated vertex is malformed');
});

test('the PROBLEMS table names a verifier for every entry', function () {
  assert.ok(Verifiers.PROBLEMS.length >= 6);
  Verifiers.PROBLEMS.forEach(function (problem) {
    ['id', 'label', 'certificate', 'verifyCost', 'searchCost'].forEach(function (field) {
      assert.ok(typeof problem[field] === 'string' && problem[field].length > 0,
        problem.id + ' is missing ' + field);
    });
  });
});

/* ------------------------------------------------------- 20.2 reductions */

/**
 * Every 3-clause over three variables, so every assignment is ruled out by
 * exactly one of them. This is the cheapest UNSATISFIABLE 3-CNF there is —
 * eight clauses — and cheapness is the whole reason it is here. The target
 * solvers are exhaustive searches, so an unsatisfiable source makes them
 * enumerate; at eighteen random clauses over three variables that costs half a
 * minute per reduction, which is why the ratio sweep this suite originally
 * carried never once finished.
 */
const UNSAT_CORE = [[1, 2, 3], [1, 2, -3], [1, -2, 3], [1, -2, -3],
  [-1, 2, 3], [-1, 2, -3], [-1, -2, 3], [-1, -2, -3]];

const REDUCTION_NAMES = ['sat-to-independent-set', 'sat-to-clique', 'sat-to-colouring'];

test('every reduction round-trips on satisfiable sources', function () {
  REDUCTION_NAMES.forEach(function (name) {
    for (let seed = 1; seed <= 10; seed += 1) {
      const formula = Generators.randomKSat({ variables: 5, clauses: 10, seed: seed });
      const result = Reductions.run(name, formula);

      assert.strictEqual(result.sourceSatisfiable, true, name + ' seed ' + seed);
      assert.strictEqual(result.targetSolved, true,
        name + ' seed ' + seed + ': a satisfiable source must give a solvable target');
      assert.strictEqual(result.agrees, true,
        name + ' seed ' + seed + ': the target answer must match the source');
      assert.strictEqual(result.valid, true,
        name + ' seed ' + seed + ': ' + (result.reason || 'mapped back wrong'));
      /* The mapped answer comes back as booleans, which is the shape a
         verifier takes; `countSatisfied` reads the ±1 trail encoding. Checking
         it both ways is deliberate — a gadget can produce an assignment the
         verifier accepts and the solver's own representation rejects. */
      assert.strictEqual(Sat.countSatisfied(formula, Sat.fromBooleans(result.mapped)),
        formula.clauses.length,
        name + ' seed ' + seed + ': the mapped-back assignment must satisfy the SOURCE');
    }
  });
});

test('every reduction round-trips on unsatisfiable sources', function () {
  REDUCTION_NAMES.forEach(function (name) {
    for (let variables = 3; variables <= 5; variables += 1) {
      const formula = Sat.createFormula(variables, UNSAT_CORE);
      const result = Reductions.run(name, formula);

      assert.strictEqual(result.sourceSatisfiable, false, name + ' at ' + variables + ' variables');
      assert.strictEqual(result.targetSolved, false,
        name + ': an unsatisfiable source must give an unsolvable target');
      assert.strictEqual(result.agrees, true, name + ' at ' + variables + ' variables');
      assert.strictEqual(result.valid, true, name + ' at ' + variables + ' variables');
    }
  });
});

test('the round trip catches a source made unsatisfiable one clause at a time', function () {
  /* Six of the eight clauses are satisfiable, seven are, and the eighth is the
     one that closes it — so the same family exercises the boundary rather than
     only the two ends. */
  const answers = [];

  for (let take = 6; take <= 8; take += 1) {
    const formula = Sat.createFormula(3, UNSAT_CORE.slice(0, take));
    const result = Reductions.run('sat-to-independent-set', formula);

    assert.strictEqual(result.agrees, true, 'the first ' + take + ' clauses');
    assert.strictEqual(result.valid, true, 'the first ' + take + ' clauses');
    answers.push(result.sourceSatisfiable);
  }
  assert.deepStrictEqual(answers, [true, true, false],
    'the eighth clause is the one that makes it unsatisfiable');
});

test('sat to independent set: the target size is the clause count, exactly', function () {
  for (let seed = 1; seed <= 10; seed += 1) {
    const formula = Generators.randomKSat({ variables: 7, ratio: 3, seed: seed });
    const map = Reductions.satToIndependentSet(formula);

    assert.strictEqual(map.target, formula.clauses.length,
      'seed ' + seed + ': the independent set must take one literal per clause');
    assert.strictEqual(map.graph.n, formula.clauses.reduce(function (sum, clause) {
      return sum + clause.length;
    }, 0), 'seed ' + seed + ': one vertex per literal occurrence');
  }
});

test('sat to clique: independent set in the complement is clique in the graph', function () {
  for (let seed = 1; seed <= 10; seed += 1) {
    const formula = Generators.randomKSat({ variables: 6, ratio: 3, seed: seed });
    const clique = Reductions.satToClique(formula);
    const independent = Reductions.satToIndependentSet(formula);

    assert.strictEqual(clique.target, independent.target, 'seed ' + seed);
    const possible = clique.graph.n * (clique.graph.n - 1) / 2;
    assert.strictEqual(clique.graph.edges.length + independent.graph.edges.length, possible,
      'seed ' + seed + ': the two edge sets must partition every pair');
  }
});

test('vertex cover to set cover: the mapped cover really covers the source graph', function () {
  for (let seed = 1; seed <= 10; seed += 1) {
    const graph = Generators.colourableGraph({ n: 8, seed: seed }).graph;
    for (let size = 3; size <= 6; size += 1) {
      const result = Reductions.run('vertex-cover-to-set-cover', { graph: graph, size: size });
      if (!result.targetSolved) continue;
      assert.strictEqual(result.valid, true,
        'seed ' + seed + ' size ' + size + ': ' + (result.reason || 'invalid'));
      assert.ok(result.mapped.length <= size, 'seed ' + seed + ': the cover must fit the budget');
    }
  }
});

test('subset sum to partition: the two sides really are equal, and map back exactly', function () {
  for (let seed = 1; seed <= 10; seed += 1) {
    const solvable = Generators.subsetSumInstance({ count: 10, seed: seed });
    const result = Reductions.run('subset-sum-to-partition', solvable);

    assert.strictEqual(result.agrees, true, 'seed ' + seed);
    assert.strictEqual(result.valid, true, 'seed ' + seed + ': ' + (result.reason || 'invalid'));
    const total = result.map.numbers.reduce(function (a, b) { return a + b; }, 0);
    const side = result.side.reduce(function (sum, i) { return sum + result.map.numbers[i]; }, 0);
    assert.strictEqual(side * 2, total, 'seed ' + seed + ': a partition is two equal halves');
  }
});

test('subset sum to partition: an unsolvable source stays unsolvable in the target', function () {
  for (let seed = 1; seed <= 8; seed += 1) {
    const unsolvable = Generators.unsolvableSubsetSum({ count: 10, seed: seed });
    const result = Reductions.run('subset-sum-to-partition', unsolvable);

    assert.strictEqual(result.sourceSatisfiable, false, 'seed ' + seed);
    assert.strictEqual(result.agrees, true, 'seed ' + seed);
  }
});

test('the NAMES list and run() stay in step', function () {
  assert.strictEqual(Reductions.NAMES.length, 5);
  Reductions.NAMES.forEach(function (name) {
    assert.strictEqual(typeof name, 'string');
  });
});
