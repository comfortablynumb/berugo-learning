/**
 * Insertion, selection, bubble and shell sort - the four small-n baselines,
 * and the four different answers to "what does a sort cost".
 *
 * They are here to be measured against each other rather than dismissed.
 * Insertion sort is adaptive: on data that is already nearly ordered it does
 * O(n + inversions) work and beats every O(n log n) sort below a few dozen
 * elements, which is exactly why Timsort and pdqsort both fall back to it.
 * Selection sort is the opposite - its comparison count is n(n-1)/2 on every
 * input, sorted or not - but it does at most n-1 swaps, which is the right
 * trade when a move is expensive and a comparison is not.
 *
 * Stability is a property of the algorithm, not of the data, and this file is
 * where the difference is visible in ten lines:
 *
 *   insertion  stops shifting at the first element that is <= the key, so an
 *              equal element is never stepped over: stable.
 *   bubble     only ever swaps a strictly-out-of-order adjacent pair: stable.
 *   selection  swaps the minimum into place from a distance, jumping over
 *              whatever sat between: NOT stable, and the section proves it
 *              rather than asserting it.
 *   shell      insertion sort at gap h, and a gap > 1 steps over equal
 *              elements by construction: NOT stable.
 *
 * Every function takes the array and an `ops` from `sort-ops.js`, sorts in
 * place and returns the same array. Nothing here allocates except shell's gap
 * sequence.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SortsElementary = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /**
   * The stable one. `> 0` rather than `>= 0` is the whole of its stability:
   * the shift stops at the first element that is not strictly greater, so an
   * equal element keeps the position it already had.
   */
  function insertionSort(array, ops, options) {
    const settings = options || {};
    const from = settings.from === undefined ? 0 : settings.from;
    const to = settings.to === undefined ? array.length : settings.to;

    for (let i = from + 1; i < to; i += 1) {
      const key = array[i];
      let j = i - 1;
      while (j >= from && ops.cmp(array[j], key) > 0) {
        ops.write(array, j + 1, array[j]);
        j -= 1;
      }
      if (j + 1 !== i) ops.write(array, j + 1, key);
    }
    return array;
  }

  /**
   * Insertion sort that finds the position by binary search. It does
   * O(n log n) comparisons instead of O(n²) - and still O(n²) moves, which is
   * why it is a smaller win than it looks and why libraries mostly do not
   * bother. `upper` bound placement keeps it stable.
   */
  function binaryInsertionSort(array, ops, options) {
    const settings = options || {};
    const from = settings.from === undefined ? 0 : settings.from;
    const to = settings.to === undefined ? array.length : settings.to;

    for (let i = from + 1; i < to; i += 1) {
      const key = array[i];
      let low = from;
      let high = i;
      while (low < high) {
        const mid = low + ((high - low) >>> 1);
        if (ops.cmp(key, array[mid]) < 0) high = mid;
        else low = mid + 1;
      }
      for (let j = i; j > low; j -= 1) ops.write(array, j, array[j - 1]);
      if (low !== i) ops.write(array, low, key);
    }
    return array;
  }

  /**
   * n(n-1)/2 comparisons whatever the input, and at most n-1 swaps. The swap
   * is what costs it stability: moving the minimum in from a distance jumps
   * the displaced element over anything equal to it.
   */
  function selectionSort(array, ops) {
    for (let i = 0; i < array.length - 1; i += 1) {
      let least = i;
      for (let j = i + 1; j < array.length; j += 1) {
        if (ops.cmp(array[j], array[least]) < 0) least = j;
      }
      ops.swap(array, i, least);
    }
    return array;
  }

  /**
   * Bubble sort with the early exit, which is the only thing that makes it
   * adaptive: a sorted input costs one clean pass of n-1 comparisons and
   * stops. Without the flag it is n(n-1)/2 on every input, and the version
   * people remember from school is the one without the flag.
   */
  function bubbleSort(array, ops) {
    let end = array.length;
    let swapped = true;

    while (swapped && end > 1) {
      swapped = false;
      for (let i = 1; i < end; i += 1) {
        if (ops.cmp(array[i - 1], array[i]) > 0) {
          ops.swap(array, i - 1, i);
          swapped = true;
        }
      }
      end -= 1;
    }
    return array;
  }

  /* Ciura's empirically-derived gaps, extended by the ×2.25 rule above 701.
     The sequence is the whole algorithm: shell sort's complexity is a
     property of the gaps and is still not known for the best of them. */
  const CIURA = [1, 4, 10, 23, 57, 132, 301, 701];

  function gapsFor(length) {
    const gaps = CIURA.filter(function (gap) { return gap < length; });
    let next = 701;
    while (next * 2.25 < length) {
      next = Math.floor(next * 2.25);
      gaps.push(next);
    }
    return gaps.reverse();
  }

  /**
   * Insertion sort run at decreasing gaps. Each pass leaves the array
   * "h-sorted", and an already h-sorted array stays h-sorted when a smaller
   * gap runs - so the final gap-1 pass is an insertion sort over an array
   * with very few inversions left, which is the case insertion sort is fast
   * on. Not stable: a gap greater than 1 moves elements past their equals.
   */
  function shellSort(array, ops) {
    gapsFor(array.length).forEach(function (gap) {
      for (let i = gap; i < array.length; i += 1) {
        const key = array[i];
        let j = i;
        while (j >= gap && ops.cmp(array[j - gap], key) > 0) {
          ops.write(array, j, array[j - gap]);
          j -= gap;
        }
        if (j !== i) ops.write(array, j, key);
      }
    });
    return array;
  }

  /** Inversions - the pair count insertion sort's cost is linear in. Counted
   *  by a merge, so it is O(n log n) rather than the O(n²) definition. */
  function countInversions(values, compare) {
    const order = compare || function (a, b) { return a < b ? -1 : (a > b ? 1 : 0); };
    let total = 0;

    function sortHalf(items) {
      if (items.length < 2) return items;
      const mid = items.length >>> 1;
      const left = sortHalf(items.slice(0, mid));
      const right = sortHalf(items.slice(mid));
      const merged = [];
      let i = 0;
      let j = 0;
      while (i < left.length && j < right.length) {
        if (order(right[j], left[i]) < 0) { merged.push(right[j]); j += 1; total += left.length - i; }
        else { merged.push(left[i]); i += 1; }
      }
      return merged.concat(left.slice(i)).concat(right.slice(j));
    }

    sortHalf(values.slice());
    return total;
  }

  const ALGORITHMS = {
    insertion: { run: insertionSort, stable: true, adaptive: true, inPlace: true, label: 'insertion' },
    'binary-insertion': { run: binaryInsertionSort, stable: true, adaptive: false, inPlace: true, label: 'binary insertion' },
    selection: { run: selectionSort, stable: false, adaptive: false, inPlace: true, label: 'selection' },
    bubble: { run: bubbleSort, stable: true, adaptive: true, inPlace: true, label: 'bubble' },
    shell: { run: shellSort, stable: false, adaptive: true, inPlace: true, label: 'shell' }
  };

  return {
    insertionSort: insertionSort,
    binaryInsertionSort: binaryInsertionSort,
    selectionSort: selectionSort,
    bubbleSort: bubbleSort,
    shellSort: shellSort,
    gapsFor: gapsFor,
    countInversions: countInversions,
    algorithms: ALGORITHMS,
    kinds: Object.keys(ALGORITHMS)
  };
}));
