'use strict';

/**
 * Every figure the M10.4-M10.6 worked examples quote, recomputed.
 *
 * The selection harness here mirrors `selection-and-order-section.js` exactly:
 * the same seven pivot seeds, averaged, because quickselect's cost is an
 * expectation and a single run is one sample of it. A test that measured one
 * seed would disagree with the section on most sizes and be right about
 * neither.
 */

const test = require('node:test');
const assert = require('node:assert');

const prose = require('../support/worked-example-prose.js');
const quotes = prose.quotes;
const fixed = prose.fixed;

const SortLab = require('../../src/js/machines/sort-lab.js');
const SortOps = require('../../src/js/algorithms/sort-ops.js');
const Timsort = require('../../src/js/algorithms/timsort.js');
const Pdqsort = require('../../src/js/algorithms/pdqsort.js');
const RadixSort = require('../../src/js/algorithms/radix-sort.js');
const Selection = require('../../src/js/algorithms/selection.js');
const Random = require('../../src/js/utils/random.js');
require('../../src/js/content/examples-sorting-library.js');
require('../../src/js/content/concepts-sorting-library.js');

/* -------------------------------------------------- 10.4 library-sorts */

const PAPER_LENGTHS = [120, 80, 25, 20, 30];

function paperInput() {
  const out = [];
  let base = 1000000;
  PAPER_LENGTHS.forEach(function (length) {
    for (let i = 0; i < length; i += 1) out.push(base + i);
    base -= 1;
  });
  return out;
}

function timsortOnPaper(buggy) {
  const values = paperInput();
  const list = values.slice();
  const ops = SortOps.create({});
  const report = Timsort.sort(list, ops, { buggyCollapse: buggy, minRun: 1 });

  let wrong = 0;
  const expected = values.slice().sort(function (a, b) { return a - b; });
  for (let i = 0; i < expected.length; i += 1) {
    if (list[i] !== expected[i]) wrong += 1;
  }
  return { report: report, wrong: wrong, size: values.length };
}

function settledStacks(report) {
  return report.stackHistory
    .filter(function (entry) { return entry.settled; })
    .map(function (entry) { return entry.lengths; });
}

test('library-sorts: minRunLength lands in [16, 32] and hits the documented values', function () {
  assert.strictEqual(Timsort.MIN_MERGE, 32);
  const expected = { 10: 10, 63: 32, 64: 16, 65: 17, 1000: 32, 2048: 16, 20000: 20 };
  Object.keys(expected).forEach(function (key) {
    assert.strictEqual(Timsort.minRunLength(Number(key)), expected[key], 'minRun for n = ' + key);
  });

  for (let n = 32; n < 5000; n += 1) {
    const minRun = Timsort.minRunLength(n);
    assert.ok(minRun >= 16 && minRun <= 32, 'minRun ' + minRun + ' out of range at n = ' + n);
  }
});

test('library-sorts: the de Gouw run lengths break the pre-2015 collapse rule', function () {
  const fixedRule = timsortOnPaper(false);
  const buggyRule = timsortOnPaper(true);

  assert.strictEqual(fixedRule.size, 275);
  assert.strictEqual(PAPER_LENGTHS.reduce(function (a, b) { return a + b; }, 0), 275);

  assert.deepStrictEqual(settledStacks(fixedRule.report),
    [[120], [120, 80], [120, 80, 25], [120, 80, 25, 20], [275]]);
  assert.strictEqual(fixedRule.report.invariantViolations, 0);

  const buggyStacks = settledStacks(buggyRule.report);
  assert.deepStrictEqual(buggyStacks[buggyStacks.length - 1], [120, 80, 45, 30]);
  assert.strictEqual(buggyRule.report.invariantViolations, 1);
  assert.strictEqual(80 + 45, 125);
  assert.ok(!(120 > 125), 'the deepest triple is the one that fails');

  quotes('library-sorts', ['[120] → [120, 80] → [120, 80, 25] → [120, 80, 25, 20] → [275]',
    '0 violations at any point', 'settled stack: [120, 80, 45, 30]', '120 > 80 + 45 = 125 is false']);
});

test('library-sorts: both collapse rules sort all 275 elements correctly', function () {
  assert.strictEqual(timsortOnPaper(false).wrong, 0);
  assert.strictEqual(timsortOnPaper(true).wrong, 0);

  quotes('library-sorts', ['fixed rule: 0 out of place', 'buggy rule: 0 out of place']);
});

