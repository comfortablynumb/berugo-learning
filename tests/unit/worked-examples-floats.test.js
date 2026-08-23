'use strict';

/**
 * Every figure the M17.4-M17.6 content quotes, recomputed from the modules and
 * then checked against the prose.
 *
 * The summation figures depend on the dataset generator, and that generator is
 * the subject of a defect worth remembering: `Random.seeded` yields 32
 * significant bits, and a sum of fewer than 2^21 such values is exactly
 * representable - so naive summation over them scores a relative error of
 * exactly zero. `FloatLab.unit` widens the draw, and the assertion below that
 * the naive error is non-trivial is what stops that regressing.
 */

const test = require('node:test');
const assert = require('node:assert');

const FloatInspect = require('../../src/js/algorithms/float-inspect.js');
const Summation = require('../../src/js/algorithms/summation.js');
const FixedDecimal = require('../../src/js/algorithms/fixed-decimal.js');
const FloatLab = require('../../src/js/machines/float-lab.js');

require('../../src/js/content/concepts-floats.js');
require('../../src/js/content/examples-floats.js');
const prose = require('../support/worked-example-prose.js');

/* ------------------------------------------------------------------- 17.4 */

test('ieee 754: 0.1 decoded by hand is the value the prose writes out', function () {
  const parts = FloatInspect.decompose(0.1);
  const rational = FloatInspect.exactRational(0.1);

  assert.strictEqual(parts.biasedExponent, 1019);
  assert.strictEqual(parts.exponent, -4);
  assert.strictEqual(parts.significand, 7205759403792794n);
  assert.strictEqual(rational.numerator, 3602879701896397n);
  assert.strictEqual(rational.denominator, 1n << 55n);
  assert.strictEqual(FloatInspect.exactDecimal(0.1),
    '0.1000000000000000055511151231257827021181583404541015625');

  prose.quotes('ieee-754', ['1019', '3602879701896397', '2⁵⁵', '7 205 759 403 792 794',
    '0.1000000000000000055511151231257827021181583404541015625']);
});

test('ieee 754: the neighbours of 0.1 are equally spaced', function () {
  const neighbours = FloatInspect.neighbours(0.1);

  assert.strictEqual(neighbours.gapAbove, neighbours.gapBelow);
  assert.strictEqual(neighbours.gapAbove.toExponential(4), '1.3878e-17');
  assert.ok(neighbours.above > 0.1 && neighbours.below < 0.1);

  prose.quotes('ieee-754', ['1.3878e-17', '5.55e-18']);
});

test('ieee 754: the spacing ladder locates 2^53 and the far end', function () {
  const ladder = FloatInspect.spacingTable([0, 52, 53, 70]);

  assert.strictEqual(ladder[0].gap.toExponential(4), '2.2204e-16');
  assert.strictEqual(ladder[0].gap, Number.EPSILON);
  assert.strictEqual(ladder[1].gap, 1);
  assert.strictEqual(ladder[2].gap, 2);
  assert.strictEqual(ladder[3].gap, 262144);
  assert.strictEqual(FloatInspect.incrementSurvives(Math.pow(2, 53)), false);
  assert.strictEqual(FloatInspect.incrementSurvives(Math.pow(2, 52)), true);

  prose.quotes('ieee-754', ['2.2204e-16', '2⁵²', '2⁵³', '262 144']);
});

test('ieee 754: nextAfter holds at all seven checked properties', function () {
  const audit = FloatLab.nextAfterAudit();

  assert.strictEqual(audit.length, 7);
  audit.forEach(function (row) { assert.strictEqual(row.holds, true, row.name); });
  assert.strictEqual(FloatInspect.nextUp(0), 5e-324);

  prose.quotes('ieee-754', ['5e-324', '2.2250738585072014e-308']);
});

test('ieee 754: the three comparisons disagree exactly where the prose says', function () {
  const rows = {};
  FloatLab.comparisonTable(1e-9).forEach(function (row) { rows[row.label] = row; });

  const big = rows['1e9 + 1 against 1e9'];
  assert.strictEqual(Number(big.ulps), 8388608);
  assert.strictEqual(big.absoluteEqual, false);
  assert.strictEqual(big.relativeEqual, true);

  const small = rows['1e-12 against 2e-12'];
  assert.strictEqual(Number(small.ulps), 4503599627370496);
  assert.strictEqual(small.absoluteEqual, true);
  assert.strictEqual(small.relativeEqual, false);

  prose.quotes('ieee-754', ['8 388 608', '4 503 599 627 370 496']);
});

test('ieee 754: narrowing 0.1 to binary32 costs the stated distance', function () {
  const narrowed = FloatInspect.narrowingError(0.1);

  assert.strictEqual(Number(narrowed.ulps), 107374182);
  assert.strictEqual(narrowed.narrowed, 0.10000000149011612);

  prose.quotes('ieee-754', ['107 374 182', '0.10000000149011612']);
});

