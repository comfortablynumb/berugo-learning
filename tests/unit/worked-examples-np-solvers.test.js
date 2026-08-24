'use strict';

/**
 * Every figure the M20.7-M20.9 content quotes, recomputed from the modules and
 * then checked against the prose.
 *
 * The section controllers are not imported; the calls below reproduce what
 * they make at their default control settings.
 */

const test = require('node:test');
const assert = require('node:assert');

const SolverLab = require('../../src/js/machines/solver-lab.js');
const HeuristicLab = require('../../src/js/machines/heuristic-lab.js');

require('../../src/js/content/concepts-np-solvers.js');
require('../../src/js/content/examples-np-solvers.js');
const prose = require('../support/worked-example-prose.js');

function factorial(n) {
  let value = 1;

  for (let i = 2; i <= n; i += 1) value *= i;
  return value;
}

/* ------------------------------------------------------------ 20.7 solvers */

test('using-solvers: at-most-one priced exactly at every size', function () {
  const scaling = SolverLab.atMostOneScaling({ groupSize: 3 });
  const at = function (n) {
    const row = scaling.rows.filter(function (entry) { return entry.n === n; })[0];
    const out = {};
    row.encodings.forEach(function (entry) { out[entry.encoding] = entry; });
    return out;
  };

  assert.deepStrictEqual(scaling.rows.map(function (row) { return row.n; }),
    [5, 20, 100, 500, 2000]);
  assert.strictEqual(at(5).pairwise.clauses, 10);
  assert.strictEqual(at(5).sequential.clauses, 11);
  assert.strictEqual(at(100).pairwise.clauses, 4950);
  assert.strictEqual(at(100).commander.clauses, 350);
  assert.strictEqual(at(100).sequential.clauses, 296);
  assert.strictEqual(at(2000).pairwise.clauses, 1999000);
  assert.strictEqual(at(2000).commander.clauses, 6999);
  assert.strictEqual(at(2000).sequential.clauses, 5996);
  assert.strictEqual(at(2000).sequential.auxiliary, 1999);
  assert.strictEqual(at(2000).commander.auxiliary, 1002);
  assert.strictEqual(Math.round(at(2000).pairwise.clauses / at(2000).sequential.clauses), 333);

  prose.quotes('using-solvers', ['10', '11', '4 950', '350', '296', '1 999 000', '6 999',
    '5 996', '333']);
});

test('using-solvers: six models of one instance, all agreeing', function () {
  const study = SolverLab.encodingStudy({ n: 18, m: 60, clique: 7, colours: 6 });
  const rowFor = function (encoding, symmetry) {
    return study.rows.filter(function (row) {
      return row.encoding === encoding && row.symmetryBreaking === symmetry;
    })[0];
  };

  assert.strictEqual(study.agreed, true, 'every model must agree with the direct search');
  assert.strictEqual(study.direct.found, false);
  assert.strictEqual(study.direct.steps, 327);

  assert.strictEqual(rowFor('pairwise', false).variables, 108);
  assert.strictEqual(rowFor('pairwise', false).clauses, 720);
  assert.strictEqual(rowFor('commander', false).variables, 144);
  assert.strictEqual(rowFor('sequential', false).variables, 198);
  assert.strictEqual(rowFor('sequential', false).clauses, 702);
  assert.strictEqual(rowFor('pairwise', true).clauses, 726);
  assert.strictEqual(rowFor('pairwise', true).symmetryClauses, 6);

  [false].forEach(function (symmetry) {
    const nodes = new Set(['pairwise', 'commander', 'sequential'].map(function (encoding) {
      return rowFor(encoding, symmetry).nodes;
    }));
    assert.strictEqual(nodes.size, 1, 'this DPLL explores the same tree whichever encoding');
    assert.strictEqual(Array.from(nodes)[0], 1439);
  });
  ['pairwise', 'commander', 'sequential'].forEach(function (encoding) {
    assert.strictEqual(rowFor(encoding, true).nodes, 1, encoding + ' with symmetry breaking');
  });
  assert.strictEqual(prose.fixed(study.symmetryGain.factor, 1), '1439.0');
  assert.strictEqual(rowFor('pairwise', false).propagations, 18010);
  assert.strictEqual(rowFor('commander', false).propagations, 21923);
  assert.strictEqual(rowFor('sequential', false).propagations, 21150);

  prose.quotes('using-solvers', ['327', '108', '720', '144', '198', '702', '726', '1 439',
    '18 010', '21 923', '21 150', 'six unit clauses']);
});

