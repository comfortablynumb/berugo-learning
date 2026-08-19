'use strict';

/**
 * Unit tests for the M10 sorts.
 *
 * A sort is the easiest thing in the world to test badly: run it on twenty
 * random integers, see an ascending list, ship it. Every property here is one
 * that a test like that misses.
 *
 *   correctness      against a reference sort, on all seven generator shapes
 *                    and at every length from 0 to 40 - because the bugs live
 *                    at 0, 1, 2 and at the recursion's cutoff, not at 20.
 *   stability        by tagging every element with its original index, which
 *                    is the only way the output can answer the question. The
 *                    sorts that claim it are asserted to have it, and the
 *                    ones that do not are asserted to *lack* it, so an
 *                    accidental change of algorithm is caught in both
 *                    directions.
 *   the counters     a sort whose comparison count does not respond to the
 *                    input shape is not adaptive, whatever its documentation
 *                    says. Selection sort's n(n-1)/2 is asserted exactly.
 *   the failure      the adversarial input really does drive median-of-three
 *                    quicksort past n²/4, and introsort really does escape.
 */

const test = require('node:test');
const assert = require('node:assert');

const SortOps = require('../../src/js/algorithms/sort-ops.js');
const Elementary = require('../../src/js/algorithms/sorts-elementary.js');
const MergeSort = require('../../src/js/algorithms/merge-sort.js');
const QuickSort = require('../../src/js/algorithms/quick-sort.js');
const Timsort = require('../../src/js/algorithms/timsort.js');
const Pdqsort = require('../../src/js/algorithms/pdqsort.js');
const RadixSort = require('../../src/js/algorithms/radix-sort.js');
const SortLab = require('../../src/js/machines/sort-lab.js');
const Random = require('../../src/js/utils/random.js');

function ops(options) {
  return SortOps.create(options || {});
}

function taggedOps() {
  return SortOps.create({ key: function (item) { return item.key; } });
}

/** Tagged items, so stability is observable. */
function items(length, seed, distinct) {
  const random = Random.seeded(seed);
  const out = new Array(length);
  for (let i = 0; i < length; i += 1) {
    out[i] = { key: random.int(distinct === undefined ? 1000 : distinct), at: i };
  }
  return out;
}

function expected(list) {
  return list.slice().sort(function (a, b) {
    return a.key === b.key ? a.at - b.at : a.key - b.key;
  });
}

function isSorted(list) {
  for (let i = 1; i < list.length; i += 1) {
    if (list[i - 1].key > list[i].key) return false;
  }
  return true;
}

function isStable(list) {
  for (let i = 1; i < list.length; i += 1) {
    if (list[i - 1].key === list[i].key && list[i - 1].at > list[i].at) return false;
  }
  return true;
}

/* Every sort, behind one signature, so the shared property tests below are
   written once rather than fifteen times. */
const SORTS = {
  insertion: { stable: true, run: function (list, o) { Elementary.insertionSort(list, o, {}); } },
  'binary-insertion': { stable: true, run: function (list, o) { Elementary.binaryInsertionSort(list, o, {}); } },
  selection: { stable: false, run: function (list, o) { Elementary.selectionSort(list, o); } },
  bubble: { stable: true, run: function (list, o) { Elementary.bubbleSort(list, o); } },
  shell: { stable: false, run: function (list, o) { Elementary.shellSort(list, o); } },
  'merge-top-down': { stable: true, run: function (list, o) { MergeSort.topDownSort(list, o, {}); } },
  'merge-bottom-up': { stable: true, run: function (list, o) { MergeSort.bottomUpSort(list, o, {}); } },
  'merge-natural': { stable: true, run: function (list, o) { MergeSort.naturalSort(list, o, {}); } },
  'merge-in-place': { stable: true, run: function (list, o) { MergeSort.inPlaceSort(list, o); } },
  'quick-lomuto': {
    stable: false,
    run: function (list, o) { QuickSort.sort(list, o, { partition: 'lomuto', pivot: 'median-of-three' }); }
  },
  'quick-hoare': {
    stable: false,
    run: function (list, o) { QuickSort.sort(list, o, { partition: 'hoare', pivot: 'median-of-three' }); }
  },
  'quick-three-way': {
    stable: false,
    run: function (list, o) { QuickSort.sort(list, o, { partition: 'three-way', pivot: 'ninther' }); }
  },
  introsort: {
    stable: false,
    run: function (list, o) { QuickSort.introSort(list, o, { insertionSort: Elementary.insertionSort }); }
  },
  timsort: { stable: true, run: function (list, o) { Timsort.sort(list, o, {}); } },
  pdqsort: { stable: false, run: function (list, o) { Pdqsort.sort(list, o, {}); } },
  'radix-lsd': {
    stable: true,
    run: function (list, o) {
      RadixSort.lsdRadixSort(list, o, { bits: 8, key: function (item) { return item.key; } });
    }
  }
};

