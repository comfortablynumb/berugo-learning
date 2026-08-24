'use strict';

/**
 * Every figure the M18.4-M18.5 content quotes, recomputed from the modules and
 * then checked against the prose.
 *
 * The section controllers are not imported; the calls below reproduce what they
 * make at their default control settings, which is the contract this suite is
 * really pinning down - if a default moves, the prose is wrong and this fails.
 */

const test = require('node:test');
const assert = require('node:assert');

const QR = require('../../src/js/algorithms/qr-svd.js');
const NumericLab = require('../../src/js/machines/numeric-lab.js');

require('../../src/js/content/concepts-numerics-linear.js');
require('../../src/js/content/examples-numerics-linear.js');
const prose = require('../support/worked-example-prose.js');

/* The prose writes 5.24e2 where toExponential writes 5.24e+2; the number is
   the same and the rendering is the one a reader sees. */
function exponential(value, digits) {
  return Number(value).toExponential(digits).replace('e+', 'e');
}

function rowAt(rows, degree) {
  return rows.filter(function (row) { return row.degree === degree; })[0];
}

function methodOf(rows, id) {
  return rows.filter(function (row) { return row.id === id; })[0];
}

/* ------------------------------------------------------------------- 18.4 */

test('least squares: the normal equations square the conditioning exactly', function () {
  const rows = NumericLab.fittingSweep({ noise: 0 });

  rows.forEach(function (row) {
    if (row.normalCondition > 1e17) return;
    assert.ok(Math.abs(row.squared - 1) < 0.01,
      'the ratio to kappa squared is 1.000 at degree ' + row.degree +
      ', measured ' + row.squared);
  });

  const four = rowAt(rows, 4);
  const ten = rowAt(rows, 10);
  assert.ok(ten.normalResidual > ten.qrResidual * 100,
    'by degree 10 the two routes have parted company');

  prose.quotes('least-squares', [
    exponential(four.condition, 2), exponential(four.normalCondition, 2),
    exponential(ten.condition, 2), exponential(ten.normalCondition, 2),
    exponential(ten.qrResidual, 2), exponential(ten.normalResidual, 2),
    '1.000'
  ]);
});

test('least squares: the reported condition number saturates rather than climbing', function () {
  const rows = NumericLab.fittingSweep({ noise: 0 });
  const twelve = rowAt(rows, 12);
  const fourteen = rowAt(rows, 14);

  assert.ok(fourteen.condition > twelve.condition,
    'the design matrix keeps getting worse conditioned');
  assert.ok(fourteen.normalCondition <= twelve.normalCondition * 1.05,
    'while the Gram matrix reading stops rising, at ' + fourteen.normalCondition);
  assert.ok(fourteen.normalCondition > 1 / Number.EPSILON,
    'because it has reached the neighbourhood of 1 / machine epsilon');

  prose.quotes('least-squares', [
    exponential(fourteen.condition, 2), exponential(fourteen.normalCondition, 2)
  ]);
});

test('least squares: three QR variants, separated by thirteen orders', function () {
  const rows = NumericLab.orthogonalityRace({});
  const classical = methodOf(rows, 'classical');
  const modified = methodOf(rows, 'modified');
  const householder = methodOf(rows, 'householder');

  assert.ok(classical.loss > 1e-3, 'classical Gram-Schmidt is badly non-orthogonal');
  assert.ok(modified.loss < classical.loss / 1e6, 'the modified variant is far better');
  assert.ok(householder.loss < 1e-13, 'and Householder is at machine precision');

  prose.quotes('least-squares', [
    exponential(classical.loss, 3), exponential(modified.loss, 3),
    exponential(householder.loss, 3),
    exponential(classical.loss / modified.loss, 1),
    exponential(classical.loss / householder.loss, 1),
    exponential(modified.loss / householder.loss, 1),
    exponential(classical.condition, 2)
  ]);
});

test('least squares: the Frobenius truncation error lands on its own bound', function () {
  const study = NumericLab.truncationStudy({});

  study.rows.forEach(function (row) {
    if (row.frobeniusBound === 0) return;
    assert.ok(Math.abs(row.measured - row.frobeniusBound) <= 1e-9 * row.frobeniusBound,
      'the measured Frobenius error equals the Frobenius bound at rank ' + row.k);
    assert.ok(row.frobeniusBound >= row.spectralBound,
      'and the Frobenius bound is never below the spectral one');
  });

  const six = study.rows[5];
  assert.strictEqual(six.k, 6);

  prose.quotes('least-squares', [
    exponential(six.measured, 2), exponential(six.frobeniusBound, 2),
    exponential(six.spectralBound, 2)
  ]);
});

/* ------------------------------------------------------------------- 18.5 */

