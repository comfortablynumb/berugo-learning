'use strict';

/**
 * Every figure the M18.1-M18.3 content quotes, recomputed from the modules and
 * then checked against the prose.
 *
 * The section controllers are not imported; the calls below reproduce what they
 * make at their default control settings, which is the contract this suite is
 * really pinning down - if a default moves, the prose is wrong and this fails.
 */

const test = require('node:test');
const assert = require('node:assert');

const Linalg = require('../../src/js/algorithms/linalg.js');
const NumericLab = require('../../src/js/machines/numeric-lab.js');

require('../../src/js/content/concepts-numerics.js');
require('../../src/js/content/examples-numerics.js');
const prose = require('../support/worked-example-prose.js');

/* The prose writes 5.24e2 where toExponential writes 5.24e+2; the number is
   the same and the rendering is the one a reader sees. */
function exponential(value, digits) {
  return Number(value).toExponential(digits).replace('e+', 'e');
}

/** The sweep row nearest a requested condition number, the way the section
 *  controller picks one. */
function sweepRow(rows, condition) {
  let best = rows[0];
  rows.forEach(function (row) {
    if (Math.abs(Math.log10(row.requested) - Math.log10(condition)) <
      Math.abs(Math.log10(best.requested) - Math.log10(condition))) best = row;
  });
  return best;
}

/* ------------------------------------------------------------------- 18.1 */

test('conditioning: the residual is flat while the error climbs nine orders', function () {
  const rows = NumericLab.conditioningSweep({ size: 8, seed: 11 });
  const first = rows[0];
  const last = rows[rows.length - 1];

  assert.ok(first.relativeResidual < 1e-15, 'the residual starts at machine precision');
  assert.ok(last.relativeResidual < 1e-15, 'and is still there at the worst conditioning');
  assert.ok(last.relativeError / first.relativeError > 1e14,
    'while the error moves at least fourteen orders of magnitude');
  rows.forEach(function (row) {
    assert.ok(row.withinBound, 'every row sits inside the condition-number bound');
  });

  prose.quotes('conditioning-and-error', [
    exponential(first.relativeError, 2),
    exponential(last.relativeError, 2),
    exponential(last.relativeResidual, 2)
  ]);
});

test('conditioning: the digit budget at kappa = 1e8 matches the measurement', function () {
  const rows = NumericLab.conditioningSweep({ size: 8, seed: 11 });
  const row = sweepRow(rows, 1e8);

  assert.strictEqual(Math.round(Math.log10(row.requested)), 8);
  assert.ok(row.relativeError <= row.bound,
    'the measured error is inside epsilon times kappa');
  assert.ok(row.relativeError > 1e-12,
    'and it is well above machine precision, so digits really were lost');

  prose.quotes('conditioning-and-error', [
    '2.22e-16',
    exponential(row.bound, 2),
    exponential(row.relativeError, 2),
    exponential(row.relativeResidual, 2)
  ]);
});

test('conditioning: the Hilbert ladder loses every digit by n = 13', function () {
  const rows = NumericLab.hilbertLadder();
  const first = rows[0];
  const last = rows[rows.length - 1];

  assert.strictEqual(first.n, 3);
  assert.strictEqual(last.n, 13);
  assert.ok(last.relativeError > 1, 'no correct digits at all at n = 13');
  assert.ok(last.relativeResidual < 1e-15, 'and the residual is still at machine precision');
  assert.ok(Math.log10(last.condition) > 16,
    'the condition number has passed what a double can carry');

  prose.quotes('conditioning-and-error', [
    exponential(first.condition, 2),
    exponential(last.condition, 2),
    exponential(first.relativeError, 2),
    exponential(last.relativeError, 2),
    exponential(last.relativeResidual, 2)
  ]);
});

/* ------------------------------------------------------------------- 18.2 */

test('root finding: five methods on the cubic, with the orders fitted', function () {
  const rows = NumericLab.rootRace('cubic', { start: 3, tolerance: 1e-12 });
  const by = {};
  rows.forEach(function (row) { by[row.method] = row; });

  assert.strictEqual(by.bisection.iterations, 41);
  assert.strictEqual(by.bisection.evaluations, 43);
  assert.strictEqual(by.newton.iterations, 6);
  assert.strictEqual(by.newton.evaluations, 12);
  assert.strictEqual(by.secant.iterations, 8);
  assert.strictEqual(by.secant.evaluations, 9);
  assert.ok(by.secant.evaluations < by.newton.evaluations,
    'the secant method is the cheapest in the table on the metric that is paid');

  prose.quotes('root-finding', [
    '41 iterations', '6 iterations', '12 evaluations',
    '8 iterations', '9 evaluations', '2.0945514815423265'
  ]);
});

