'use strict';

/**
 * Every figure the M10.7-M10.10 worked examples quote, recomputed.
 *
 * The two key sets in 10.7 are built exactly as `binary-search-section.js`
 * builds them - uniform is i x 3 and skewed is floor(1.001^i) - and the skewed
 * probe is index 9 000, because the whole point of that row is that
 * interpolation search costs 13 probes there and 1 on the uniform keys. Change
 * the distribution and the section stops demonstrating anything.
 */

const test = require('node:test');
const assert = require('node:assert');

const prose = require('../support/worked-example-prose.js');
const quotes = prose.quotes;

const SortLab = require('../../src/js/machines/sort-lab.js');
const SortOps = require('../../src/js/algorithms/sort-ops.js');
const BinarySearch = require('../../src/js/algorithms/binary-search.js');
const AnswerSearch = require('../../src/js/algorithms/answer-search.js');
const ExternalSort = require('../../src/js/algorithms/external-sort.js');
const Networks = require('../../src/js/algorithms/sorting-networks.js');
require('../../src/js/content/examples-searching.js');
require('../../src/js/content/concepts-searching.js');

/* -------------------------------------------------- 10.7 binary-search */

const mutations = {};
BinarySearch.mutationReport().forEach(function (row) { mutations[row.name] = row; });

function reasonsOf(row) {
  const out = {};
  row.failures.forEach(function (failure) { out[failure.reason] = (out[failure.reason] || 0) + 1; });
  return out;
}

test('binary-search: thirteen probe cases, and how few of them notice each defect', function () {
  const expected = { correct: 0, 'closed-interval': 3, 'lte-probe': 5, 'high-mid-minus-one': 1,
    'low-mid': 6, 'inclusive-loop': 4, 'rounded-mid': 11 };

  Object.keys(expected).forEach(function (name) {
    assert.ok(mutations[name], 'no mutation named ' + name);
    assert.strictEqual(mutations[name].checks, 13, name + ' probe count');
    assert.strictEqual(mutations[name].caught, expected[name], name + ' caught');
  });

  quotes('binary-search', ['caught by 0 of 13', 'caught by 3 of 13', 'caught by 1 of 13',
    'caught by 4 of 13']);
});

test('binary-search: the inclusive loop is caught only by the read past the end', function () {
  assert.deepStrictEqual(reasonsOf(mutations['inclusive-loop']), { 'read past the end': 4 });
  assert.deepStrictEqual(reasonsOf(mutations['closed-interval']), { 'wrong answer': 3 });
  assert.deepStrictEqual(reasonsOf(mutations['high-mid-minus-one']), { 'wrong answer': 1 });

  /* The two loud ones: a hang is the safest failure a binary search has. */
  assert.deepStrictEqual(reasonsOf(mutations['low-mid']), { 'did not terminate': 6 });
  assert.deepStrictEqual(reasonsOf(mutations['rounded-mid']), { 'did not terminate': 11 });

  const interior = mutations['high-mid-minus-one'].failures[0];
  assert.strictEqual(interior.probe, 'target absent, interior');

  quotes('binary-search', ['the only case that catches it: target absent, in the interior',
    'every one of them by the out-of-bounds read, never by a wrong answer']);
});

function keySets() {
  const uniform = [];
  const skewed = [];
  for (let i = 0; i < 10000; i += 1) {
    uniform.push(i * 3);
    skewed.push(Math.floor(Math.pow(1.001, i)));
  }
  return { uniform: uniform, skewed: skewed };
}

function probesFor(variant, array, target) {
  const ops = SortOps.create({});
  if (variant === 'interpolation') return BinarySearch.interpolationSearch(array, target, ops).probes;
  if (variant === 'branchless') BinarySearch.branchlessLowerBound(array, target, ops);
  else if (variant === 'exponential') BinarySearch.exponentialSearch(array, target, ops);
  else BinarySearch.lowerBound(array, target, ops);
  return ops.stats().comparisons;
}

