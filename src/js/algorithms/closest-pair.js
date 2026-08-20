/**
 * Closest pair of points in O(n log n), and the counting of inversions that
 * shares its shape - two problems where the combine step is the algorithm.
 *
 * Divide and conquer is usually taught as "split, solve, combine", with the
 * combine step an afterthought. These two are the cases where it is the whole
 * difficulty. Splitting points by x-coordinate is trivial; the question is
 * whether a pair straddling the divide can beat the best pair found on either
 * side, and the answer - that only points within delta of the line matter, and
 * that each of them need be compared with at most seven others when the strip
 * is kept sorted by y - is the reason the algorithm is not quadratic.
 *
 * The seven is not folklore here: `stripComparisons` is reported, and the
 * demo shows the measured maximum per point. Counting inversions is the same
 * shape with a merge as the combine step, and it is included because it is the
 * cheapest way to see that "the combine step does the work" is a statement
 * about a family rather than about one algorithm.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ClosestPair = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return {
      distanceChecks: 0, stripChecks: 0, calls: 0, baseCases: 0,
      maxDepth: 0, worstStripRun: 0, stripPoints: 0
    };
  }

  function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** The oracle. Every claim the fast algorithm makes is checked against this
   *  on the same points, because a closest-pair bug returns a plausible pair
   *  rather than an error. */
  function bruteForce(points, options) {
    const report = (options || {}).report || emptyReport();
    let best = { a: null, b: null, distance: Infinity };

    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        report.distanceChecks += 1;
        const d = distance(points[i], points[j]);
        if (d < best.distance) best = { a: points[i], b: points[j], distance: d };
      }
    }
    return { pair: best, report: report };
  }

  function better(left, right) {
    return left.distance <= right.distance ? left : right;
  }

  function closestInStrip(strip, limit, report) {
    let best = { a: null, b: null, distance: limit };
    report.stripPoints += strip.length;

    for (let i = 0; i < strip.length; i += 1) {
      let run = 0;
      for (let j = i + 1; j < strip.length && strip[j].y - strip[i].y < best.distance; j += 1) {
        run += 1;
        report.stripChecks += 1;
        report.distanceChecks += 1;
        const d = distance(strip[i], strip[j]);
        if (d < best.distance) best = { a: strip[i], b: strip[j], distance: d };
      }
      report.worstStripRun = Math.max(report.worstStripRun, run);
    }
    return best;
  }

  function mergeByY(left, right) {
    const out = [];
    let i = 0;
    let j = 0;
    while (i < left.length && j < right.length) {
      if (left[i].y <= right[j].y) { out.push(left[i]); i += 1; }
      else { out.push(right[j]); j += 1; }
    }
    while (i < left.length) { out.push(left[i]); i += 1; }
    while (j < right.length) { out.push(right[j]); j += 1; }
    return out;
  }

  /**
   * Closest pair, O(n log n). The recursion returns the points sorted by y as
   * well as the best pair, so the strip is built by merging rather than by
   * sorting - which is what keeps the log factor from becoming log².
   */
  function closestPair(points, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const cutoff = Math.max(2, settings.cutoff === undefined ? 3 : settings.cutoff);
    const byX = points.slice().sort(function (a, b) { return a.x - b.x || a.y - b.y; });

    function solve(from, to, depth) {
      report.calls += 1;
      report.maxDepth = Math.max(report.maxDepth, depth);
      const count = to - from;

      if (count <= cutoff) {
        report.baseCases += 1;
        const slice = byX.slice(from, to);
        const found = bruteForce(slice, { report: report }).pair;
        return { best: found, sorted: slice.slice().sort(function (a, b) { return a.y - b.y; }) };
      }

      const middle = (from + to) >> 1;
      const divide = byX[middle].x;
      const left = solve(from, middle, depth + 1);
      const right = solve(middle, to, depth + 1);
      const best = better(left.best, right.best);

      const sorted = mergeByY(left.sorted, right.sorted);
      const strip = sorted.filter(function (point) { return Math.abs(point.x - divide) < best.distance; });
      return { best: better(best, closestInStrip(strip, best.distance, report)), sorted: sorted };
    }

    if (points.length < 2) return { pair: { a: null, b: null, distance: Infinity }, report: report };
    return { pair: solve(0, byX.length, 1).best, report: report };
  }

  /**
   * Counting inversions with a merge sort: the same divide and conquer with
   * the combine step counting the pairs it crosses, which is the only place a
   * cross-pair can be seen without looking at all of them.
   */
  function countInversions(values) {
    const report = { merges: 0, comparisons: 0, inversions: 0 };
    const buffer = new Array(values.length);

    function sortRange(array, from, to) {
      if (to - from <= 1) return 0;
      const middle = (from + to) >> 1;
      let total = sortRange(array, from, middle) + sortRange(array, middle, to);

      report.merges += 1;
      let i = from;
      let j = middle;
      for (let k = from; k < to; k += 1) {
        if (i >= middle) { buffer[k] = array[j]; j += 1; continue; }
        if (j >= to) { buffer[k] = array[i]; i += 1; continue; }
        report.comparisons += 1;
        if (array[j] < array[i]) {
          buffer[k] = array[j];
          j += 1;
          total += middle - i;          // every remaining left element beats it
        } else {
          buffer[k] = array[i];
          i += 1;
        }
      }
      for (let k = from; k < to; k += 1) array[k] = buffer[k];
      return total;
    }

    report.inversions = sortRange(values.slice(), 0, values.length);
    return report;
  }

  /** The quadratic reference for `countInversions`, for the same reason the
   *  brute-force closest pair exists. */
  function countInversionsNaive(values) {
    let total = 0;
    for (let i = 0; i < values.length; i += 1) {
      for (let j = i + 1; j < values.length; j += 1) {
        if (values[i] > values[j]) total += 1;
      }
    }
    return total;
  }

  return {
    emptyReport: emptyReport,
    distance: distance,
    bruteForce: bruteForce,
    closestPair: closestPair,
    countInversions: countInversions,
    countInversionsNaive: countInversionsNaive
  };
}));