test('root finding: the fitted orders land near 2 and the golden ratio', function () {
  const rows = NumericLab.rootRace('cubic', { start: 3, tolerance: 1e-12 });
  const by = {};
  rows.forEach(function (row) { by[row.method] = row; });

  assert.ok(Math.abs(by.newton.reportOrder - 2) < 0.15,
    'Newton fits close to quadratic, and the measured value is ' + by.newton.reportOrder);
  assert.ok(Math.abs(by.secant.reportOrder - 1.618) < 0.15,
    'the secant fits close to the golden ratio, at ' + by.secant.reportOrder);
  assert.strictEqual(by.bisection.reportOrder, null,
    'bisection has no convergence order and the column stays blank');

  prose.quotes('root-finding', [
    Number(by.newton.reportOrder).toFixed(3),
    Number(by.secant.reportOrder).toFixed(3),
    '1.618'
  ]);
});

test('root finding: the bracketing methods separate on their contraction', function () {
  const rows = NumericLab.rootRace('cubic', { start: 3, tolerance: 1e-12 });
  const by = {};
  rows.forEach(function (row) { by[row.method] = row; });

  assert.ok(Math.abs(by.bisection.reportContraction - 0.5) < 1e-9,
    'bisection halves the bracket exactly');
  assert.ok(by['false position'].reportContraction > 0.99,
    'false position barely contracts at all, at ' + by['false position'].reportContraction);

  prose.quotes('root-finding', ['0.5000', '1.0000']);
});

test('root finding: Newton lands in the wrong basin from three of nine starts', function () {
  const rows = NumericLab.newtonBasins('multiroot', null, {});
  const wrong = rows.filter(function (row) {
    return row.converged && row.nearest !== null && Math.abs(row.root - row.nearest) > 1e-6;
  });

  assert.strictEqual(rows.length, 9);
  assert.strictEqual(wrong.length, 3, 'three of nine starting points return a different root');

  const from075 = rows.filter(function (row) { return Math.abs(row.start - 0.75) < 1e-9; })[0];
  assert.ok(from075, 'the 0.75 start is in the table');
  assert.ok(Math.abs(from075.root + Math.SQRT2) < 1e-6,
    'from 0.75 Newton returns the far negative root');
  assert.strictEqual(from075.iterations, 8);

  const boundary = Math.sqrt(2 / 3);
  assert.ok(Math.abs(boundary - 0.816497) < 1e-5,
    'the derivative vanishes at sqrt(2/3), which is where the basins meet');

  prose.quotes('root-finding', ['0.75', '−1.414214', '3 of 9', '0.816497', '0.8150', '0.8165']);
});

test('root finding: the same equation rearranged converges once and not twice', function () {
  const rows = NumericLab.fixedPointPair({});

  assert.strictEqual(rows.length, 2);
  assert.ok(rows[0].contraction, 'the first rearrangement contracts');
  assert.ok(!rows[1].contraction, 'the second does not');
  assert.ok(rows[0].converged, 'so the first converges');
  assert.ok(!rows[1].converged, 'and the second never does');
  assert.strictEqual(rows[0].iterations, 28);

  prose.quotes('root-finding', ['0.3820', '3.2361', '28']);
});

/* ------------------------------------------------------------------- 18.3 */

test('linear systems: the tiny pivot destroys the answer without an error', function () {
  const rows = NumericLab.pivotingDemo({ epsilon: 1e-18 });
  const pivoted = rows.filter(function (row) { return row.pivoted; })[0];
  const bare = rows.filter(function (row) { return !row.pivoted; })[0];

  assert.strictEqual(pivoted.swaps, 1);
  assert.strictEqual(pivoted.relativeError, 0, 'pivoting gives the exact answer here');
  assert.ok(Math.abs(pivoted.x[0] - 1) < 1e-12, 'x1 is 1');
  assert.ok(Math.abs(pivoted.x[1] - 1) < 1e-12, 'x2 is 1');

  assert.strictEqual(bare.swaps, 0);
  assert.strictEqual(bare.x[0], 0, 'without pivoting the first component is exactly zero');
  assert.ok(bare.growth > 1e17, 'and the growth factor records why');
  assert.ok(Math.abs(bare.relativeError - Math.SQRT1_2) < 1e-3,
    'a relative error of about 0.707, which is 7.07e-1');

  prose.quotes('linear-systems', [
    exponential(bare.relativeError, 2), '1e18', '1e-18'
  ]);
});

