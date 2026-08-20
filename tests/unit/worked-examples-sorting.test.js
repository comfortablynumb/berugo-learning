'use strict';

/**
 * Every figure the M10.1-M10.3 worked examples quote, recomputed.
 *
 * The rule is the one the earlier milestones settled on: reproduce the
 * measurement with the demo's parameters and seed, then assert the prose still
 * quotes it, so moving a number without moving the sentence fails the build.
 *
 * Two of these tests exist because the first draft of the prose was wrong.
 * The introsort figures on the anti-quicksort input were written from a run
 * that is not the one the module performs: measured, the depth limit fires and
 * caps the recursion at exactly 2*ceil(log2 n), which is a better fact than the
 * one that was there.
 */

const test = require('node:test');
const assert = require('node:assert');

const prose = require('../support/worked-example-prose.js');
const quotes = prose.quotes;
const grouped = prose.grouped;

const SortLab = require('../../src/js/machines/sort-lab.js');
const SortOps = require('../../src/js/algorithms/sort-ops.js');
const QuickSort = require('../../src/js/algorithms/quick-sort.js');
const Elementary = require('../../src/js/algorithms/sorts-elementary.js');
const Random = require('../../src/js/utils/random.js');
require('../../src/js/content/examples-sorting.js');
require('../../src/js/content/concepts-sorting.js');

const SIZE = 2000;
const SEED = 3;

function byName(rows) {
  const out = {};
  rows.forEach(function (row) { out[row.algorithm] = row; });
  return out;
}

const random = byName(SortLab.compare({ kind: 'random', size: SIZE, seed: SEED }));
const sorted = byName(SortLab.compare({ kind: 'sorted', size: SIZE, seed: SEED }));

/* -------------------------------------------------- 10.1 sorting-contract */

test('sorting-contract: four sorts of the same 2 000 elements, four comparison counts', function () {
  assert.strictEqual(random.shell.comparisons, 29853);
  assert.strictEqual(random.insertion.comparisons, 993838);
  assert.strictEqual(random.bubble.comparisons, 1994247);
  assert.strictEqual(random.selection.comparisons, 1999000);

  const spread = random.selection.comparisons / random.shell.comparisons;
  assert.strictEqual(Math.round(spread), 67);

  quotes('sorting-contract', ['29 853', '993 838', '1 994 247', '1 999 000', '67×']);
});

test('sorting-contract: selection sort is n(n-1)/2 on every one of the seven shapes', function () {
  const expected = SIZE * (SIZE - 1) / 2;
  assert.strictEqual(expected, 1999000);

  const shapes = SortLab.acrossShapes({ size: SIZE, seed: SEED, algorithms: ['selection'] });
  assert.strictEqual(shapes.length, 7);
  shapes.forEach(function (shape) {
    assert.strictEqual(shape.rows[0].comparisons, expected, shape.kind);
  });

  quotes('sorting-contract', ['2 000 × 1 999 / 2 = 1 999 000', 'measured on sorted input: 1 999 000']);
});

test('sorting-contract: the move column ranks the four sorts the other way round', function () {
  assert.strictEqual(random.selection.moves, 3984);
  assert.strictEqual(random.selection.swaps, 1992);
  assert.strictEqual(random.shell.moves, 23509);
  assert.strictEqual(random.insertion.moves, 993828);
  assert.strictEqual(random.bubble.moves, 1983686);

  const factor = random.bubble.moves / random.selection.moves;
  assert.ok(factor > 490 && factor < 500, 'bubble does ' + factor.toFixed(0) + 'x the moves');

  quotes('sorting-contract', ['3 984 moves, 1 992 swaps', '23 509 moves', '993 828 moves', '1 983 686']);
});

test('sorting-contract: an already-sorted input separates the adaptive sorts from the rest', function () {
  assert.strictEqual(sorted.insertion.comparisons, 1999);
  assert.strictEqual(sorted.insertion.moves, 0);
  assert.strictEqual(sorted.bubble.comparisons, 1999);
  assert.strictEqual(sorted.bubble.moves, 0);
  assert.strictEqual(sorted.shell.comparisons, 15194);
  assert.strictEqual(sorted.shell.moves, 0);
  assert.strictEqual(sorted.selection.comparisons, 1999000);

  quotes('sorting-contract', ['1 999 comparisons, 0 moves', '15 194 comparisons, 0 moves']);
});

