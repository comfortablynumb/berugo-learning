'use strict';

/**
 * Every figure the M19.1-M19.3 content quotes, recomputed from the modules and
 * then checked against the prose.
 *
 * The section controllers are not imported; the calls below reproduce what they
 * make at their default control settings, which is the contract this suite is
 * really pinning down - if a default moves, the prose is wrong and this fails.
 */

const test = require('node:test');
const assert = require('node:assert');

const RandomizedLab = require('../../src/js/machines/randomized-lab.js');
const MonteCarlo = require('../../src/js/algorithms/monte-carlo.js');
const Karger = require('../../src/js/algorithms/karger.js');

require('../../src/js/content/concepts-randomized.js');
require('../../src/js/content/examples-randomized.js');
const prose = require('../support/worked-example-prose.js');

function exponential(value, digits) {
  return Number(value).toExponential(digits).replace('e+', 'e');
}

function percent(value, digits) {
  return (value * 100).toFixed(digits) + '%';
}

/* ------------------------------------------------------------------- 19.1 */

test('randomised: the liar densities on 561 are 57.0% Fermat and 1.43% Miller-Rabin', function () {
  const density = RandomizedLab.liarDensity(561);

  assert.strictEqual(density.bases, 558, 'bases 2 through 559');
  assert.strictEqual(density.fermatLiars, 318);
  assert.strictEqual(density.millerLiars, 8);
  assert.strictEqual(percent(density.fermatRate, 2), '56.99%');
  assert.strictEqual(percent(density.millerRate, 2), '1.43%');

  prose.quotes('randomised-design', ['318', '558', '56.99%', '1.43%', '57.0%']);
});

test('randomised: the measured amplification at the demo default', function () {
  const run = RandomizedLab.amplify({ n: 561, trials: 20000, maxRounds: 6 });

  assert.strictEqual(run.rows[0].failures, 277, 'one round is fooled 277 times in 20 000');
  assert.strictEqual(run.rows[1].failures, 8, 'two rounds, 8 times');
  assert.strictEqual(run.rows[2].failures, 0, 'and three rounds, never in this budget');
  assert.strictEqual(exponential(run.rows[0].measured, 3), '1.385e-2');
  assert.strictEqual(exponential(run.rows[1].measured, 3), '4.000e-4');
  assert.strictEqual(exponential(run.rows[0].perInstance, 2), '1.43e-2');
  assert.strictEqual(exponential(run.rows[2].perInstance, 2), '2.95e-6');
  assert.strictEqual(exponential(run.rows[2].universal, 2), '1.56e-2');

  prose.quotes('randomised-design',
    ['277', '1.385e-2', '4.000e-4', '2.95e-6', '1.56e-2', '20 000']);
});

test('randomised: the Las Vegas quantiles at p = 0.2 over 4 000 runs', function () {
  const run = RandomizedLab.lasVegasRuns({ successProbability: 0.2, trials: 4000 });

  assert.strictEqual(run.mean.toFixed(3), '5.074');
  assert.strictEqual(run.expectedMean, 5);
  assert.strictEqual(run.median, 4);
  assert.strictEqual(run.p99, 21);
  assert.strictEqual(run.expectedP99.toFixed(2), '20.64');
  assert.strictEqual(run.worst, 36);
  assert.strictEqual(run.budget, 10);
  assert.strictEqual(run.overBudget, 454);
  assert.strictEqual(percent(run.overBudgetRate, 1), '11.3%');
  assert.strictEqual(percent(Math.pow(0.8, 10), 1), '10.7%');

  prose.quotes('randomised-design',
    ['5.074', '20.64', '36', '454', '11.3%', '10.7%', '4 000']);
});

/* ------------------------------------------------------------------- 19.2 */

test('contraction: the two-clique graph, its oracle and the two rules', function () {
  const study = RandomizedLab.kargerStudy({ clusterSize: 6, bridges: 2, trials: 2000 });

  assert.strictEqual(study.graph.n, 12);
  assert.strictEqual(study.graph.edges.length, 32);
  assert.strictEqual(study.exact.cut, 2);
  assert.strictEqual(study.exact.optimalCuts, 1);
  assert.strictEqual(study.exact.partitionsExamined, 2047);
  assert.strictEqual(study.run.successes, 691);
  assert.strictEqual(percent(study.run.empiricalRate, 2), '34.55%');
  assert.strictEqual(percent(study.run.predictedRate, 2), '1.52%');
  assert.strictEqual(study.trialsForOnePercent, 302);

  const wrong = RandomizedLab.kargerStudy({ clusterSize: 6, bridges: 2, trials: 2000,
    pickBy: 'pair' });
  assert.strictEqual(percent(wrong.run.empiricalRate, 2), '23.40%');

  prose.quotes('random-contraction',
    ['32', '2 047', '691', '34.55%', '1.52%', '302', '23.40%']);
});

