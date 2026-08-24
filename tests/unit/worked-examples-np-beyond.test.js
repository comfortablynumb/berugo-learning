'use strict';

/**
 * Every figure the M20.4-M20.6 content quotes, recomputed from the modules and
 * then checked against the prose.
 *
 * The section controllers are not imported; the calls below reproduce what
 * they make at their default control settings.
 */

const test = require('node:test');
const assert = require('node:assert');

const NpLab = require('../../src/js/machines/np-lab.js');
const HeuristicLab = require('../../src/js/machines/heuristic-lab.js');
const Qbf = require('../../src/js/algorithms/qbf.js');

require('../../src/js/content/concepts-np-beyond.js');
require('../../src/js/content/examples-np-beyond.js');
const prose = require('../support/worked-example-prose.js');

/* ------------------------------------------------------------ 20.4 beyond NP */

test('beyond-np: five prefixes on one matrix, and three of them are false', function () {
  const study = NpLab.qbfStudy({ variables: 10, clauses: 14, seed: 5, pairs: 4 });
  const byPattern = {};

  study.rows.forEach(function (row) { byPattern[row.pattern] = row; });
  assert.deepStrictEqual(study.rows.map(function (row) { return row.pattern; }),
    ['E', 'EA', 'AE', 'EAE', 'AEAE']);
  assert.deepStrictEqual(study.rows.map(function (row) { return row.value; }),
    [true, false, false, true, false]);
  study.rows.forEach(function (row) {
    assert.strictEqual(row.agrees, true, row.pattern + ' disagrees with the oracle');
    assert.strictEqual(row.asSat, true, row.pattern + ' must be satisfiable as plain SAT');
  });

  assert.strictEqual(byPattern.E.nodes, 37);
  assert.strictEqual(byPattern.EA.nodes, 223);
  assert.strictEqual(byPattern.AE.nodes, 546);
  assert.strictEqual(byPattern.AEAE.nodes, 46);
  assert.strictEqual(byPattern.EA.universals, 5);
  assert.strictEqual(byPattern.AEAE.universals, 6);
  assert.strictEqual(byPattern.AEAE.alternations, 3);
  assert.deepStrictEqual(study.rows.map(function (row) { return row.expansionClauses; }),
    [14, 152, 208, 78, 264]);
  assert.strictEqual(byPattern.E.oracleEntries, 1024);

  prose.quotes('beyond-np', ['37', '223', '546', '46', '14', '152', '208', '78', '264',
    '1 024', '64']);
});

test('beyond-np: the two games, identical clauses and opposite answers', function () {
  const study = NpLab.qbfStudy({ variables: 10, clauses: 14, seed: 5, pairs: 4 });
  const forward = study.games.filter(function (row) { return row.order === '∀ then ∃'; });
  const swapped = study.games.filter(function (row) { return row.order === '∃ then ∀'; });

  assert.deepStrictEqual(forward.map(function (row) { return row.value; }),
    [true, true, true, true]);
  assert.deepStrictEqual(swapped.map(function (row) { return row.value; }),
    [false, false, false, false]);
  assert.deepStrictEqual(forward.map(function (row) { return row.nodes; }), [6, 19, 51, 127]);
  assert.deepStrictEqual(swapped.map(function (row) { return row.nodes; }), [6, 14, 30, 62]);
  assert.deepStrictEqual(forward.map(function (row) { return row.strategySize; }), [2, 4, 8, 16]);
  study.games.forEach(function (row) {
    assert.strictEqual(row.value, row.expected, row.pairs + ' ' + row.order);
    assert.strictEqual(row.asSat, true, 'both games are satisfiable as plain CNF');
  });

  prose.quotes('beyond-np', ['6, 19, 51 and 127', '6, 14, 30 and 62', '16 entries']);
});

test('beyond-np: the clauses really are identical between the two games', function () {
  for (let pairs = 1; pairs <= 4; pairs += 1) {
    assert.deepStrictEqual(Qbf.matchingGame(pairs).qbf.clauses,
      Qbf.swappedGame(pairs).qbf.clauses, pairs + ' rounds');
  }
});

/* ------------------------------------------------- 20.5 parameterised */

test('parameterised-algorithms: five methods on the demo default', function () {
  const graph = NpLab.instanceGraph({ n: 20, m: 45, seed: 4 });
  const study = NpLab.vertexCoverStudy({ graph: graph, k: 12 });
  const byMethod = {};

  study.rows.forEach(function (row) { byMethod[row.method] = row; });
  assert.strictEqual(study.brute.examined, 1048576);
  assert.strictEqual(study.brute.size, 12);
  assert.strictEqual(byMethod['edge branching'].nodes, 925);
  assert.strictEqual(byMethod['edge branching + rules'].nodes, 389);
  assert.strictEqual(byMethod['degree branching'].nodes, 13);
  assert.strictEqual(byMethod['degree branching + rules'].nodes, 13);
  assert.strictEqual(byMethod['Buss kernel, then degree branching'].nodes, 13);
  study.rows.forEach(function (row) {
    assert.strictEqual(row.found, true, row.method);
    assert.strictEqual(row.size, 12, row.method);
    assert.strictEqual(row.valid, true, row.method);
  });

  prose.quotes('parameterised-algorithms', ['1 048 576', '925', '13', '12', '45 edges']);
});

