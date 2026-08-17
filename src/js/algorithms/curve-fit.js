/**
 * Empirical complexity: fit measurements to a growth class.
 *
 * Two independent methods, because agreement between them is the evidence:
 *   - the doubling ratio T(2n)/T(n), which reads off the exponent directly;
 *   - a least-squares fit of a single-term model c·f(n) over a candidate basis,
 *     ranked by relative residual.
 *
 * Both operate on measurements, so both can be wrong in the same way if the
 * measurements are (warm cache, dead-code elimination, a quadratic generator).
 * The section that uses this says so, and 1.9 shows how to break it.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CurveFit = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const BASIS = [
    { name: 'constant', label: 'O(1)', fn: function () { return 1; }, exponent: 0 },
    { name: 'log', label: 'O(log n)', fn: function (n) { return Math.log2(n); }, exponent: 0 },
    { name: 'linear', label: 'O(n)', fn: function (n) { return n; }, exponent: 1 },
    { name: 'linearithmic', label: 'O(n log n)', fn: function (n) { return n * Math.log2(n); }, exponent: 1 },
    { name: 'quadratic', label: 'O(n²)', fn: function (n) { return n * n; }, exponent: 2 },
    { name: 'cubic', label: 'O(n³)', fn: function (n) { return n * n * n; }, exponent: 3 },
    { name: 'exponential', label: 'O(2ⁿ)', fn: function (n) { return Math.pow(2, n); }, exponent: Infinity }
  ];

  /** Least-squares coefficient for y ≈ c·f(n), plus the relative residual. */
  function fitOne(points, candidate) {
    let numerator = 0;
    let denominator = 0;

    points.forEach(function (point) {
      const basis = candidate.fn(point.x);
      numerator += basis * point.y;
      denominator += basis * basis;
    });

    const c = denominator === 0 ? 0 : numerator / denominator;
    let residual = 0;
    let scale = 0;

    points.forEach(function (point) {
      const predicted = c * candidate.fn(point.x);
      residual += Math.pow(point.y - predicted, 2);
      scale += Math.pow(point.y, 2);
    });

    return {
      name: candidate.name,
      label: candidate.label,
      coefficient: c,
      residual: Math.sqrt(residual),
      relative: scale === 0 ? 0 : Math.sqrt(residual / scale)
    };
  }

  /** Ranks every candidate; the best fit is first. */
  function fit(points) {
    const usable = points.filter(function (point) {
      return Number.isFinite(point.x) && Number.isFinite(point.y) && point.x > 0;
    });

    if (usable.length < 3) return { best: null, ranked: [], note: 'need at least three points' };

    const ranked = BASIS.map(function (candidate) { return fitOne(usable, candidate); })
      .sort(function (a, b) { return a.relative - b.relative; });

    return { best: ranked[0], ranked: ranked, note: null };
  }

  /**
   * Doubling ratios. For a cost of Θ(n^k) the ratio tends to 2^k, so the
   * estimated exponent is log2 of the ratio - the reading that settles most
   * arguments in four minutes.
   */
  function doubling(points) {
    const sorted = points.slice().sort(function (a, b) { return a.x - b.x; });
    const rows = [];

    for (let i = 1; i < sorted.length; i += 1) {
      const previous = sorted[i - 1];
      const current = sorted[i];
      const sizeRatio = current.x / previous.x;
      if (!Number.isFinite(sizeRatio) || sizeRatio <= 1 || previous.y <= 0) continue;

      const costRatio = current.y / previous.y;
      rows.push({
        from: previous.x,
        to: current.x,
        ratio: costRatio,
        exponent: Math.log(costRatio) / Math.log(sizeRatio)
      });
    }

    const tail = rows.slice(Math.max(0, rows.length - 3));
    const estimate = tail.length
      ? tail.reduce(function (sum, row) { return sum + row.exponent; }, 0) / tail.length
      : NaN;

    return { rows: rows, exponent: estimate, label: describeExponent(estimate) };
  }

  function describeExponent(exponent) {
    if (!Number.isFinite(exponent)) return 'unknown';
    if (exponent < 0.2) return 'about constant';
    if (exponent < 0.7) return 'sub-linear (log-ish)';
    if (exponent < 1.15) return 'about linear';
    if (exponent < 1.45) return 'about n log n';
    if (exponent < 2.3) return 'about quadratic';
    if (exponent < 3.3) return 'about cubic';
    return 'faster than cubic';
  }

  return { fit: fit, fitOne: fitOne, doubling: doubling, basis: BASIS, describeExponent: describeExponent };
}));
