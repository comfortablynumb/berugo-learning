'use strict';

/**
 * Every figure the M12.1-M12.4 worked examples quote, recomputed.
 *
 * Each figure is asserted twice: recomputed from the module at the section's
 * own default control values, and asserted to still appear in the section's
 * prose. Moving a number without moving the sentence fails the build.
 *
 * Three of these constants were wrong when first written and were caught by
 * the graded exercises rather than by review - C(24, 12), the count of
 * two-digit numbers with no equal adjacent digits, and whether 1000 qualifies
 * at all - which is the argument for recomputing rather than quoting.
 */

const test = require('node:test');
const assert = require('node:assert');

const prose = require('../support/worked-example-prose.js');
const quotes = prose.quotes;
const fixed = prose.fixed;

const DpLab = require('../../src/js/machines/dp-lab.js');
const DpClassic = require('../../src/js/algorithms/dp-classic.js');
const DpKnapsack = require('../../src/js/algorithms/dp-knapsack.js');
const DpSequence = require('../../src/js/algorithms/dp-sequence.js');
const Random = require('../../src/js/utils/random.js');
require('../../src/js/content/examples-dp.js');
require('../../src/js/content/concepts-dp.js');

/* -------------------------------------------------- 12.1 what-dp-is */

const fibonacci = DpLab.compare(DpLab.fibonacciProblem(), 25,
  { states: DpLab.fibonacciStates(25) });

test('what-dp-is: the three evaluations of Fibonacci at n = 25', function () {
  const naive = fibonacci.rows[0];
  const memo = fibonacci.rows[1];
  const table = fibonacci.rows[2];

  assert.strictEqual(naive.calls, 242785);
  assert.strictEqual(naive.transitions, 242784);
  assert.strictEqual(memo.calls, 49);
  assert.strictEqual(memo.states, 26);
  assert.strictEqual(memo.transitions, 48);
  assert.strictEqual(memo.hits, 23);
  assert.strictEqual(table.states, 26);
  assert.strictEqual(table.transitions, 48);
  assert.strictEqual(table.unresolved, 0);
  assert.ok(fibonacci.agree, 'the three evaluations must agree');
  assert.strictEqual(memo.value, 75025);

  quotes('what-dp-is', ['242 785', '242 784', '49', '26', '48', '23', '75 025']);
});

test('what-dp-is: the predicted cost bounds the measured one', function () {
  const predicted = DpLab.predictedCost(26, 2);
  assert.strictEqual(predicted.total, 52);
  assert.ok(predicted.total >= fibonacci.rows[1].transitions,
    'the prediction must be an upper bound on the measurement');

  quotes('what-dp-is', ['52']);
});

test('what-dp-is: overlap is 23 of 26 states, and the binomial lattice shares 81 of 120', function () {
  assert.strictEqual(DpLab.dependencyDag(fibonacci.memo, {}).shared, 23);

  const binomial = DpLab.compare(DpLab.binomialProblem(), [20, 10],
    { states: DpLab.binomialStates(20, 10) });
  assert.strictEqual(binomial.rows[0].calls, 369511);
  assert.strictEqual(binomial.rows[1].states, 120);
  assert.strictEqual(binomial.rows[2].states, 176);
  assert.strictEqual(binomial.rows[1].value, 184756);
  assert.strictEqual(DpLab.dependencyDag(binomial.memo, {}).shared, 81);

  quotes('what-dp-is', ['23', '369 511', '120', '176', '184 756', '81']);
});

/* The failure that returns a number rather than raising. */
test('what-dp-is: the reversed tabulation returns 0 from 48 unwritten reads', function () {
  const states = DpLab.fibonacciStates(25);
  const backwards = DpLab.tabulated(DpLab.fibonacciProblem(), states.slice().reverse(),
    { target: 25 });

  assert.strictEqual(backwards.value, 0);
  assert.strictEqual(backwards.unresolved.length, 48);
  assert.strictEqual(backwards.report.states, 26);
  assert.strictEqual(backwards.report.transitions, 48);

  quotes('what-dp-is', ['48', '26', '0']);
});

