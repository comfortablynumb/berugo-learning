'use strict';

/**
 * Every figure the M17.1-M17.3 content quotes, recomputed from the modules and
 * then checked against the prose.
 *
 * The section controllers are not imported; the calls below reproduce what they
 * make at their default control settings, which is the contract this suite is
 * really pinning down - if a default moves, the prose is wrong and this fails.
 */

const test = require('node:test');
const assert = require('node:assert');

const IntegerOps = require('../../src/js/algorithms/integer-ops.js');
const BitTricks = require('../../src/js/algorithms/bit-tricks.js');
const Bitset = require('../../src/js/algorithms/bitset.js');
const Lab = require('../../src/js/machines/number-lab.js');

require('../../src/js/content/concepts-numbers.js');
require('../../src/js/content/examples-numbers.js');
const prose = require('../support/worked-example-prose.js');

/* ------------------------------------------------------------------- 17.1 */

test('integer representation: 100 + 100 at int8 overflows without carrying', function () {
  const w8 = IntegerOps.width(8, true);
  const sum = IntegerOps.add(100n, 100n, w8);
  const policies = IntegerOps.policies(sum.exact, w8);

  assert.strictEqual(sum.exact, 200n);
  assert.strictEqual(sum.carry, false);
  assert.strictEqual(sum.overflow, true);
  assert.strictEqual(policies.wrapping, -56n);
  assert.strictEqual(policies.saturating, 127n);
  assert.strictEqual(policies.checked, null);

  prose.quotes('integer-representation', ['200', '−56', '127']);
});

test('integer representation: the multiplication raises both flags', function () {
  const w8 = IntegerOps.width(8, true);
  const product = IntegerOps.mul(100n, 100n, w8);

  assert.strictEqual(product.exact, 10000n);
  assert.strictEqual(product.carry, true);
  assert.strictEqual(product.overflow, true);
  assert.strictEqual(IntegerOps.policies(product.exact, w8).wrapping, 16n);

  prose.quotes('integer-representation', ['10 000', '16']);
});

test('integer representation: the canonical pair of flag disagreements', function () {
  const w8 = IntegerOps.width(8, true);
  const carryOnly = IntegerOps.add(255n, 1n, w8);
  const overflowOnly = IntegerOps.add(127n, 1n, w8);

  assert.deepStrictEqual([carryOnly.carry, carryOnly.overflow], [true, false]);
  assert.deepStrictEqual([overflowOnly.carry, overflowOnly.overflow], [false, true]);

  prose.quotes('integer-representation', ['0xFF + 0x01', '0x7F + 0x01']);
});

test('integer representation: the asymmetry, as counts', function () {
  const asymmetry = IntegerOps.asymmetry(IntegerOps.width(8, true));

  assert.strictEqual(asymmetry.negatives, 128n);
  assert.strictEqual(asymmetry.positives, 127n);
  assert.strictEqual(asymmetry.negatedMin, -128n);

  prose.quotes('integer-representation', ['128 negatives against 127 positives', '−128']);
});

test('integer representation: the byte order the demo reports', function () {
  const trip = IntegerOps.endianRoundTrip(0x12345678n, IntegerOps.width(32, false));

  assert.strictEqual(trip.littleReadAsBig, 2018915346n);
  assert.strictEqual(trip.bigReadAsLittle, 2018915346n);
  assert.strictEqual(IntegerOps.endianRoundTrip(100n, IntegerOps.width(8, false)).agree, true);

  prose.quotes('integer-representation', ['2 018 915 346']);
});

test('integer representation: every coercion row is the value the prose names', function () {
  const rows = {};
  Lab.coercionTable().forEach(function (row) { rows[row.expression] = row.value; });

  assert.strictEqual(rows['1 << 31'], -2147483648);
  assert.strictEqual(rows['1 << 32'], 1);
  assert.strictEqual(rows['4294967296 | 0'], 0);
  assert.strictEqual(rows['-1 >>> 0'], 4294967295);
  assert.strictEqual(rows['~~3.7'], 3);
  assert.strictEqual(rows['(2 ** 53) + 1 === 2 ** 53'], true);

  prose.quotes('integer-representation',
    ['−2147483648', '4 294 967 295', '(2**53) + 1 === 2**53']);
});

