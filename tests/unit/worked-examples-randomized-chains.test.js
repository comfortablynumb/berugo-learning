'use strict';

/**
 * Every figure the M19.4-M19.6 content quotes, recomputed from the modules and
 * then checked against the prose.
 *
 * The section controllers are not imported; the calls below reproduce what they
 * make at their default control settings, which is the contract this suite is
 * really pinning down - if a default moves, the prose is wrong and this fails.
 */

const test = require('node:test');
const assert = require('node:assert');

const RandomizedLab = require('../../src/js/machines/randomized-lab.js');
const ApproxLab = require('../../src/js/machines/approx-lab.js');
const Approx = require('../../src/js/algorithms/approximation.js');

require('../../src/js/content/concepts-randomized-chains.js');
require('../../src/js/content/examples-randomized-chains.js');
const prose = require('../support/worked-example-prose.js');

function percent(value, digits) {
  return (value * 100).toFixed(digits) + '%';
}

function widthRow(study, width) {
  return study.rows.filter(function (row) { return row.width === width; })[0];
}

function methodRow(summary, name) {
  return summary.filter(function (entry) { return entry.method === name; })[0];
}

/* ------------------------------------------------------------------- 19.4 */

test('mcmc: the width sweep at the demo default, 20 000 steps and seed 42', function () {
  const study = RandomizedLab.chainStudy({ steps: 20000, seed: 42 });

  assert.strictEqual(study.target.meanX.toFixed(4), '-0.6000', 'the true mean of the mixture');
  assert.strictEqual(percent(widthRow(study, 0.1).acceptanceRate, 1), '92.7%');
  assert.strictEqual(percent(widthRow(study, 0.3).acceptanceRate, 1), '79.1%');
  assert.strictEqual(percent(widthRow(study, 1).acceptanceRate, 1), '43.5%');
  assert.strictEqual(percent(widthRow(study, 2.4).acceptanceRate, 1), '17.1%');
  assert.strictEqual(percent(widthRow(study, 5).acceptanceRate, 1), '6.3%');
  assert.strictEqual(percent(widthRow(study, 12).acceptanceRate, 1), '1.2%');

  assert.strictEqual(widthRow(study, 0.1).ess.toFixed(1), '74.9');
  assert.strictEqual(widthRow(study, 0.3).ess.toFixed(1), '23.2');
  assert.strictEqual(widthRow(study, 1).ess.toFixed(1), '174.8');
  assert.strictEqual(widthRow(study, 2.4).ess.toFixed(1), '559.7');
  assert.strictEqual(widthRow(study, 5).ess.toFixed(1), '456.1');
  assert.strictEqual(widthRow(study, 12).ess.toFixed(1), '151.4');

  prose.quotes('markov-chain-monte-carlo',
    ['92.7%', '79.1%', '43.5%', '17.1%', '6.3%', '1.2%',
      '74.9', '23.2', '174.8', '559.7', '456.1', '151.4']);
});

test('mcmc: the width-0.1 chain is wrong by 249 of its own standard errors', function () {
  const study = RandomizedLab.chainStudy({ steps: 20000, seed: 42 });
  const row = widthRow(study, 0.1);

  assert.strictEqual(row.mean.toFixed(4), '-1.9849');
  assert.strictEqual(row.meanError.toFixed(4), '1.3849');
  assert.strictEqual(row.naiveError.toFixed(5), '0.00557');
  assert.strictEqual(row.honestError.toFixed(5), '0.09099');
  assert.strictEqual(row.autocorrelationTime.toFixed(1), '267.2');
  assert.strictEqual((row.honestError / row.naiveError).toFixed(1), '16.3');
  assert.strictEqual(Math.round(row.meanError / row.naiveError), 249);
  assert.strictEqual(percent(row.modeShare.measured, 1), '1.3%');
  assert.strictEqual(percent(row.modeShare.expected, 1), '35.0%');

  prose.quotes('markov-chain-monte-carlo',
    ['-1.9849'.replace('-', '−'), '1.3849', '0.00557', '0.09099', '267.2', '16.3', '249',
      '1.3%', '35.0%']);
});

