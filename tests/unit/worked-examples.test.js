'use strict';

/**
 * Worked examples state figures. This suite recomputes them independently, so
 * editing a setup without editing the arithmetic fails the build rather than
 * teaching a wrong number.
 *
 * The rule for adding a worked example: every number in a `result` or `answer`
 * that can be derived must be derived here from the example's own `setup`.
 */

const test = require('node:test');
const assert = require('node:assert');

const registries = require('../../src/js/content/registries.js');
require('../../src/js/content/examples-platform.js');

function example(sectionId, index) {
  const entries = registries.ExampleRegistry.get(sectionId);
  assert.ok(entries && entries[index], 'missing worked example ' + sectionId + '#' + index);
  return entries[index];
}

function stepText(entry, index) {
  return entry.steps[index].work + '\n' + (entry.steps[index].result || '');
}

test('code-engine: the quadratic comparison count is n(n-1)/2 for n = 20000', function () {
  const entry = example('code-engine', 0);
  const n = 20000;
  const comparisons = (n * (n - 1)) / 2;

  assert.strictEqual(comparisons, 199990000);
  assert.match(entry.steps[0].work, /20000 × 19999 \/ 2/);
  assert.match(entry.steps[0].work, /199,990,000/, 'the stated count matches n(n-1)/2');
});

test('code-engine: the time estimate follows from the stated 2 ns per comparison', function () {
  const entry = example('code-engine', 0);
  const nanoseconds = 199990000 * 2;
  const seconds = nanoseconds / 1e9;

  assert.strictEqual(nanoseconds, 399980000);
  assert.ok(Math.abs(seconds - 0.4) < 0.001);
  assert.match(stepText(entry, 1), /399,980,000 ns/);
  assert.match(stepText(entry, 1), /0\.40/);
});

test('code-engine: the effective per-comparison cost implied by the budget', function () {
  const entry = example('code-engine', 0);
  const budgetNs = 1.2 * 1e9;
  const perComparison = budgetNs / 199990000;

  assert.ok(perComparison > 6 && perComparison < 6.1, 'implied cost is just over 6 ns');
  assert.match(stepText(entry, 2), /> 6 ns/);
});

test('code-engine: the linear/quadratic ratio is 10 000x', function () {
  const entry = example('code-engine', 0);
  const ratio = 199990000 / 20000;

  assert.ok(Math.abs(ratio - 10000) < 1, 'ratio is ' + ratio.toFixed(1));
  assert.match(stepText(entry, 3), /10,000×/);
  assert.match(entry.answer, /10 000×/);
});

test('js-systems: the stated bit pattern really is 1.5', function () {
  const entry = example('js-systems', 0);
  const view = new DataView(new ArrayBuffer(8));

  // The setup lists the little-endian bytes: 00 00 00 00 00 00 F8 3F.
  [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf8, 0x3f].forEach(function (byte, i) {
    view.setUint8(i, byte);
  });

  assert.strictEqual(view.getFloat64(0, true), 1.5);
  assert.strictEqual(view.getBigUint64(0, true).toString(16).toUpperCase(), '3FF8000000000000');
  assert.match(entry.steps[0].work, /0x3FF8000000000000/);
});

test('js-systems: the field decomposition matches the bits', function () {
  const entry = example('js-systems', 0);
  const bits = BigInt('0x3FF8000000000000');
  const sign = Number((bits >> 63n) & 1n);
  const exponent = Number((bits >> 52n) & 0x7ffn);
  const mantissa = bits & 0xfffffffffffffn;

  assert.strictEqual(sign, 0);
  assert.strictEqual(exponent, 1023);
  assert.strictEqual(mantissa, BigInt(Math.pow(2, 51)));
  assert.strictEqual((1 + Number(mantissa) / Math.pow(2, 52)) * Math.pow(2, exponent - 1023), 1.5);
  assert.match(stepText(entry, 2), /1\.5/);
});

test('js-systems: the ulp figures are right at 1.5 and at 2^53', function () {
  const entry = example('js-systems', 0);
  const ulpAt1p5 = Math.pow(2, -52);
  const ulpAt2p53 = Math.pow(2, 53 - 1023 - 52 + 1023);

  assert.ok(Math.abs(ulpAt1p5 - 2.220446049250313e-16) < 1e-30);
  assert.match(stepText(entry, 3), /2\.22 × 10⁻¹⁶/);

  assert.strictEqual(ulpAt2p53, 2);
  assert.strictEqual(Math.pow(2, 53) + 1, Math.pow(2, 53), 'the consequence the example claims');
  assert.match(stepText(entry, 4), /ulp = 2\^\(53 − 52\) = 2/);
  assert.match(entry.answer, /2⁵³ − 1/);
});