test('integer representation: sixteen bits leaves the stated headroom for +/- 2 000', function () {
  const w16 = IntegerOps.width(16, true);

  assert.strictEqual(w16.min, -32768n);
  assert.strictEqual(w16.max, 32767n);
  assert.strictEqual(Number(w16.max - 2000n), 30767);
  assert.strictEqual(Math.round((2000 / 32768) * 100), 6, 'about 6% of the range');

  prose.quotes('integer-representation', ['−32 768 … 32 767', '30 768', '6%', '94%']);
});

/* ------------------------------------------------------------------- 17.2 */

const SWEEP = Lab.trickSweep({ wideSamples: 20000 });

function trickRow(id) {
  for (let i = 0; i < SWEEP.length; i += 1) {
    if (SWEEP[i].id === id) return SWEEP[i];
  }
  throw new Error('no trick ' + id);
}

test('bit manipulation: the sweep checks 85 536 inputs and disagrees nowhere', function () {
  SWEEP.forEach(function (row) {
    assert.strictEqual(row.checked, 85536, row.id + ' input count');
    assert.strictEqual(row.disagreements, 0, row.id + ' disagreements');
  });

  prose.quotes('bit-manipulation', ['85 536', '65 536', '20 000']);
});

test('bit manipulation: SWAR popcount is 12 against 96, everywhere', function () {
  const row = trickRow('popcount');

  assert.strictEqual(row.fastMean, 12);
  assert.strictEqual(row.slowMean, 96);
  assert.strictEqual(row.fastWorst, 12);
  assert.strictEqual(row.slowWorst, 96);
  assert.strictEqual(row.saving.toFixed(2), '8.00');

  prose.quotes('bit-manipulation', ['12 operations', '96', '8.00×']);
});

test('bit manipulation: the bit scan loses on the mean and wins in the tail', function () {
  const row = trickRow('ctz');

  /* Not exactly 5: ctz of zero short-circuits at one operation, and zero is
     one of the 85 536 inputs. The prose quotes the rounded figure, so the
     test rounds the same way rather than asserting a value nobody wrote. */
  assert.strictEqual(row.fastMean.toFixed(2), '5.00');
  assert.strictEqual(row.slowMean.toFixed(2), '4.00');
  assert.strictEqual(row.saving.toFixed(2), '0.80');
  assert.strictEqual(row.fastWorst, 5);
  assert.strictEqual(row.slowWorst, 46);
  assert.strictEqual(row.worstSaving.toFixed(2), '9.20');

  prose.quotes('bit-manipulation', ['5.00 against 4.00', '0.80×', '9.20×', '5 against 46']);
});

test('bit manipulation: Kernighan sits between the two on the mean', function () {
  const row = trickRow('popcount-kernighan');

  assert.strictEqual(row.fastMean.toFixed(2), '29.59');
  assert.strictEqual(row.fastWorst, 78);

  prose.quotes('bit-manipulation', ['29.59', '78']);
});

test('bit manipulation: the SWAR trace of 0xDEADBEEF is the one the prose shows', function () {
  const stages = Lab.popcountTrace(0xdeadbeef);
  const hex = stages.map(function (stage) { return stage.hex.toUpperCase(); });

  assert.strictEqual(hex[1], '0X9959699A');
  assert.strictEqual(hex[2], '0X33233334');
  assert.strictEqual(hex[3], '0X06050607');
  assert.strictEqual(BitTricks.popcountSwar(0xdeadbeef).count, 24);
  assert.strictEqual(6 + 5 + 6 + 7, 24, 'the four byte counters sum to the answer');

  prose.quotes('bit-manipulation', ['0x9959699A', '0x33233334', '0x06050607', '24']);
});

test('bit manipulation: every identity holds over 20 001 inputs including zero', function () {
  const rows = Lab.identityChecks(20000, 5);

  rows.forEach(function (row) {
    assert.strictEqual(row.failures, 0, row.name);
    assert.strictEqual(row.samples, 20001);
  });
  assert.strictEqual(rows.length, 7);

  prose.quotes('bit-manipulation', ['20 001']);
});

