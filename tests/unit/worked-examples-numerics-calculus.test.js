'use strict';

/**
 * Every figure the M18.6-M18.8 content quotes, recomputed from the modules and
 * then checked against the prose.
 *
 * The section controllers are not imported; the calls below reproduce what they
 * make at their default control settings, which is the contract this suite is
 * really pinning down - if a default moves, the prose is wrong and this fails.
 */

const test = require('node:test');
const assert = require('node:assert');

const AnalysisLab = require('../../src/js/machines/analysis-lab.js');

require('../../src/js/content/concepts-numerics-calculus.js');
require('../../src/js/content/examples-numerics-calculus.js');
const prose = require('../support/worked-example-prose.js');

/* The prose writes 4.384e-1 where toExponential agrees, and 2.572e+2 where it
   writes the same; only positive exponents differ, so strip the plus. */
function exponential(value, digits) {
  return Number(value).toExponential(digits).replace('e+', 'e');
}

function withPlus(value, digits) {
  return Number(value).toExponential(digits);
}

function rowAt(rows, key, value) {
  return rows.filter(function (row) { return row[key] === value; })[0];
}

/* ------------------------------------------------------------------- 18.6 */

test('interpolation: more nodes make the equally spaced fit worse', function () {
  const rows = AnalysisLab.nodeSweep({ target: 'runge' });
  const first = rows[0];
  const last = rows[rows.length - 1];

  assert.strictEqual(first.count, 5);
  assert.strictEqual(last.count, 25);
  assert.ok(last.equal > first.equal * 100,
    'five times the data makes it at least a hundred times worse');
  assert.ok(last.chebyshev < first.chebyshev, 'Chebyshev improves over the same range');
  assert.ok(last.spline < first.spline, 'and so does the spline');
  assert.ok(last.chebyshev < last.equal / 1000, 'the same degree, at 1/1000 the error');

  prose.quotes('interpolation', [
    withPlus(first.equal, 3), withPlus(last.equal, 3),
    withPlus(last.chebyshev, 3), withPlus(last.spline, 3),
    withPlus(last.equal / first.equal, 1)
  ]);
});

test('interpolation: the intermediate node counts are quoted correctly', function () {
  const rows = AnalysisLab.nodeSweep({ target: 'runge' });

  prose.quotes('interpolation', [
    withPlus(rowAt(rows, 'count', 9).equal, 3),
    withPlus(rowAt(rows, 'count', 13).equal, 3)
  ]);
  assert.ok(rowAt(rows, 'count', 13).equal > rowAt(rows, 'count', 9).equal,
    'the sequence is monotonically worse');
});

test('interpolation: both splines interpolate and only one stays in range', function () {
  const rows = AnalysisLab.overshootStudy({});
  const natural = rows[0];
  const monotone = rows[1];

  assert.ok(natural.interpolationError < 1e-12, 'the natural cubic hits every node');
  assert.ok(monotone.interpolationError < 1e-12, 'and so does the monotone one');
  assert.ok(natural.below > 0.1, 'the natural cubic dips below the data');
  assert.ok(natural.above > 0.1, 'and rises above it');
  assert.strictEqual(monotone.above, 0, 'the monotone cubic never rises above the data');
  assert.strictEqual(monotone.below, 0, 'and never dips below it');

  prose.quotes('interpolation', [
    natural.below.toFixed(4), natural.above.toFixed(4),
    (natural.worst / natural.range * 100).toFixed(1) + '%', '0.0000'
  ]);
});

/* ------------------------------------------------------------------- 18.7 */

