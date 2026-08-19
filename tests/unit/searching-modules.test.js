'use strict';

/**
 * Unit tests for the M10 pivots, patterns, selection and searches.
 *
 * These are the modules whose bugs are quiet. A quicksort with a bad pivot
 * rule returns the right answer slowly; a Timsort with the pre-2015 collapse
 * rule returns the right answer with a broken invariant; a radix sort with an
 * unstable pass returns something that is almost sorted; a binary search with
 * `high = length - 1` is correct on every array anybody tests it with. So
 * none of these tests check only the output.
 */

const test = require('node:test');
const assert = require('node:assert');

const SortOps = require('../../src/js/algorithms/sort-ops.js');
const Elementary = require('../../src/js/algorithms/sorts-elementary.js');
const QuickSort = require('../../src/js/algorithms/quick-sort.js');
const Timsort = require('../../src/js/algorithms/timsort.js');
const Pdqsort = require('../../src/js/algorithms/pdqsort.js');
const RadixSort = require('../../src/js/algorithms/radix-sort.js');
const Selection = require('../../src/js/algorithms/selection.js');
const BinarySearch = require('../../src/js/algorithms/binary-search.js');
const AnswerSearch = require('../../src/js/algorithms/answer-search.js');
const ExternalSort = require('../../src/js/algorithms/external-sort.js');
const Networks = require('../../src/js/algorithms/sorting-networks.js');
const SortLab = require('../../src/js/machines/sort-lab.js');
const Random = require('../../src/js/utils/random.js');

function ops() { return SortOps.create({}); }

function ascending(list) {
  return list.slice().sort(function (a, b) { return a - b; });
}

/* ------------------------------------------------------------ quicksort */

test('quicksort: every partition and pivot pairing sorts every shape', function () {
  const inputs = [[], [1], [2, 1], SortLab.input('random', 200, 1),
    SortLab.input('few-unique', 200, 2), SortLab.input('sorted', 120, 3),
    SortLab.input('reversed', 120, 4), new Array(120).fill(7)];

  QuickSort.partitionKinds.forEach(function (partition) {
    QuickSort.pivotKinds.forEach(function (pivot) {
      inputs.forEach(function (source, index) {
        const list = source.slice();
        QuickSort.sort(list, ops(), { partition: partition, pivot: pivot, random: Random.seeded(9) });
        assert.deepStrictEqual(list, ascending(source),
          partition + '/' + pivot + ' failed input ' + index);
      });
    });
  });
});

test('quicksort: three-way partitioning is what makes all-equal input linear', function () {
  const size = 2000;
  const results = {};

  [['lomuto', 'median-of-three'], ['hoare', 'median-of-three'], ['three-way', 'ninther']]
    .forEach(function (pair) {
      const list = new Array(size).fill(5);
      const counted = ops();
      const report = QuickSort.sort(list, counted, { partition: pair[0], pivot: pair[1] });
      results[pair[0]] = { comparisons: counted.stats().comparisons, depth: report.maxDepth,
        partitions: report.partitions };
    });

  assert.ok(results.lomuto.comparisons > size * size / 4,
    'Lomuto on all-equal input is quadratic: ' + results.lomuto.comparisons);
  assert.strictEqual(results.lomuto.depth, size, 'and it recurses once per element');
  assert.ok(results.hoare.depth < 20, 'Hoare stops on equal elements, so it splits down the middle');
  assert.strictEqual(results['three-way'].partitions, 1,
    'three-way places the whole equal block in one partition');
  assert.ok(results['three-way'].comparisons < 3 * size,
    'which makes the whole sort linear: ' + results['three-way'].comparisons);
});