test('using-solvers: the slot sweep is a factorial', function () {
  const sweep = SolverLab.colourSweep({ n: 18, m: 60, clique: 7, from: 3, to: 8 });
  const plain = sweep.rows.filter(function (row) { return !row.symmetryBreaking; });
  const broken = sweep.rows.filter(function (row) { return row.symmetryBreaking; });

  plain.forEach(function (row) {
    if (row.satisfiable) return;
    assert.strictEqual(row.nodes, 2 * factorial(row.colours) - 1,
      row.colours + ' slots: expected ' + (2 * factorial(row.colours) - 1));
    assert.strictEqual(row.conflicts, factorial(row.colours), row.colours + ' slots: conflicts');
  });
  assert.deepStrictEqual(plain.filter(function (row) { return !row.satisfiable; })
    .map(function (row) { return row.nodes; }), [11, 47, 239, 1439]);
  assert.deepStrictEqual(plain.map(function (row) { return row.satisfiable; }),
    [false, false, false, false, true, true]);
  broken.forEach(function (row) {
    if (row.satisfiable) return;
    assert.strictEqual(row.nodes, 1, row.colours + ' slots with symmetry breaking');
  });
  assert.deepStrictEqual(plain.filter(function (row) { return row.satisfiable; })
    .map(function (row) { return row.nodes; }), [17, 19]);
  assert.deepStrictEqual(broken.filter(function (row) { return row.satisfiable; })
    .map(function (row) { return row.nodes; }), [12, 12]);

  prose.quotes('using-solvers', ['11', '47', '239', '1 439', '17 and 19', '12']);
});

/* ---------------------------------------------------- 20.8 hardness */

test('hardness-in-practice: the phase transition at the demo default', function () {
  const phase = HeuristicLab.phaseTransition({ variables: 44, instances: 60 });
  const at = function (ratio) {
    return phase.rows.filter(function (row) { return row.ratio === ratio; })[0];
  };

  assert.deepStrictEqual(phase.rows.map(function (row) { return row.ratio; }),
    [1, 2, 3, 3.5, 4, 4.27, 4.5, 5, 6, 8]);
  assert.strictEqual(at(1).satisfiableFraction, 1);
  assert.strictEqual(at(8).satisfiableFraction, 0);
  assert.strictEqual(at(1).median, 10);
  assert.strictEqual(at(2).median, 14);
  assert.strictEqual(at(3).median, 20);
  assert.strictEqual(at(3).worst, 255);
  assert.strictEqual(prose.fixed(at(3).mean, 1), '29.6');
  assert.strictEqual(at(3.5).median, 36);
  assert.strictEqual(at(4).median, 134);
  assert.strictEqual(at(4.27).median, 256);
  assert.strictEqual(at(4.5).median, 313);
  assert.strictEqual(at(4.5).worst, 931);
  assert.strictEqual(at(5).median, 247);
  assert.strictEqual(at(6).median, 137);
  assert.strictEqual(at(8).median, 53);
  assert.strictEqual(prose.fixed(at(4).satisfiableFraction * 100, 1), '86.7');
  assert.strictEqual(prose.fixed(at(4.5).satisfiableFraction * 100, 1), '41.7');

  const peak = phase.rows.reduce(function (best, row) {
    return row.median > best.median ? row : best;
  }, phase.rows[0]);
  assert.strictEqual(peak.ratio, 4.5, 'the cost peaks above the satisfiability crossover');

  prose.quotes('hardness-in-practice', ['10', '14', '20', '255', '29.6', '36', '134', '256',
    '313', '931', '247', '137', '53', '86.7%', '41.7%', '4.50', '4.38']);
});

test('hardness-in-practice: the satisfiability crossover interpolates to 4.38', function () {
  const phase = HeuristicLab.phaseTransition({ variables: 44, instances: 60 });
  let crossing = null;

  for (let i = 1; i < phase.rows.length; i += 1) {
    const above = phase.rows[i - 1];
    const below = phase.rows[i];
    if (above.satisfiableFraction < 0.5 || below.satisfiableFraction >= 0.5) continue;
    const span = above.satisfiableFraction - below.satisfiableFraction;
    const share = (above.satisfiableFraction - 0.5) / span;
    crossing = above.ratio + share * (below.ratio - above.ratio);
    break;
  }
  assert.strictEqual(prose.fixed(crossing, 2), '4.38');
});