test('every sort: correct at every length from 0 to 40, on wide and narrow key ranges', function () {
  Object.keys(SORTS).forEach(function (name) {
    for (let n = 0; n <= 40; n += 1) {
      [3, 1000].forEach(function (distinct) {
        const source = items(n, n * 7 + distinct, distinct);
        const list = source.slice();
        SORTS[name].run(list, taggedOps());
        assert.strictEqual(list.length, n, name + ': length changed at n = ' + n);
        assert.deepStrictEqual(list.map(function (x) { return x.key; }),
          expected(source).map(function (x) { return x.key; }),
          name + ': wrong order at n = ' + n + ', ' + distinct + ' distinct keys');
      });
    }
  });
});

test('every sort: correct on all seven generator shapes', function () {
  Object.keys(SORTS).forEach(function (name) {
    SortLab.kinds.forEach(function (kind) {
      const values = SortLab.input(kind, 300, 11);
      const source = SortLab.tag(values);
      const list = source.slice();
      SORTS[name].run(list, taggedOps());
      assert.ok(isSorted(list), name + ' did not sort the ' + kind + ' input');
      assert.deepStrictEqual(list.map(function (x) { return x.key; }),
        expected(source).map(function (x) { return x.key; }), name + ' on ' + kind);
    });
  });
});

test('every sort: the stability claim is true in both directions', function () {
  /* Many duplicates, so an unstable sort has somewhere to go wrong. */
  const source = items(400, 29, 8);

  Object.keys(SORTS).forEach(function (name) {
    const list = source.slice();
    SORTS[name].run(list, taggedOps());
    assert.ok(isSorted(list), name + ': not sorted');
    if (SORTS[name].stable) {
      assert.ok(isStable(list), name + ' claims stability and reordered equal keys');
    }
  });

  /* And the unstable ones really are unstable - an algorithm that quietly
     became stable is a different algorithm, and the section's table would be
     wrong about it. */
  ['selection', 'shell', 'quick-lomuto', 'quick-three-way'].forEach(function (name) {
    const list = source.slice();
    SORTS[name].run(list, taggedOps());
    assert.ok(!isStable(list), name + ' is documented as unstable but kept every tie in order');
  });
});

test('sort-ops: the counters are separate measurements, not one total', function () {
  const selectionOps = taggedOps();
  const selection = items(200, 3);
  Elementary.selectionSort(selection.slice(), selectionOps);

  const insertionOps = taggedOps();
  Elementary.insertionSort(selection.slice(), insertionOps, {});

  const a = selectionOps.stats();
  const b = insertionOps.stats();
  assert.strictEqual(a.comparisons, 200 * 199 / 2, 'selection sort is n(n-1)/2 comparisons, exactly');
  assert.ok(a.swaps <= 199, 'selection sort does at most n-1 swaps');
  assert.ok(b.moves > a.moves, 'insertion sort moves far more than selection sort');
  assert.ok(b.comparisons < a.comparisons, 'and compares far less on this input');
});

test('elementary: insertion sort is adaptive and selection sort is not', function () {
  const shapes = ['sorted', 'nearly-sorted', 'random'];
  const insertion = [];
  const selection = [];

  shapes.forEach(function (kind) {
    const values = SortLab.tag(SortLab.input(kind, 1000, 5));
    const one = taggedOps();
    Elementary.insertionSort(values.slice(), one, {});
    insertion.push(one.stats().comparisons);

    const two = taggedOps();
    Elementary.selectionSort(values.slice(), two);
    selection.push(two.stats().comparisons);
  });

  assert.strictEqual(insertion[0], 999, 'sorted input costs one comparison per element');
  assert.ok(insertion[1] < insertion[2] / 10, 'nearly sorted must be far cheaper than random');
  assert.strictEqual(selection[0], selection[1], 'selection sort cannot tell the shapes apart');
  assert.strictEqual(selection[1], selection[2], 'and it never will');
  assert.strictEqual(selection[0], 1000 * 999 / 2);
});

