'use strict';

/**
 * Every figure the M18.9-M18.10 content quotes, recomputed from the modules and
 * then checked against the prose.
 *
 * The section controllers are not imported; the calls below reproduce what they
 * make at their default control settings, which is the contract this suite is
 * really pinning down - if a default moves, the prose is wrong and this fails.
 */

const test = require('node:test');
const assert = require('node:assert');

const AnalysisLab = require('../../src/js/machines/analysis-lab.js');

require('../../src/js/content/concepts-numerics-transforms.js');
require('../../src/js/content/examples-numerics-transforms.js');
const prose = require('../support/worked-example-prose.js');

function exponential(value, digits) {
  return Number(value).toExponential(digits).replace('e+', 'e');
}

function withPlus(value, digits) {
  return Number(value).toExponential(digits);
}

function rowAt(rows, key, value) {
  return rows.filter(function (row) { return row[key] === value; })[0];
}

/* ------------------------------------------------------------------- 18.9 */

test('transforms: the butterfly count is exactly (n/2)log2(n)', function () {
  const rows = AnalysisLab.transformRace({});

  rows.forEach(function (row) {
    assert.strictEqual(row.butterflies, row.expected,
      'the count at n = ' + row.n + ' is exactly (n/2)log2(n)');
    assert.strictEqual(row.naiveOperations, row.n * row.n,
      'and the naive DFT costs n squared');
    assert.ok(row.difference < 1e-10,
      'the FFT agrees with the naive DFT at n = ' + row.n);
  });

  const last = rows[rows.length - 1];
  assert.strictEqual(last.n, 256);
  assert.strictEqual(last.butterflies, 1024);
  assert.strictEqual(last.naiveOperations, 65536);

  prose.quotes('fourier-transforms', [
    prose.grouped(last.butterflies), prose.grouped(last.naiveOperations),
    last.saving.toFixed(1) + '×', exponential(last.difference, 2)
  ]);
});

test('transforms: the round trip stays inside the acceptance criterion', function () {
  const rows = AnalysisLab.roundTripStudy();
  const smallest = rows[0];
  const largest = rows[rows.length - 1];

  rows.forEach(function (row) {
    assert.ok(row.relativeError < 1e-10,
      'the round trip at n = ' + row.n + ' is within 1e-10, measured ' + row.relativeError);
  });
  assert.strictEqual(largest.n, 65536);
  assert.ok(largest.relativeError > smallest.relativeError,
    'and the error grows slowly with the size, as log2(n) stages of rounding predicts');

  prose.quotes('fourier-transforms', [
    exponential(largest.relativeError, 2)
  ]);
});

test('transforms: the windows are scored, and the ordering is not a ladder', function () {
  const rows = AnalysisLab.leakageStudy({ frequency: 10.5 });
  const by = {};
  rows.forEach(function (row) { by[row.id] = row; });

  assert.ok(by.rectangular.ratio < 200, 'no window leaves a very poor ratio');
  assert.ok(by.blackman.ratio > by.hann.ratio, 'Blackman rejects distant sidelobes best');
  assert.ok(by.hamming.ratio < by.hann.ratio,
    'and Hamming scores WORSE than Hann on distant rejection, at ' + by.hamming.ratio);
  assert.ok(by.blackman.peak < by.rectangular.peak,
    'the cost of a window is a lower and wider peak');

  prose.quotes('fourier-transforms', [
    by.rectangular.peak.toFixed(3), by.blackman.peak.toFixed(3),
    by.hann.peak.toFixed(3),
    prose.grouped(Math.round(by.rectangular.ratio)),
    prose.grouped(Math.round(by.hamming.ratio)),
    prose.grouped(Math.round(by.hann.ratio)),
    prose.grouped(Math.round(by.blackman.ratio)),
    withPlus(by.rectangular.sidelobe, 2),
    exponential(by.hann.sidelobe, 2)
  ]);
});

test('transforms: the aliasing table folds exactly where the arithmetic says', function () {
  const rows = AnalysisLab.aliasTable({});
  const aliased = rows.filter(function (row) { return row.aliased; });

  assert.strictEqual(rows.length, 8);
  assert.strictEqual(aliased.length, 4);
  assert.strictEqual(rowAt(rows, 'frequency', 700).apparent, 300);
  assert.strictEqual(rowAt(rows, 'frequency', 900).apparent, 100);
  assert.strictEqual(rowAt(rows, 'frequency', 1100).apparent, 100);
  assert.strictEqual(rowAt(rows, 'frequency', 1300).apparent, 300);
  assert.ok(!rowAt(rows, 'frequency', 450).aliased, '450 Hz is below Nyquist and does not fold');

  prose.quotes('fourier-transforms', ['700', '900', '1 100', '1 300', '300', '100', '500']);
});

