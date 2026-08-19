/**
 * Pattern-defeating quicksort: Orson Peters' answer to the same problem
 * Timsort solves, from the other direction.
 *
 * Timsort asks "what order is already here, and how do I exploit it".
 * pdqsort asks "what pattern is about to make me quadratic, and how do I
 * destroy it". Both beat a textbook sort on real data; they disagree about
 * what real data looks like, and both are right about the case they were
 * written for.
 *
 * Four mechanisms, and the module reports each one firing:
 *
 *   partition detection   if a partition came back already in order, try to
 *                         finish with a *bounded* insertion sort. Success
 *                         means a nearly-sorted input costs O(n); the bound
 *                         means a merely-lucky partition costs 8 moves to
 *                         find that out, not O(n²).
 *   pattern breaking      a badly unbalanced partition is evidence of a
 *                         pattern, not of bad luck. pdqsort swaps a few
 *                         elements to destroy it, so the *next* pivot choice
 *                         is not fed the same shape.
 *   equal-element guard   when the pivot equals its predecessor, everything
 *                         equal to it is pushed left in one partition, which
 *                         turns duplicate-heavy input linear.
 *   deterministic fallback  a depth budget, and heapsort when it runs out.
 *                         No randomness, so the worst case is O(n log n)
 *                         without giving up reproducibility.
 *
 * The last point is the one worth stealing: pdqsort gets its worst-case
 * bound *without* a random pivot, so two runs on the same input do the same
 * work - which a benchmark, a cache and a debugger all care about.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Pdqsort = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const INSERTION_THRESHOLD = 24;
  const NINTHER_THRESHOLD = 128;
  const PARTIAL_INSERTION_LIMIT = 8;

  function sort3(array, a, b, c, ops) {
    sort2(array, a, b, ops);
    sort2(array, b, c, ops);
    sort2(array, a, b, ops);
  }

  function sort2(array, a, b, ops) {
    if (ops.cmp(array[b], array[a]) < 0) ops.swap(array, a, b);
  }

  function insertionSortRange(array, from, to, ops) {
    for (let i = from + 1; i < to; i += 1) {
      const key = array[i];
      let j = i - 1;
      while (j >= from && ops.cmp(key, array[j]) < 0) { ops.write(array, j + 1, array[j]); j -= 1; }
      if (j + 1 !== i) ops.write(array, j + 1, key);
    }
  }

  /**
   * Insertion sort that gives up. It sorts while the total number of shifts
   * stays under a small constant, and returns false the moment it does not.
   *
   * That bound is the whole idea. Trying insertion sort on an
   * already-partitioned range is a bet that the range is nearly sorted; the
   * bet has to be cheap to lose, and 8 moves is what "cheap" means here.
   */
  function partialInsertionSort(array, from, to, ops) {
    if (to - from < 2) return true;
    let moves = 0;

    for (let i = from + 1; i < to; i += 1) {
      if (ops.cmp(array[i], array[i - 1]) >= 0) continue;
      const key = array[i];
      let j = i - 1;
      while (j >= from && ops.cmp(key, array[j]) < 0) {
        ops.write(array, j + 1, array[j]);
        j -= 1;
        moves += 1;
        if (moves > PARTIAL_INSERTION_LIMIT) {
          ops.write(array, j + 1, key);
          return false;
        }
      }
      ops.write(array, j + 1, key);
    }
    return true;
  }

  function heapifyRange(array, from, to, root, ops) {
    const length = to - from;
    let parent = root;
    for (;;) {
      const left = 2 * parent + 1;
      if (left >= length) return;
      const right = left + 1;
      const best = right < length && ops.cmp(array[from + right], array[from + left]) > 0 ? right : left;
      if (ops.cmp(array[from + best], array[from + parent]) <= 0) return;
      ops.swap(array, from + parent, from + best);
      parent = best;
    }
  }

  function heapSortRange(array, from, to, ops) {
    const length = to - from;
    for (let i = (length >>> 1) - 1; i >= 0; i -= 1) heapifyRange(array, from, to, i, ops);
    for (let end = length - 1; end > 0; end -= 1) {
      ops.swap(array, from, from + end);
      heapifyRange(array, from, from + end, 0, ops);
    }
  }

  /** Choose a pivot and leave it at `from`. Ninther above 128 elements,
   *  median-of-three below - the sample has to grow with the array or it
   *  stops being a median of anything. */
  function choosePivot(array, from, to, ops, report) {
    const size = to - from;
    const half = size >>> 1;

    if (size > NINTHER_THRESHOLD) {
      sort3(array, from, from + half, to - 1, ops);
      sort3(array, from + 1, from + half - 1, to - 2, ops);
      sort3(array, from + 2, from + half + 1, to - 3, ops);
      sort3(array, from + half - 1, from + half, from + half + 1, ops);
      ops.swap(array, from, from + half);
      report.ninthers += 1;
    } else {
      sort3(array, from + half, from, to - 1, ops);
      report.medians += 1;
    }
  }

  /**
   * Partition around `array[from]`, elements equal to the pivot going right.
   * Reports whether the range was *already* partitioned, which is the signal
   * `partialInsertionSort` is allowed to act on.
   */
  function partitionRight(array, from, to, ops) {
    const pivot = array[from];
    let first = from;
    let last = to;

    do { first += 1; } while (first < last && ops.cmp(array[first], pivot) < 0);

    if (first - 1 === from) {
      while (first < last && !(ops.cmp(array[last - 1], pivot) < 0)) last -= 1;
    } else {
      while (!(ops.cmp(array[last - 1], pivot) < 0)) last -= 1;
    }
    last -= 1;

    const alreadyPartitioned = first >= last;

    while (first < last) {
      ops.swap(array, first, last);
      do { first += 1; } while (ops.cmp(array[first], pivot) < 0);
      do { last -= 1; } while (!(ops.cmp(array[last], pivot) < 0));
    }

    const pivotAt = first - 1;
    ops.write(array, from, array[pivotAt]);
    ops.write(array, pivotAt, pivot);
    return { at: pivotAt, alreadyPartitioned: alreadyPartitioned };
  }

  /**
   * Partition with elements equal to the pivot going *left*. Used when the
   * pivot equals its predecessor, which means the previous partition already
   * put a block of equals here - and pushing them all left retires them in
   * one step instead of one per duplicate.
   */
  function partitionLeft(array, from, to, ops) {
    const pivot = array[from];
    let first = from;
    let last = to;

    do { last -= 1; } while (ops.cmp(pivot, array[last]) < 0);

    if (last + 1 === to) {
      while (first < last && !(ops.cmp(pivot, array[first + 1]) < 0)) first += 1;
    } else {
      while (!(ops.cmp(pivot, array[first + 1]) < 0)) first += 1;
    }
    first += 1;

    while (first < last) {
      ops.swap(array, first, last);
      do { last -= 1; } while (ops.cmp(pivot, array[last]) < 0);
      do { first += 1; } while (!(ops.cmp(pivot, array[first]) < 0));
    }

    const pivotAt = last;
    ops.write(array, from, array[pivotAt]);
    ops.write(array, pivotAt, pivot);
    return pivotAt;
  }

  /**
   * Break the pattern that produced a lopsided partition.
   *
   * The reasoning is worth reading twice: an unbalanced split is not just bad
   * luck, it is *evidence*. Something about the input's arrangement defeated
   * the pivot rule, and it will defeat the next one the same way unless the
   * arrangement changes. A few swaps at fixed offsets cost nothing and make
   * the next sample uncorrelated with whatever produced this one.
   *
   * The swaps stay strictly *inside one partition*. Reaching across the pivot
   * would mix an element below it with one above it and quietly undo the
   * partition that was just computed - the sort still terminates and still
   * looks plausible, and the output is not sorted.
   */
  function breakPatterns(array, from, to, ops, report) {
    const size = to - from;
    if (size < INSERTION_THRESHOLD) return;
    report.patternBreaks += 1;

    const quarter = size >>> 2;
    ops.swap(array, from, from + quarter);
    ops.swap(array, to - 1, to - 1 - quarter);

    if (size > NINTHER_THRESHOLD) {
      ops.swap(array, from + 1, from + quarter + 1);
      ops.swap(array, from + 2, from + quarter + 2);
      ops.swap(array, to - 2, to - 2 - quarter);
      ops.swap(array, to - 3, to - 3 - quarter);
    }
  }

  function emptyReport() {
    return {
      partitions: 0, maxDepth: 0, heapsortFallbacks: 0, patternBreaks: 0,
      alreadyPartitioned: 0, partialInsertionWins: 0, partialInsertionTries: 0,
      insertionRuns: 0, equalBlocks: 0, ninthers: 0, medians: 0
    };
  }

  /**
   * The sort. `report` is the point of the module - the section shows each
   * mechanism firing on the input that needs it and staying quiet on the
   * inputs that do not.
   */
  function sort(array, ops, options) {
    const settings = options || {};
    const report = emptyReport();
    const budget = settings.depthLimit === undefined
      ? Math.max(1, Math.ceil(Math.log2(Math.max(2, array.length))))
      : settings.depthLimit;
    const breaking = settings.breakPatterns !== false;

    function loop(from, to, allowed, leftmost, depth) {
      let begin = from;
      let bad = allowed;
      let isLeftmost = leftmost;
      let level = depth;

      while (to - begin > 1) {
        if (level > report.maxDepth) report.maxDepth = level;
        const size = to - begin;

        if (size <= INSERTION_THRESHOLD) {
          insertionSortRange(array, begin, to, ops);
          report.insertionRuns += 1;
          return;
        }

        choosePivot(array, begin, to, ops, report);

        if (!isLeftmost && !(ops.cmp(array[begin - 1], array[begin]) < 0)) {
          begin = partitionLeft(array, begin, to, ops) + 1;
          report.equalBlocks += 1;
          report.partitions += 1;
          continue;
        }

        const split = partitionRight(array, begin, to, ops);
        report.partitions += 1;
        if (split.alreadyPartitioned) report.alreadyPartitioned += 1;

        const leftSize = split.at - begin;
        const rightSize = to - (split.at + 1);
        const unbalanced = leftSize < size / 8 || rightSize < size / 8;

        if (unbalanced) {
          bad -= 1;
          if (bad === 0) {
            heapSortRange(array, begin, to, ops);
            report.heapsortFallbacks += 1;
            return;
          }
          if (breaking) {
            breakPatterns(array, begin, split.at, ops, report);
            breakPatterns(array, split.at + 1, to, ops, report);
          }
        } else if (split.alreadyPartitioned) {
          report.partialInsertionTries += 1;
          if (partialInsertionSort(array, begin, split.at, ops)
            && partialInsertionSort(array, split.at + 1, to, ops)) {
            report.partialInsertionWins += 1;
            return;
          }
        }

        loop(begin, split.at, bad, isLeftmost, level + 1);
        begin = split.at + 1;
        isLeftmost = false;
        level += 1;
      }
    }

    loop(0, array.length, budget, true, 1);
    return report;
  }

  return {
    INSERTION_THRESHOLD: INSERTION_THRESHOLD,
    NINTHER_THRESHOLD: NINTHER_THRESHOLD,
    PARTIAL_INSERTION_LIMIT: PARTIAL_INSERTION_LIMIT,
    partialInsertionSort: partialInsertionSort,
    partitionRight: partitionRight,
    partitionLeft: partitionLeft,
    heapSortRange: heapSortRange,
    sort: sort
  };
}));