test('sorting-contract: four broken comparators, and not one exception', function () {
  const report = SortLab.comparatorReport({ size: 40, seed: 5 });
  const byKind = {};
  report.forEach(function (row) { byKind[row.name] = row; });

  assert.strictEqual(byKind.correct.sorted, true);
  assert.strictEqual(byKind.correct.outOfOrderPairs, 0);
  assert.strictEqual(byKind.correct.axiomViolations, 0);

  assert.strictEqual(byKind['boolean-return'].sorted, false);
  assert.strictEqual(byKind['boolean-return'].axiomViolations, 144);
  assert.strictEqual(byKind['default-string'].sorted, false);
  assert.strictEqual(byKind['random-order'].sorted, false);

  report.forEach(function (row) {
    assert.strictEqual(row.threw, null, row.name + ' threw, and nothing here may throw');
  });

  assert.deepStrictEqual([1, 2, 10].sort(), [1, 10, 2]);
  assert.deepStrictEqual([5, 40, 300].sort(), [300, 40, 5]);
  assert.deepStrictEqual([1, 2, 3].sort(), [1, 2, 3]);

  quotes('sorting-contract', ['[1, 2, 10] → [1, 10, 2]', '[5, 40, 300] → [300, 40, 5]']);
});

/* -------------------------------------------------- 10.2 merge-sort */

test('merge-sort: four schedules, the same merges, thirteen comparisons apart', function () {
  assert.strictEqual(random['merge-top-down'].comparisons, 19407);
  assert.strictEqual(random['merge-bottom-up'].comparisons, 19420);
  assert.strictEqual(random['merge-natural'].comparisons, 21281);
  assert.strictEqual(random['merge-in-place'].comparisons, 26763);
  assert.strictEqual(random['merge-bottom-up'].comparisons - random['merge-top-down'].comparisons, 13);

  quotes('merge-sort', ['19 407', '19 420', '21 281', '26 763', 'within 13 comparisons']);
});

test('merge-sort: the movement column is where the schedules actually differ', function () {
  assert.strictEqual(random['merge-bottom-up'].moves, 24000);
  assert.strictEqual(random['merge-top-down'].moves, 43904);
  assert.strictEqual(random['merge-in-place'].moves, 102734);
  assert.strictEqual(random['merge-in-place'].swaps, 51367);

  const levels = Math.ceil(Math.log2(SIZE));
  assert.strictEqual(levels, 11);
  assert.strictEqual(SIZE * levels, 22000);
  assert.strictEqual(grouped(24000), '24 000');

  const saving = 1 - random['merge-bottom-up'].moves / random['merge-top-down'].moves;
  assert.strictEqual(Math.round(saving * 100), 45);

  quotes('merge-sort', ['24 000 moves', '43 904 moves', '102 734 moves and 51 367 swaps',
    '⌈log₂ 2 000⌉ = 11 levels', '45% fewer moves']);
});

test('merge-sort: one allocation, or none and 51 367 swaps', function () {
  assert.strictEqual(random['merge-top-down'].allocations, 1);
  assert.strictEqual(random['merge-bottom-up'].allocations, 1);
  assert.strictEqual(random['merge-natural'].allocations, 1);
  assert.strictEqual(random['merge-in-place'].allocations, 0);

  const ratio = random['merge-in-place'].moves / random['merge-top-down'].moves;
  assert.strictEqual(ratio.toFixed(1), '2.3');

  quotes('merge-sort', ['1 allocation of 2 000 slots', '0 allocations', '2.3×']);
});

test('merge-sort: natural runs collapse the sorted, reversed and organ-pipe shapes', function () {
  function naturalOn(kind) {
    const rows = byName(SortLab.compare({ kind: kind, size: SIZE, seed: SEED,
      algorithms: ['merge-natural'] }));
    return rows['merge-natural'];
  }

  const onSorted = naturalOn('sorted');
  assert.strictEqual(onSorted.comparisons, 2000);
  assert.strictEqual(onSorted.moves, 0);

  const onReversed = naturalOn('reversed');
  assert.strictEqual(onReversed.comparisons, 2000);
  assert.strictEqual(onReversed.swaps, 1000);

  const onOrgan = naturalOn('organ-pipe');
  assert.strictEqual(onOrgan.comparisons, 4000);

  quotes('merge-sort', ['2 000 comparisons — one per element', '2 000 comparisons and 1 000 swaps',
    '4 000 comparisons']);
});

/* -------------------------------------------------- 10.3 quicksort */

function quicksortRun(values, partition, pivot, intro) {
  const list = values.slice();
  const ops = SortOps.create({});
  const report = intro
    ? QuickSort.introSort(list, ops, { partition: partition, pivot: pivot,
      insertionSort: Elementary.insertionSort })
    : QuickSort.sort(list, ops, { partition: partition, pivot: pivot, random: Random.seeded(9) });

  let wrong = 0;
  const expected = values.slice().sort(function (a, b) { return a - b; });
  for (let i = 0; i < expected.length; i += 1) {
    if (list[i] !== expected[i]) wrong += 1;
  }
  return { report: report, comparisons: ops.stats().comparisons, wrong: wrong };
}

function identical(n) {
  const values = [];
  for (let i = 0; i < n; i += 1) values.push(7);
  return values;
}