test('quicksort: the adversary drives median-of-three past n squared over four', function () {
  [512, 1024].forEach(function (n) {
    const killer = QuickSort.adversarialInput(n, { partition: 'lomuto', pivot: 'median-of-three' });
    assert.deepStrictEqual(ascending(killer), ascending(killer), 'the killer is a permutation');

    const plain = ops();
    const plainList = killer.slice();
    const plainReport = QuickSort.sort(plainList, plain, { partition: 'lomuto', pivot: 'median-of-three' });
    assert.deepStrictEqual(plainList, ascending(killer), 'it still returns the right answer');
    assert.ok(plain.stats().comparisons > n * n / 4,
      'n = ' + n + ': ' + plain.stats().comparisons + ' comparisons is not quadratic');
    assert.ok(plainReport.maxDepth > n / 4, 'and the recursion goes deep');

    const intro = ops();
    const introList = killer.slice();
    const introReport = QuickSort.introSort(introList, intro, { insertionSort: Elementary.insertionSort });
    assert.deepStrictEqual(introList, ascending(killer));
    assert.ok(intro.stats().comparisons < plain.stats().comparisons / 4,
      'introsort escapes the same input');
    assert.ok(introReport.maxDepth < 4 * Math.ceil(Math.log2(n)), 'with a bounded depth');
  });
});

test('quicksort: the depth limit fires on an input built against its own pivot rule', function () {
  const n = 2048;
  const killer = QuickSort.adversarialInput(n, { partition: 'three-way', pivot: 'ninther' });

  const unlimited = ops();
  const unlimitedReport = QuickSort.sort(killer.slice(), unlimited,
    { partition: 'three-way', pivot: 'ninther' });

  const limited = ops();
  const limitedList = killer.slice();
  const limitedReport = QuickSort.introSort(limitedList, limited,
    { insertionSort: Elementary.insertionSort });

  assert.deepStrictEqual(limitedList, ascending(killer));
  assert.ok(unlimitedReport.maxDepth > 100, 'without a limit the recursion is deep');
  assert.ok(limitedReport.heapsortFallbacks > 0, 'the heapsort escape actually fires');
  assert.ok(limitedReport.maxDepth < unlimitedReport.maxDepth / 4, 'and it caps the depth');
});

/* -------------------------------------------------------------- Timsort */

test('timsort: minrun lands in the documented range and matches the reference values', function () {
  assert.strictEqual(Timsort.minRunLength(10), 10);
  assert.strictEqual(Timsort.minRunLength(63), 32);
  assert.strictEqual(Timsort.minRunLength(64), 16);
  assert.strictEqual(Timsort.minRunLength(65), 17);
  assert.strictEqual(Timsort.minRunLength(1000), 32);
  assert.strictEqual(Timsort.minRunLength(2048), 16);

  for (let n = Timsort.MIN_MERGE; n < 3000; n += 7) {
    const minRun = Timsort.minRunLength(n);
    assert.ok(minRun >= Timsort.MIN_MERGE / 2 && minRun <= Timsort.MIN_MERGE,
      'minrun for ' + n + ' was ' + minRun);
  }
});

test('timsort: no invariant survives the collapse, on every shape', function () {
  SortLab.kinds.forEach(function (kind) {
    [200, 1000, 3000].forEach(function (size) {
      const values = SortLab.tag(SortLab.input(kind, size, 5));
      const list = values.slice();
      const report = Timsort.sort(list, SortOps.create({ key: function (x) { return x.key; } }), {});
      assert.strictEqual(report.invariantViolations, 0,
        kind + ' at ' + size + ' left ' + report.invariantViolations + ' violations');
      assert.ok(report.maxStackDepth < 50, 'the stack stays shallow');
    });
  });
});