test('contraction: the work product at the bound and at the measured rate', function () {
  const study = RandomizedLab.kargerStudy({ clusterSize: 6, bridges: 2, trials: 2000 });
  const perRun = study.graph.n - 2;
  const atBound = Karger.trialsFor(study.graph.n, 0.01);
  const atMeasured = Math.ceil(Math.log(0.01) / Math.log(1 - study.run.empiricalRate));

  assert.strictEqual(perRun, 10, 'twelve vertices means ten merges per run');
  assert.strictEqual(atBound, 302);
  assert.strictEqual(atBound * perRun, 3020);
  assert.strictEqual(atMeasured, 11);
  assert.strictEqual(atMeasured * perRun, 110);
  assert.strictEqual(study.stein.cut, 2);
  assert.strictEqual(study.stein.contractions, 64);
  assert.strictEqual(study.stein.calls, 63);

  prose.quotes('random-contraction', ['3 020', '110', '64', '63', '10']);
});

test('contraction: the cycle attains the bound and the counting corollary', function () {
  const study = RandomizedLab.kargerStudy({ family: 'cycle', clusterSize: 12, trials: 2000 });

  assert.strictEqual(study.graph.edges.length, 12);
  assert.strictEqual(study.exact.cut, 2);
  assert.strictEqual(study.exact.optimalCuts, 66, 'C12 has exactly 12 · 11 / 2 minimum cuts');
  assert.strictEqual(percent(study.run.empiricalRate, 2), '100.00%');
  assert.strictEqual(study.run.exactCutHits, 33);
  assert.strictEqual(percent(study.run.exactCutRate, 2), '1.65%');
  assert.strictEqual(study.run.distinctCutsFound, 66);

  prose.quotes('random-contraction', ['66', '100.00%', '1.65%', '33']);
});

/* ------------------------------------------------------------------- 19.3 */

test('monte carlo: the five estimators on the exponential integrand', function () {
  const run = RandomizedLab.varianceReduction({ target: 'exponential', samples: 4000, seed: 21 });
  const row = function (name) {
    return run.rows.filter(function (entry) { return entry.method === name; })[0];
  };

  assert.strictEqual(run.target.exact.toFixed(6), '1.718282');
  assert.strictEqual(row('plain').run.estimate.toFixed(6), '1.714534');
  assert.strictEqual(exponential(row('plain').run.error, 3), '3.748e-3');
  assert.strictEqual(row('plain').run.variance.toFixed(6), '0.233670');

  assert.strictEqual(row('antithetic').run.variance.toFixed(6), '0.003777');
  assert.strictEqual(row('antithetic').factor.toFixed(2), '61.87');
  assert.strictEqual(exponential(row('antithetic').run.error, 3), '2.966e-3');

  assert.strictEqual(row('control variate').run.variance.toFixed(6), '0.003884');
  assert.strictEqual(row('control variate').factor.toFixed(2), '60.16');
  assert.strictEqual(exponential(row('control variate').run.error, 3), '2.142e-3');

  assert.strictEqual(row('stratified').run.variance.toFixed(6), '0.242093');
  assert.strictEqual(row('stratified').factor.toFixed(2), '0.97');
  assert.strictEqual(exponential(row('stratified').run.error, 3), '1.088e-6');
  assert.strictEqual(row('stratified').errorFactor.toFixed(1), '3445.0');

  assert.strictEqual(exponential(row('quasi (van der Corput)').run.error, 3), '5.214e-4');

  prose.quotes('monte-carlo-estimation',
    ['1.718282', '1.714534', '3.748e-3', '0.233670', '0.003777', '61.87',
      '2.966e-3', '0.003884', '60.16', '2.142e-3', '0.242093', '1.088e-6',
      '3 445', '5.214e-4']);
});

test('monte carlo: the same five on the oscillating integrand, where two of them fail', function () {
  const run = RandomizedLab.varianceReduction({ target: 'oscillating', samples: 4000, seed: 21 });
  const row = function (name) {
    return run.rows.filter(function (entry) { return entry.method === name; })[0];
  };

  assert.strictEqual(row('antithetic').factor.toFixed(2), '1.41');
  assert.ok(row('antithetic').errorFactor < 1,
    'antithetic makes the measured error worse here: factor ' + row('antithetic').errorFactor);
  assert.strictEqual((1 / row('antithetic').errorFactor).toFixed(1), '2.5');
  assert.strictEqual(row('control variate').factor.toFixed(2), '1.01');
  assert.strictEqual(row('stratified').errorFactor.toFixed(0), '412');
  assert.strictEqual(row('quasi (van der Corput)').errorFactor.toFixed(1), '57.7');

  prose.quotes('monte-carlo-estimation', ['1.41', '1.01', '412', '57.7', '2.5']);
});

test('monte carlo: the 95% interval coverage over 200 seeds', function () {
  const rows = RandomizedLab.intervalCoverage({ target: 'exponential', samples: 4000,
    repeats: 200 });
  const row = function (name) {
    return rows.filter(function (entry) { return entry.method === name; })[0];
  };

  assert.strictEqual(percent(row('plain').coverage, 1), '96.0%');
  assert.strictEqual(percent(row('antithetic').coverage, 1), '96.0%');
  assert.strictEqual(percent(row('control variate').coverage, 1), '95.0%');
  assert.strictEqual(percent(row('stratified').coverage, 1), '100.0%');

  prose.quotes('monte-carlo-estimation', ['96.0%', '95.0%', '100.0%']);
});