test('differentiation: the V curve bottoms out where the theory says', function () {
  const study = AnalysisLab.stepStudy({ at: 1 });

  assert.strictEqual(study.forward.h, 1e-8);
  assert.strictEqual(study.central.h, 1e-5);
  assert.strictEqual(study.complex.error, 0, 'the complex step has no error at any h');
  assert.ok(Math.abs(Math.log10(study.forward.h) - Math.log10(study.predictedForward)) < 1,
    'the forward minimum is within a decade of sqrt(epsilon)');
  assert.ok(Math.abs(Math.log10(study.central.h) - Math.log10(study.predictedCentral)) < 1,
    'and the central one is within a decade of the cube root');

  prose.quotes('differentiation-and-autodiff', [
    exponential(study.predictedForward, 2), exponential(study.predictedCentral, 2),
    exponential(study.forward.error, 2), exponential(study.central.error, 2),
    '2.22e-16'
  ]);
});

test('differentiation: quadrature compared per evaluation, not per rule', function () {
  const rows = AnalysisLab.quadratureRace({ panels: 8 });
  const by = {};
  rows.forEach(function (row) { by[row.method] = row; });

  assert.strictEqual(by.simpson.evaluations, 9);
  assert.strictEqual(by['gauss-legendre'].evaluations, 4);
  assert.ok(by['gauss-legendre'].error < by.simpson.error / 1000,
    'Gauss is far more accurate on fewer evaluations');
  assert.ok(by['adaptive simpson'].evaluations > 100,
    'and adaptive Simpson spends heavily on a smooth integrand');

  prose.quotes('differentiation-and-autodiff', [
    exponential(by['gauss-legendre'].error, 2), exponential(by.simpson.error, 3),
    exponential(by.trapezoid.error, 2),
    prose.grouped(by['adaptive simpson'].evaluations)
  ]);
});

test('differentiation: Gauss is exact to 2n − 1 and not to 2n', function () {
  const rows = AnalysisLab.gaussExactness({});

  rows.forEach(function (row) {
    assert.ok(row.errorAtExact < 1e-15,
      'exact at degree ' + row.exactDegree + ' with ' + row.points + ' points');
    assert.ok(row.errorBeyond > 1e-8,
      'and visibly not exact one degree higher');
  });

  prose.quotes('differentiation-and-autodiff', [
    exponential(rowAt(rows, 'points', 2).errorAtExact, 2),
    exponential(rowAt(rows, 'points', 2).errorBeyond, 2),
    exponential(rowAt(rows, 'points', 5).errorAtExact, 2),
    exponential(rowAt(rows, 'points', 5).errorBeyond, 2)
  ]);
});

test('differentiation: reverse mode costs one sweep at any input count', function () {
  const rows = AnalysisLab.autodiffRace({});
  const widest = rows[rows.length - 1];

  rows.forEach(function (row) {
    assert.strictEqual(row.reversePasses, 1, 'reverse mode always takes one sweep');
    assert.strictEqual(row.forwardPasses, row.inputs, 'forward mode takes one per input');
    assert.ok(row.reverseError < 1e-12, 'and the gradient is exact on ' + row.label);
    assert.ok(row.centralError > row.reverseError,
      'while a central difference is not, on ' + row.label);
  });
  assert.strictEqual(widest.inputs, 24);
  assert.ok(widest.ratio > 9, 'the operation ratio at 24 inputs is ' + widest.ratio);

  prose.quotes('differentiation-and-autodiff', [
    widest.ratio.toFixed(2) + '×', '24'
  ]);
});

test('differentiation: the tape yields both partials from one backward sweep', function () {
  const tape = AnalysisLab.tapeGraph('trigonometric');
  const inputs = tape.nodes.filter(function (node) { return node.isInput; });

  assert.strictEqual(tape.nodes.length, 6, 'six nodes for sin(xy) + exp(x)');
  assert.strictEqual(inputs.length, 2);

  const at = [0.4, 1.3];
  const truth = [at[1] * Math.cos(at[0] * at[1]) + Math.exp(at[0]),
    at[0] * Math.cos(at[0] * at[1])];
  inputs.forEach(function (node, i) {
    assert.ok(Math.abs(node.adjoint - truth[i]) < 1e-12,
      'the input adjoint is the partial derivative');
  });

  prose.quotes('differentiation-and-autodiff', [
    truth[0].toFixed(6), truth[1].toFixed(6), '0.520000', '0.496880', '1.491825', '1.988705'
  ]);
});

