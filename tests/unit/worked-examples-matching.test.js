'use strict';

/**
 * Every figure the M14.6-M14.7 worked examples quote, recomputed from the
 * modules and then checked against the prose.
 */

const test = require('node:test');
const assert = require('node:assert');

const Weighted = require('../../src/js/algorithms/weighted-matching.js');
const TwoSat = require('../../src/js/algorithms/two-sat.js');
const MatchingLab = require('../../src/js/machines/matching-lab.js');
const SatLab = require('../../src/js/machines/sat-lab.js');

require('../../src/js/content/concepts-matching.js');
require('../../src/js/content/examples-matching.js');
const prose = require('../support/worked-example-prose.js');

const EDGE_STEPS = [12, 16, 20, 24, 30];

/* ------------------------------------------------------------------ 14.6 */

test('general-matching: 2 against 3, and 3 against 3 on the same eight edges', function () {
  const failing = MatchingLab.generalRun({ adjacency: MatchingLab.oddCycleFixture('failing') });
  const sorted = MatchingLab.generalRun({ adjacency: MatchingLab.oddCycleFixture('sorted') });

  assert.strictEqual(MatchingLab.ODD_CYCLE_EDGES.length, 8);
  assert.strictEqual(failing.adjacency.length, 6);
  assert.strictEqual(failing.naive.size, 2);
  assert.strictEqual(failing.blossom.size, 3);
  assert.strictEqual(failing.truth, 3);
  assert.strictEqual(failing.optimal, true);
  assert.strictEqual(failing.blossom.report.blossomsContracted, 1);
  assert.strictEqual(failing.blossom.report.augmentingPaths, 3);
  assert.strictEqual(failing.blossom.report.edgesExamined, 13);
  assert.strictEqual(sorted.naive.size, 3);
  assert.strictEqual(sorted.blossom.report.edgesExamined, 6);
  prose.quotes('general-matching',
    ['size 2', 'size 3', '1 blossom contraction', '3 augmenting paths', '13 edge examinations',
      '6 edge examinations']);
});

test('general-matching: the shortcut is short on 5 of 300 — 1.7%', function () {
  const shorts = EDGE_STEPS.map(function (edges) {
    return MatchingLab.naiveFailureRate({ n: 12, m: edges, trials: 60 });
  });

  assert.deepStrictEqual(shorts.map(function (row) { return row.short; }), [1, 1, 1, 2, 0]);
  const total = shorts.reduce(function (sum, row) { return sum + row.short; }, 0);
  const trials = shorts.reduce(function (sum, row) { return sum + row.trials; }, 0);

  assert.strictEqual(total, 5);
  assert.strictEqual(trials, 300);
  assert.strictEqual((100 * total / trials).toFixed(1), '1.7');
  prose.quotes('general-matching', ['1, 1, 1, 2 and 0', '5 of 300', '1.7%']);
});

test('general-matching: 28 with a certificate, and greedy at 34', function () {
  const run = MatchingLab.assignmentRun({ size: 6, range: 20, seed: 1 });

  assert.strictEqual(run.run.cost, 28);
  assert.strictEqual(run.greedy.cost, 34);
  assert.strictEqual(run.truth.cost, 28);
  assert.strictEqual(run.permutations, 720);
  assert.strictEqual(run.run.report.phases, 6);
  assert.strictEqual(run.run.report.comparisons, 45);
  assert.strictEqual(run.check.violated, 0);
  assert.strictEqual(run.check.slackOnChosen, 0);
  assert.strictEqual(run.check.valid, true);
  assert.strictEqual((100 * (34 - 28) / 28).toFixed(1), '21.4');
  prose.quotes('general-matching',
    ['28', '34', '720', '6 phases', '45 comparisons', '21.4%']);
});

test('general-matching: the greedy gap grows with size rather than shrinking', function () {
  const rows = [3, 4, 5, 6, 7, 8].map(function (size) {
    return MatchingLab.assignmentRun({ size: size, range: 20, seed: 1 });
  });

  assert.deepStrictEqual(rows.map(function (r) { return r.run.cost; }), [20, 27, 20, 28, 33, 30]);
  assert.deepStrictEqual(rows.map(function (r) { return r.greedy.cost; }), [20, 27, 30, 34, 42, 51]);
  assert.deepStrictEqual(rows.map(function (r) { return r.greedy.cost - r.run.cost; }),
    [0, 0, 10, 6, 9, 21]);
  assert.deepStrictEqual(rows.map(function (r) { return r.permutations; }),
    [6, 24, 120, 720, 5040, 40320]);
  rows.forEach(function (row, i) {
    assert.strictEqual(row.optimal, true, 'row ' + i + ' is not optimal');
  });
  assert.strictEqual((100 * 21 / 30).toFixed(0), '70');
  prose.quotes('general-matching',
    ['20, 27, 20, 28, 33, 30', '20, 27, 30, 34, 42, 51', '0, 0, 10, 6, 9, 21', '70%']);
});

/* ------------------------------------------------------------------ 14.7 */

function scheduling(conflicts) {
  return SatLab.build({ model: 'scheduling', variables: 8, clauses: conflicts, seed: 1 });
}

