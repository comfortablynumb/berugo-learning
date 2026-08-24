'use strict';

/**
 * Every figure the M19.7-M19.9 content quotes, recomputed from the modules and
 * then checked against the prose.
 *
 * The section controllers are not imported; the calls below reproduce what they
 * make at their default control settings, which is the contract this suite is
 * really pinning down - if a default moves, the prose is wrong and this fails.
 */

const test = require('node:test');
const assert = require('node:assert');

const Random = require('../../src/js/utils/random.js');
const ApproxLab = require('../../src/js/machines/approx-lab.js');
const Lp = require('../../src/js/algorithms/lp-rounding.js');
const Derand = require('../../src/js/algorithms/derandomize.js');

require('../../src/js/content/concepts-approximation.js');
require('../../src/js/content/examples-approximation.js');
const prose = require('../support/worked-example-prose.js');

function percent(value, digits) {
  return (value * 100).toFixed(digits) + '%';
}

function methodRow(summary, name) {
  return summary.filter(function (entry) { return entry.method === name; })[0];
}

/* ------------------------------------------------------------------- 19.7 */

test('lp: the demo instance is all-halves, and rounding costs 12 against an optimum of 7', function () {
  const graph = ApproxLab.randomInstanceGraph({ rng: Random.seeded(5), n: 12, density: 0.35 });
  const relaxation = Lp.vertexCoverLp(graph);
  const rounded = Lp.roundVertexCover(graph, relaxation);
  const exact = ApproxLab.exactVertexCover(graph);

  assert.strictEqual(relaxation.value.toFixed(2), '6.00');
  assert.ok(relaxation.halfIntegral, 'the basic solution is half-integral');
  relaxation.x.forEach(function (value) {
    assert.strictEqual(value.toFixed(3), '0.500', 'every coordinate sits at exactly one half');
  });
  assert.strictEqual(rounded.size, 12, 'rounding at half takes everything');
  assert.strictEqual(exact.size, 7);
  assert.strictEqual((rounded.size / exact.size).toFixed(2), '1.71');

  prose.quotes('lp-relaxation', ['6.00', '0.500', '12', '7', '1.71']);
});

test('lp: half-integrality and the integrality gap over 150 random instances', function () {
  const study = ApproxLab.gapStudy({ n: 12, instances: 150 });

  assert.strictEqual(study.rows.length, 150);
  assert.strictEqual(study.halfIntegralCount, 150, 'every basic solution is half-integral');
  assert.strictEqual(study.summary.mean.toFixed(4), '1.1456');
  assert.strictEqual(study.summary.max.toFixed(4), '1.3333');

  prose.quotes('lp-relaxation', ['150', '1.1456', '1.3333']);
});

test('lp: the complete graphs attain 2 − 2/n exactly', function () {
  const study = ApproxLab.gapStudy({ n: 12, instances: 20 });
  const gaps = study.complete.map(function (row) { return row.gap.toFixed(4); });

  assert.deepStrictEqual(gaps, ['1.3333', '1.6000', '1.7143', '1.7778', '1.8182', '1.8667']);
  study.complete.forEach(function (row) {
    assert.strictEqual(row.lp.toFixed(2), (row.n / 2).toFixed(2),
      'K' + row.n + ' pays n/2 fractionally');
    assert.strictEqual(row.integer, row.n - 1, 'and n − 1 integrally');
    assert.ok(Math.abs(row.gap - (2 - 2 / row.n)) < 1e-12);
  });
  const last = study.complete[study.complete.length - 1];
  assert.strictEqual(last.n, 15);
  assert.strictEqual(last.lp.toFixed(2), '7.50');
  assert.strictEqual(last.integer, 14);

  prose.quotes('lp-relaxation',
    ['1.6000', '1.7143', '1.7778', '1.8182', '1.8667', '7.50', '14']);
});

