/**
 * Merge sort four ways, and the k-way merge external sorting is built on.
 *
 * The merge step is the algorithm. Everything else - top-down recursion,
 * bottom-up doubling, natural run detection - is a different schedule for the
 * same merges, and the section measures them against each other rather than
 * presenting one as canonical:
 *
 *   topDown   the textbook recursion. ceil(log2 n) levels, n moves per level.
 *   bottomUp  the same merges driven by a loop over widths 1, 2, 4, 8 - no
 *             recursion, no stack, and one buffer allocated once for the
 *             whole sort.
 *   natural   detects the runs already present and merges those. On sorted
 *             input it finds one run and stops: O(n) with a single pass.
 *   inPlace   rotation-based merging with no buffer at all, which is what the
 *             O(1)-space claim actually costs - the move count goes up by
 *             more than an order of magnitude and the section shows it.
 *
 * Stability is by construction, and it is one character: the merge takes from
 * the left run when the two heads compare equal (`<= 0`). Flip that to `< 0`
 * and every figure in the section stays identical while the sort silently
 * stops being stable, which is the `unstableMerge` option - it exists so the
 * test that catches it can be written.
 *
 * Every function takes an `ops` from `sort-ops.js` and counts nothing itself.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MergeSort = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /**
   * Merge `[from, mid)` with `[mid, to)` of `source` into `target`.
   *
   * `takeLeftOnTie` is stability. When the heads are equal the left run holds
   * the element that was originally earlier, so taking from the left keeps
   * the original order of equals; taking from the right reverses them.
   */
  function merge(source, target, from, mid, to, ops, takeLeftOnTie) {
    let i = from;
    let j = mid;

    for (let k = from; k < to; k += 1) {
      if (i >= mid) { ops.write(target, k, source[j]); j += 1; }
      else if (j >= to) { ops.write(target, k, source[i]); i += 1; }
      else if (takeLeftOnTie ? ops.cmp(source[j], source[i]) < 0 : ops.cmp(source[j], source[i]) <= 0) {
        ops.write(target, k, source[j]);
        j += 1;
      } else {
        ops.write(target, k, source[i]);
        i += 1;
      }
    }
  }

  function bufferFor(array, ops) {
    ops.alloc(array.length);
    return array.slice();
  }

  /**
   * Top-down, merging into the buffer and copying back. The alternative -
   * swapping the roles of array and buffer per level so no copy is needed -
   * is faster and is what `bottomUp` does; this one is written the way the
   * recursion is usually taught so the two can be compared.
   */
  function topDownSort(array, ops, options) {
    const settings = options || {};
    const stable = !settings.unstableMerge;
    const buffer = bufferFor(array, ops);

    function sortRange(from, to) {
      if (to - from < 2) return;
      const mid = from + ((to - from) >>> 1);
      sortRange(from, mid);
      sortRange(mid, to);
      merge(array, buffer, from, mid, to, ops, stable);
      for (let k = from; k < to; k += 1) ops.write(array, k, buffer[k]);
    }

    sortRange(0, array.length);
    return array;
  }

  /**
   * Bottom-up: widths 1, 2, 4, … with the two arrays swapping roles each
   * pass, so nothing is ever copied back. One allocation for the whole sort,
   * which is what the exercise asks the learner to reproduce.
   */
  function bottomUpSort(array, ops, options) {
    const settings = options || {};
    const stable = !settings.unstableMerge;
    const n = array.length;
    let source = array;
    let target = bufferFor(array, ops);

    for (let width = 1; width < n; width *= 2) {
      for (let from = 0; from < n; from += 2 * width) {
        const mid = Math.min(from + width, n);
        const to = Math.min(from + 2 * width, n);
        merge(source, target, from, mid, to, ops, stable);
      }
      const held = source;
      source = target;
      target = held;
    }

    if (source !== array) for (let k = 0; k < n; k += 1) ops.write(array, k, source[k]);
    return array;
  }

  /**
   * The ascending runs already in the data. A descending run is reversed in
   * place and counted as a run too, which is what makes reversed input cost
   * one pass rather than n/2 merges - and is exactly the trick Timsort uses.
   *
   * The descent test is *strict* (`< 0`), and that is not a detail: a run
   * detected with `<= 0` could contain equal elements, and reversing it would
   * put them back in the wrong order. Strict descent is what lets the reversal
   * happen at all without costing stability.
   */
  function detectRuns(array, ops, options) {
    const settings = options || {};
    const runs = [];
    let start = 0;

    while (start < array.length) {
      let end = start + 1;
      if (end < array.length && ops.cmp(array[end], array[start]) < 0) {
        while (end < array.length && ops.cmp(array[end], array[end - 1]) < 0) end += 1;
        if (settings.reverseDescending !== false) reverseRange(array, start, end, ops);
      } else {
        while (end < array.length && ops.cmp(array[end], array[end - 1]) >= 0) end += 1;
      }
      runs.push({ from: start, to: end, length: end - start });
      start = end;
    }
    return runs;
  }

  function reverseRange(array, from, to, ops) {
    let i = from;
    let j = to - 1;
    while (i < j) { ops.swap(array, i, j); i += 1; j -= 1; }
  }

  /**
   * Natural merge sort: find the runs, then merge adjacent pairs until one
   * remains. On already-sorted input `detectRuns` returns a single run and no
   * merge happens at all - the whole sort is one linear scan.
   */
  function naturalSort(array, ops, options) {
    const settings = options || {};
    const stable = !settings.unstableMerge;
    let runs = detectRuns(array, ops, { reverseDescending: settings.reverseDescending });
    const buffer = bufferFor(array, ops);
    let passes = 0;

    while (runs.length > 1) {
      const merged = [];
      for (let i = 0; i < runs.length; i += 2) {
        if (i + 1 >= runs.length) { merged.push(runs[i]); continue; }
        const left = runs[i];
        const right = runs[i + 1];
        merge(array, buffer, left.from, right.from, right.to, ops, stable);
        for (let k = left.from; k < right.to; k += 1) ops.write(array, k, buffer[k]);
        merged.push({ from: left.from, to: right.to, length: right.to - left.from });
      }
      runs = merged;
      passes += 1;
    }

    return { array: array, passes: passes };
  }

  /**
   * Merging with no buffer, by rotation. The two halves are split at the
   * point that lets each side be rotated into place, and the recursion does
   * the rest - O(n log n) comparisons and O(n log² n) moves. It is here to be
   * priced: "in place" is not free, it is paid for in moves.
   *
   * It is still stable, which surprises people. The cut on the longer side is
   * a `lowerBound` and the cut on the shorter side an `upperBound`, and that
   * asymmetry is exactly what keeps equal elements in their original order.
   */
  function inPlaceMerge(array, from, mid, to, ops) {
    if (mid - from === 0 || to - mid === 0) return;
    if (to - from === 2) {
      if (ops.cmp(array[from], array[from + 1]) > 0) ops.swap(array, from, from + 1);
      return;
    }

    let leftCut;
    let rightCut;
    if (mid - from > to - mid) {
      leftCut = from + ((mid - from) >>> 1);
      rightCut = lowerBoundIn(array, mid, to, array[leftCut], ops);
    } else {
      rightCut = mid + ((to - mid) >>> 1);
      leftCut = upperBoundIn(array, from, mid, array[rightCut], ops);
    }

    rotate(array, leftCut, mid, rightCut, ops);
    const newMid = leftCut + (rightCut - mid);
    inPlaceMerge(array, from, leftCut, newMid, ops);
    inPlaceMerge(array, newMid, rightCut, to, ops);
  }

  function lowerBoundIn(array, from, to, value, ops) {
    let low = from;
    let high = to;
    while (low < high) {
      const mid = low + ((high - low) >>> 1);
      if (ops.cmp(array[mid], value) < 0) low = mid + 1;
      else high = mid;
    }
    return low;
  }

  function upperBoundIn(array, from, to, value, ops) {
    let low = from;
    let high = to;
    while (low < high) {
      const mid = low + ((high - low) >>> 1);
      if (ops.cmp(value, array[mid]) < 0) high = mid;
      else low = mid + 1;
    }
    return low;
  }

  /** Rotate `[from, to)` left by `mid - from`, as three reversals. */
  function rotate(array, from, mid, to, ops) {
    if (mid === from || mid === to) return;
    reverseRange(array, from, mid, ops);
    reverseRange(array, mid, to, ops);
    reverseRange(array, from, to, ops);
  }

  function inPlaceSort(array, ops) {
    function sortRange(from, to) {
      if (to - from < 2) return;
      const mid = from + ((to - from) >>> 1);
      sortRange(from, mid);
      sortRange(mid, to);
      inPlaceMerge(array, from, mid, to, ops);
    }
    sortRange(0, array.length);
    return array;
  }

  /**
   * The k-way merge external sorting needs, driven by a binary heap over the
   * run cursors. `heapSteps` is the figure that matters: k-way costs
   * n·log2(k) comparisons in one pass where repeated 2-way merging costs
   * n·log2(k) comparisons spread over log2(k) passes - the same comparisons,
   * a factor of log2(k) fewer passes over the data.
   */
  function kWayMerge(runs, ops) {
    const heap = [];
    let heapSteps = 0;

    function less(a, b) { return ops.cmp(a.value, b.value) < 0; }

    function siftUp(at) {
      let index = at;
      while (index > 0) {
        const parent = (index - 1) >>> 1;
        heapSteps += 1;
        if (!less(heap[index], heap[parent])) break;
        const held = heap[index];
        heap[index] = heap[parent];
        heap[parent] = held;
        index = parent;
      }
    }

    function siftDown(at) {
      let index = at;
      for (;;) {
        const left = 2 * index + 1;
        if (left >= heap.length) break;
        const right = left + 1;
        heapSteps += 1;
        let best = right < heap.length && less(heap[right], heap[left]) ? right : left;
        heapSteps += 1;
        if (!less(heap[best], heap[index])) break;
        const held = heap[index];
        heap[index] = heap[best];
        heap[best] = held;
        index = best;
      }
    }

    runs.forEach(function (run, index) {
      if (!run.length) return;
      heap.push({ value: run[0], run: index, at: 0 });
      siftUp(heap.length - 1);
    });

    const out = [];
    ops.alloc(runs.reduce(function (total, run) { return total + run.length; }, 0));

    while (heap.length) {
      const top = heap[0];
      out.push(top.value);
      ops.move();
      const source = runs[top.run];
      if (top.at + 1 < source.length) {
        heap[0] = { value: source[top.at + 1], run: top.run, at: top.at + 1 };
      } else {
        const last = heap.pop();
        if (heap.length) heap[0] = last;
      }
      if (heap.length) siftDown(0);
    }

    return { values: out, heapSteps: heapSteps, runs: runs.length };
  }

  const ALGORITHMS = {
    'top-down': { run: topDownSort, stable: true, adaptive: false, inPlace: false, label: 'top-down merge' },
    'bottom-up': { run: bottomUpSort, stable: true, adaptive: false, inPlace: false, label: 'bottom-up merge' },
    natural: { run: function (a, o, s) { return naturalSort(a, o, s).array; }, stable: true, adaptive: true, inPlace: false, label: 'natural merge' },
    'in-place': { run: inPlaceSort, stable: true, adaptive: false, inPlace: true, label: 'in-place merge' }
  };

  return {
    topDownSort: topDownSort,
    bottomUpSort: bottomUpSort,
    naturalSort: naturalSort,
    inPlaceSort: inPlaceSort,
    detectRuns: detectRuns,
    merge: merge,
    kWayMerge: kWayMerge,
    algorithms: ALGORITHMS,
    kinds: Object.keys(ALGORITHMS)
  };
}));