/* -------------------------------------------------- 12.2 one-dimensional-dp */

function sequence(count, seed, spread) {
  const random = Random.seeded(seed);
  const values = [];

  for (let i = 0; i < count; i += 1) values.push(random.int(spread));
  return values;
}

const oneDimensional = sequence(2000, 3, 1000);

test('one-dimensional-dp: LIS at 175x fewer transitions for the same length of 85', function () {
  const quadratic = DpClassic.lisQuadratic(oneDimensional, {});
  const patience = DpClassic.lisPatience(oneDimensional, {});

  assert.strictEqual(quadratic.length, 85);
  assert.strictEqual(patience.length, 85);
  assert.strictEqual(quadratic.report.transitions, 1999000);
  assert.strictEqual(quadratic.report.transitions, 2000 * 1999 / 2);
  assert.strictEqual(patience.report.transitions, 11411);
  assert.strictEqual(fixed(quadratic.report.transitions / patience.report.transitions, 0), '175');

  quotes('one-dimensional-dp', ['85', '1 999 000', '11 411', '175']);
});

test('one-dimensional-dp: both reconstructions are subsequences and the piles are not', function () {
  const quadratic = DpClassic.lisQuadratic(oneDimensional, {});
  const patience = DpClassic.lisPatience(oneDimensional, {});

  assert.ok(DpClassic.isSubsequence(quadratic.sequence, oneDimensional));
  assert.ok(DpClassic.isSubsequence(patience.sequence, oneDimensional));
  assert.ok(!DpClassic.isSubsequence(patience.piles, oneDimensional),
    'the piles must NOT be a subsequence, or the example demonstrates nothing');

  assert.deepStrictEqual(patience.piles.slice(0, 4), [0, 3, 6, 8]);
  assert.deepStrictEqual(patience.sequence.slice(0, 4), [1, 5, 11, 18]);

  quotes('one-dimensional-dp', ['0, 3, 6, 8', '1, 5, 11, 18']);
});

test('one-dimensional-dp: coin change counts 4 and 9, then 29 and 26 547', function () {
  const coins = [1, 2, 5];
  const rows = [{ amount: 5, combinations: 4, permutations: 9 },
    { amount: 11, combinations: 11, permutations: 218 },
    { amount: 20, combinations: 29, permutations: 26547 }];

  rows.forEach(function (row) {
    assert.strictEqual(DpClassic.coinChangeWays(coins, row.amount, {}).ways, row.combinations,
      'combinations at ' + row.amount);
    assert.strictEqual(DpClassic.coinChangeWays(coins, row.amount, { order: 'permutations' }).ways,
      row.permutations, 'permutations at ' + row.amount);
    assert.strictEqual(DpClassic.coinWaysBruteForce(coins, row.amount), row.combinations,
      'enumeration agrees with combinations at ' + row.amount);
  });
  assert.deepStrictEqual(DpClassic.coinChangeMin(coins, 20, {}).coins, [5, 5, 5, 5]);

  quotes('one-dimensional-dp', ['4', '9', '29', '26 547']);
});

test('one-dimensional-dp: Kadane measures 502 781 over the whole re-centred sequence', function () {
  const signed = oneDimensional.map(function (v) { return v - Math.floor(v / 2); });
  const run = DpClassic.maxSubarray(signed, {});

  assert.strictEqual(run.value, 502781);
  assert.strictEqual(run.from, 0);
  assert.strictEqual(run.to, 1999);
  assert.strictEqual(DpClassic.maxSubarrayNaive(signed).value, run.value);

  quotes('one-dimensional-dp', ['502 781']);
});

/* -------------------------------------------------- 12.3 knapsack-family */

function knapsackInstance() {
  const random = Random.seeded(5);
  const items = [];

  for (let i = 0; i < 12; i += 1) {
    items.push({ id: i, value: 10 + random.int(90), weight: 2 + random.int(18) });
  }
  return { items: items, capacity: 60 };
}