test('binary-search: 13 probes on both distributions, and the bound is 14', function () {
  const data = keySets();
  const uniformTarget = data.uniform[data.uniform.length - 1];
  const skewedTarget = data.skewed[9000];

  assert.strictEqual(Math.ceil(Math.log2(10000)), 14);
  assert.strictEqual(probesFor('plain', data.uniform, uniformTarget), 13);
  assert.strictEqual(probesFor('plain', data.skewed, skewedTarget), 13);

  assert.strictEqual(probesFor('branchless', data.uniform, uniformTarget), 15);
  assert.strictEqual(probesFor('branchless', data.skewed, skewedTarget), 15);
  assert.strictEqual(15, Math.ceil(Math.log2(10000)) + 1);

  quotes('binary-search', ['⌈log₂ 10 000⌉ = 14 is the bound', 'measured: 13 comparisons, on both distributions',
    'branchless: 15 comparisons, on both distributions']);
});

test('binary-search: interpolation search wins on uniform keys and only on uniform keys', function () {
  const data = keySets();

  assert.strictEqual(probesFor('interpolation', data.uniform, data.uniform[data.uniform.length - 1]), 1);
  assert.strictEqual(probesFor('interpolation', data.skewed, data.skewed[9000]), 13);

  const exponential = BinarySearch.exponentialSearch(data.uniform, data.uniform[3], SortOps.create({}));
  assert.strictEqual(exponential.index, 3);
  assert.strictEqual(exponential.bound, 4);
  assert.strictEqual(exponential.from, 2);
  assert.strictEqual(exponential.to, 5);

  quotes('binary-search', ['measured: 1 probe', 'measured: 13 probes',
    'the bound doubles to 4, then searches [2, 5)']);
});

test('binary-search: the midpoint that overflowed java.util.Arrays for nine years', function () {
  const report = BinarySearch.midpointComparison(2000000000, 2100000000);

  assert.strictEqual(report.safe, 2050000000);
  assert.strictEqual(report.bits32, -97483648);
  assert.strictEqual(report.overflows, true);
  assert.strictEqual(2000000000 + ((2100000000 - 2000000000) >> 1), 2050000000);
});

/* -------------------------------------------------- 10.8 searching-the-answer */

function shipFeasible(weights, days) {
  return function (capacity) {
    let used = 1;
    let load = 0;
    for (let i = 0; i < weights.length; i += 1) {
      if (load + weights[i] > capacity) { used += 1; load = 0; }
      load += weights[i];
    }
    return used <= days;
  };
}

test('searching-the-answer: five checks over forty-six candidates', function () {
  const weights = [];
  for (let i = 1; i <= 10; i += 1) weights.push(i);

  const result = AnswerSearch.shipCapacity(weights, 5);
  assert.strictEqual(result.answer, 15);
  assert.strictEqual(result.checks, 5);
  assert.strictEqual(result.low, 10);
  assert.strictEqual(result.high, 55);
  assert.strictEqual(result.span, 46);
  assert.strictEqual(55 - 10 + 1, 46);

  const monotone = AnswerSearch.monotonicityReport(10, 55, shipFeasible(weights, 5));
  assert.strictEqual(monotone.flips, 1);
  assert.strictEqual(monotone.monotone, true);
  assert.strictEqual(monotone.firstTrue, 15);

  quotes('searching-the-answer', ['lower bound: 10', 'upper bound: 55', '46 candidate capacities',
    'exactly 1 flip', '5 feasibility checks over 46 candidates', 'the answer is 15']);
});

test('searching-the-answer: thirty checks against a sweep of a billion', function () {
  const cost = AnswerSearch.searchCost(1000000000);
  assert.strictEqual(cost.checks, 30);
  assert.strictEqual(cost.sweep, 1000000000);
  assert.strictEqual(cost.checks, Math.ceil(Math.log2(1000000000)));

  quotes('searching-the-answer', ['a range of a billion: 1 000 000 000 against 30']);
});

test('searching-the-answer: a predicate that flips three times returns 7 where the truth is 3', function () {
  const feasible = function (x) { return x === 3 || x >= 7; };

  const report = AnswerSearch.monotonicityReport(0, 10, feasible);
  assert.strictEqual(report.flips, 3);
  assert.strictEqual(report.monotone, false);
  assert.strictEqual(report.firstTrue, 3);

  const search = AnswerSearch.firstTrue(0, 10, feasible);
  assert.strictEqual(search.answer, 7);
  assert.notStrictEqual(search.answer, report.firstTrue);

  quotes('searching-the-answer', ['the boolean sequence changes value 3 times',
    'binary search returns 7', 'the smallest true value is 3']);
});