test('eigenvalues: power iteration tracks the gap and ignores the size', function () {
  const rows = NumericLab.gapStudy({});
  const by = {};
  rows.forEach(function (row) { by[row.gap] = row; });

  assert.strictEqual(by[0.5].iterations, 33);
  assert.strictEqual(by[0.9].iterations, 195);
  assert.strictEqual(by[0.99].iterations, 1802);

  rows.forEach(function (row) {
    assert.ok(row.iterations <= row.predicted * 1.2 + 10,
      'the measurement runs at or under the prediction at gap ' + row.gap);
  });
  assert.ok(by[0.99].iterations > by[0.5].iterations * 40,
    'and a near-tie costs orders of magnitude more passes');

  prose.quotes('eigenvalues', [
    '33', '195', prose.grouped(by[0.99].iterations),
    String(Math.round(by[0.9].predicted)), prose.grouped(Math.round(by[0.99].predicted))
  ]);
});

test('eigenvalues: shifted inverse iteration reaches every eigenvalue named', function () {
  const rows = NumericLab.shiftStudy({ offset: 0.2 });
  let fewest = rows[0];
  let most = rows[0];
  rows.forEach(function (row) {
    assert.ok(row.correct, 'the shift landed on the eigenvalue it aimed at: ' + row.target);
    if (row.iterations < fewest.iterations) fewest = row;
    if (row.iterations > most.iterations) most = row;
  });

  assert.strictEqual(fewest.iterations, 10);
  assert.strictEqual(most.iterations, 24);
  assert.strictEqual(rows[rows.length - 1].target, 1,
    'including the smallest, which power iteration cannot reach at all');

  prose.quotes('eigenvalues', ['10', '24']);
});

test('eigenvalues: the QR algorithm recovers the whole spectrum by similarity', function () {
  const run = NumericLab.qrConvergence({});

  assert.ok(run.converged, 'the subdiagonal reached the tolerance');
  assert.strictEqual(run.iterations, 37);
  run.expected.forEach(function (value, index) {
    assert.ok(Math.abs(run.values[index] - value) < 1e-8,
      'eigenvalue ' + value + ' recovered from the diagonal');
  });
  assert.ok(run.trail[run.trail.length - 1] < run.trail[0],
    'and the subdiagonal shrank monotonically enough to converge');

  prose.quotes('eigenvalues', ['37 sweeps']);
});

test('eigenvalues: Wilkinson’s polynomial amplifies by nine orders at degree 20', function () {
  const rows = NumericLab.polynomialLadder(null, 1e-10);
  const by = {};
  rows.forEach(function (row) { by[row.n] = row; });

  assert.ok(by[5].rootShift < 1e-7, 'a small shift at degree 5');
  assert.ok(by[20].rootShift > 0.5, 'and most of a whole unit at degree 20');
  assert.ok(by[20].rootShift / by[20].epsilon > 1e9,
    'an amplification above a billion, measured ' + by[20].rootShift / by[20].epsilon);
  assert.ok(Math.abs(Math.abs(by[20].coefficient) - 210) < 1e-6,
    'the coefficient of x^19 is -210');

  prose.quotes('eigenvalues', [
    exponential(by[5].rootShift, 3), exponential(by[10].rootShift, 3),
    exponential(by[15].rootShift, 3), exponential(by[20].rootShift, 3),
    exponential(by[20].rootShift / by[20].epsilon, 1), '210'
  ]);
});

/* -------------------------------------------------------------- the traps */

test('eigenvalues: an all-ones start is a fixed point of a constant-row-sum matrix', function () {
  /* The claim the concept makes, checked directly rather than asserted: on
     [[2, 1], [1, 2]] the all-ones vector is the eigenvector for 3, so the
     iteration reports 3 whichever eigenvalue was wanted. */
  const matrix = [[2, 1], [1, 2]];
  const x = [1, 1];
  const y = [matrix[0][0] * x[0] + matrix[0][1] * x[1],
    matrix[1][0] * x[0] + matrix[1][1] * x[1]];

  assert.deepStrictEqual(y, [3, 3], 'A times the all-ones vector is 3 times it');
  assert.strictEqual(y[0] / x[0], 3, 'so the iteration is stationary at 3');

  prose.quotes('eigenvalues', ['[[2, 1], [1, 2]]', '3']);
});

test('least squares: truncation only saves storage below about half the rank', function () {
  const study = NumericLab.truncationStudy({});
  const saving = study.rows.filter(function (row) { return row.stored < row.full; });

  assert.ok(saving.length > 0, 'some ranks do save');
  assert.ok(saving.length < study.rows.length,
    'and past about half the rank the two factors cost more than the matrix');
  assert.strictEqual(QR.lowRank(
    { rows: 1, cols: 1, data: new Float64Array([2]) }, 1).frobeniusBound, 0,
  'a full-rank truncation drops nothing, so both bounds are zero');
});