test('mcmc: the error column across the sweep, and R-hat over four dispersed chains', function () {
  const study = RandomizedLab.chainStudy({ steps: 20000, seed: 42 });
  const errors = [0.1, 0.3, 1, 2.4, 5, 12].map(function (width) {
    return widthRow(study, width).meanError.toFixed(4);
  });
  assert.deepStrictEqual(errors,
    ['1.3849', '0.3504', '0.1380', '0.0663', '0.0687', '0.3838']);
  assert.strictEqual(widthRow(study, 0.3).autocorrelationTime.toFixed(1), '861.7');

  const convergence = RandomizedLab.convergenceStudy({ width: 0.1, steps: 8000 });
  assert.strictEqual(convergence.rHat.rHat.toFixed(4), '1.5081');
  assert.deepStrictEqual(convergence.rHat.means.map(function (m) { return m.toFixed(4); }),
    ['-2.2719', '-1.6051', '-1.4836', '1.2352']);

  prose.quotes('markov-chain-monte-carlo',
    ['0.3504', '0.1380', '0.0663', '0.0687', '0.3838', '861.7', '1.5081',
      '−2.2719', '−1.6051', '−1.4836', '+1.2352']);
});

/* ------------------------------------------------------------------- 19.5 */

test('fingerprinting: Freivalds at n = 60, one corrupted entry, 4 000 seeds', function () {
  const study = RandomizedLab.freivaldsStudy({ size: 60, cells: 1, trials: 4000, maxRounds: 8,
    seed: 4 });

  assert.strictEqual(study.multiplyCost, 432000, '60³ multiply-adds, counted as two per term');
  assert.strictEqual(study.verifyCost, 43200, 'eight rounds of three matrix-vector products');
  assert.strictEqual((study.multiplyCost / study.verifyCost).toFixed(1), '10.0');

  const measured = study.rows.map(function (row) { return row.measured.toFixed(5); });
  assert.deepStrictEqual(measured,
    ['0.50850', '0.24550', '0.12300', '0.05650', '0.03275', '0.01575', '0.00925', '0.00500']);
  assert.strictEqual(study.rows[0].missed, 2034);

  const alarms = study.rows.reduce(function (a, row) { return a + row.falseAlarms; }, 0);
  assert.strictEqual(alarms, 0, 'a true identity has no counter-example, at any round count');

  prose.quotes('fingerprinting',
    ['432 000', '43 200', '2 034', '0.50850', '0.24550', '0.12300', '0.05650',
      '0.03275', '0.01575', '0.00925', '0.00500', '4 000']);
});

test('fingerprinting: Schwartz-Zippel over Z mod 1009 accepts the truth and rejects the rest', function () {
  const study = RandomizedLab.identityStudy({ trials: 2000 });
  const rows = study.rows.filter(function (row) { return row.field === 1009; });
  const trueRows = rows.filter(function (row) { return row.holds; });
  const falseRows = rows.filter(function (row) { return !row.holds; });

  trueRows.forEach(function (row) {
    assert.strictEqual(row.accepted, 2000, 'a true identity holds at every point of the field');
  });
  assert.strictEqual(falseRows[0].accepted, 3);
  assert.strictEqual(falseRows[0].rate.toFixed(5), '0.00150');
  assert.strictEqual(falseRows[0].bound.toFixed(5), '0.00198');
  assert.strictEqual(falseRows[1].accepted, 4);
  assert.strictEqual(falseRows[1].rate.toFixed(5), '0.00200');
  assert.strictEqual(falseRows[1].bound.toFixed(5), '0.00297');

  const small = study.rows.filter(function (row) {
    return row.field === 101 && !row.holds && row.degree === 3;
  })[0];
  assert.strictEqual(percent(small.rate, 1), '2.9%', 'the same false claim over a small field');

  prose.quotes('fingerprinting',
    ['2 000', '0.00150', '0.00198', '0.00200', '0.00297', '2.9%']);
});