test('timsort: the pre-2015 collapse rule leaves a violated invariant', function () {
  /* The run lengths from de Gouw et al. Building an array whose natural runs
     are exactly these lengths is the only way to reach the case: it cannot be
     hit by random data, which is why the bug survived years of it. */
  const lengths = [120, 80, 25, 20, 30];
  const values = [];
  let base = 1000000;
  lengths.forEach(function (length) {
    for (let i = 0; i < length; i += 1) values.push(base + i);
    base -= 1;
  });

  const fixedList = values.slice();
  const fixed = Timsort.sort(fixedList, ops(), { minRun: 1 });
  const buggyList = values.slice();
  const buggy = Timsort.sort(buggyList, ops(), { minRun: 1, buggyCollapse: true });

  assert.deepStrictEqual(fixedList, ascending(values), 'the fixed rule sorts');
  assert.deepStrictEqual(buggyList, ascending(values),
    'and so does the buggy one - which is exactly why it survived');
  assert.strictEqual(fixed.invariantViolations, 0);
  assert.ok(buggy.invariantViolations > 0,
    'the buggy collapse must leave the invariant broken, or this test proves nothing');

  const settled = buggy.stackHistory.filter(function (entry) { return entry.settled; });
  const broken = settled.filter(function (entry) { return entry.violations > 0; });
  assert.ok(broken.length > 0);
  assert.deepStrictEqual(broken[0].lengths, [120, 80, 45, 30],
    'the stack the paper describes: 120 is not greater than 80 + 45');
});

test('timsort: galloping is used, and the run detector finds the runs that exist', function () {
  const clustered = [];
  for (let i = 0; i < 2000; i += 1) clustered.push(i < 1000 ? i : 100000 + i);
  const counted = ops();
  const report = Timsort.sort(clustered.slice(), counted, {});
  assert.strictEqual(report.naturalRuns, 1, 'that input is a single ascending run');

  const interleaved = [];
  for (let i = 0; i < 2000; i += 1) interleaved.push(i % 2 ? i : 3000 - i);
  const second = ops();
  const interleavedReport = Timsort.sort(interleaved.slice(), second, {});
  assert.ok(interleavedReport.runs > 1, 'and interleaved data is many runs');
  assert.ok(interleavedReport.merges > 0);
});

/* -------------------------------------------------------------- pdqsort */

test('pdqsort: each mechanism fires on the input it exists for', function () {
  function report(kind, size) {
    const values = SortLab.input(kind, size, 3);
    const list = values.slice();
    const counted = ops();
    const result = Pdqsort.sort(list, counted, {});
    assert.deepStrictEqual(list, ascending(values), 'pdqsort failed on ' + kind);
    return { report: result, comparisons: counted.stats().comparisons };
  }

  const sorted = report('sorted', 20000);
  assert.ok(sorted.report.partialInsertionWins > 0, 'sorted input must win with partial insertion');
  assert.ok(sorted.comparisons < 3 * 20000, 'so it costs O(n): ' + sorted.comparisons);
  assert.strictEqual(sorted.report.maxDepth, 1);

  const equal = report('few-unique', 20000);
  assert.ok(equal.report.equalBlocks > 0, 'duplicate-heavy input must use the equal-block guard');
  assert.ok(equal.comparisons < 5 * 20000);

  const organ = report('organ-pipe', 20000);
  assert.ok(organ.report.patternBreaks > 0, 'a pattern that unbalances the pivot must be broken');

  const random = report('random', 20000);
  assert.ok(random.report.partialInsertionWins === 0,
    'random input must not be able to win the bounded insertion bet');
});

test('pdqsort: the bounded insertion sort gives up rather than degrading', function () {
  const nearly = [];
  for (let i = 0; i < 200; i += 1) nearly.push(i);
  assert.strictEqual(Pdqsort.partialInsertionSort(nearly, 0, nearly.length, ops()), true);

  /* The property that matters is not the exact move count, it is that the
     count does not depend on n: giving up has to cost the same on a range of
     200 as on a range of 20 000, or the bet is not cheap to lose. */
  const costs = [200, 2000, 20000].map(function (size) {
    const reversed = [];
    for (let i = 0; i < size; i += 1) reversed.push(size - i);
    const counted = ops();
    assert.strictEqual(Pdqsort.partialInsertionSort(reversed, 0, reversed.length, counted), false,
      'it must refuse a reversed range rather than pay O(n squared) to sort it');
    return counted.stats().moves;
  });

  assert.strictEqual(costs[0], costs[1], 'giving up costs the same at 200 and 2 000 elements');
  assert.strictEqual(costs[1], costs[2], 'and the same again at 20 000');
  assert.ok(costs[0] < 4 * Pdqsort.PARTIAL_INSERTION_LIMIT,
    'and it is a small multiple of the limit: ' + costs[0]);
});