test('library-sorts: Timsort on nearly-sorted 2 000 costs 3 099 against a merge sort 15 410', function () {
  const rows = SortLab.compare({ kind: 'nearly-sorted', size: 2000, seed: 3,
    algorithms: ['timsort', 'merge-bottom-up'] });
  const byName = {};
  rows.forEach(function (row) { byName[row.algorithm] = row; });

  assert.strictEqual(byName.timsort.comparisons, 3099);
  assert.strictEqual(byName['merge-bottom-up'].comparisons, 15410);
  assert.strictEqual(fixed(3099 / 2000), '1.55');

  const random = SortLab.compare({ kind: 'random', size: 2000, seed: 3, algorithms: ['timsort'] });
  assert.strictEqual(random[0].comparisons, 19399);

  quotes('library-sorts', ['3 099 comparisons — 1.55 per element', '15 410']);
});

test('library-sorts: each pdqsort mechanism fires only on the shape it exists for', function () {
  function pdqOn(values) {
    const ops = SortOps.create({});
    const report = Pdqsort.sort(values.slice(), ops, {});
    return { report: report, comparisons: ops.stats().comparisons };
  }

  const sorted = pdqOn(SortLab.input('sorted', 20000, 3));
  assert.strictEqual(sorted.comparisons, 40010);
  assert.strictEqual(sorted.report.maxDepth, 1);
  assert.strictEqual(sorted.report.partialInsertionWins, 1);

  const identical = [];
  for (let i = 0; i < 20000; i += 1) identical.push(7);
  const equal = pdqOn(identical);
  assert.strictEqual(equal.comparisons, 40024);
  assert.strictEqual(equal.report.equalBlocks, 1);
  assert.strictEqual(equal.report.maxDepth, 2);

  const few = pdqOn(SortLab.input('few-unique', 20000, 3));
  assert.strictEqual(few.comparisons, 60008);
  assert.strictEqual(few.report.equalBlocks, 3);

  const random = pdqOn(SortLab.input('random', 20000, 3));
  assert.strictEqual(random.comparisons, 319511);
  assert.strictEqual(random.report.patternBreaks, 91);

  const organ = pdqOn(SortLab.input('organ-pipe', 20000, 3));
  assert.strictEqual(organ.comparisons, 428593);
  assert.strictEqual(organ.report.patternBreaks, 394);
  assert.strictEqual(organ.report.heapsortFallbacks, 0);

  quotes('library-sorts', ['40 010 comparisons', '40 024 comparisons, 1 equal block, depth 2',
    '60 008 comparisons, 3 equal blocks', '319 511 comparisons, 91 pattern breaks',
    '428 593 comparisons, 394 pattern breaks', '0 heapsort fallbacks']);
});

/* -------------------------------------------------- 10.5 non-comparison-sorts */

test('non-comparison-sorts: counting sort is priced by the key range, not by n', function () {
  const byte = RadixSort.countingCost(Math.pow(2, 8), 1000);
  const wide = RadixSort.countingCost(Math.pow(2, 16), 1000);
  const huge = RadixSort.countingCost(Math.pow(2, 32), 1000);

  assert.strictEqual(byte.tableBytes, 1024);
  assert.strictEqual(byte.countingOperations, 1256);
  assert.strictEqual(byte.wins, true);

  assert.strictEqual(wide.tableBytes, 262144);
  assert.strictEqual(wide.countingOperations, 66536);
  assert.strictEqual(wide.wins, false);

  assert.strictEqual(huge.tableBytes, 17179869184);
  assert.strictEqual(huge.wins, false);
  assert.strictEqual(Math.round(byte.comparisonOperations), 9966);

  quotes('non-comparison-sorts', ['1 024 bytes of counters, 1 256 operations',
    '262 144 bytes, 66 536 operations', '17 179 869 184 bytes', 'n log₂ n ≈ 9 966']);
});

test('non-comparison-sorts: the digit width trades passes against table size', function () {
  [[4, 16, 64, 8], [8, 256, 1024, 4], [16, 65536, 262144, 2]].forEach(function (row) {
    const bits = row[0];
    assert.strictEqual(Math.pow(2, bits), row[1], 'buckets at ' + bits + ' bits');
    assert.strictEqual(Math.pow(2, bits) * 4, row[2], 'bytes at ' + bits + ' bits');
    assert.strictEqual(Math.ceil(32 / bits), row[3], 'passes at ' + bits + ' bits');
  });

  quotes('non-comparison-sorts', ['4 bits:  16 buckets,     64 bytes, 8 passes',
    '8 bits:  256 buckets,  1 024 bytes, 4 passes',
    '16 bits: 65 536 buckets, 262 144 bytes, 2 passes']);
});