test('quicksort: 2 000 identical values cost 2 004 997, 31 723 or 2 012', function () {
  const values = identical(SIZE);

  const lomuto = quicksortRun(values, 'lomuto', 'median-of-three', false);
  assert.strictEqual(lomuto.comparisons, 2004997);
  assert.strictEqual(lomuto.report.maxDepth, 2000);
  assert.strictEqual(lomuto.report.partitions, 1999);

  const hoare = quicksortRun(values, 'hoare', 'median-of-three', false);
  assert.strictEqual(hoare.comparisons, 31723);
  assert.strictEqual(hoare.report.maxDepth, 12);

  const threeWay = quicksortRun(values, 'three-way', 'ninther', false);
  assert.strictEqual(threeWay.comparisons, 2012);
  assert.strictEqual(threeWay.report.maxDepth, 2);
  assert.strictEqual(threeWay.report.partitions, 1);

  assert.strictEqual(Math.round(lomuto.comparisons / hoare.comparisons), 63);

  quotes('quicksort', ['2 004 997 comparisons', 'recursion depth 2 000', '1 999 partitions',
    '31 723 comparisons', 'recursion depth 12', '2 012 comparisons', '1 partition']);
});

test('quicksort: three distinct values is the case that happens by accident', function () {
  const rows = byName(SortLab.compare({ kind: 'few-unique', size: SIZE, seed: SEED,
    algorithms: ['quick-lomuto', 'quick-hoare', 'quick-three-way'] }));

  assert.strictEqual(rows['quick-lomuto'].comparisons, 676647);
  assert.strictEqual(rows['quick-hoare'].comparisons, 32506);
  assert.strictEqual(rows['quick-three-way'].comparisons, 3389);
  assert.strictEqual(Math.round(676647 / 3389), 200);

  quotes('quicksort', ['676 647', '32 506', '3 389', 'a factor of 200']);
});

test('quicksort: the anti-quicksort input drives median-of-three above n squared over four', function () {
  [[512, 66304, 257], [1024, 263680, 513], [2048, 1051648, 1025]].forEach(function (row) {
    const n = row[0];
    const values = QuickSort.adversarialInput(n, { partition: 'lomuto', pivot: 'median-of-three' });
    const plain = quicksortRun(values, 'lomuto', 'median-of-three', false);

    assert.strictEqual(plain.comparisons, row[1], 'comparisons at n = ' + n);
    assert.strictEqual(plain.report.maxDepth, row[2], 'depth at n = ' + n);
    assert.ok(plain.comparisons > n * n / 4, 'n = ' + n + ' must be above n^2/4');
    assert.strictEqual(plain.wrong, 0, 'the sort is correct - the failure is a slowdown');
  });

  quotes('quicksort', ['66 304 comparisons', '263 680 comparisons', '1 051 648 comparisons',
    'n²/4 = 1 048 576', '0 out of place, at every size']);
});

test('quicksort: the depth limit fires and caps the recursion at 2 ceil(log2 n)', function () {
  [[512, 15373, 18], [1024, 35374, 20], [2048, 79717, 22]].forEach(function (row) {
    const n = row[0];
    const values = QuickSort.adversarialInput(n, { partition: 'lomuto', pivot: 'median-of-three' });
    const intro = quicksortRun(values, 'lomuto', 'median-of-three', true);

    assert.strictEqual(intro.comparisons, row[1], 'introsort comparisons at n = ' + n);
    assert.strictEqual(intro.report.maxDepth, row[2], 'introsort depth at n = ' + n);
    assert.strictEqual(intro.report.maxDepth, 2 * Math.ceil(Math.log2(n)), 'the cap at n = ' + n);
    assert.strictEqual(intro.report.heapsortFallbacks, 1, 'one escape at n = ' + n);
    assert.strictEqual(intro.wrong, 0);
  });

  assert.strictEqual(Math.round(1051648 / 79717), 13);

  quotes('quicksort', ['15 373 comparisons, depth 18, 1 heapsort escape',
    '35 374 comparisons, depth 20, 1 heapsort escape',
    '79 717 comparisons, depth 22, 1 heapsort escape', '13×']);
});

test('quicksort: a second adversary, built against the ninther, meets the same limit', function () {
  const values = QuickSort.adversarialInput(2048, { partition: 'three-way', pivot: 'ninther' });

  const plain = quicksortRun(values, 'three-way', 'ninther', false);
  assert.strictEqual(plain.comparisons, 361451);
  assert.strictEqual(plain.report.maxDepth, 344);

  const intro = quicksortRun(values, 'three-way', 'ninther', true);
  assert.strictEqual(intro.comparisons, 78223);
  assert.strictEqual(intro.report.maxDepth, 22);
  assert.strictEqual(intro.report.heapsortFallbacks, 1);

  quotes('quicksort', ['361 451 comparisons, depth 344', '78 223 comparisons, depth 22, 1 heapsort escape']);
});