test('knapsack-family: 793 cells give 571, and the chosen set re-sums to it', function () {
  const instance = knapsackInstance();
  const full = DpKnapsack.knapsack01(instance.items, instance.capacity, {});
  const rolling = DpKnapsack.knapsack01Rolling(instance.items, instance.capacity, {});

  assert.strictEqual(full.report.cells, 793);
  assert.strictEqual(full.report.cells, 13 * 61);
  assert.strictEqual(full.value, 571);
  assert.strictEqual(DpKnapsack.bruteForce(instance.items, instance.capacity).value, 571);
  assert.strictEqual(full.chosen.length, 8);

  const check = DpKnapsack.verify(instance.items, instance.capacity, full.chosen, full.value);
  assert.strictEqual(check.weight, 59);
  assert.strictEqual(check.value, 571);
  assert.ok(check.fits && check.matches);

  assert.strictEqual(rolling.report.cells, 61);
  assert.strictEqual(rolling.value, 571);
  assert.strictEqual(rolling.chosen, null);

  quotes('knapsack-family', ['793', '571', '59', '60', '61']);
});

test('knapsack-family: the three bounded expansions agree at 910', function () {
  const instance = knapsackInstance();
  const items = instance.items.slice(0, 6).map(function (item) {
    return { value: item.value, weight: item.weight, count: 40 };
  });
  const naive = DpKnapsack.boundedNaive(items, 60, {});
  const binary = DpKnapsack.boundedBinary(items, 60, {});
  const queue = DpKnapsack.boundedQueue(items, 60, {});

  assert.strictEqual(naive.value, 910);
  assert.strictEqual(binary.value, 910);
  assert.strictEqual(queue.value, 910);
  assert.strictEqual(naive.expanded, 240);
  assert.strictEqual(binary.expanded, 36);
  assert.strictEqual(queue.expanded, 6);
  assert.strictEqual(naive.report.transitions, 11800);
  assert.strictEqual(binary.report.transitions, 621);
  assert.strictEqual(queue.report.transitions, 366);

  quotes('knapsack-family', ['910', '240', '36', '11 800', '621', '366']);
});

test('knapsack-family: one extra digit on the capacity is ten times the table', function () {
  const rows = [{ capacity: 10, bits: 4, cells: 132 }, { capacity: 100, bits: 7, cells: 1212 },
    { capacity: 1000, bits: 10, cells: 12012 }, { capacity: 10000, bits: 14, cells: 120012 },
    { capacity: 100000, bits: 17, cells: 1200012 }];

  rows.forEach(function (row) {
    const cost = DpKnapsack.bitCost(12, row.capacity);
    assert.strictEqual(cost.bits, row.bits, 'bits at capacity ' + row.capacity);
    assert.strictEqual(cost.cells, row.cells, 'cells at capacity ' + row.capacity);
  });
  assert.strictEqual(fixed(rows[4].bits / rows[0].bits, 2), '4.25');
  assert.strictEqual(Math.round(rows[4].cells / rows[0].cells), 9091);

  quotes('knapsack-family', ['132', '1 212', '1 200 012', '4', '7', '17', '4.25', '9 091']);
});

test('knapsack-family: the weights total 109 and cannot be split evenly', function () {
  const instance = knapsackInstance();
  const weights = instance.items.map(function (item) { return item.weight; });
  const partition = DpKnapsack.equalPartition(weights, {});

  assert.strictEqual(partition.total, 109);
  assert.strictEqual(partition.bestHalf, 54);
  assert.strictEqual(partition.difference, 1);
  assert.strictEqual(partition.equal, false);

  quotes('knapsack-family', ['109', '54', '1']);
});

/* -------------------------------------------------- 12.4 sequence-alignment */