test('hardness-in-practice: the restart study, including the cutoff that hurts', function () {
  const study = HeuristicLab.restartStudy({ noise: 0.5, trials: 40 });
  const at = function (cutoff) {
    return study.rows.filter(function (row) { return row.cutoff === cutoff; })[0];
  };

  assert.strictEqual(study.plain.median, 1125);
  assert.strictEqual(prose.fixed(study.plain.mean, 1), '1581.6');
  assert.strictEqual(study.plain.p90, 3724);
  assert.strictEqual(study.plain.worst, 6060);
  assert.strictEqual(prose.fixed(study.plain.spread, 1), '5.4');

  assert.strictEqual(at(1000).median, 1192);
  assert.strictEqual(prose.fixed(at(1000).mean, 1), '1313.5');
  assert.strictEqual(at(1000).p90, 2836);
  assert.strictEqual(at(1000).worst, 5252);
  assert.strictEqual(at(1000).restarts, 37);

  assert.strictEqual(prose.fixed(at(3000).mean, 1), '1565.7');
  assert.strictEqual(at(3000).restarts, 7);

  assert.strictEqual(at(100).median, 4670);
  assert.strictEqual(prose.fixed(at(100).mean, 1), '6747.1');
  assert.strictEqual(at(100).worst, 20384);
  assert.strictEqual(at(100).restarts, 2666);
  assert.strictEqual(prose.fixed(at(100).mean / study.plain.mean, 1), '4.3');

  study.rows.concat([study.plain]).forEach(function (row) {
    assert.strictEqual(row.solved, 40, 'every strategy must solve every seed');
  });

  prose.quotes('hardness-in-practice', ['1 125', '1 582', '3 724', '6 060', '5.4',
    '1 192', '1 314', '2 836', '5 252', '37', '1 566', '4 670', '6 747', '20 384', '2 666',
    '4.3']);
});

/* -------------------------------------------------------- 20.9 the workshop */

test('reduction-workshop: the model, the solve and the check', function () {
  const gap = SolverLab.modelGap({});
  const study = gap.study;
  const clausesFor = function (id) {
    return gap.hard.filter(function (row) { return row.id === id; })[0];
  };

  assert.strictEqual(study.model.clauses, 8013);
  assert.strictEqual(study.model.variables, 3789);
  assert.strictEqual(study.model.variables - study.model.decisionVariables, 3600);
  assert.strictEqual(study.solved.stats.nodes, 4707);
  assert.strictEqual(study.feasible, true);
  assert.strictEqual(study.validation.satisfied, true);

  assert.strictEqual(clausesFor('one-shift-per-day').clauses, 189);
  assert.strictEqual(clausesFor('demand').clauses, 3171);
  assert.strictEqual(clausesFor('demand').auxiliary, 1512);
  assert.strictEqual(clausesFor('no-day-after-night').clauses, 54);
  assert.strictEqual(clausesFor('workload').clauses, 1935);
  assert.strictEqual(clausesFor('workload').auxiliary, 900);
  assert.strictEqual(clausesFor('rest').clauses, 2664);
  assert.strictEqual(clausesFor('rest').auxiliary, 1188);
  gap.hard.forEach(function (row) {
    assert.strictEqual(row.ok, true, row.id + ' must hold in the produced grid');
  });

  prose.quotes('reduction-workshop', ['8 013', '3 789', '3 600', '4 707', '189', '3 171',
    '54', '1 935', '2 664', '5 of 5']);
});

test('reduction-workshop: the workload spread the model does not constrain', function () {
  const gap = SolverLab.modelGap({});

  assert.deepStrictEqual(gap.stats.perNurse, [5, 5, 5, 5, 5, 4, 2, 2, 2]);
  assert.strictEqual(gap.stats.workedSpread, 3);
  assert.strictEqual(gap.soft.length, 3);
  gap.soft.forEach(function (item) {
    assert.ok(item.why && item.why.length > 40, item.id + ' must say why a clause cannot say it');
    assert.ok(item.achieved && item.achieved.length > 0, item.id + ' must report a number');
  });

  prose.quotes('reduction-workshop', ['5, 5, 5, 5, 5, 4, 2, 2, 2', 'a spread of 3']);
});

test('reduction-workshop: the frontier has three different kinds of answer', function () {
  const frontier = SolverLab.feasibilityFrontier({});
  const at = function (nurses) {
    return frontier.rows.filter(function (row) { return row.nurses === nurses; })[0];
  };

  assert.deepStrictEqual(frontier.rows.map(function (row) { return row.nurses; }),
    [4, 5, 6, 7, 8]);
  frontier.rows.forEach(function (row) {
    assert.strictEqual(row.required, 24, 'the demand is 24 shifts at every size');
    assert.strictEqual(row.capacity, row.nurses * 4, 'capacity at ' + row.nurses + ' nurses');
  });

  assert.strictEqual(at(4).feasible, false);
  assert.strictEqual(at(4).exhausted, false, '4 nurses is PROVED infeasible');
  assert.strictEqual(at(4).nodes, 14663);
  assert.strictEqual(at(5).feasible, false);
  assert.strictEqual(at(5).exhausted, true, '5 nurses exhausts the budget without a proof');
  assert.strictEqual(at(5).nodes, 40000);
  assert.strictEqual(at(6).feasible, true);
  assert.strictEqual(at(6).nodes, 6327);
  assert.strictEqual(at(7).nodes, 247);
  assert.strictEqual(at(8).nodes, 33);
  [6, 7, 8].forEach(function (nurses) {
    assert.strictEqual(at(nurses).valid, true, nurses + ' nurses: the schedule must validate');
  });

  prose.quotes('reduction-workshop', ['14 663', '40 000', '6 327', '247', '33',
    '16', '20', '24', '28', '32']);
});