test('transforms: the convolution crossover is real at these lengths', function () {
  const study = AnalysisLab.convolutionRace({});

  assert.ok(study.fftMatches, 'the FFT route matches schoolbook after rounding');
  assert.ok(study.nttMatches, 'and the NTT route matches exactly');
  assert.ok(study.fftButterflies > study.naiveOperations,
    'at these lengths the transform route costs MORE: ' + study.fftButterflies +
    ' against ' + study.naiveOperations);
  assert.ok(study.bound.fits, 'the coefficients fit under the NTT modulus');

  prose.quotes('fourier-transforms', [
    String(study.naiveOperations), String(study.fftButterflies)
  ]);
});

/* ------------------------------------------------------------------ 18.10 */

test('optimisation: the fixed step diverges and the line search does not', function () {
  const diverging = AnalysisLab.optimiserRace({ surface: 'rosenbrock', step: 0.01 });
  const surviving = AnalysisLab.optimiserRace({ surface: 'rosenbrock', step: 0.001 });

  assert.ok(diverging.rows[0].diverged, 'a step of 0.01 diverges');
  assert.strictEqual(diverging.rows[0].iterations, 5, 'in five iterations');
  assert.ok(!surviving.rows[0].diverged, 'a step of 0.001 survives');
  assert.ok(surviving.rows[0].objective > surviving.rows[2].objective * 1000,
    'and the line search gets orders further in the same budget');
  assert.ok(surviving.rows[2].evaluations > surviving.rows[0].evaluations * 3,
    'at several times the evaluations');

  prose.quotes('optimisation', [
    withPlus(diverging.rows[0].objective, 3),
    exponential(surviving.rows[0].objective, 3),
    exponential(surviving.rows[2].objective, 3),
    prose.grouped(surviving.rows[2].evaluations),
    prose.grouped(surviving.rows[0].evaluations)
  ]);
});

test('optimisation: BFGS and Newton finish while the first-order methods run', function () {
  const race = AnalysisLab.optimiserRace({ surface: 'rosenbrock', step: 0.001 });
  const bfgs = race.rows[3];
  const newton = race.rows[4];

  assert.ok(bfgs.converged, 'BFGS converges');
  assert.ok(newton.converged, 'and so does Newton');
  assert.strictEqual(bfgs.iterations, 36);
  assert.strictEqual(newton.iterations, 22);
  assert.ok(bfgs.objective < 1e-18, 'to an objective at machine precision');

  prose.quotes('optimisation', [
    '36', '22', exponential(bfgs.objective, 3), exponential(newton.objective, 3)
  ]);
});

test('optimisation: the stability cliff is a threshold', function () {
  const rows = AnalysisLab.stepStability({});
  const by = {};
  rows.forEach(function (row) { by[row.multiple] = row; });

  assert.ok(by[0.5].converged, 'half the limit converges');
  assert.ok(by[0.9].converged, 'and so does nine tenths');
  assert.ok(by[0.9].iterations < by[0.5].iterations,
    'closer to the limit is faster, right up until it is not');
  assert.ok(!by[1].converged, 'at the limit it stops converging');
  assert.ok(by[1.1].diverged && by[2].diverged, 'and above it, it explodes');

  prose.quotes('optimisation', [
    prose.grouped(by[0.5].iterations), prose.grouped(by[0.9].iterations),
    String(by[1.1].iterations), String(by[2].iterations)
  ]);
});

test('optimisation: descent pays for conditioning and Newton does not', function () {
  const rows = AnalysisLab.conditionStudy({});

  rows.forEach(function (row) {
    assert.strictEqual(row.newton, 2,
      'Newton takes 2 iterations at kappa = ' + row.condition);
  });
  assert.strictEqual(rows[0].descent, 2);
  assert.ok(rows[rows.length - 1].descent > 5000,
    'and descent takes ' + rows[rows.length - 1].descent + ' at the worst conditioning');

  prose.quotes('optimisation', [
    prose.grouped(rows[rows.length - 1].descent),
    prose.grouped(rows[rows.length - 1].condition),
    String(rowAt(rows, 'condition', 100).descent),
    String(rowAt(rows, 'condition', 10).descent),
    String(rowAt(rows, 'condition', 30).descent),
    prose.grouped(rowAt(rows, 'condition', 300).descent)
  ]);
});

test('optimisation: a pure rotation costs coordinate descent a factor of thirty', function () {
  const rows = AnalysisLab.coordinateStudy({});
  const aligned = rows[0];
  const rotated = rows[1];

  assert.ok(aligned.converged && rotated.converged, 'both converge');
  assert.strictEqual(aligned.iterations, 2);
  assert.strictEqual(rotated.iterations, 68);
  assert.ok(rotated.evaluations > aligned.evaluations * 10,
    'and the evaluation count moves with it');

  prose.quotes('optimisation', [
    '2 iterations', '68', prose.grouped(rotated.evaluations),
    prose.grouped(aligned.evaluations)
  ]);
});