test('linear systems: Wilkinson attains 2^(n-1) with no swaps at all', function () {
  const rows = NumericLab.growthLadder();

  rows.forEach(function (row) {
    assert.strictEqual(row.swaps, 0,
      'partial pivoting finds the diagonal entry already largest at n = ' + row.n);
    assert.ok(row.matchesPrediction,
      'and the growth factor is exactly 2^(n-1) at n = ' + row.n);
  });

  prose.quotes('linear-systems', ['2ⁿ⁻¹']);
});

test('linear systems: reuse is free and the inverse is not', function () {
  const study = NumericLab.reuseStudy({});

  assert.strictEqual(study.factorisations.reused, 1);
  assert.strictEqual(study.factorisations.fresh, 20);
  assert.strictEqual(study.reusedError, study.freshError,
    'reuse and from-scratch give bit-identical answers');
  /* The penalty is a ratio of two rounding-error norms and it is engine
     sensitive - 8.41 on Node 24, 6.02 on Node 22, same source and same seed,
     because the Gaussian that builds the right-hand sides runs on `Math.log`
     and V8 does not round it identically across releases. Pinning it to a
     decimal is asserting a property of the engine; the band is the claim the
     section actually makes, and it is still tight enough to fail if the
     inverse route ever stopped being worse. */
  assert.ok(study.inversePenalty > 2,
    'the inverse is materially worse, at ' + study.inversePenalty + 'x');
  assert.ok(study.inversePenalty > 4 && study.inversePenalty < 12,
    'several times worse rather than marginally or catastrophically, at '
      + study.inversePenalty + 'x');

  prose.quotes('linear-systems', ['20', 'several times worse']);
});

test('linear systems: the iterative race, and preconditioning as a no-op', function () {
  const plain = NumericLab.iterativeRace({ size: 40, scaled: false, omega: 1.8 });
  const scaled = NumericLab.iterativeRace({ size: 40, scaled: true, omega: 1.8 });
  const by = {};
  plain.rows.forEach(function (row) { by[row.method] = row; });

  assert.strictEqual(by.jacobi.iterations, 7621);
  assert.strictEqual(by['gauss-seidel'].iterations, 2711);
  assert.strictEqual(by['conjugate gradient'].iterations, 40);
  assert.strictEqual(plain.preconditioned.iterations, by['conjugate gradient'].iterations,
    'on a uniform diagonal Jacobi preconditioning changes nothing');
  assert.ok(Math.abs(plain.condition - plain.preconditionedCondition) /
    plain.condition < 1e-9, 'and the condition number does not move either');

  assert.ok(scaled.preconditionedCondition < scaled.condition / 100,
    'with the rows scaled it has something to work on');
  assert.strictEqual(scaled.rows[3].iterations, 196);
  assert.strictEqual(scaled.preconditioned.iterations, 40);

  prose.quotes('linear-systems', [
    prose.grouped(by.jacobi.iterations), prose.grouped(by['gauss-seidel'].iterations),
    exponential(scaled.condition, 2), exponential(scaled.preconditionedCondition, 2),
    '196', '40'
  ]);
});

test('linear systems: the omega sweep finds its own optimum', function () {
  const rows = NumericLab.omegaSweep({});
  let best = rows[0];
  rows.forEach(function (row) {
    if (row.converged && row.iterations < best.iterations) best = row;
  });

  assert.strictEqual(rows[0].omega, 1, 'the sweep starts at plain Gauss-Seidel');
  assert.strictEqual(rows[0].iterations, 2163);
  assert.strictEqual(best.omega, 1.85);
  assert.strictEqual(best.iterations, 153);
  assert.ok(rows[rows.length - 1].iterations > best.iterations,
    'and it gets worse again past the optimum');

  prose.quotes('linear-systems', [prose.grouped(rows[0].iterations), '1.85',
    prose.grouped(best.iterations)]);
});

/* --------------------------------------------------------------- the labs */

test('linear systems: the exact reference survives its own cancellation', function () {
  /* Deriving x1 as (1 - x2)/e cancels to exactly zero at e = 1e-18 and scores
     the correctly pivoted answer as the failure. The arrangement that
     survives is x1 = 1/(1 - e). */
  const truth = NumericLab.exactTinyPivotSolution(1e-18);

  assert.ok(Math.abs(truth[0] - 1) < 1e-15, 'x1 is 1 to fifteen digits');
  assert.ok(Math.abs(truth[1] - 1) < 1e-15, 'and so is x2');

  const matrix = Linalg.tinyPivot(1e-18);
  const scored = Linalg.scoreSolution(matrix, truth, new Float64Array([1, 2]), truth);
  assert.ok(scored.relativeResidual < 1e-15,
    'the reference satisfies the system it is the reference for');
});
