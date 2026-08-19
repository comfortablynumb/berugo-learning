/**
 * Quicksort: two partition schemes, four pivot rules, the all-equal disaster
 * and the depth limit that turns the quadratic case into a merely slower one.
 *
 * The section is about failure rather than about the average case. Quicksort's
 * expected O(n log n) is real and its worst case is O(n²), and the gap between
 * them is entirely decided by two choices this module makes explicit:
 *
 *   the partition scheme   Lomuto is easier to write and does about 3× the
 *                          swaps of Hoare; on all-equal input Lomuto puts
 *                          every element on one side and recurses n deep.
 *   the pivot rule         first/last is quadratic on sorted input - the most
 *                          common real input there is. median-of-three fixes
 *                          that and is still defeatable by a constructed
 *                          input; random is defeatable only by guessing the
 *                          seed.
 *
 * Three-way (Dutch national flag) partitioning is the fix for duplicates: the
 * equal block is placed and never recursed into, so an array of one distinct
 * value is sorted in a single linear pass instead of n levels.
 *
 * `introsort` is the engineering answer: run quicksort, count the depth, and
 * when it passes 2·log2(n) switch that subarray to heapsort. The average case
 * is untouched and the worst case becomes O(n log n) - which is why every
 * `std::sort` on earth is some version of this.
 *
 * `maxDepth` and `heapsortFallbacks` are reported so the escape can be seen
 * firing rather than assumed.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.QuickSort = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const SMALL = 16;

  /* ------------------------------------------------------------ pivots */

  function medianOfThree(array, a, b, c, ops) {
    if (ops.cmp(array[a], array[b]) > 0) { const h = a; a = b; b = h; }
    if (ops.cmp(array[b], array[c]) > 0) { b = c; }
    if (ops.cmp(array[a], array[b]) > 0) { b = a; }
    return b;
  }

  /** Tukey's ninther: the median of three medians of three. It costs 12 extra
   *  comparisons and is what pdqsort and BSD qsort use above a few hundred
   *  elements, because median-of-three on a large array still samples three
   *  points out of thousands. */
  function ninther(array, from, to, ops) {
    const n = to - from;
    const step = n >>> 3;
    const mid = from + (n >>> 1);
    return medianOfThree(array,
      medianOfThree(array, from, from + step, from + 2 * step, ops),
      medianOfThree(array, mid - step, mid, mid + step, ops),
      medianOfThree(array, to - 1 - 2 * step, to - 1 - step, to - 1, ops), ops);
  }

  const PIVOTS = {
    first: function (array, from) { return from; },
    last: function (array, from, to) { return to - 1; },
    middle: function (array, from, to) { return from + ((to - from) >>> 1); },
    random: function (array, from, to, ops, random) {
      return from + (random ? random.int(to - from) : 0);
    },
    'median-of-three': function (array, from, to, ops) {
      return medianOfThree(array, from, from + ((to - from) >>> 1), to - 1, ops);
    },
    ninther: function (array, from, to, ops) {
      return to - from < 9 ? medianOfThree(array, from, from + ((to - from) >>> 1), to - 1, ops)
        : ninther(array, from, to, ops);
    }
  };

  /* -------------------------------------------------------- partitions */

  /**
   * Lomuto: one forward scan, everything < pivot swapped to the front. The
   * simple one, and the one whose all-equal behaviour is a disaster - with
   * `<= 0` every element moves left and the split is n-1/0.
   */
  function lomuto(array, from, to, pivotIndex, ops) {
    ops.swap(array, pivotIndex, to - 1);
    const pivot = array[to - 1];
    let store = from;

    for (let i = from; i < to - 1; i += 1) {
      if (ops.cmp(array[i], pivot) < 0) {
        ops.swap(array, i, store);
        store += 1;
      }
    }
    ops.swap(array, store, to - 1);
    return { left: store, right: store + 1 };
  }

  /**
   * Hoare: two pointers walking inwards, swapping the pairs that are on the
   * wrong side. It does about a third of Lomuto's swaps, and - the part that
   * matters - it *stops* on elements equal to the pivot, so all-equal input
   * splits down the middle instead of at the end.
   *
   * Two traps live in these six lines, and both are silent.
   *
   * The do/while form is the correct one. The version with `while (a[i] <
   * pivot) i++` before the first increment runs off the end when the pivot is
   * the maximum, which is the classic Hoare off-by-one.
   *
   * And the chosen pivot is swapped to `from` first, because Hoare's scheme
   * does not tolerate the pivot sitting at `to - 1`: the split can then be
   * the whole range and the recursion never shrinks. It does not return a
   * wrong answer - it hangs. With the pivot at `from` the returned cut is
   * always strictly inside the range, so both sides get smaller.
   */
  function hoare(array, from, to, pivotIndex, ops) {
    ops.swap(array, pivotIndex, from);
    const pivot = array[from];
    let i = from - 1;
    let j = to;

    for (;;) {
      do { i += 1; } while (ops.cmp(array[i], pivot) < 0);
      do { j -= 1; } while (ops.cmp(array[j], pivot) > 0);
      if (i >= j) return { left: j + 1, right: j + 1 };
      ops.swap(array, i, j);
    }
  }

  /**
   * Dutch national flag. One pass, three regions: less, equal, greater. The
   * equal block is final, so the recursion skips it entirely - which is what
   * makes duplicate-heavy input linear instead of quadratic.
   */
  function threeWay(array, from, to, pivotIndex, ops) {
    const pivot = array[pivotIndex];
    let less = from;
    let i = from;
    let greater = to;

    while (i < greater) {
      const order = ops.cmp(array[i], pivot);
      if (order < 0) { ops.swap(array, i, less); less += 1; i += 1; }
      else if (order > 0) { greater -= 1; ops.swap(array, i, greater); }
      else i += 1;
    }
    return { left: less, right: greater };
  }

  const PARTITIONS = { lomuto: lomuto, hoare: hoare, 'three-way': threeWay };

  /* ------------------------------------------------------------- sorts */

  function heapifyRange(array, from, to, root, ops) {
    const length = to - from;
    let parent = root;
    for (;;) {
      const left = 2 * parent + 1;
      if (left >= length) return;
      const right = left + 1;
      let best = right < length && ops.cmp(array[from + right], array[from + left]) > 0 ? right : left;
      if (ops.cmp(array[from + best], array[from + parent]) <= 0) return;
      ops.swap(array, from + parent, from + best);
      parent = best;
    }
  }

  /** Introsort's escape hatch: O(n log n) worst case, in place, and slower
   *  than quicksort on average - which is exactly what a fallback should be. */
  function heapSortRange(array, from, to, ops) {
    const length = to - from;
    for (let i = (length >>> 1) - 1; i >= 0; i -= 1) heapifyRange(array, from, to, i, ops);
    for (let end = length - 1; end > 0; end -= 1) {
      ops.swap(array, from, from + end);
      heapifyRange(array, from, from + end, 0, ops);
    }
  }

  function settingsFor(options) {
    const settings = options || {};
    return {
      partition: PARTITIONS[settings.partition] ? settings.partition : 'hoare',
      pivot: PIVOTS[settings.pivot] ? settings.pivot : 'median-of-three',
      random: settings.random || null,
      depthLimit: settings.depthLimit === undefined ? null : settings.depthLimit,
      smallCutoff: settings.smallCutoff === undefined ? 0 : settings.smallCutoff,
      insertionSort: settings.insertionSort || null
    };
  }

  /**
   * The sort. `depthLimit` null means plain quicksort with no escape - the
   * configuration the adversarial demo drives into quadratic. A number turns
   * it into introsort.
   */
  function sort(array, ops, options) {
    const config = settingsFor(options);
    const partition = PARTITIONS[config.partition];
    const pickPivot = PIVOTS[config.pivot];
    const report = { maxDepth: 0, partitions: 0, heapsortFallbacks: 0, insertionRuns: 0 };

    function sortRange(from, to, depth) {
      if (depth > report.maxDepth) report.maxDepth = depth;

      while (to - from > 1) {
        if (config.smallCutoff && to - from <= config.smallCutoff && config.insertionSort) {
          config.insertionSort(array, ops, { from: from, to: to });
          report.insertionRuns += 1;
          return;
        }
        if (config.depthLimit !== null && depth >= config.depthLimit) {
          heapSortRange(array, from, to, ops);
          report.heapsortFallbacks += 1;
          return;
        }

        const bounds = partition(array, from, to, pickPivot(array, from, to, ops, config.random), ops);
        report.partitions += 1;

        /* Recurse into the smaller side and loop on the larger: the stack
           depth is then O(log n) even when the recursion depth is not. */
        if (bounds.left - from < to - bounds.right) {
          sortRange(from, bounds.left, depth + 1);
          from = bounds.right;
        } else {
          sortRange(bounds.right, to, depth + 1);
          to = bounds.left;
        }
        depth += 1;
        if (depth > report.maxDepth) report.maxDepth = depth;
      }
    }

    sortRange(0, array.length, 1);
    return report;
  }

  /** Introsort as libraries ship it: 2·log2(n) depth limit, insertion sort
   *  under 16 elements, ninther pivot. */
  function introSort(array, ops, options) {
    const settings = options || {};
    return sort(array, ops, {
      partition: settings.partition || 'three-way',
      pivot: settings.pivot || 'ninther',
      random: settings.random,
      depthLimit: 2 * Math.max(1, Math.ceil(Math.log2(Math.max(2, array.length)))),
      smallCutoff: settings.smallCutoff === undefined ? SMALL : settings.smallCutoff,
      insertionSort: settings.insertionSort
    });
  }

  /**
   * The killer input for a deterministic pivot rule.
   *
   * McIlroy's anti-quicksort: sort with a comparator that has not decided the
   * values yet, and let it decide them adversarially - whichever element the
   * algorithm compares to a pivot becomes the value that makes that pivot bad.
   * The result is an array of the integers 0..n-1 whose *arrangement* drives
   * the given pivot rule into a worst-case split at every level.
   *
   * It is built against a live sort rather than by formula, so it defeats
   * exactly the configuration passed in and nothing else - which is the point
   * the section makes about "random pivot is not paranoia".
   */
  function adversarialInput(n, options) {
    const settings = options || {};
    const gas = n;
    const values = new Array(n);
    const candidate = new Array(n);
    let nsolid = 0;
    for (let i = 0; i < n; i += 1) { values[i] = gas; candidate[i] = i; }

    let pivotAt = 0;
    function compare(x, y) {
      if (values[x] === gas && values[y] === gas) {
        if (x === pivotAt) values[x] = nsolid++;
        else values[y] = nsolid++;
      }
      if (values[x] === gas) pivotAt = x;
      else if (values[y] === gas) pivotAt = y;
      return values[x] - values[y];
    }

    const probe = candidate.slice();
    const ops = {
      cmp: compare,
      swap: function (array, i, j) { const h = array[i]; array[i] = array[j]; array[j] = h; },
      write: function (array, i, v) { array[i] = v; },
      move: function () {},
      alloc: function () {}
    };
    sort(probe, ops, {
      partition: settings.partition || 'lomuto',
      pivot: settings.pivot || 'median-of-three',
      depthLimit: null
    });

    const out = new Array(n);
    for (let i = 0; i < n; i += 1) out[i] = values[i] === gas ? nsolid++ : values[i];
    return out;
  }

  const ALGORITHMS = {
    'lomuto-first': { partition: 'lomuto', pivot: 'first', label: 'Lomuto · first' },
    'lomuto-median': { partition: 'lomuto', pivot: 'median-of-three', label: 'Lomuto · median-of-three' },
    'hoare-median': { partition: 'hoare', pivot: 'median-of-three', label: 'Hoare · median-of-three' },
    'hoare-random': { partition: 'hoare', pivot: 'random', label: 'Hoare · random' },
    'three-way-ninther': { partition: 'three-way', pivot: 'ninther', label: 'three-way · ninther' }
  };

  return {
    sort: sort,
    introSort: introSort,
    heapSortRange: heapSortRange,
    adversarialInput: adversarialInput,
    partitions: PARTITIONS,
    pivots: PIVOTS,
    algorithms: ALGORITHMS,
    kinds: Object.keys(ALGORITHMS),
    partitionKinds: Object.keys(PARTITIONS),
    pivotKinds: Object.keys(PIVOTS)
  };
}));