/* ------------------------------------------------------------------- 18.8 */

test('differential equations: the measured orders match the claimed ones', function () {
  const rows = AnalysisLab.orderTable({});
  const by = {};
  rows.forEach(function (row) { by[row.method] = row; });

  rows.forEach(function (row) {
    assert.ok(row.matches,
      row.label + ' should measure ' + row.expected + ', measured ' + row.observed);
  });
  assert.ok(by.rk4.rows[by.rk4.rows.length - 1].error <
    by.verlet.rows[by.verlet.rows.length - 1].error / 1e6,
  'RK4 is far more accurate per step than Verlet');

  prose.quotes('differential-equations', [
    by.euler.observed.toFixed(3), by.midpoint.observed.toFixed(3),
    by.rk4.observed.toFixed(3), by.verlet.observed.toFixed(3),
    exponential(by.euler.rows[by.euler.rows.length - 1].error, 2),
    exponential(by.rk4.rows[by.rk4.rows.length - 1].error, 2)
  ]);
});

test('differential equations: RK4 decays and Verlet oscillates, at h = 0.1', function () {
  const rows = AnalysisLab.orbitStudy({ step: 0.1, eccentricity: 0 });
  const by = {};
  rows.forEach(function (row) { by[row.method] = row; });

  assert.ok(!by.rk4.symplectic, 'RK4 is not symplectic');
  assert.ok(by.verlet.symplectic, 'Verlet is');

  assert.ok(Math.abs(by.rk4.radiusEnd - by.rk4.radiusMin) < 1e-12,
    'RK4 ends at its smallest radius, so the decay is monotone');
  assert.ok(by.verlet.radiusEnd > by.verlet.radiusMin &&
    by.verlet.radiusEnd < by.verlet.radiusMax,
  'Verlet ends inside its band rather than at an extreme');
  assert.ok(by.rk4.energy.relativeWorst > by.verlet.energy.relativeWorst * 100,
    'and RK4 drifts far more in energy despite being higher order');

  prose.quotes('differential-equations', [
    by.rk4.radiusEnd.toFixed(6), by.verlet.radiusEnd.toFixed(6),
    by.verlet.radiusMax.toFixed(6), by.euler.radiusEnd.toFixed(6),
    exponential(by.rk4.energy.relativeWorst, 2),
    exponential(by.verlet.energy.relativeWorst, 2)
  ]);
});

test('differential equations: the effect really does vanish at h = 0.01', function () {
  const rows = AnalysisLab.orbitStudy({ step: 0.01, eccentricity: 0 });
  const by = {};
  rows.forEach(function (row) { by[row.method] = row; });

  assert.ok(by.rk4.energy.relativeWorst < 1e-8,
    'RK4 holds to a part in 1e8 or better at the smaller step');
  assert.ok(by.verlet.energy.relativeWorst < 1e-8, 'and so does Verlet');

  prose.quotes('differential-equations', [
    exponential(by.rk4.energy.relativeWorst, 2),
    exponential(by.verlet.energy.relativeWorst, 2)
  ]);
});

test('differential equations: the stiff step is a threshold, not a gradient', function () {
  const study = AnalysisLab.stiffnessStudy({ fast: 1000 });

  assert.strictEqual(study.explicitStepsNeeded, 500);
  assert.strictEqual(study.implicit.steps, 10);
  assert.ok(study.explicit[0].stable && study.explicit[1].stable,
    'below the limit it is stable');
  assert.ok(!study.explicit[2].stable, 'and 25% above it, it explodes');
  assert.ok(study.implicit.ratioToLimit > 40,
    'the implicit method runs at ' + study.implicit.ratioToLimit + 'x the explicit limit');

  prose.quotes('differential-equations', [
    exponential(study.limit, 3), '500', '10',
    exponential(study.implicit.error, 2),
    '1 000'
  ]);
});