test('js-systems: MAX_SAFE_INTEGER is exactly the value the example names', function () {
  assert.strictEqual(Number.MAX_SAFE_INTEGER, Math.pow(2, 53) - 1);
  assert.strictEqual(Number.MAX_SAFE_INTEGER, 9007199254740991);
});

/* ---------------------------------------------- code-engine, second example */

test('code-engine: binary search really costs ceil(log2 n) + 1 across the whole range', function () {
  const entry = example('code-engine', 1);
  const counts = [1024, 4096, 65536].map(function (n) { return Math.ceil(Math.log2(n)) + 1; });

  assert.deepStrictEqual(counts, [11, 13, 17]);
  assert.match(entry.steps[0].work, /10 \+ 1 = 11 comparisons/);
  assert.match(entry.steps[0].work, /12 \+ 1 = 13/);
  assert.match(entry.steps[0].work, /16 \+ 1 = 17/);
  assert.strictEqual(65536 / 1024, 64, 'the "64x more data" claim');
  assert.strictEqual(17 - 11, 6, 'costs 6 more comparisons');
});

test('code-engine: the linear scan figures and the 315x ratio', function () {
  const entry = example('code-engine', 1);
  const n = 4096;

  assert.strictEqual((n + 1) / 2, 2048.5, 'average hit position');
  assert.strictEqual(Math.round(n / 13), 315, 'ratio to binary search');
  assert.match(entry.steps[1].work, /2,048\.5/);
  assert.match(entry.steps[1].work, /4096 \/ 13 = 315×/);
});

test('code-engine: a budget of 20 accepts binary search and stops the scan at 0.49%', function () {
  const entry = example('code-engine', 1);

  assert.ok(17 <= 20, 'binary search at 65 536 fits');
  assert.strictEqual(20 - 17, 3, 'three spare');
  assert.strictEqual((20 / 4096 * 100).toFixed(2), '0.49', 'fraction of the array inspected');
  assert.match(entry.steps[2].work, /17 of 20 used, 3 spare/);
  assert.match(entry.steps[2].work, /0\.49% of the array/);
});

test('code-engine: two comparisons per halving needs 33, and 33 still separates', function () {
  const entry = example('code-engine', 1);
  const twoWay = 2 * Math.ceil(Math.log2(65536)) + 1;

  assert.strictEqual(twoWay, 33);
  assert.ok(twoWay > 20, 'which is why the budget of 20 rejects it');
  assert.strictEqual(Math.round(4096 / twoWay), 124, 'margin against the linear scan');
  assert.match(entry.steps[3].work, /2 × 16 \+ 1 = 33/);
  assert.match(entry.steps[3].work, /4096 \/ 33 = 124×/);
  assert.match(entry.answer, /124× margin/);
});

test('code-engine: the wall clock bounds an uninstrumented loop at ~6e8 iterations', function () {
  const entry = example('code-engine', 1);
  const iterations = 1.2 / 2e-9;

  assert.ok(Math.abs(iterations - 6e8) < 1, 'iterations at 2 ns each in a 1.2 s budget');
  assert.match(entry.steps[4].work, /6 × 10⁸ iterations/);
});

/* ----------------------------------------------- js-systems, second example */

/** The exact decimal value of a double, as a string, to `places` digits. */
function exactDecimal(value, places) {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  const bits = (BigInt(view.getUint32(0)) << 32n) | BigInt(view.getUint32(4));
  const exponent = Number((bits >> 52n) & 0x7ffn) - 1075;
  const mantissa = (1n << 52n) | (bits & 0xfffffffffffffn);

  const numerator = exponent >= 0 ? mantissa << BigInt(exponent) : mantissa;
  const denominator = exponent >= 0 ? 1n : 1n << BigInt(-exponent);
  const scaled = (numerator * 10n ** BigInt(places)) / denominator;
  const digits = scaled.toString().padStart(places + 1, '0');
  return digits.slice(0, digits.length - places) + '.' + digits.slice(digits.length - places);
}

function bitsOf(value) {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  return view.getBigUint64(0).toString(16).toUpperCase().padStart(16, '0');
}

test('js-systems: the three bit patterns in the setup are the real ones', function () {
  const entry = example('js-systems', 1);

  assert.strictEqual(bitsOf(0.1), '3FB999999999999A');
  assert.strictEqual(bitsOf(0.2), '3FC999999999999A');
  assert.strictEqual(bitsOf(0.3), '3FD3333333333333');
  assert.strictEqual(bitsOf(0.1 + 0.2), '3FD3333333333334');
  assert.match(entry.setup, /0x3FB999999999999A/);
  assert.match(entry.setup, /0x3FD3333333333333/);
});