/* ---------------------------------------------------------------- radix */

test('radix: LSD is stable-or-broken, and the damage grows with the pass count', function () {
  function run(distinct, unstable) {
    const random = Random.seeded(7);
    const source = [];
    for (let i = 0; i < 2000; i += 1) source.push({ key: random.int(distinct), at: i });
    const list = source.slice();
    RadixSort.lsdRadixSort(list, SortOps.create({ key: function (x) { return x.key; } }),
      { bits: 8, key: function (item) { return item.key; }, unstable: unstable });

    let sorted = true;
    let stable = true;
    for (let i = 1; i < list.length; i += 1) {
      if (list[i - 1].key > list[i].key) sorted = false;
      if (list[i - 1].key === list[i].key && list[i - 1].at > list[i].at) stable = false;
    }
    return { sorted: sorted, stable: stable };
  }

  assert.deepStrictEqual(run(20, false), { sorted: true, stable: true });
  assert.deepStrictEqual(run(1000000, false), { sorted: true, stable: true });

  const oneByte = run(20, true);
  assert.strictEqual(oneByte.sorted, true, 'with one meaningful pass the damage is invisible');
  assert.strictEqual(oneByte.stable, false, 'except in the tie order');

  const fourBytes = run(1000000, true);
  assert.strictEqual(fourBytes.sorted, false,
    'with four passes an unstable pass destroys the passes before it');
});

test('radix: negatives need the sign bias, and without it they sort last', function () {
  const values = [-2147483648, 2147483647, -1, 0, 1, -100, 100];

  const biased = values.slice();
  RadixSort.lsdRadixSort(biased, ops(), { bits: 8 });
  assert.deepStrictEqual(biased, ascending(values));

  const unbiased = values.slice();
  RadixSort.lsdRadixSort(unbiased, ops(), { bits: 8, signed: false });
  assert.deepStrictEqual(unbiased, [0, 1, 100, 2147483647, -2147483648, -100, -1],
    'unsigned digits put every negative after every positive');

  assert.strictEqual(RadixSort.unbiasSigned(RadixSort.biasSigned(-5)), -5);
  assert.ok(RadixSort.biasSigned(-1) < RadixSort.biasSigned(0), 'the bias is order-preserving');
});

test('radix: counting sort is priced by its key range, not by n', function () {
  const small = RadixSort.countingCost(256, 1000);
  const wide = RadixSort.countingCost(65536, 1000);
  const huge = RadixSort.countingCost(4294967296, 1000);

  assert.strictEqual(small.tableBytes, 1024);
  assert.ok(small.wins, 'a byte-sized key range beats a comparison sort');
  assert.strictEqual(wide.tableBytes, 262144);
  assert.ok(!wide.wins);
  assert.strictEqual(huge.tableBytes, 4294967296 * 4);
  assert.ok(!huge.wins, 'a 32-bit key range needs 17 GB of counters');
});

/* ------------------------------------------------------------ selection */

test('selection: every algorithm finds every k, including on all-equal input', function () {
  const sources = [SortLab.input('random', 200, 3), new Array(80).fill(4),
    SortLab.input('few-unique', 150, 5), [7], [2, 1]];

  sources.forEach(function (source, index) {
    const want = ascending(source);
    for (let k = 0; k < source.length; k += 1) {
      assert.strictEqual(Selection.quickSelect(source.slice(), k, ops(),
        { random: Random.seeded(k + 1) }).value, want[k], 'quickselect input ' + index + ' k=' + k);
      assert.strictEqual(Selection.medianOfMedians(source.slice(), k, ops()).value, want[k],
        'median of medians input ' + index + ' k=' + k);
      assert.strictEqual(Selection.introSelect(source.slice(), k, ops()).value, want[k],
        'introselect input ' + index + ' k=' + k);
    }
  });
});