test('searching-the-answer: the maximising form is a last-true search, and it is 3 in 3 checks', function () {
  const cows = AnswerSearch.aggressiveCows([1, 2, 4, 8, 9], 3);
  assert.strictEqual(cows.answer, 3);
  assert.strictEqual(cows.checks, 3);

  /* lastTrue must be its own loop: firstTrue on the negation is one too small
     whenever the whole range is feasible, which is the case a test skips. */
  const always = AnswerSearch.lastTrue(0, 20, function () { return true; });
  assert.strictEqual(always.answer, 20);

  quotes('searching-the-answer', ['a last-true search rather than a first-true one, answer 3 in 3 checks']);
});

test('searching-the-answer: ternary search over a peak, in integers and in reals', function () {
  const integer = AnswerSearch.ternarySearchInteger(0, 1000, function (x) {
    return -(x - 37) * (x - 37) + 500;
  });
  assert.strictEqual(integer.at, 37);
  assert.strictEqual(integer.value, 500);
  assert.strictEqual(integer.probes, 30);

  const real = AnswerSearch.ternarySearchReal(0, 10, function (x) {
    return -(x - 3.5) * (x - 3.5) + 9;
  }, 200);
  assert.strictEqual(real.iterations, 200);
  assert.strictEqual(real.at.toFixed(9), '3.499999970');
  assert.ok(real.width < 1e-15, 'the interval closes to the floating-point floor, not to a tolerance');

  quotes('searching-the-answer', ['is found at 37 in 30 probes',
    '200 rounds on [0, 10] closes the interval to 4.44e-16']);
});

/* -------------------------------------------------- 10.9 external-sorting */

function externalRun(generation, order) {
  const records = SortLab.input('random', 10000, 5);
  return ExternalSort.sort(records.slice(), SortOps.create({}),
    { memory: 100, order: order, runGeneration: generation });
}

test('external-sorting: replacement selection makes runs twice the size of memory', function () {
  const flush = externalRun('sort-and-flush', 4);
  assert.strictEqual(flush.initialRuns, 100);
  assert.strictEqual(flush.meanRunLength, 100);
  assert.strictEqual(flush.mergePasses, 4);
  assert.strictEqual(flush.totalTransfers, 100000);
  assert.strictEqual(Math.ceil(10000 / 100), 100);

  const replacement = externalRun('replacement-selection', 4);
  assert.strictEqual(replacement.initialRuns, 51);
  assert.strictEqual(replacement.meanRunLength.toFixed(1), '196.1');
  assert.strictEqual(replacement.mergePasses, 3);
  assert.strictEqual(replacement.totalTransfers, 80000);
  assert.strictEqual(replacement.recordReads, replacement.recordWrites);

  const saved = 1 - replacement.totalTransfers / flush.totalTransfers;
  assert.strictEqual(Math.round(saved * 100), 20);

  quotes('external-sorting', ['100 runs', 'mean run length 100.0', 'measured: 51 runs, mean length 196.1',
    '100 000 record transfers', '80 000', '20% of all I/O removed']);
});

test('external-sorting: sorted input generates one run and no merge pass at all', function () {
  const records = [];
  for (let i = 0; i < 10000; i += 1) records.push(i);

  const report = ExternalSort.sort(records, SortOps.create({}),
    { memory: 100, order: 4, runGeneration: 'replacement-selection' });
  assert.strictEqual(report.initialRuns, 1);
  assert.strictEqual(report.mergePasses, 0);
});