test('parameterised-algorithms: the four fitted branching bases', function () {
  const graph = NpLab.instanceGraph({ n: 20, m: 45, seed: 4 });
  const sweep = NpLab.branchingSweep({ graph: graph, from: 6, to: 18, step: 1 });
  const seriesFor = function (rule, reduce) {
    return sweep.series.filter(function (entry) {
      return entry.rule === rule && entry.reduce === reduce;
    })[0];
  };

  assert.strictEqual(prose.fixed(seriesFor('edge', false).base, 4), '2.0030');
  assert.strictEqual(prose.fixed(seriesFor('edge', true).base, 4), '3.0163');
  assert.strictEqual(prose.fixed(seriesFor('degree', false).base, 4), '1.4991');
  assert.strictEqual(prose.fixed(seriesFor('degree', true).base, 4), '1.6712');

  const plainEdge = seriesFor('edge', false).runs.filter(function (run) {
    return !run.found && !run.exhausted;
  });
  assert.strictEqual(plainEdge[0].nodes, 127);
  assert.strictEqual(plainEdge[plainEdge.length - 1].nodes, 4095);
  const plainDegree = seriesFor('degree', false).runs.filter(function (run) {
    return !run.found && !run.exhausted;
  });
  assert.strictEqual(plainDegree[0].nodes, 7);
  assert.strictEqual(plainDegree[plainDegree.length - 1].nodes, 53);

  prose.quotes('parameterised-algorithms', ['2.0030', '3.0163', '1.4991', '1.6712',
    '127', '4 095', '53']);
});

test('parameterised-algorithms: the kernel stops depending on n', function () {
  const sweep = NpLab.kernelSweep({ k: 12 });

  assert.deepStrictEqual(sweep.rows.map(function (row) { return row.n; }),
    [46, 86, 166, 326, 646]);
  assert.deepStrictEqual(sweep.rows.map(function (row) { return row.edges; }),
    [137, 261, 522, 990, 1953]);
  assert.deepStrictEqual(sweep.rows.map(function (row) { return row.kernelEdges; }),
    [13, 14, 14, 14, 14]);
  sweep.rows.forEach(function (row) {
    assert.strictEqual(row.forced, 6, 'the six hubs must be committed at n = ' + row.n);
    assert.ok(row.kernelEdges <= row.bound, 'the k² bound at n = ' + row.n);
  });

  prose.quotes('parameterised-algorithms', ['46', '137', '646', '1 953', '13', '14']);
});

test('parameterised-algorithms: the treewidth DP widths and states', function () {
  const study = NpLab.treewidthStudy({ n: 22 });

  assert.strictEqual(study.allAgree, true);
  assert.deepStrictEqual(study.rows.map(function (row) { return row.width; }), [3, 4, 6, 7, 10]);
  assert.deepStrictEqual(study.rows.map(function (row) { return row.states; }),
    [16, 32, 128, 256, 2048]);
  assert.deepStrictEqual(study.rows.map(function (row) { return row.edges; }),
    [23, 29, 40, 55, 77]);

  prose.quotes('parameterised-algorithms', ['3, 4, 6, 7 and 10', '16', '2 048']);
});

/* --------------------------------------------------- 20.6 metaheuristics */

test('metaheuristics: the tournament at the demo default', function () {
  const run = HeuristicLab.tournament({ cities: 30, budget: 40000, seed: 7 });
  const byName = {};

  run.runs.forEach(function (entry) { byName[entry.name] = entry; });
  assert.strictEqual(run.fair, true, 'every method must be offered the same budget');
  assert.strictEqual(prose.fixed(run.best, 2), '481.52');
  assert.strictEqual(prose.fixed(run.lowerBound, 2), '403.41');
  assert.strictEqual(prose.fixed(run.christofides, 2), '499.40');

  assert.strictEqual(prose.fixed(byName['nearest-neighbour'].cost, 2), '588.75');
  assert.strictEqual(prose.fixed(byName['two-opt'].cost, 2), '481.52');
  assert.strictEqual(byName['two-opt'].spent, 2430);
  assert.strictEqual(prose.fixed(byName['or-opt'].cost, 2), '521.42');
  assert.strictEqual(byName['or-opt'].spent, 9282);
  assert.strictEqual(prose.fixed(byName.annealing.cost, 2), '486.03');
  assert.strictEqual(prose.fixed(byName.tabu.cost, 2), '489.00');
  assert.strictEqual(prose.fixed(byName.genetic.cost, 2), '552.96');
  assert.strictEqual(prose.fixed(byName['ant-colony'].cost, 2), '486.03');
  assert.strictEqual(prose.fixed(byName.grasp.cost, 2), '481.52');

  run.runs.forEach(function (entry) {
    assert.strictEqual(entry.valid, true, entry.name + ' returned an invalid tour');
    assert.strictEqual(entry.offered, 40000, entry.name + ' was offered a different budget');
  });
  assert.strictEqual((byName['two-opt'].spent / 40000 * 100).toFixed(1) + '%', '6.1%');

  prose.quotes('metaheuristics', ['481.52', '403.41', '499.40', '588.75', '2 430', '521.42',
    '9 282', '486.03', '489.00', '552.96', '40 000', '6.1%', '30']);
});