test('selection: quickselect is linear where sorting is n log n', function () {
  const source = SortLab.input('random', 100000, 9);
  const k = source.length >>> 1;

  const quick = ops();
  Selection.quickSelect(source.slice(), k, quick, { random: Random.seeded(3) });
  const guaranteed = ops();
  Selection.medianOfMedians(source.slice(), k, guaranteed);
  const sorting = ops();
  source.slice().sort(function (a, b) { sorting.cmp(a, b); return a - b; });

  const perElement = quick.stats().comparisons / source.length;
  assert.ok(perElement < 6, 'quickselect measured ' + perElement.toFixed(2) + ' comparisons per element');
  assert.ok(guaranteed.stats().comparisons > quick.stats().comparisons,
    'the guaranteed algorithm costs more than the expected-linear one');
  assert.ok(sorting.stats().comparisons > guaranteed.stats().comparisons,
    'and sorting costs more than either');
});

test('selection: top-k and partial sort agree with a full sort', function () {
  const source = SortLab.input('random', 2000, 11);
  const want = ascending(source).slice(0, 10);

  assert.deepStrictEqual(Selection.topK(source, 10, ops()), want);
  const partial = source.slice();
  Selection.partialSort(partial, 10, ops(), { random: Random.seeded(2) });
  assert.deepStrictEqual(partial.slice(0, 10), want);
  assert.deepStrictEqual(ascending(partial), ascending(source), 'and nothing is lost');
});

/* -------------------------------------------------------- binary search */

test('binary search: the bounds are exhaustively correct, including empty and all-equal', function () {
  for (let n = 0; n <= 32; n += 1) {
    for (let seed = 0; seed < 4; seed += 1) {
      const random = Random.seeded(n * 8 + seed);
      const array = [];
      for (let i = 0; i < n; i += 1) array.push(random.int(10));
      array.sort(function (a, b) { return a - b; });

      for (let target = -2; target <= 11; target += 1) {
        const low = BinarySearch.lowerBound(array, target, ops());
        const high = BinarySearch.upperBound(array, target, ops());
        let wantLow = array.length;
        let wantHigh = array.length;
        for (let i = 0; i < array.length; i += 1) {
          if (wantLow === array.length && array[i] >= target) wantLow = i;
          if (wantHigh === array.length && array[i] > target) wantHigh = i;
        }
        assert.strictEqual(low, wantLow, 'lowerBound n=' + n + ' target=' + target);
        assert.strictEqual(high, wantHigh, 'upperBound n=' + n + ' target=' + target);
        assert.strictEqual(BinarySearch.branchlessLowerBound(array, target, ops()), wantLow);
        assert.strictEqual(BinarySearch.equalRange(array, target, ops()).count,
          array.filter(function (v) { return v === target; }).length);
      }
    }
  }
});

test('binary search: the invariant holds at every step of every trace', function () {
  const array = [1, 3, 3, 3, 5, 8, 13, 21];
  for (let target = 0; target <= 22; target += 1) {
    const trace = BinarySearch.traceLowerBound(array, target, ops());
    assert.strictEqual(trace.correct, true, 'target ' + target);
    trace.steps.forEach(function (step, index) {
      assert.strictEqual(step.holds, true, 'the invariant broke at step ' + index);
      assert.ok(step.mid >= step.low && step.mid < step.high, 'mid must be inside the interval');
    });
    assert.ok(trace.steps.length <= Math.ceil(Math.log2(array.length + 1)) + 1);
  }
});

test('binary search: every mutation is caught, and the correct version is caught by nothing', function () {
  const report = BinarySearch.mutationReport();
  const byName = {};
  report.forEach(function (entry) { byName[entry.name] = entry; });

  assert.strictEqual(byName.correct.caught, 0, 'the correct version must pass every probe');
  Object.keys(byName).forEach(function (name) {
    if (name === 'correct') return;
    assert.ok(byName[name].caught > 0, name + ' is not caught by any probe case');
  });

  assert.ok(byName['inclusive-loop'].failures.every(function (failure) {
    return failure.reason === 'read past the end';
  }), 'the inclusive loop is only ever caught by the out-of-bounds read, never by a wrong answer');
  assert.strictEqual(byName['high-mid-minus-one'].caught, 1,
    'and one mutation is caught by exactly one case out of thirteen');
});