test('ieee 754: NaN payload count and the two zeros', function () {
  assert.strictEqual(Math.pow(2, 53) - 2, 9007199254740990,
    'two sign bits times 2^52 − 1 fractions');
  assert.strictEqual(-0 === 0, true);
  assert.strictEqual(1 / -0, -Infinity);

  prose.quotes('ieee-754', ['2⁵³ − 2', '−Infinity']);
});

/* ------------------------------------------------------------------- 17.5 */

const SUMMATION = FloatLab.summationRun({ dataset: 'positive-small', count: 200000, seed: 17 });
const ORDERS = FloatLab.orderSensitivity({ dataset: 'positive-small', count: 200000, seed: 17 });

function summationRow(id) {
  for (let i = 0; i < SUMMATION.rows.length; i += 1) {
    if (SUMMATION.rows[i].id === id) return SUMMATION.rows[i];
  }
  throw new Error('no row ' + id);
}

test('hazards: the data has a full mantissa, so naive summation is genuinely wrong', function () {
  assert.strictEqual(SUMMATION.count, 200001);
  assert.ok(summationRow('naive').relativeError > 1e-12,
    'if this drops to zero the generator has narrowed to 32 significant bits again');
  assert.strictEqual(summationRow('naive').relativeError.toExponential(3), '1.002e-11');
  assert.strictEqual(summationRow('naive').absoluteError.toExponential(3), '1.002e+5');

  prose.quotes('floating-point-hazards', ['1.002e-11', '1.002e+5', '200 001']);
});

test('hazards: pairwise is nearly free and Kahan reaches the floor', function () {
  assert.strictEqual(summationRow('pairwise').relativeError.toExponential(3), '4.329e-15');
  assert.strictEqual(summationRow('pairwise').operations, 202048);
  assert.strictEqual(summationRow('kahan').relativeError.toExponential(3), '7.126e-17');
  assert.strictEqual(summationRow('kahan').operations, 800004);
  assert.strictEqual(summationRow('kahan').sum, summationRow('exact').sum,
    'compensation reaches the double the exact sum rounds to');
  assert.strictEqual(summationRow('exact').absoluteError.toExponential(3), '7.126e-1');

  prose.quotes('floating-point-hazards',
    ['4.329e-15', '202 048', '7.126e-17', '800 004', '7.126e-1']);
});

test('hazards: four orderings give three distinct naive sums and one Kahan sum', function () {
  const naive = {};
  ORDERS.forEach(function (row) { naive[row.id] = Number(row.naiveUlps); });

  assert.strictEqual(naive['as-generated'], 50078);
  assert.strictEqual(naive.ascending, 0, 'smallest first lands on the correctly rounded total');
  assert.strictEqual(naive.descending, 50078);
  assert.strictEqual(naive.shuffled, 41434);

  const distinct = new Set(ORDERS.map(function (row) { return row.naive; }));
  assert.strictEqual(distinct.size, 3);
  ORDERS.forEach(function (row) {
    assert.strictEqual(Number(row.kahanUlps), 0, row.id + ' compensated');
  });

  prose.quotes('floating-point-hazards', ['50 078', '41 434']);
});

test('hazards: the one-pass variance is wrong by five orders of magnitude', function () {
  const rows = {};
  FloatLab.varianceRun({ count: 200000, seed: 17 }).rows.forEach(function (row) {
    rows[row.name] = row;
  });

  assert.strictEqual(rows['sum of squares'].variance.toExponential(8), '2.18103808e+4');
  assert.strictEqual(rows['sum of squares'].relativeError.toExponential(3), '2.619e+5');
  assert.strictEqual(rows['two pass'].variance.toExponential(8), '8.32836041e-2');
  assert.strictEqual(rows['two pass'].relativeError.toExponential(3), '7.010e-11');
  assert.strictEqual(rows.Welford.variance.toExponential(8), '8.32835944e-2');
  assert.strictEqual(rows.Welford.relativeError.toExponential(3), '1.167e-7');
  assert.ok(rows.Welford.relativeError > rows['two pass'].relativeError,
    'Welford is the best one-pass method, not the best method');

  prose.quotes('floating-point-hazards',
    ['2.18103808e+4', '2.619e+5', '8.32836041e-2', '7.010e-11', '8.32835944e-2', '1.167e-7']);
});

test('hazards: the quadratic loses fifteen digits and the rewrite does not', function () {
  const roots = FloatLab.quadraticRoots(1, 1e8, 1);

  assert.strictEqual(roots.naive.toExponential(12), '-7.450580596924e-9');
  assert.strictEqual(roots.stable.toExponential(12), '-1.000000000000e-8');
  assert.strictEqual(roots.naiveResidual.toExponential(3), '2.549e-1');
  assert.strictEqual(roots.stableResidual.toExponential(3), '1.110e-16');
  assert.strictEqual(Number(roots.ulps), 1541029470702650);
  assert.strictEqual(roots.digitsLost, 15);

  prose.quotes('floating-point-hazards',
    ['2.549e-1', '1.110e-16', '1 541 029 470 702 650', '15 significant digits']);
});