test('external-sorting: the merge order is the other lever on the same cost', function () {
  const expected = { 2: [7, 160000], 4: [4, 100000], 8: [3, 80000], 16: [2, 60000] };

  Object.keys(expected).forEach(function (key) {
    const report = externalRun('sort-and-flush', Number(key));
    assert.strictEqual(report.mergePasses, expected[key][0], 'passes at order ' + key);
    assert.strictEqual(report.totalTransfers, expected[key][1], 'transfers at order ' + key);
    assert.strictEqual(report.mergePasses, ExternalSort.passesFor(100, Number(key)),
      'the pass formula at order ' + key);
  });

  assert.strictEqual((160000 / 60000).toFixed(1), '2.7');

  quotes('external-sorting', ['order  2: 7 passes, 160 000 transfers', 'order 16: 2 passes,  60 000',
    'the I/O falls by 2.7×']);
});

test('external-sorting: the I/O model at a billion records', function () {
  const cost = ExternalSort.ioCost(1e9, 1e7, 1e5, 99);
  assert.strictEqual(cost.blocks, 10000);
  assert.strictEqual(cost.runs, 100);
  assert.strictEqual(cost.mergePasses, 2);
  assert.strictEqual(cost.blockTransfers, 60000);
});

test('external-sorting: all three networks pass exhaustive zero-one verification', function () {
  const expected = {
    4: { bitonic: [6, 3], 'odd-even': [5, 3], insertion: [6, 5] },
    8: { bitonic: [24, 6], 'odd-even': [19, 6], insertion: [28, 13] },
    16: { bitonic: [80, 10], 'odd-even': [63, 10], insertion: [120, 29] }
  };

  Object.keys(expected).forEach(function (key) {
    const n = Number(key);
    Object.keys(expected[key]).forEach(function (kind) {
      const network = Networks.networks[kind].build(n);
      assert.strictEqual(network.comparators.length, expected[key][kind][0], kind + ' comparators at n = ' + n);
      assert.strictEqual(network.depth, expected[key][kind][1], kind + ' depth at n = ' + n);

      const verdict = Networks.verifyZeroOne(network);
      assert.strictEqual(verdict.checked, Math.pow(2, n), kind + ' checked at n = ' + n);
      assert.strictEqual(verdict.failures, 0, kind + ' failures at n = ' + n);
    });
  });

  quotes('external-sorting', ['4 wires: 16 inputs', '8 wires: 256', '16 wires: 65 536',
    '0 failures - a proof rather than a sample']);
});

test('external-sorting: bitonic depth is exactly log2(n)(log2(n)+1)/2, and 1 025 pays for 2 048', function () {
  [8, 16, 64, 1024].forEach(function (n) {
    const levels = Math.log2(n);
    assert.strictEqual(Networks.networks.bitonic.build(n).depth, levels * (levels + 1) / 2, 'depth at n = ' + n);
  });

  const table = Networks.costTable([1024, 1025]);
  assert.strictEqual(table[0].bitonicComparators, 28160);
  assert.strictEqual(table[0].bitonicDepth, 55);
  assert.strictEqual(table[0].padding, 0);
  assert.strictEqual(table[1].padded, 2048);
  assert.strictEqual(table[1].padding, 1023);
  assert.strictEqual(table[1].bitonicComparators, 67584);
  assert.strictEqual(table[1].bitonicDepth, 66);
  assert.strictEqual((67584 / 28160).toFixed(1), '2.4');

  quotes('external-sorting', ['n = 8 → 6, n = 16 → 10, n = 64 → 21, n = 1 024 → 55',
    'pads to 2 048 — 67 584 comparators, depth 66, 1 023 sentinels', '2.4× the comparators']);
});

test('external-sorting: deleting one comparator is caught by between 1 and 225 of 256 inputs', function () {
  const sensitivity = Networks.deletionSensitivity(Networks.networks.bitonic.build(8));
  const caught = sensitivity.map(function (entry) { return entry.caughtBy; });

  assert.strictEqual(sensitivity.length, 24);
  assert.strictEqual(Math.min.apply(null, caught), 1);
  assert.strictEqual(Math.max.apply(null, caught), 225);
  sensitivity.forEach(function (entry) {
    assert.strictEqual(entry.of, 256);
    assert.ok(entry.caughtBy > 0, 'every deletion must be caught by something');
  });

  quotes('external-sorting', ['caught by between 1 and 225 of the 256 zero-one inputs']);
});