test('binary search: the variants answer the questions a plain search cannot', function () {
  const rotated = [15, 18, 20, 2, 3, 6, 12];
  assert.strictEqual(rotated[BinarySearch.rotatedSearch(rotated, 6, ops())], 6);
  assert.strictEqual(BinarySearch.rotatedSearch(rotated, 99, ops()), -1);
  rotated.forEach(function (value) {
    assert.strictEqual(rotated[BinarySearch.rotatedSearch(rotated, value, ops())], value);
  });

  const uniform = [];
  for (let i = 0; i < 10000; i += 1) uniform.push(i * 3);
  const found = BinarySearch.interpolationSearch(uniform, 29997, ops());
  assert.strictEqual(found.index, 9999);
  assert.ok(found.probes <= 3, 'interpolation on uniform data is a couple of probes');

  const near = BinarySearch.exponentialSearch(uniform, 9, ops());
  assert.strictEqual(near.index, 3);
  assert.ok(near.bound <= 8, 'the bound doubles only until it passes the target');
});

test('binary search: the midpoint overflow is real once the arithmetic is 32 bits', function () {
  const wide = BinarySearch.midpointComparison(2000000000, 2100000000);
  assert.strictEqual(wide.safe, 2050000000);
  assert.strictEqual(wide.naive, 2050000000, 'doubles do not overflow, so JavaScript hides it');
  assert.ok(wide.bits32 < 0, 'and the same expression through 32 bits is negative');
  assert.strictEqual(wide.overflows, true);

  const narrow = BinarySearch.midpointComparison(4, 10);
  assert.strictEqual(narrow.overflows, false);
  assert.strictEqual(narrow.safe, narrow.bits32);
});

/* -------------------------------------------------------- answer search */

test('answer search: every problem agrees with brute force, and the predicates are monotone', function () {
  for (let trial = 0; trial < 60; trial += 1) {
    const random = Random.seeded(trial + 1);
    const n = 2 + random.int(8);
    const weights = [];
    for (let i = 0; i < n; i += 1) weights.push(1 + random.int(20));

    const ships = AnswerSearch.shipCapacity(weights, 1 + random.int(n));
    assert.strictEqual(ships.answer,
      AnswerSearch.scanForFirstTrue(ships.low, ships.high, ships.feasible), 'ships');
    assert.strictEqual(AnswerSearch.monotonicityReport(ships.low, ships.high, ships.feasible).monotone,
      true, 'the ship predicate must be monotone or the search is not licensed');

    const books = AnswerSearch.allocateBooks(weights, 1 + random.int(n));
    assert.strictEqual(books.answer,
      AnswerSearch.scanForFirstTrue(books.low, books.high, books.feasible), 'books');

    const stalls = [];
    for (let i = 0; i < n + 2; i += 1) stalls.push(random.int(100));
    const cows = AnswerSearch.aggressiveCows(stalls, 2 + random.int(n));
    let wanted = -1;
    for (let x = cows.low; x <= cows.high; x += 1) {
      if (cows.feasible(x)) wanted = x;
    }
    assert.strictEqual(cows.answer, wanted, 'cows is a last-true search and must not be one too small');
  }
});

