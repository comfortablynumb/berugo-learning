/**
 * Finding the k-th smallest without sorting: quickselect, median of medians,
 * introselect, and the top-k question that is usually asked instead.
 *
 * Quickselect is quicksort that recurses into one side only. That single
 * change takes the expected cost from n log n to 2n - the recurrence
 * T(n) = T(n/2) + n sums to 2n rather than multiplying by the depth - and
 * leaves the same O(n²) worst case, for the same reason and with the same
 * fixes.
 *
 * Median of medians is the guarantee: split into groups of five, take each
 * group's median, recursively select the median of those, use it as the
 * pivot. It provably discards at least 30% of the array per step, so the
 * worst case is linear. It is also slower than quickselect on virtually every
 * real input, because "linear" hides a constant near 10, and the section
 * measures that rather than repeating the folklore in either direction.
 *
 * Introselect is what libraries ship: quickselect, with a fallback to the
 * guaranteed algorithm once the recursion has gone deeper than it should.
 *
 * The comparison the section is really about is `sort then index` versus
 * `select`: n log n against ~2n, which is a factor of log n that only starts
 * to matter when it does.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Selection = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const GROUP = 5;

  /**
   * Three-way partition around a value, so duplicate-heavy input cannot make
   * selection quadratic. Returns the boundaries of the equal block: if k
   * lands inside it, the answer is already found and no recursion happens.
   */
  function partitionThreeWay(array, from, to, pivot, ops) {
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

  function medianOfThree(array, a, b, c, ops) {
    if (ops.cmp(array[a], array[b]) > 0) { const held = a; a = b; b = held; }
    if (ops.cmp(array[b], array[c]) > 0) b = c;
    if (ops.cmp(array[a], array[b]) > 0) b = a;
    return b;
  }

  function pivotValue(array, from, to, ops, random) {
    if (random) return array[from + random.int(to - from)];
    return array[medianOfThree(array, from, from + ((to - from) >>> 1), to - 1, ops)];
  }

  /**
   * Quickselect. `report.discarded` is the figure that explains the linear
   * expectation: each partition throws away one whole side, so the work
   * halves rather than doubling.
   */
  function quickSelect(array, k, ops, options) {
    const settings = options || {};
    const report = { partitions: 0, discarded: 0, maxDepth: 0, fallbacks: 0 };
    let from = 0;
    let to = array.length;
    let depth = 0;

    while (to - from > 1) {
      depth += 1;
      if (depth > report.maxDepth) report.maxDepth = depth;

      const usesFallback = settings.depthLimit !== undefined && depth > settings.depthLimit;
      const pivot = usesFallback
        ? medianOfMediansValue(array, from, to, ops, report)
        : pivotValue(array, from, to, ops, settings.random);
      if (usesFallback) report.fallbacks += 1;

      const bounds = partitionThreeWay(array, from, to, pivot, ops);
      report.partitions += 1;

      if (k < bounds.left) { report.discarded += to - bounds.left; to = bounds.left; }
      else if (k >= bounds.right) { report.discarded += bounds.left - from; from = bounds.right; }
      else return { value: array[k], report: report };
    }
    return { value: array[k], report: report };
  }

  /** The median of each group of five, gathered to the front of the range so
   *  the recursive call works on a contiguous prefix. */
  function gatherGroupMedians(array, from, to, ops) {
    let count = 0;
    for (let start = from; start < to; start += GROUP) {
      const end = Math.min(start + GROUP, to);
      insertionRange(array, start, end, ops);
      ops.swap(array, from + count, start + ((end - start) >>> 1));
      count += 1;
    }
    return count;
  }

  function insertionRange(array, from, to, ops) {
    for (let i = from + 1; i < to; i += 1) {
      const key = array[i];
      let j = i - 1;
      while (j >= from && ops.cmp(array[j], key) > 0) { ops.write(array, j + 1, array[j]); j -= 1; }
      if (j + 1 !== i) ops.write(array, j + 1, key);
    }
  }

  /**
   * The median-of-medians pivot. The guarantee it buys: the chosen value is
   * greater than at least 3 of every 5 elements in half the groups, so at
   * least 3n/10 elements are discarded whichever way the partition falls -
   * and 7/10 of a linear recurrence still sums to linear.
   */
  function medianOfMediansValue(array, from, to, ops, report) {
    if (to - from <= GROUP) {
      insertionRange(array, from, to, ops);
      return array[from + ((to - from) >>> 1)];
    }
    const count = gatherGroupMedians(array, from, to, ops);
    if (report) report.groups = (report.groups || 0) + count;
    return selectRange(array, from, from + count, from + (count >>> 1), ops, report).value;
  }

  function selectRange(array, from, to, k, ops, report) {
    let low = from;
    let high = to;

    while (high - low > 1) {
      const pivot = medianOfMediansValue(array, low, high, ops, report);
      const bounds = partitionThreeWay(array, low, high, pivot, ops);
      if (report) report.partitions = (report.partitions || 0) + 1;
      if (k < bounds.left) high = bounds.left;
      else if (k >= bounds.right) low = bounds.right;
      else return { value: array[k] };
    }
    return { value: array[k] };
  }

  /** Guaranteed-linear selection. Slower than quickselect on real input, and
   *  the only one of the two with a worst case worth writing down. */
  function medianOfMedians(array, k, ops) {
    const report = { partitions: 0, groups: 0 };
    const result = selectRange(array, 0, array.length, k, ops, report);
    return { value: result.value, report: report };
  }

  /** Introselect: quickselect until the depth says the pivots are going
   *  badly, then the guaranteed pivot rule for the rest. */
  function introSelect(array, k, ops, options) {
    const settings = options || {};
    const limit = settings.depthLimit === undefined
      ? 2 * Math.max(1, Math.ceil(Math.log2(Math.max(2, array.length))))
      : settings.depthLimit;
    return quickSelect(array, k, ops, { depthLimit: limit, random: settings.random });
  }

  /**
   * Top-k by a bounded max-heap: one pass, k slots, and no mutation of the
   * input. The comparison with quickselect is the point - this is O(n log k)
   * and quickselect is O(n), but this one streams and does not need the array
   * in memory at all, which is usually what decides it.
   */
  function topK(values, k, ops) {
    const heap = [];

    function siftUp(at) {
      let index = at;
      while (index > 0) {
        const parent = (index - 1) >>> 1;
        if (ops.cmp(heap[index], heap[parent]) <= 0) break;
        ops.swap(heap, index, parent);
        index = parent;
      }
    }

    function siftDown(at) {
      let index = at;
      for (;;) {
        const left = 2 * index + 1;
        if (left >= heap.length) return;
        const right = left + 1;
        const best = right < heap.length && ops.cmp(heap[right], heap[left]) > 0 ? right : left;
        if (ops.cmp(heap[best], heap[index]) <= 0) return;
        ops.swap(heap, index, best);
        index = best;
      }
    }

    values.forEach(function (value) {
      if (heap.length < k) { heap.push(value); ops.move(); siftUp(heap.length - 1); return; }
      if (k > 0 && ops.cmp(value, heap[0]) < 0) { heap[0] = value; ops.move(); siftDown(0); }
    });

    const out = heap.slice();
    ops.alloc(k);
    return out.sort(function (a, b) { return ops.cmp(a, b); });
  }

  /**
   * Partial sort: the first k elements sorted, the rest merely partitioned
   * away. One quickselect plus a sort of k elements, which is the operation
   * "give me the top 10 of a million" actually wants.
   */
  function partialSort(array, k, ops, options) {
    const settings = options || {};
    if (k <= 0) return { report: { partitions: 0 } };
    const selected = quickSelect(array, Math.min(k, array.length) - 1, ops, settings);
    insertionRange(array, 0, Math.min(k, array.length), ops);
    return { report: selected.report };
  }

  /** The expected comparison counts the section tabulates, from the standard
   *  analyses: ~2n for quickselect at a random k, ~n log2 n for sorting, and
   *  the ~10n constant that makes median-of-medians a guarantee rather than a
   *  recommendation. */
  function expectedComparisons(n) {
    return {
      n: n,
      quickselect: 2 * n,
      medianOfMedians: 10 * n,
      sortThenIndex: n * Math.max(1, Math.log2(Math.max(2, n))),
      topKHeap: function (k) { return n * Math.max(1, Math.log2(Math.max(2, k))); }
    };
  }

  return {
    GROUP: GROUP,
    quickSelect: quickSelect,
    medianOfMedians: medianOfMedians,
    introSelect: introSelect,
    topK: topK,
    partialSort: partialSort,
    partitionThreeWay: partitionThreeWay,
    expectedComparisons: expectedComparisons
  };
}));