/* ------------------------------------------------------------------- 17.3 */

const UNIVERSE = 1000000;
const crossover = Lab.crossoverDensity(UNIVERSE);

test('bitsets: the crossing density is solved, not sampled', function () {
  assert.strictEqual(crossover.bitsetBytes, 125000);
  assert.strictEqual(crossover.bytesPerEntry, 32);
  assert.strictEqual(crossover.population, 3906.25);
  assert.strictEqual((100 * crossover.density).toFixed(3), '0.391');

  prose.quotes('bitsets-and-swar', ['125 000 bytes', '122.1 KB', '3 906', '0.391%', '32 bytes']);
});

test('bitsets: the density sweep brackets the crossing', function () {
  const rows = Lab.densitySweep(UNIVERSE, [0.5, 0.1, 0.01, 0.001]);

  assert.strictEqual(rows[0].ratio.toFixed(2), '128.00');
  assert.strictEqual(rows[1].ratio.toFixed(2), '25.60');
  assert.strictEqual(rows[3].ratio.toFixed(2), '0.26');
  assert.strictEqual(rows[3].bitsetWins, false, 'below the crossing the Set is smaller');

  prose.quotes('bitsets-and-swar', ['128.00×', '0.26×']);
});

test('bitsets: word operations cost the universe whatever the answer is', function () {
  const rows = Lab.setOperationRun({ universe: UNIVERSE, population: 20000, seed: 11 });
  const byName = {};
  rows.forEach(function (row) { byName[row.operation] = row; });

  assert.strictEqual(byName.intersect.size, 417);
  assert.strictEqual(byName.union.size, 39583);
  assert.strictEqual(byName.difference.size, 19583);
  rows.forEach(function (row) {
    assert.strictEqual(row.wordsTouched, 31250, row.operation + ' words');
    assert.strictEqual(row.disagreements, 0, row.operation + ' against a real Set');
  });

  prose.quotes('bitsets-and-swar', ['31 250 words', '417', '39 583', '19 583', '20 000 probes']);
});

test('bitsets: iterating the population beats scanning the universe', function () {
  const cost = Lab.iterationCost(UNIVERSE, 20000, 13);

  assert.strictEqual(cost.slowSteps, 1000000);
  assert.strictEqual(cost.fastSteps, 51031);
  assert.strictEqual(cost.saving.toFixed(1), '19.6');
  assert.strictEqual(cost.agree, true);

  prose.quotes('bitsets-and-swar', ['51 031', '1 000 000', '19.6×']);
});

test('bitsets: the sieve writes the same marks either way', function () {
  const sieve = Lab.sieveComparison(1000000);

  assert.strictEqual(sieve.primes, 78498);
  assert.strictEqual(sieve.composites, 921501);
  assert.strictEqual(sieve.bitWrites, 2122048);
  assert.strictEqual(sieve.setWrites, sieve.bitWrites, 'it is the same algorithm');
  assert.strictEqual(sieve.ratio.toFixed(1), '235.9');

  prose.quotes('bitsets-and-swar', ['921 501', '2 122 048', '235.9×', '122.1 KB', '28.1 MB']);
});

test('bitsets: a knight from d4 is 16 shift-and-mask operations against a 64-square walk', function () {
  const scene = Lab.bitboardScene({ piece: 'knight', file: 3, rank: 3,
    blockers: [{ file: 3, rank: 6 }] });

  assert.strictEqual(scene.squares, 8);
  assert.strictEqual(scene.operations, 16);
  assert.strictEqual(scene.referenceOperations, 64);
  assert.strictEqual(scene.disagreements, 0);
  assert.strictEqual(Bitset.boardPopcount(Bitset.knightAttacks(Bitset.square(0, 0))), 2,
    'a knight in the corner reaches two squares, which is what the masks are for');

  prose.quotes('bitsets-and-swar', ['16 shift-and-mask operations', '64-square walk']);
});