test('non-comparison-sorts: LSD radix makes zero comparisons at every digit width', function () {
  SortLab.kinds.forEach(function (kind) {
    const rows = SortLab.compare({ kind: kind, size: 2000, seed: 3, algorithms: ['radix-lsd'] });
    assert.strictEqual(rows[0].comparisons, 0, 'comparisons on ' + kind);
    assert.strictEqual(rows[0].wrong, 0, 'correctness on ' + kind);
  });

  quotes('non-comparison-sorts', ['LSD radix, any digit width: 0 comparisons']);
});

test('non-comparison-sorts: an unstable pass is invisible on narrow keys and fatal on wide ones', function () {
  function radixOn(range, stable) {
    const random = Random.seeded(11);
    const records = [];
    for (let i = 0; i < 2000; i += 1) records.push({ key: random.int(range), at: i });

    const ops = SortOps.create({});
    RadixSort.lsdRadixSort(records, ops, {
      bits: 8, unstable: !stable, key: function (item) { return item.key; }
    });

    let outOfOrder = 0;
    let tiesReversed = 0;
    for (let i = 1; i < records.length; i += 1) {
      if (records[i - 1].key > records[i].key) outOfOrder += 1;
      if (records[i - 1].key === records[i].key && records[i - 1].at > records[i].at) tiesReversed += 1;
    }
    return { outOfOrder: outOfOrder, tiesReversed: tiesReversed };
  }

  const narrowStable = radixOn(20, true);
  assert.strictEqual(narrowStable.outOfOrder, 0);
  assert.strictEqual(narrowStable.tiesReversed, 0);

  const narrowUnstable = radixOn(20, false);
  assert.strictEqual(narrowUnstable.outOfOrder, 0, 'narrow keys still come out sorted');
  assert.ok(narrowUnstable.tiesReversed > 0, 'and only the tie order is damaged');

  const wideStable = radixOn(1000000, true);
  assert.strictEqual(wideStable.outOfOrder, 0);

  const wideUnstable = radixOn(1000000, false);
  assert.ok(wideUnstable.outOfOrder > 0, 'wide keys come out unsorted');

  quotes('non-comparison-sorts', ['unstable: sorted, ties reversed',
    'unstable: not sorted — the first adjacent pair is already out of order']);
});

/* -------------------------------------------------- 10.6 selection-and-order */

const PIVOT_SEEDS = [3, 11, 17, 29, 41, 53, 67];

function selectWith(method, list, k, ops, seed) {
  if (method === 'median-of-medians') return Selection.medianOfMedians(list, k, ops);
  if (method === 'introselect') {
    return Selection.introSelect(list, k, ops, { random: Random.seeded(seed) });
  }
  if (method === 'sort-then-index') {
    list.sort(function (a, b) { return ops.cmp(a, b); });
    return { value: list[k] };
  }
  return Selection.quickSelect(list, k, ops, { random: Random.seeded(seed) });
}

/** The section's own harness: the mean over seven pivot seeds, and the answer checked every time. */
function meanCost(method, n, percentile) {
  const values = SortLab.input('random', n, 7);
  const k = Math.min(values.length - 1, Math.max(0, Math.floor((percentile / 100) * (values.length - 1))));
  const expected = values.slice().sort(function (a, b) { return a - b; });
  let comparisons = 0;
  let wrong = 0;

  PIVOT_SEEDS.forEach(function (seed) {
    const ops = SortOps.create({});
    const found = selectWith(method, values.slice(), k, ops, seed);
    comparisons += ops.stats().comparisons;
    if (found.value !== expected[k]) wrong += 1;
  });

  const mean = comparisons / PIVOT_SEEDS.length;
  return { comparisons: Math.round(mean), perElement: mean / n, wrong: wrong, k: k };
}