test('lp: MAX-SAT four ways against exact optima', function () {
  const study = ApproxLab.maxSatStudy({ instances: 60, clauses: 30, variables: 14 });

  assert.strictEqual(percent(methodRow(study.summary, 'random').mean, 2), '79.00%');
  assert.strictEqual(percent(methodRow(study.summary, 'random').median, 2), '79.31%');
  assert.strictEqual(percent(methodRow(study.summary, 'random').min, 2), '60.00%');
  assert.strictEqual(percent(methodRow(study.summary, 'lp').mean, 2), '97.62%');
  assert.strictEqual(percent(methodRow(study.summary, 'lp').min, 2), '82.76%');
  assert.strictEqual(percent(methodRow(study.summary, 'best-of-two').min, 2), '82.76%');
  assert.strictEqual(percent(methodRow(study.summary, 'conditional').mean, 2), '98.66%');
  assert.strictEqual(percent(methodRow(study.summary, 'conditional').min, 2), '93.10%');

  assert.ok(methodRow(study.summary, 'best-of-two').min >= 0.75,
    'the better of the two must stay inside its 3/4 bound');
  assert.ok(methodRow(study.summary, 'lp').min >= 1 - 1 / Math.E,
    'and LP rounding inside 1 − 1/e');

  prose.quotes('lp-relaxation',
    ['79.00%', '79.31%', '60.00%', '97.62%', '82.76%', '98.66%', '93.10%', '63.2%']);
});

/* ------------------------------------------------------------------- 19.8 */

test('schemes: the ε sweep on 20 strongly correlated items', function () {
  const study = ApproxLab.knapsackStudy({ count: 20, seed: 5 });
  const at = function (epsilon) {
    return study.rows.filter(function (row) { return row.epsilon === epsilon; })[0];
  };

  assert.strictEqual(study.exact.value, 6764);
  assert.strictEqual(study.exact.cells, 258640);
  assert.strictEqual(study.instance.capacity, 5465);

  assert.strictEqual(at(0.5).scale.toFixed(3), '25.150');
  assert.strictEqual(at(0.5).value, 6740);
  assert.strictEqual(percent(at(0.5).ratio, 4), '99.6452%');
  assert.strictEqual(at(0.5).cells, 10100);
  assert.strictEqual((study.exact.cells / at(0.5).cells).toFixed(1), '25.6');

  assert.strictEqual(percent(at(0.3).ratio, 4), '99.8522%');
  assert.strictEqual(percent(at(0.2).ratio, 4), '100.0000%');
  assert.strictEqual(at(0.2).cells, 25500);
  assert.strictEqual(at(0.1).cells, 51240);
  assert.strictEqual(at(0.05).cells, 102680);
  assert.strictEqual(at(0.02).cells, 256900);
  assert.strictEqual(at(0.01).cells, 514000);
  assert.strictEqual(at(0.01).scale.toFixed(3), '0.503');
  assert.strictEqual(at(0.01).cheaperThanExact, false,
    'below K = 1 the "approximate" table exceeds the exact one');

  study.rows.forEach(function (row) {
    assert.ok(row.meetsGuarantee, 'ε = ' + row.epsilon + ' missed its own guarantee');
    assert.ok(row.feasible, 'and every answer must fit the capacity');
  });

  prose.quotes('approximation-schemes',
    ['6 764', '258 640', '5 465', '25.150', '6 740', '99.6452%', '10 100', '25.6',
      '99.8522%', '100.0000%', '25 500', '51 240', '102 680', '256 900', '514 000', '0.503']);
});

test('schemes: the PTAS subset count explodes while the FPTAS grows linearly in 1/ε', function () {
  const rows = ApproxLab.schemeComparison({ count: 20, seed: 5 });
  const at = function (k) {
    return rows.filter(function (row) { return row.k === k; })[0];
  };

  assert.strictEqual(at(1).subsets, 21);
  assert.strictEqual(percent(at(1).ptasRatio, 2), '99.25%');
  assert.strictEqual(at(3).subsets, 1351);
  assert.strictEqual(percent(at(3).ptasRatio, 2), '100.00%');
  assert.strictEqual(at(4).subsets, 6196);
  assert.strictEqual(at(1).fptasCells, 10100);
  assert.strictEqual(at(4).fptasCells, 25500);

  prose.quotes('approximation-schemes', ['21', '99.25%', '1 351', '6 196']);
});