test('answer search: the canonical instances give the canonical answers', function () {
  const ships = AnswerSearch.shipCapacity([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5);
  assert.strictEqual(ships.answer, 15);
  assert.strictEqual(ships.checks, 5);
  assert.strictEqual(ships.span, 46, 'and it checked 5 capacities out of 46');

  const cows = AnswerSearch.aggressiveCows([1, 2, 4, 8, 9], 3);
  assert.strictEqual(cows.answer, 3);

  const divisor = AnswerSearch.smallestDivisor([1, 2, 5, 9], 6);
  assert.strictEqual(divisor.answer,
    AnswerSearch.scanForFirstTrue(divisor.low, divisor.high, divisor.feasible));
});

test('answer search: a non-monotone predicate is detected rather than silently searched', function () {
  const bumpy = function (x) { return x === 3 || x >= 7; };
  const report = AnswerSearch.monotonicityReport(0, 10, bumpy);
  assert.strictEqual(report.monotone, false);
  assert.ok(report.flips > 1, 'a monotone predicate flips once; this one flips ' + report.flips);

  const monotone = AnswerSearch.monotonicityReport(0, 10, function (x) { return x >= 4; });
  assert.strictEqual(monotone.monotone, true);
  assert.strictEqual(monotone.flips, 1);
  assert.strictEqual(monotone.firstTrue, 4);
});

test('answer search: ternary search finds the peak of a unimodal function', function () {
  const peak = AnswerSearch.ternarySearchInteger(0, 1000, function (x) {
    return -(x - 37) * (x - 37) + 500;
  });
  assert.strictEqual(peak.at, 37);
  assert.strictEqual(peak.value, 500);

  const edge = AnswerSearch.ternarySearchInteger(0, 1000, function (x) {
    return -(x - 812) * (x - 812) + 9;
  });
  assert.strictEqual(edge.at, 812);

  const real = AnswerSearch.ternarySearchReal(0, 10, function (x) {
    return -(x - 3.5) * (x - 3.5) + 9;
  });
  assert.ok(Math.abs(real.at - 3.5) < 1e-6, 'converged to ' + real.at);
  assert.ok(real.width < 1e-12, 'and the interval really did close');
});

/* ------------------------------------------------------- external sort */

test('external sort: correct, and the pass count is the predicted one', function () {
  for (let trial = 0; trial < 20; trial += 1) {
    const source = SortLab.input('random', 1 + trial * 43, trial + 1);
    ['sort-and-flush', 'replacement-selection'].forEach(function (generation) {
      const list = source.slice();
      const report = ExternalSort.sort(list, ops(),
        { memory: 16, order: 4, runGeneration: generation });
      assert.deepStrictEqual(list, ascending(source), generation + ' at n = ' + source.length);
      assert.strictEqual(report.mergePasses, report.predictedPasses,
        generation + ': predicted ' + report.predictedPasses + ', ran ' + report.mergePasses);
    });
  }
});

test('external sort: replacement selection makes runs about twice the size of memory', function () {
  const source = SortLab.input('random', 10000, 5);

  const flushed = ExternalSort.sort(source.slice(), ops(),
    { memory: 100, order: 4, runGeneration: 'sort-and-flush' });
  const replaced = ExternalSort.sort(source.slice(), ops(),
    { memory: 100, order: 4, runGeneration: 'replacement-selection' });

  assert.strictEqual(flushed.initialRuns, 100, 'sort-and-flush is exactly ceil(n/M) runs');
  assert.strictEqual(flushed.meanRunLength, 100);
  assert.ok(replaced.meanRunLength > 180 && replaced.meanRunLength < 220,
    'the snowplough argument predicts 2M = 200, measured ' + replaced.meanRunLength.toFixed(1));
  assert.ok(replaced.mergePasses < flushed.mergePasses, 'and halving the runs removes a whole pass');
  assert.ok(replaced.totalTransfers < flushed.totalTransfers);
});

test('external sort: sorted input costs replacement selection one run and no merge', function () {
  const sorted = SortLab.input('sorted', 5000, 1);
  const report = ExternalSort.sort(sorted.slice(), ops(),
    { memory: 100, order: 4, runGeneration: 'replacement-selection' });

  assert.strictEqual(report.initialRuns, 1);
  assert.strictEqual(report.mergePasses, 0);
});

test('external sort: the merge order is the base of the logarithm', function () {
  const source = SortLab.input('random', 10000, 5);
  const passes = [2, 4, 8, 16].map(function (order) {
    return ExternalSort.sort(source.slice(), ops(),
      { memory: 100, order: order, runGeneration: 'sort-and-flush' }).mergePasses;
  });

  assert.deepStrictEqual(passes, [7, 4, 3, 2]);
  const model = ExternalSort.ioCost(1000000000, 10000000, 100000, 99);
  assert.strictEqual(model.runs, 100);
  assert.strictEqual(model.mergePasses, 2);
  assert.strictEqual(model.blockTransfers, 60000);
});

/* ------------------------------------------------------------ networks */

test('networks: the zero-one principle verifies every network exhaustively', function () {
  [4, 8, 16].forEach(function (size) {
    Networks.kinds.forEach(function (kind) {
      const network = Networks.networks[kind].build(size);
      const verdict = Networks.verifyZeroOne(network);
      assert.strictEqual(verdict.exhaustive, true);
      assert.strictEqual(verdict.checked, 1 << size);
      assert.strictEqual(verdict.failures, 0, kind + ' at ' + size + ' does not sort');
    });
  });
});

test('networks: a network really sorts, and its depth is the parallel time', function () {
  [4, 8, 16].forEach(function (size) {
    for (let trial = 0; trial < 10; trial += 1) {
      const source = SortLab.input('random', size, size * 10 + trial);
      Networks.kinds.forEach(function (kind) {
        const list = source.slice();
        Networks.apply(Networks.networks[kind].build(size), list, ops());
        assert.deepStrictEqual(list, ascending(source), kind + ' at ' + size);
      });
    }
  });

  [8, 16, 64, 1024].forEach(function (size) {
    const levels = Math.log2(size);
    assert.strictEqual(Networks.bitonicNetwork(size).depth, levels * (levels + 1) / 2,
      'bitonic depth is log2(n)(log2(n)+1)/2 at n = ' + size);
  });
});

test('networks: deleting one comparator can be caught by a single input', function () {
  const network = Networks.bitonicNetwork(8);
  const sensitivity = Networks.deletionSensitivity(network);

  sensitivity.forEach(function (entry) {
    assert.ok(entry.caughtBy > 0, 'every comparator must matter');
    assert.strictEqual(entry.of, 256);
  });

  const hardest = sensitivity.reduce(function (best, entry) {
    return entry.caughtBy < best.caughtBy ? entry : best;
  });
  assert.strictEqual(hardest.caughtBy, 1,
    'and the hardest deletion is caught by exactly one of the 256 zero-one inputs');
});

test('networks: padding to a power of two is a cliff, not a rounding', function () {
  const table = Networks.costTable([1024, 1025]);
  assert.strictEqual(table[0].padding, 0);
  assert.strictEqual(table[1].padded, 2048);
  assert.strictEqual(table[1].padding, 1023);
  assert.ok(table[1].bitonicComparators > 2 * table[0].bitonicComparators / 1.1,
    'one extra element more than doubles the comparators');
});

/* -------------------------------------------------------------- the lab */

test('sort lab: every algorithm on every shape is right, and every claim honest', function () {
  SortLab.kinds.forEach(function (kind) {
    SortLab.compare({ kind: kind, size: 300, seed: 3 }).forEach(function (row) {
      assert.strictEqual(row.wrong, 0, row.algorithm + ' got ' + row.wrong + ' wrong on ' + kind);
      assert.strictEqual(row.stabilityHonest, true,
        row.algorithm + ' claims stability it does not have on ' + kind);
    });
  });
});

test('sort lab: a broken comparator does not throw, it returns a wrong order', function () {
  const report = SortLab.comparatorReport({ size: 40, seed: 5 });
  const byName = {};
  report.forEach(function (entry) { byName[entry.name] = entry; });

  assert.strictEqual(byName.correct.sorted, true);
  assert.strictEqual(byName.correct.axiomViolations, 0);

  assert.strictEqual(byName['default-string'].threw, null,
    'the default sort does not complain about sorting numbers as strings');
  assert.strictEqual(byName['default-string'].matchesCorrect, false,
    'it just returns a different order');

  ['boolean-return', 'random-order', 'reversed-on-equal'].forEach(function (name) {
    assert.strictEqual(byName[name].threw, null, name + ' must not throw');
    assert.ok(byName[name].axiomViolations > 0, name + ' must break an axiom');
  });
});