test('sequence-alignment: kitten to sitting is 3, in seven columns', function () {
  const full = DpSequence.editDistance('kitten', 'sitting', {});

  assert.strictEqual(full.distance, 3);
  assert.strictEqual(DpSequence.editDistanceBruteForce('kitten', 'sitting'), 3);
  assert.strictEqual(full.report.peakCells, 56);
  assert.strictEqual(full.report.peakCells, 7 * 8);
  assert.strictEqual(full.alignment.top, 'kitten-');
  assert.strictEqual(full.alignment.bottom, 'sitting');

  const check = DpSequence.checkAlignment('kitten', 'sitting', full.alignment);
  assert.ok(check.valid);
  assert.strictEqual(check.columns, 7);
  assert.strictEqual(DpSequence.alignmentCost(full.alignment, {}), 3);

  quotes('sequence-alignment', ['3', '56', '7']);
});

test('sequence-alignment: Hirschberg matches at 16 peak cells and five splits', function () {
  const rows = DpSequence.editDistanceRows('kitten', 'sitting', {});
  const linear = DpSequence.hirschberg('kitten', 'sitting', {});

  assert.strictEqual(rows.distance, 3);
  assert.strictEqual(rows.report.peakCells, 16);
  assert.strictEqual(rows.alignment, undefined,
    'the two-row variant must not offer an alignment at all');

  assert.strictEqual(linear.distance, 3);
  assert.strictEqual(linear.report.peakCells, 16);
  assert.strictEqual(linear.report.splits, 5);
  assert.ok(DpSequence.checkAlignment('kitten', 'sitting', linear.alignment).valid);

  quotes('sequence-alignment', ['16', '5']);
});

test('sequence-alignment: the memory ratio at 600 and 2 000 characters a side', function () {
  [{ n: 600, full: 361201, linear: 1202, ratio: '300.5' },
    { n: 2000, full: 4004001, linear: 4002, ratio: '1 000.5' }].forEach(function (row) {
    assert.strictEqual((row.n + 1) * (row.n + 1), row.full, 'full cells at ' + row.n);
    assert.strictEqual(2 * (row.n + 1), row.linear, 'linear cells at ' + row.n);
    assert.strictEqual(prose.grouped(Math.floor(row.full / row.linear)) + '.5', row.ratio,
      'ratio at ' + row.n);
  });

  quotes('sequence-alignment', ['361 201', '1 202', '300.5', '4 004 001', '4 002', '1 000.5']);
});

test('sequence-alignment: the LCS of abcabba and cbabac is "baba", and the diff follows', function () {
  const lcs = DpSequence.longestCommonSubsequence('abcabba', 'cbabac', {});
  assert.strictEqual(lcs.length, 4);
  assert.strictEqual(lcs.sequence, 'baba');

  const script = DpSequence.diffScript('abcabba', 'cbabac');
  const counts = { keep: 0, add: 0, remove: 0 };

  script.forEach(function (step) { counts[step.op] += 1; });
  assert.strictEqual(counts.keep, 4);
  assert.strictEqual(counts.add, 2);
  assert.strictEqual(counts.remove, 3);
  assert.strictEqual(script.length, 9);

  quotes('sequence-alignment', ['baba', '4', '2', '3']);
});

test('sequence-alignment: global 12, local 12 and affine 6 on the same pair', function () {
  const global = DpSequence.alignScored('ACACACTA', 'AGCACACA', {});
  const local = DpSequence.alignScored('ACACACTA', 'AGCACACA', { mode: 'local' });
  const affine = DpSequence.alignAffine('ACACACTA', 'AGCACACA', {});

  assert.strictEqual(global.score, 12);
  assert.strictEqual(local.score, 12);
  assert.strictEqual(affine.score, 6);
  assert.deepStrictEqual(local.at, { i: 8, j: 8 });

  assert.strictEqual(DpSequence.editDistance('ab', 'ba', {}).distance, 2);
  assert.strictEqual(DpSequence.editDistance('ab', 'ba', { costs: { transpose: 1 } }).distance, 1);

  quotes('sequence-alignment', ['12', '6', '8', '2', '1']);
});