test('selection-and-order: three constants in front of n at 20 000 elements', function () {
  const quick = meanCost('quickselect', 20000, 50);
  const mom = meanCost('median-of-medians', 20000, 50);
  const sort = meanCost('sort-then-index', 20000, 50);

  assert.strictEqual(quick.k, 9999);
  assert.strictEqual(quick.comparisons, 59772);
  assert.strictEqual(fixed(quick.perElement), '2.99');
  assert.strictEqual(mom.comparisons, 161904);
  assert.strictEqual(fixed(mom.perElement), '8.10');
  assert.strictEqual(sort.comparisons, 259880);
  assert.strictEqual(fixed(sort.perElement), '12.99');

  [quick, mom, sort].forEach(function (row) { assert.strictEqual(row.wrong, 0); });
  assert.strictEqual(fixed(mom.comparisons / quick.comparisons, 1), '2.7');
  assert.strictEqual(fixed(sort.comparisons / quick.comparisons, 1), '4.3');
  assert.strictEqual(fixed(Math.log2(20000)), '14.29');

  quotes('selection-and-order', ['59 772 comparisons', '2.99 per element', '161 904 comparisons',
    '8.10 per element', '259 880 comparisons', '12.99 per element', '2.7×', '4.3×']);
});

test('selection-and-order: the selection constants stay put while the sorting one tracks log n', function () {
  const rows = [5000, 20000, 80000].map(function (n) {
    return {
      n: n,
      quick: meanCost('quickselect', n, 50),
      mom: meanCost('median-of-medians', n, 50),
      sort: meanCost('sort-then-index', n, 50)
    };
  });

  const expected = [['3.24', '8.18', '10.99'], ['2.99', '8.10', '12.99'], ['3.92', '8.27', '14.99']];
  rows.forEach(function (row, index) {
    assert.strictEqual(fixed(row.quick.perElement), expected[index][0], 'quickselect at n = ' + row.n);
    assert.strictEqual(fixed(row.mom.perElement), expected[index][1], 'median of medians at n = ' + row.n);
    assert.strictEqual(fixed(row.sort.perElement), expected[index][2], 'sorting at n = ' + row.n);
  });

  assert.strictEqual(rows[0].quick.comparisons, 16221);
  assert.strictEqual(rows[2].quick.comparisons, 313625);
  assert.strictEqual(rows[2].sort.comparisons, 1199064);

  quotes('selection-and-order', ['n =  5 000: 3.24n', '8.18n', '10.99n',
    'n = 20 000: 2.99n', '8.10n', '12.99n', 'n = 80 000: 3.92n', '8.27n', '14.99n']);
});

test('selection-and-order: introselect matches quickselect exactly on this input', function () {
  const quick = meanCost('quickselect', 20000, 50);
  const intro = meanCost('introselect', 20000, 50);

  assert.strictEqual(intro.comparisons, quick.comparisons);
  assert.strictEqual(intro.comparisons, 59772);
  assert.strictEqual(intro.wrong, 0);
});

test('selection-and-order: the median is the most expensive rank, and k = n is the cheapest', function () {
  const sweep = [0, 25, 50, 100].map(function (percentile) {
    return { percentile: percentile, cost: meanCost('quickselect', 20000, percentile) };
  });

  const expected = ['2.31', '2.84', '2.99', '1.81'];
  sweep.forEach(function (row, index) {
    assert.strictEqual(fixed(row.cost.perElement), expected[index], 'k = ' + row.percentile + '%');
    assert.strictEqual(row.cost.wrong, 0);
  });
});

test('selection-and-order: the bounded heap, the select and the full sort agree at every k', function () {
  const values = SortLab.input('random', 20000, 7);
  const expected = values.slice().sort(function (a, b) { return a - b; });

  [10, 100, 1000].forEach(function (k) {
    const heapOps = SortOps.create({});
    const heap = Selection.topK(values.slice(), k, heapOps);
    assert.deepStrictEqual(heap, expected.slice(0, k), 'top ' + k + ' by bounded heap');

    const selectOps = SortOps.create({});
    const list = values.slice();
    Selection.partialSort(list, k, selectOps, { random: Random.seeded(3) });
    assert.deepStrictEqual(list.slice(0, k), expected.slice(0, k), 'top ' + k + ' by select');

    const sliced = values.slice().sort(function (a, b) { return a - b; }).slice(0, k);
    assert.deepStrictEqual(sliced, expected.slice(0, k), 'top ' + k + ' by full sort');
  });

  quotes('selection-and-order', ['identical output at every k']);
});