test('schemes: scaling weights is infeasible, and density greedy is unbounded', function () {
  const study = ApproxLab.knapsackStudy({ count: 20, seed: 5 });

  assert.strictEqual(study.broken.value, 6931);
  assert.strictEqual(study.broken.weight, 5631);
  assert.strictEqual(study.broken.capacity, 5465);
  assert.strictEqual(study.broken.feasible, false);
  assert.strictEqual(study.broken.overflow, 166);
  assert.ok(study.broken.value > study.exact.value,
    'a value above the optimum is the only visible symptom of infeasibility');

  assert.strictEqual(study.trap.densityOnly, 2);
  assert.strictEqual(study.trap.optimum, 100);
  assert.strictEqual(percent(study.trap.densityRatio, 1), '2.0%');
  assert.strictEqual(study.trap.greedy, 100);
  assert.strictEqual(study.trap.via, 'single item');

  prose.quotes('approximation-schemes', ['6 931', '5 631', '166', '2.0%', '100']);
});

/* ------------------------------------------------------------------- 19.9 */

test('derandomisation: the random distribution, the walk, and the small space', function () {
  const study = ApproxLab.derandomStudy({ n: 16, density: 0.4, trials: 500, seed: 3 });

  assert.strictEqual(study.graph.edges.length, 37);
  assert.strictEqual(study.bound, 18.5);
  assert.strictEqual(study.randomSpread.mean.toFixed(2), '18.67');
  assert.strictEqual(study.belowBound, 232);
  assert.strictEqual(percent(study.belowBound / study.trials, 1), '46.4%');
  assert.strictEqual(study.bestRandom, 26);

  assert.strictEqual(study.conditional.cut, 25);
  assert.ok(study.conditional.meetsBound, 'the walk always meets |E|/2');

  assert.strictEqual(study.small.points, 32);
  assert.strictEqual(study.small.fullSpace, 65536);
  assert.strictEqual(study.small.bits, 5);
  assert.strictEqual(study.small.cut, 24);
  assert.strictEqual(study.small.averageOverSpace.toFixed(4), '18.5000');

  assert.strictEqual(study.exact.cut, 28);
  assert.strictEqual(study.exact.assignments, 32768);

  prose.quotes('derandomisation',
    ['37', '18.5', '18.67', '232', '26', '25', '32', '65 536', '24', '18.5000',
      '28', '32 768']);
});

test('derandomisation: the family is exactly pairwise independent and no more', function () {
  const study = ApproxLab.derandomStudy({ n: 16, density: 0.4, trials: 500, seed: 3 });

  assert.strictEqual(study.profile.pairwiseWorst.toFixed(4), '0.0000');
  assert.strictEqual(study.profile.tripleWorst.toFixed(4), '0.1250');
  assert.deepStrictEqual(study.profile.tripleAt, [0, 1, 2]);
  assert.strictEqual(study.profile.coordinates, 12);

  prose.quotes('derandomisation', ['0.0000', '0.125', '(0, 1, 2)', '5 seed bits']);
});

test('derandomisation: the MAX-SAT walk beats the expectation the coin only meets on average', function () {
  const formula = Derand.randomFormula({ rng: Random.seeded(9), variables: 14, clauses: 40,
    width: 3 });
  const cuts = [];
  for (let t = 0; t < 500; t += 1) {
    cuts.push(Derand.randomAssignmentSat(formula, Random.seeded(t * 41 + 1)).satisfied);
  }
  const expected = Derand.expectedSatisfied(formula);
  const spread = ApproxLab.spreadOf(cuts);
  const below = cuts.filter(function (v) { return v < expected; }).length;

  assert.strictEqual(expected.toFixed(2), '35.00', '40 clauses of width 3 give 7/8 of them');
  assert.strictEqual(spread.mean.toFixed(2), '35.10');
  assert.strictEqual(spread.min, 28);
  assert.strictEqual(below, 178);
  assert.strictEqual(Derand.conditionalExpectationSat(formula).satisfied, 39);
  assert.strictEqual(ApproxLab.exactMaxSat(formula).satisfied, 40);
  assert.strictEqual(ApproxLab.exactMaxSat(formula).assignments, 16384);
  assert.strictEqual(percent(spread.min / 40, 1), '70.0%');

  prose.quotes('derandomisation',
    ['35.00', '35.10', '178', '39', '40', '16 384', '70.0%']);
});