test('hazards: absorption at 10^16 begins at half the gap', function () {
  const ladder = FloatLab.absorptionLadder(1e16, [0.5, 1, 1.5, 2]);

  assert.strictEqual(ladder[0].ulp, 2);
  assert.strictEqual(ladder[0].changed, false, 'a quarter of the gap');
  assert.strictEqual(ladder[1].changed, false, 'exactly half, and ties go to the even neighbour');
  assert.strictEqual(ladder[2].changed, true);
  assert.strictEqual(ladder[3].changed, true);

  prose.quotes('floating-point-hazards', ['10¹⁶ + 1', '10¹⁶ + 1.5']);
});

/* ------------------------------------------------------------------- 17.6 */

const DIVERGENCE = FloatLab.ledgerDivergence({ counts: [1000, 10000, 100000, 1000000], seed: 23 });
const RATE = FloatLab.rateApplication({ count: 200000, seed: 23,
  rate: { numerator: 875, denominator: 10000 } });
const POLICIES = FloatLab.policyRun({ count: 200000, seed: 23,
  rate: { numerator: 875, denominator: 10000 } });

test('fixed and decimal: the double ledger never crosses half a cent', function () {
  assert.strictEqual(DIVERGENCE[0].errorCents.toExponential(3), '1.019e-8');
  assert.strictEqual(DIVERGENCE[3].errorCents.toExponential(3), '6.855e-5');

  DIVERGENCE.forEach(function (row) {
    assert.strictEqual(row.crossesHalfCent, false, 'at ' + row.count + ' transactions');
    assert.strictEqual(row.formatsCorrectly, true, 'at ' + row.count + ' transactions');
    assert.strictEqual(row.comparesEqual, false, 'at ' + row.count + ' transactions');
  });

  prose.quotes('fixed-and-decimal', ['1.019e-8', '6.855e-5']);
});

test('fixed and decimal: what it loses is equality, on most ledgers', function () {
  const failures = FloatLab.centRoundingFailures({ trials: 500, count: 500, seed: 23 });

  assert.strictEqual(failures.mismatches, 0, 'the total always formats to the right cent');
  assert.strictEqual(failures.unequal, 442);
  assert.strictEqual((100 * failures.unequalRate).toFixed(1), '88.4');

  prose.quotes('fixed-and-decimal', ['442', '88.4%', '500']);
});

test('fixed and decimal: applying a rate loses cents, and which rates do cannot be predicted', function () {
  assert.strictEqual(RATE.disagreements, 1026);
  assert.strictEqual(RATE.count, 200000);
  assert.strictEqual(RATE.centsApart, -1026);
  assert.strictEqual(POLICIES.ties, 2554);

  const twenty = FloatLab.rateApplication({ count: 200000, seed: 23,
    rate: { numerator: 2000, denominator: 10000 } });
  assert.strictEqual(twenty.disagreements, 0, '20% produces no exact ties at all');

  prose.quotes('fixed-and-decimal', ['1 026', '2 554', '200 000', '20%']);
});

test('fixed and decimal: the policy drifts are the ones the prose reports', function () {
  const byId = {};
  POLICIES.rows.forEach(function (row) { byId[row.id] = row; });

  assert.strictEqual(byId['half-even'].drift.toFixed(2), '177.60');
  assert.strictEqual(byId['half-up'].drift.toFixed(2), '1459.60');
  assert.strictEqual(byId.floor.drift.toFixed(2), '-98677.40');
  assert.strictEqual(byId.ceil.drift.toFixed(2), '98848.60');
  assert.strictEqual(byId.floor.total, byId.truncate.total,
    'floor and truncate agree while every amount is positive');
  assert.strictEqual(Number(byId['half-up'].total - byId['half-even'].total), 1282);
  assert.strictEqual(POLICIES.spread, 197526);

  prose.quotes('fixed-and-decimal',
    ['177.60', '1 459.60', '98 677.40', '98 848.60', '1 282', '197 526']);
});

test('fixed and decimal: an exact rational grows a 293-bit denominator', function () {
  const cost = FloatLab.representationCost({ steps: 200 });

  assert.strictEqual(cost.finalDenominatorBits, 293);
  assert.strictEqual(cost.asDouble.toFixed(6), '6.878031');

  let exact = FixedDecimal.rational(0n, 1n);
  for (let i = 1; i <= 200; i += 1) {
    exact = FixedDecimal.ratAdd(exact, FixedDecimal.rational(1n, BigInt(i)));
  }
  assert.strictEqual(FixedDecimal.ratWidth(exact).denominatorBits, 293);

  prose.quotes('fixed-and-decimal', ['293', '6.878031']);
});