/* -------------------------------------------------- 10.10 sorting-in-practice */

const shapes = {};
SortLab.acrossShapes({ size: 2000, seed: 3 }).forEach(function (shape) {
  const rows = {};
  shape.rows.forEach(function (row) { rows[row.algorithm] = row; });
  shapes[shape.kind] = rows;
});

test('sorting-in-practice: six shapes, four different winners', function () {
  const expected = {
    random: ['timsort', 19399], sorted: ['insertion', 1999], 'nearly-sorted': ['timsort', 3099],
    'few-unique': ['quick-three-way', 3389], reversed: ['merge-natural', 2000],
    'organ-pipe': ['merge-natural', 4000]
  };

  Object.keys(expected).forEach(function (kind) {
    const rows = shapes[kind];
    const comparisonSorts = Object.keys(rows).filter(function (name) { return name !== 'radix-lsd'; });
    const best = comparisonSorts.reduce(function (winner, name) {
      return rows[name].comparisons < rows[winner].comparisons ? name : winner;
    });

    assert.strictEqual(best, expected[kind][0], 'winner on ' + kind);
    assert.strictEqual(rows[best].comparisons, expected[kind][1], 'winning cost on ' + kind);
  });

  quotes('sorting-in-practice', ['Timsort        19 399', 'insertion       1 999', 'Timsort         3 099',
    'three-way       3 389', 'natural merge   2 000', 'natural merge   4 000']);
});

test('sorting-in-practice: one algorithm across the shapes is a factor of 48', function () {
  const expected = { sorted: 21033, random: 25011, 'nearly-sorted': 104120, 'organ-pipe': 323989,
    'few-unique': 676647, adversarial: 1003000, reversed: 34331 };

  Object.keys(expected).forEach(function (kind) {
    assert.strictEqual(shapes[kind]['quick-lomuto'].comparisons, expected[kind], 'lomuto on ' + kind);
  });

  assert.strictEqual(Math.round(1003000 / 21033), 48);

  quotes('sorting-in-practice', ['random 25 011', 'sorted 21 033', 'nearly sorted 104 120',
    'few unique 676 647', 'organ pipe 323 989', 'adversarial 1 003 000', 'a factor of 48']);
});

test('sorting-in-practice: selection sort and radix report the same number on all seven', function () {
  Object.keys(shapes).forEach(function (kind) {
    assert.strictEqual(shapes[kind].selection.comparisons, 1999000, 'selection on ' + kind);
    assert.strictEqual(shapes[kind]['radix-lsd'].comparisons, 0, 'radix comparisons on ' + kind);
    const moves = shapes[kind]['radix-lsd'].moves;
    assert.ok(moves >= 4000 && moves <= 8000, 'radix moves on ' + kind + ' were ' + moves);
  });

  assert.strictEqual(Object.keys(shapes).length, 7);

  quotes('sorting-in-practice', ['selection sort: 1 999 000 on every one of the seven shapes',
    'LSD radix: 0 comparisons on every shape', '4 000 to 8 000']);
});

test('sorting-in-practice: the default comparator, evaluated rather than described', function () {
  assert.deepStrictEqual([1, 2, 3].sort(), [1, 2, 3]);
  assert.deepStrictEqual([1, 2, 10].sort(), [1, 10, 2]);
  assert.deepStrictEqual([5, 40, 300].sort(), [300, 40, 5]);
  assert.ok(String(10) < String(2), '"10" < "2" is what makes the default wrong for numbers');

  const collator = new Intl.Collator('en', { sensitivity: 'base' });
  const names = ['zoe', 'Ángel', 'ana'].slice().sort(collator.compare);
  assert.deepStrictEqual(names, ['ana', 'Ángel', 'zoe']);

  const raw = ['zoe', 'Ángel', 'ana'].slice().sort();
  assert.strictEqual(raw[raw.length - 1], 'Ángel', 'a raw sort puts the accent after z');

  quotes('sorting-in-practice', ['[1, 2, 10].sort() → [1, 10, 2]', '[5, 40, 300].sort() → [300, 40, 5]',
    '"10" < "2" because "1" < "2"']);
});