test('fingerprinting: the ordinary pair never collides and the built pair attains d/p', function () {
  const study = RandomizedLab.fingerprintStudy({ length: 5000, trials: 4000, roots: 8, seed: 12 });
  const at = function (field) {
    return study.rows.filter(function (row) { return row.field === field; })[0];
  };

  study.rows.forEach(function (row) {
    assert.strictEqual(row.ordinary.collisions, 0,
      'a one-position difference is a monomial: no reachable root at p = ' + row.field);
  });
  assert.strictEqual(at(101).adversarial.collisions, 343);
  assert.strictEqual(at(101).adversarial.rate.toFixed(5), '0.08575');
  assert.strictEqual(at(101).adversarial.bound.toFixed(4), '0.0792');
  assert.strictEqual(at(1009).adversarial.rate.toFixed(5), '0.01025');
  assert.strictEqual(at(10007).adversarial.rate.toFixed(5), '0.00125');
  assert.strictEqual(at(1000003).adversarial.collisions, 0);
  assert.strictEqual(study.tree.leaves, 79);
  assert.strictEqual(study.tree.proofLength, 7, 'ceil(log2 79)');

  prose.quotes('fingerprinting',
    ['343', '0.08575', '0.0792', '0.01025', '0.00125', '79', '5 000']);
});

/* ------------------------------------------------------------------- 19.6 */

test('ratios: four vertex-cover algorithms on 200 random graphs', function () {
  const study = ApproxLab.coverStudy({ n: 12, density: 0.35, instances: 200 });

  assert.strictEqual(study.instances, 200);
  const matching = methodRow(study.summary, 'maximal matching');
  const degree = methodRow(study.summary, 'highest degree');
  const rounding = methodRow(study.summary, 'LP + rounding');
  const relaxation = methodRow(study.summary, 'LP relaxation');

  assert.strictEqual(matching.mean.toFixed(4), '1.5161');
  assert.strictEqual(matching.median.toFixed(4), '1.4286');
  assert.strictEqual(matching.max.toFixed(4), '2.0000');
  assert.strictEqual(degree.mean.toFixed(4), '1.0321');
  assert.strictEqual(degree.median.toFixed(4), '1.0000');
  assert.strictEqual(degree.max.toFixed(4), '1.2857');
  assert.strictEqual(rounding.mean.toFixed(4), '1.4950');
  assert.strictEqual(relaxation.mean.toFixed(4), '0.8812');

  study.summary.forEach(function (entry) {
    assert.strictEqual(entry.violations, 0, entry.method + ' violated its bound');
    assert.strictEqual(entry.invalid, 0, entry.method + ' returned an infeasible cover');
  });

  prose.quotes('approximation-ratios',
    ['1.5161', '1.4286', '2.0000', '1.0321', '1.0000', '1.2857', '1.4950', '200']);
});

test('ratios: the degree trap, where the ranking reverses', function () {
  [20, 60, 100].forEach(function (k) {
    const instance = Approx.degreeTrapInstance(k);
    const matching = Approx.vertexCoverMatching(instance.graph);
    const degree = Approx.vertexCoverGreedyDegree(instance.graph);
    const expected = { 20: { n: 66, greedy: 46, match: 38 },
      60: { n: 261, greedy: 201, match: 118 },
      100: { n: 482, greedy: 382, match: 198 } }[k];

    assert.strictEqual(instance.graph.n, expected.n);
    assert.strictEqual(degree.size, expected.greedy);
    assert.strictEqual(matching.size, expected.match);
    assert.strictEqual((degree.size / k).toFixed(2), (expected.greedy / k).toFixed(2));
  });

  prose.quotes('approximation-ratios',
    ['66', '46', '2.30', '261', '201', '3.35', '482', '382', '3.82', '1.98', '1.90']);
});

