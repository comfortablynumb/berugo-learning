/**
 * Two pointers, sliding windows and monotonic structures - four techniques
 * that are the same amortisation argument wearing different clothes.
 *
 * The argument: each element enters the structure once and leaves once, so a
 * loop that looks nested is linear. The tell in a quadratic solution is an
 * inner loop whose index never moves backwards; when that is true the inner
 * loop can be hoisted into a second pointer and the total work becomes 2n
 * rather than n².
 *
 * Every function here reports `pushes` and `pops` separately, because the
 * claim being taught is not "it is fast" - it is "the totals are bounded by 2n
 * however the data is shaped", and a total is the only evidence for that. The
 * adversarial inputs in `worstCase` exist for the same reason: a monotonic
 * deque on sorted input does something visibly different from the same deque
 * on reversed input, and both stay under the bound.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TwoPointers = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { pushes: 0, pops: 0, comparisons: 0, windowMoves: 0, maxSize: 0 };
  }

  /* ------------------------------------------------------- sliding window */

  /**
   * Maximum of every window of width k, with a deque holding indices whose
   * values are strictly decreasing. The front is always the window's maximum,
   * because anything smaller that arrived earlier can never be the maximum
   * again - it is dominated and expires first.
   */
  function maxInSlidingWindow(values, k, options) {
    const report = (options || {}).report || emptyReport();
    const deque = [];
    const out = [];

    for (let i = 0; i < values.length; i += 1) {
      while (deque.length && deque[0] <= i - k) { deque.shift(); report.pops += 1; }
      while (deque.length) {
        report.comparisons += 1;
        if (values[deque[deque.length - 1]] > values[i]) break;
        deque.pop();
        report.pops += 1;
      }
      deque.push(i);
      report.pushes += 1;
      report.maxSize = Math.max(report.maxSize, deque.length);
      if (i >= k - 1) out.push(values[deque[0]]);
    }
    return { values: out, report: report };
  }

  /** The quadratic reference. It exists because a window bug produces a
   *  plausible array of maxima rather than an error. */
  function maxInSlidingWindowNaive(values, k) {
    const out = [];
    for (let i = 0; i + k <= values.length; i += 1) {
      let best = -Infinity;
      for (let j = i; j < i + k; j += 1) best = Math.max(best, values[j]);
      out.push(best);
    }
    return out;
  }

  /**
   * The shortest window whose sum reaches `target`, over non-negative values.
   * The right pointer only advances and the left pointer only advances, which
   * is the whole argument for linearity.
   */
  function shortestWindowAtLeast(values, target) {
    const report = emptyReport();
    let left = 0;
    let sum = 0;
    let best = Infinity;
    let bestAt = -1;

    for (let right = 0; right < values.length; right += 1) {
      sum += values[right];
      report.windowMoves += 1;
      while (sum - values[left] >= target) {
        sum -= values[left];
        left += 1;
        report.windowMoves += 1;
      }
      if (sum >= target && right - left + 1 < best) {
        best = right - left + 1;
        bestAt = left;
      }
    }
    return { length: best === Infinity ? 0 : best, at: bestAt, report: report };
  }

  /* ------------------------------------------------------ monotonic stack */

  /**
   * The next strictly greater element to the right of each position, by a
   * stack of indices whose values are non-increasing. Each index is pushed
   * once and popped once: 2n operations for a question that reads quadratic.
   */
  function nextGreater(values) {
    const report = emptyReport();
    const stack = [];
    const out = new Array(values.length).fill(-1);

    for (let i = 0; i < values.length; i += 1) {
      while (stack.length) {
        report.comparisons += 1;
        if (values[stack[stack.length - 1]] >= values[i]) break;
        out[stack.pop()] = i;
        report.pops += 1;
      }
      stack.push(i);
      report.pushes += 1;
      report.maxSize = Math.max(report.maxSize, stack.length);
    }
    return { indices: out, report: report };
  }

  /**
   * The largest rectangle under a histogram. The monotonic stack holds bars in
   * increasing height; when a shorter bar arrives, every taller bar on the
   * stack has found its right boundary and can be settled.
   *
   * The sentinel at the end is what makes the loop uniform: without it the
   * stack has to be drained by a second copy of the same code, which is where
   * the off-by-one bugs live.
   */
  function largestRectangle(heights) {
    const report = emptyReport();
    const stack = [];
    let best = { area: 0, left: 0, right: 0, height: 0 };

    for (let i = 0; i <= heights.length; i += 1) {
      const height = i === heights.length ? -1 : heights[i];
      while (stack.length) {
        report.comparisons += 1;
        const top = stack[stack.length - 1];
        if (heights[top] <= height) break;
        stack.pop();
        report.pops += 1;
        const left = stack.length ? stack[stack.length - 1] + 1 : 0;
        const area = heights[top] * (i - left);
        if (area > best.area) best = { area: area, left: left, right: i - 1, height: heights[top] };
      }
      if (i < heights.length) {
        stack.push(i);
        report.pushes += 1;
        report.maxSize = Math.max(report.maxSize, stack.length);
      }
    }
    return { best: best, report: report };
  }

  function largestRectangleNaive(heights) {
    let best = 0;
    for (let i = 0; i < heights.length; i += 1) {
      let low = heights[i];
      for (let j = i; j < heights.length; j += 1) {
        low = Math.min(low, heights[j]);
        best = Math.max(best, low * (j - i + 1));
      }
    }
    return best;
  }

  /* ------------------------------------------------------- two pointers */

  /**
   * Does a sorted array contain a pair summing to the target? One pointer at
   * each end, each moving inward at most n times in total. The precondition is
   * sortedness, and without it the answer is silently wrong.
   */
  function pairWithSum(sorted, target) {
    const report = emptyReport();
    let left = 0;
    let right = sorted.length - 1;

    while (left < right) {
      report.comparisons += 1;
      report.windowMoves += 1;
      const sum = sorted[left] + sorted[right];
      if (sum === target) return { found: [left, right], report: report };
      if (sum < target) left += 1;
      else right -= 1;
    }
    return { found: null, report: report };
  }

  /**
   * The shapes that make the amortisation visible: ascending input keeps the
   * deque at length one, descending input fills it to k, and random input
   * lands between. All three total 2n or fewer operations.
   */
  function worstCase(kind, n, k) {
    const values = [];
    let state = 7;
    for (let i = 0; i < n; i += 1) {
      if (kind === 'ascending') values.push(i);
      else if (kind === 'descending') values.push(n - i);
      else if (kind === 'sawtooth') values.push(i % Math.max(2, Math.floor(k / 2)));
      else {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        values.push(state % (n * 4));
      }
    }
    const run = maxInSlidingWindow(values, k, {});
    return {
      kind: kind, n: n, k: k,
      pushes: run.report.pushes, pops: run.report.pops,
      total: run.report.pushes + run.report.pops,
      maxSize: run.report.maxSize,
      perElement: (run.report.pushes + run.report.pops) / n
    };
  }

  return {
    emptyReport: emptyReport,
    maxInSlidingWindow: maxInSlidingWindow,
    maxInSlidingWindowNaive: maxInSlidingWindowNaive,
    shortestWindowAtLeast: shortestWindowAtLeast,
    nextGreater: nextGreater,
    largestRectangle: largestRectangle,
    largestRectangleNaive: largestRectangleNaive,
    pairWithSum: pairWithSum,
    worstCase: worstCase
  };
}));