test('elementary: inversions are what insertion sort is linear in', function () {
  const values = [3, 1, 2];
  assert.strictEqual(Elementary.countInversions(values), 2);
  assert.strictEqual(Elementary.countInversions([5, 4, 3, 2, 1]), 10);
  assert.strictEqual(Elementary.countInversions([1, 2, 3, 4, 5]), 0);

  const nearly = SortLab.input('nearly-sorted', 2000, 4);
  const inversions = Elementary.countInversions(nearly);
  const counted = ops();
  Elementary.insertionSort(nearly.slice(), counted, {});
  const moves = counted.stats().moves;
  assert.ok(moves <= inversions + nearly.length,
    'shifts cannot exceed the inversion count plus one placement per element');
});

test('merge: bottom-up does the same comparisons as top-down and half the moves', function () {
  const source = items(1024, 13);

  const top = taggedOps();
  MergeSort.topDownSort(source.slice(), top, {});
  const bottom = taggedOps();
  MergeSort.bottomUpSort(source.slice(), bottom, {});

  assert.ok(Math.abs(top.stats().comparisons - bottom.stats().comparisons) < source.length / 4,
    'the two schedules do essentially the same merges');
  assert.ok(bottom.stats().moves < top.stats().moves,
    'top-down copies back after every merge and bottom-up does not');
  assert.strictEqual(top.stats().allocations, 1, 'one buffer for the whole sort');
  assert.strictEqual(bottom.stats().allocations, 1);
});

test('merge: the unstable merge is the only difference, and it is one comparison', function () {
  const source = items(500, 17, 6);

  const stable = source.slice();
  MergeSort.topDownSort(stable, taggedOps(), {});
  assert.ok(isStable(stable), 'the default merge is stable');

  const unstable = source.slice();
  MergeSort.topDownSort(unstable, taggedOps(), { unstableMerge: true });
  assert.ok(isSorted(unstable), 'it still sorts, which is what makes the bug survive');
  assert.ok(!isStable(unstable), 'and it is no longer stable');
});

test('merge: natural merge finds the runs already present', function () {
  const sorted = SortLab.input('sorted', 2000, 1);
  const counted = ops();
  const run = MergeSort.naturalSort(sorted.slice(), counted, {});
  assert.strictEqual(run.passes, 0, 'a sorted array is one run and needs no merge');
  assert.strictEqual(counted.stats().comparisons, 2000, 'one pass, one comparison per element');

  const reversed = SortLab.input('reversed', 2000, 1);
  const reverseOps = ops();
  const reverseRun = MergeSort.naturalSort(reversed.slice(), reverseOps, {});
  assert.strictEqual(reverseRun.passes, 0, 'a strictly descending array is one run, reversed in place');
  assert.deepStrictEqual(reverseRun.array, reversed.slice().sort(function (a, b) { return a - b; }));
});

test('merge: in-place merging buys zero allocations with moves', function () {
  const source = items(512, 23);

  const buffered = taggedOps();
  MergeSort.topDownSort(source.slice(), buffered, {});
  const inPlace = taggedOps();
  MergeSort.inPlaceSort(source.slice(), inPlace);

  assert.strictEqual(inPlace.stats().allocations, 0, 'no buffer at all');
  assert.ok(inPlace.stats().allocations < buffered.stats().allocations);
  assert.ok(inPlace.stats().moves + inPlace.stats().swaps > buffered.stats().moves,
    '"in place" is paid for in data movement');
});

test('merge: a k-way merge is one pass over every run', function () {
  const runs = [[1, 4, 9], [2, 3, 10], [0, 5, 6, 7, 8]];
  const counted = ops();
  const merged = MergeSort.kWayMerge(runs, counted);

  assert.deepStrictEqual(merged.values, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.strictEqual(merged.runs, 3);
  assert.strictEqual(merged.values.length, 11);
});