test('ratios: greedy set cover attains H(n) on the tight instance and 1.2330 on random ones', function () {
  const study = ApproxLab.setCoverStudy({ instances: 120 });
  const at = function (n) {
    return study.tight.filter(function (row) { return row.n === n; })[0];
  };

  assert.strictEqual(at(4).greedy.toFixed(4), '2.0833');
  assert.strictEqual(at(4).harmonic.toFixed(4), '2.0833');
  assert.strictEqual(at(64).greedy.toFixed(4), '4.7439');
  assert.strictEqual(at(64).ratio.toFixed(4), '4.6969');
  assert.strictEqual(at(128).greedy.toFixed(4), '5.4331');
  assert.strictEqual(at(128).harmonic.toFixed(4), '5.4331');
  assert.strictEqual(at(128).naturalLog.toFixed(4), '4.8520');
  assert.strictEqual(study.summary.mean.toFixed(4), '1.2330');
  assert.strictEqual(study.summary.max.toFixed(4), '2.0000');
  assert.strictEqual(study.summary.count, 120);

  prose.quotes('approximation-ratios',
    ['2.0833', '4.7439', '4.6969', '5.4331', '4.8520', '1.2330', '120']);
});

test('ratios: metric TSP against Held-Karp on 60 ten-city instances', function () {
  const study = ApproxLab.tspStudy({ instances: 60, cities: 10 });

  assert.strictEqual(study.lowerBound.mean.toFixed(4), '0.7326');
  assert.strictEqual(study.lowerBound.max.toFixed(4), '0.8281');
  assert.strictEqual(study.lowerBound.min.toFixed(4), '0.6328');
  assert.strictEqual(study.doubled.mean.toFixed(4), '1.1428');
  assert.strictEqual(study.doubled.median.toFixed(4), '1.1520');
  assert.strictEqual(study.doubled.max.toFixed(4), '1.3275');
  assert.strictEqual(study.christofides.mean.toFixed(4), '1.0675');
  assert.strictEqual(study.christofides.median.toFixed(4), '1.0635');
  assert.strictEqual(study.christofides.max.toFixed(4), '1.2281');

  study.rows.forEach(function (row) {
    assert.ok(row.mst <= row.optimum, 'the MST must be a lower bound on every instance');
    assert.ok(row.christofidesRatio <= 1.5, 'and Christofides must stay inside 3/2');
  });

  prose.quotes('approximation-ratios',
    ['0.7326', '0.8281', '0.6328', '1.1428', '1.1520', '1.3275', '1.0675', '1.0635', '1.2281']);
});

test('ratios: k-centre and list scheduling, and the trap that attains 2 − 1/m', function () {
  const study = ApproxLab.otherRatios({ points: 16, machines: 4 });
  const centre = function (k) {
    return study.centres.filter(function (row) { return row.k === k; })[0];
  };

  assert.strictEqual(centre(2).ratio.toFixed(4), '1.0547');
  assert.strictEqual(centre(2).examined, 120);
  assert.strictEqual(centre(3).ratio.toFixed(4), '1.4313');
  assert.strictEqual(centre(3).examined, 560);
  assert.strictEqual(centre(4).ratio.toFixed(4), '1.2297');
  assert.strictEqual(centre(4).examined, 1820);

  assert.strictEqual(study.scheduling.plain.mean.toFixed(4), '1.1465');
  assert.strictEqual(study.scheduling.plain.max.toFixed(4), '1.4074');
  assert.strictEqual(study.scheduling.lpt.mean.toFixed(4), '1.0294');
  assert.strictEqual(study.scheduling.lpt.max.toFixed(4), '1.0882');
  assert.strictEqual(study.scheduling.trap.plain, 7);
  assert.strictEqual(study.scheduling.trap.optimum, 4);
  assert.strictEqual(study.scheduling.trap.lpt, 4);
  assert.strictEqual(study.scheduling.trap.bound, 1.75);

  prose.quotes('approximation-ratios',
    ['1.0547', '1.4313', '1.2297', '120', '560', '1 820', '1.1465', '1.4074',
      '1.0294', '1.0882', '1.75']);
});