test('monte carlo: the 1/sqrt(N) rate and the van der Corput discrepancy', function () {
  const series = RandomizedLab.errorSeries({ target: 'exponential', repeats: 40, maxPower: 16 });
  const at = function (samples) {
    return series.rows.filter(function (row) { return row.samples === samples; })[0];
  };

  assert.strictEqual(exponential(at(16).meanError, 3), '1.083e-1');
  assert.strictEqual(exponential(at(4096).meanError, 3), '7.898e-3');
  assert.strictEqual(exponential(at(4096).predicted, 3), '6.767e-3');
  assert.strictEqual(exponential(at(65536).meanError, 3), '1.590e-3');
  assert.strictEqual(exponential(at(65536).predicted, 3), '1.692e-3');
  assert.strictEqual(exponential(at(16).quasiError, 3), '5.115e-2');
  assert.strictEqual(exponential(at(65536).quasiError, 3), '1.311e-5');
  assert.strictEqual(exponential(at(16).discrepancy, 3), '6.250e-2');
  assert.strictEqual(exponential(at(65536).discrepancy, 3), '1.526e-5');

  prose.quotes('monte-carlo-estimation',
    ['1.083e-1', '7.898e-3', '6.767e-3', '1.590e-3', '1.692e-3', '5.115e-2',
      '1.311e-5', '6.250e-2', '1.526e-5']);
});

test('monte carlo: the dimension crossover sits at d = 5', function () {
  const sweep = RandomizedLab.dimensionSweep({ budget: 4096, maxDimension: 8, repeats: 20 });
  const at = function (d) {
    return sweep.rows.filter(function (row) { return row.dimension === d; })[0];
  };

  assert.strictEqual(at(1).nodes, 4096);
  assert.strictEqual(exponential(at(1).gridError, 2), '2.48e-9');
  assert.strictEqual(exponential(at(1).monteCarloError, 2), '3.19e-3');
  assert.strictEqual(at(5).nodes, 5);
  assert.strictEqual(exponential(at(5).gridError, 2), '8.30e-3');
  assert.strictEqual(exponential(at(5).monteCarloError, 2), '9.34e-3');
  assert.strictEqual(at(8).nodes, 2);
  assert.strictEqual(exponential(at(8).gridError, 2), '7.98e-2');
  assert.strictEqual(exponential(at(8).monteCarloError, 2), '1.11e-2');

  let crossover = null;
  sweep.rows.forEach(function (row) {
    if (crossover === null && row.gridError > row.monteCarloError) crossover = row.dimension - 1;
  });
  assert.strictEqual(crossover, 5, 'the grid wins up to and including five dimensions');

  prose.quotes('monte-carlo-estimation',
    ['2.48e-9', '3.19e-3', '7.98e-2', '1.11e-2', '4 096']);
});

test('monte carlo: the rare event, where plain sampling reports zero with zero error', function () {
  const run = RandomizedLab.rareEvent({ threshold: 4, samples: 20000 });
  const at = function (shift) {
    return run.rows.filter(function (row) { return row.shift === shift; })[0];
  };

  assert.strictEqual(exponential(run.exact, 6), '3.167124e-5');
  assert.strictEqual(run.samplesForOneHit, 31574);
  assert.strictEqual(run.plain.hits, 0, 'plain sampling sees nothing');
  assert.strictEqual(run.plain.estimate, 0, 'so the estimate is exactly zero');
  assert.strictEqual(run.plain.standardError, 0, 'and so is the standard error');

  assert.strictEqual(percent(at(2).relativeError, 3), '3.907%');
  assert.strictEqual(at(2).run.hits, 477);
  assert.strictEqual(at(2).run.weightEss.toFixed(1), '387.3');

  assert.strictEqual(percent(at(4).relativeError, 3), '0.121%');
  assert.strictEqual(at(4).run.hits, 10059);
  assert.strictEqual(at(4).run.weightEss.toFixed(1), '3628.9');

  assert.strictEqual(percent(at(7).relativeError, 3), '15.709%');
  assert.strictEqual(at(7).run.hits, 19982);
  assert.strictEqual(at(7).run.weightEss.toFixed(1), '75.4');
  assert.ok(at(7).run.hits > at(4).run.hits,
    'the over-shifted proposal has the best hit count and the worst estimate');

  prose.quotes('monte-carlo-estimation',
    ['3.167124e-5', '31 574', '3.907%', '477', '387.3', '0.121%', '10 059',
      '3 628.9', '15.709%', '19 982', '75.4']);
});

test('monte carlo: the exact tail used as the reference is the real one', function () {
  assert.ok(Math.abs(MonteCarlo.normalTail(4) - 3.167124183311998e-5) < 1e-19,
    'the Mills-ratio continued fraction must be machine-accurate at the threshold');
});