test('js-systems: the stored values of 0.1 and 0.2, and their errors', function () {
  const entry = example('js-systems', 1);

  assert.ok(exactDecimal(0.1, 40).startsWith('0.1000000000000000055511151231257827'));
  assert.ok(exactDecimal(0.2, 40).startsWith('0.2000000000000000111022302462515654'));
  assert.match(entry.steps[0].work, /0\.1000000000000000055511151231257827/);
  assert.match(entry.steps[1].work, /0\.2000000000000000111022302462515654/);

  /* The stored 0.2 is exactly twice the stored 0.1 - same mantissa, exponent one
     larger - so whatever the error in 0.1 is, the error in 0.2 is double it. */
  assert.strictEqual(bitsOf(0.1).slice(3), bitsOf(0.2).slice(3), 'same mantissa');
  assert.strictEqual(parseInt(bitsOf(0.2).slice(0, 3), 16) - parseInt(bitsOf(0.1).slice(0, 3), 16), 1,
    'exponent one larger');
  assert.strictEqual(2 * 0.1, 0.2, 'so doubling is exact here');

  const errorInTenth = Number(exactDecimal(0.1, 40).slice(3)) / 1e40;
  assert.strictEqual(errorInTenth.toPrecision(4), '5.551e-18', 'the error the example quotes');
  assert.match(entry.steps[0].work, /\+5\.551 × 10⁻¹⁸/);
  assert.match(entry.steps[1].work, /exactly 2 × the error in 0\.1/);
});

test('js-systems: the exact sum lands on an exact tie, and ties go to the even mantissa', function () {
  const entry = example('js-systems', 1);

  function parts(value) {
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, value);
    const bits = (BigInt(view.getUint32(0)) << 32n) | BigInt(view.getUint32(4));
    return { mantissa: (1n << 52n) | (bits & 0xfffffffffffffn), exponent: Number((bits >> 52n) & 0x7ffn) - 1075 };
  }

  const a = parts(0.1);
  const b = parts(0.2);
  const scale = Math.min(a.exponent, b.exponent);
  const sum = (a.mantissa << BigInt(a.exponent - scale)) + (b.mantissa << BigInt(b.exponent - scale));

  const lower = parts(0.3);
  const upper = parts(0.1 + 0.2);
  const lowerScaled = lower.mantissa << BigInt(lower.exponent - scale);
  const upperScaled = upper.mantissa << BigInt(upper.exponent - scale);

  assert.strictEqual(sum - lowerScaled, upperScaled - sum, 'the exact sum is equidistant');
  assert.strictEqual(lower.mantissa % 2n, 1n, 'the lower neighbour has an odd mantissa');
  assert.strictEqual(upper.mantissa % 2n, 0n, 'the upper neighbour is the even one');
  assert.strictEqual(0.1 + 0.2, 0.30000000000000004, 'so this is the answer');

  assert.ok(exactDecimal(0.3, 40).startsWith('0.2999999999999999888977697537484345'));
  assert.ok(exactDecimal(0.1 + 0.2, 40).startsWith('0.3000000000000000444089209850062616'));
  assert.match(entry.steps[2].work, /0\.3000000000000000166533453693773481/);
  assert.match(entry.steps[3].work, /an exact tie/);
  assert.match(entry.steps[3].work, /0\.30000000000000004/);
});

test('js-systems: the tolerance figures, and why an absolute epsilon stops working', function () {
  const entry = example('js-systems', 1);

  function nextUp(value) {
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, value);
    view.setBigUint64(0, view.getBigUint64(0) + 1n);
    return view.getFloat64(0);
  }

  const gapAtThird = nextUp(0.3) - 0.3;
  const gapAtBillion = nextUp(1e9) - 1e9;

  assert.strictEqual(gapAtThird, Math.pow(2, -54));
  assert.strictEqual(Number.EPSILON, Math.pow(2, -52));
  assert.strictEqual(gapAtBillion, Math.pow(2, -23));
  assert.strictEqual((gapAtBillion / Number.EPSILON).toPrecision(2), '5.4e+8');

  assert.ok(!(Math.abs(nextUp(1e9) - 1e9) <= Number.EPSILON), 'adjacent doubles fail an absolute epsilon');
  assert.ok(Math.abs(nextUp(1e9) - 1e9) <= Number.EPSILON * 1e9, 'and pass a relative one');

  assert.match(entry.steps[4].work, /2⁻⁵⁴ = 5\.551 × 10⁻¹⁷/);
  assert.match(entry.steps[4].work, /2⁻²³ = 1\.192 × 10⁻⁷ = 5\.4 × 10⁸ × EPSILON/);
  assert.match(entry.answer, /1\.192 × 10⁻⁷/);
});