test('two-sat: satisfiable at 6 conflicts and not at 7, with the variables named', function () {
  const good = scheduling(6);
  const state = SatLab.solveRun(good);

  assert.strictEqual(good.clauses.length, 12);
  assert.strictEqual(state.run.report.implications, 24);
  assert.strictEqual(state.run.report.variables, 8);
  assert.strictEqual(state.run.report.components, 4);
  assert.strictEqual(state.run.satisfiable, true);
  assert.strictEqual(state.run.report.forcedTrue, 5);
  assert.strictEqual(state.run.report.forcedFalse, 3);
  assert.strictEqual(state.violated.length, 0);
  assert.strictEqual(state.agrees, true);
  assert.strictEqual(Math.pow(2, 8), 256);
  const broken = SatLab.solveRun(scheduling(7));

  assert.strictEqual(scheduling(7).clauses.length, 14);
  assert.strictEqual(broken.run.report.implications, 28);
  assert.strictEqual(broken.run.satisfiable, false);
  assert.strictEqual(broken.run.contradictions.length, 7);
  assert.strictEqual(broken.run.report.components, 3);
  assert.strictEqual(broken.agrees, true);
  prose.quotes('two-sat',
    ['12 clauses', '24 implications', '4 components', '5 variables true', '256',
      '14 clauses', '28 implications', '7 variables', '4 to 3']);
});

test('two-sat: the satisfiability threshold, measured', function () {
  const rows = SatLab.thresholdSweep({ variables: 40, trials: 60 });

  assert.deepStrictEqual(rows.map(function (r) { return r.ratio; }),
    [0.4, 0.7, 0.9, 1.0, 1.1, 1.3, 1.6, 2.0]);
  assert.deepStrictEqual(rows.map(function (r) { return r.satisfiable; }),
    [60, 59, 59, 57, 56, 48, 26, 3]);
  assert.deepStrictEqual(rows.map(function (r) { return (100 * r.rate).toFixed(1); }),
    ['100.0', '98.3', '98.3', '95.0', '93.3', '80.0', '43.3', '5.0']);
  assert.strictEqual(rows[0].clauses, 16);
  assert.strictEqual(rows[7].clauses, 80);

  for (let i = 1; i < rows.length; i += 1) {
    assert.ok(rows[i].rate <= rows[i - 1].rate, 'the rate must fall monotonically');
  }
  prose.quotes('two-sat',
    ['100.0%, 98.3%, 98.3%, 95.0%, 93.3%, 80.0%, 43.3%, 5.0%', '16 clauses over 40 variables',
      '80 clauses']);
});

test('two-sat: the three-literal relaxation is wrong in one direction only', function () {
  const rows = [10, 15, 20, 25, 30, 40].map(function (clauses) {
    return SatLab.relaxationRun({ variables: 10, trials: 100, clauses: clauses });
  });

  assert.deepStrictEqual(rows.map(function (r) { return r.bothSat; }), [100, 89, 54, 23, 7, 0]);
  assert.deepStrictEqual(rows.map(function (r) { return r.bothUnsat; }), [0, 0, 0, 0, 0, 15]);
  assert.deepStrictEqual(rows.map(function (r) { return r.wrongUnsat; }), [0, 11, 46, 77, 93, 85]);
  assert.deepStrictEqual(rows.map(function (r) { return r.falseSat; }), [0, 0, 0, 0, 0, 0]);
  const total = rows.reduce(function (sum, row) { return sum + row.trials; }, 0);

  assert.strictEqual(total, 600);
  prose.quotes('two-sat', ['0, 11, 46, 77, 93 and 85', '600 formulas']);
});

test('two-sat: dropping the contrapositive is what makes the components meaningless', function () {
  const instance = scheduling(6);
  const both = TwoSat.implicationGraph(instance.variables, instance.clauses, {});

  assert.strictEqual(both.edges.length, 2 * instance.clauses.length);
  instance.clauses.forEach(function (clause, id) {
    assert.strictEqual(both.edges[2 * id].from, TwoSat.negate(clause[0]));
    assert.strictEqual(both.edges[2 * id].to, clause[1]);
    assert.strictEqual(both.edges[2 * id + 1].from, TwoSat.negate(clause[1]));
    assert.strictEqual(both.edges[2 * id + 1].to, clause[0]);
  });
  prose.quotes('two-sat', ['two arcs per clause']);
});

test('two-sat: the exhaustive oracle agrees on every instance family', function () {
  SatLab.MODELS.forEach(function (model) {
    for (let seed = 1; seed <= 10; seed += 1) {
      const instance = SatLab.build({ model: model, variables: 8, clauses: 10, seed: seed });
      const state = SatLab.solveRun(instance);

      assert.strictEqual(state.agrees, true, model + ' seed ' + seed);
      assert.strictEqual(state.valid, true, model + ' seed ' + seed + ': a broken assignment');
    }
  });
  const sweep = SatLab.agreementSweep({ trials: 200 });

  assert.strictEqual(sweep.disagreements, 0);
  assert.strictEqual(sweep.broken, 0);
  assert.ok(sweep.unsatisfiable > 20,
    'the family must contain unsatisfiable instances, or only half the solver is checked');
  assert.strictEqual(Weighted.emptyReport().phases, 0, 'the report shape is part of the contract');
});