test('metaheuristics: the ranking changes with the budget', function () {
  const sweep = HeuristicLab.budgetSweep({ cities: 30, seed: 7 });
  const costAt = function (budget, name) {
    const row = sweep.rows.filter(function (entry) { return entry.budget === budget; })[0];
    return row.costs.filter(function (entry) { return entry.name === name; })[0].cost;
  };

  assert.deepStrictEqual(sweep.rows.map(function (row) { return row.budget; }),
    [2000, 10000, 40000, 160000]);
  assert.strictEqual(prose.fixed(sweep.rows[0].best, 2), '489.02');
  assert.strictEqual(prose.fixed(sweep.rows[3].best, 2), '481.52');
  assert.strictEqual(prose.fixed(costAt(2000, 'two-opt'), 1), '489.0');
  assert.strictEqual(prose.fixed(costAt(2000, 'annealing'), 1), '512.2');
  assert.strictEqual(prose.fixed(costAt(2000, 'tabu'), 1), '505.4');
  assert.strictEqual(prose.fixed(costAt(2000, 'genetic'), 1), '759.1');
  assert.strictEqual(prose.fixed(costAt(2000, 'grasp'), 1), '592.2');
  assert.strictEqual(prose.fixed(costAt(160000, 'annealing'), 1), '481.5');
  assert.strictEqual(prose.fixed(costAt(160000, 'tabu'), 1), '481.5');
  assert.strictEqual(prose.fixed(costAt(2000, 'nearest-neighbour'), 1), '588.7');

  prose.quotes('metaheuristics', ['489.02', '512.2', '505.4', '759.1', '592.2', '588.7',
    '2 000', '160 000']);
});

test('metaheuristics: the cooling sweep, including temperature zero', function () {
  const sweep = HeuristicLab.coolingSweep({ cities: 30, seed: 7, budget: 40000 });
  const byFactor = {};

  sweep.rows.forEach(function (row) { byFactor[row.factor] = row; });
  assert.strictEqual(byFactor[0].worseAccepted, 0, 'temperature zero is hill climbing');
  assert.strictEqual(byFactor[0].accepted, 7);
  assert.strictEqual(prose.fixed(byFactor[0].cost, 2), '513.39');
  assert.strictEqual(prose.fixed(byFactor[0.05].temperature, 2), '2.61');
  assert.strictEqual(prose.fixed(byFactor[0.05].cost, 2), '486.03');
  assert.strictEqual(prose.fixed(byFactor[0.25].temperature, 2), '13.06');
  assert.strictEqual(prose.fixed(byFactor[0.25].cost, 2), '489.28');
  assert.strictEqual(prose.fixed(byFactor[1].temperature, 2), '52.23');
  assert.strictEqual(prose.fixed(byFactor[1].cost, 2), '486.03');
  assert.ok(byFactor[0.25].cost > byFactor[0.05].cost && byFactor[0.25].cost > byFactor[1].cost,
    'the sweep is deliberately not monotone');

  prose.quotes('metaheuristics', ['513.39', '2.61', '13.06', '52.23', '489.28']);
});

test('metaheuristics: the exact comparison at fifteen cities', function () {
  const study = HeuristicLab.exactComparison({ seed: 7 });
  const byName = {};

  study.rows.forEach(function (row) { byName[row.name] = row; });
  assert.strictEqual(prose.fixed(study.optimum, 2), '327.51');
  assert.strictEqual(study.budget, 1500);
  assert.strictEqual(prose.fixed(byName['nearest-neighbour'].ratio, 4), '1.1646');
  assert.strictEqual(byName['two-opt'].optimal, true);
  assert.strictEqual(byName.grasp.optimal, true);
  assert.strictEqual(prose.fixed(byName.genetic.ratio, 4), '1.0088');
  assert.strictEqual(prose.fixed(byName['ant-colony'].ratio, 4), '1.0604');
  assert.strictEqual(study.rows.filter(function (row) { return row.optimal; }).length, 5);

  prose.quotes('metaheuristics', ['327.51', '1 500', '1.1646', '1.0088', '1.0604']);
});
