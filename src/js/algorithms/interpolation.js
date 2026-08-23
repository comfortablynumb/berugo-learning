/**
 * Interpolation, and the two questions it is always really about: where the
 * nodes are, and whether the curve is allowed to overshoot.
 *
 * The Runge phenomenon is the headline result and it is deeply
 * counter-intuitive: for 1/(1 + 25x²) on equally spaced nodes, raising the
 * polynomial degree makes the fit WORSE, without bound, and it gets worse
 * fastest at the ends. More data and a better fit are not the same thing.
 * Moving the same number of nodes to the Chebyshev points - clustered towards
 * the ends, where the polynomial wants to oscillate - removes the divergence
 * entirely. Nothing about the polynomial changed; only where it was asked to
 * agree with the function.
 *
 * The other question is overshoot, and it is the one that actually reaches
 * production. A natural cubic spline is C² and beautiful and it overshoots
 * monotone data, which for an animation easing curve means the value goes
 * backwards, for a colour ramp means a channel leaves [0, 1], and for an audio
 * envelope means a click. `monotoneCubic` is the fix - Fritsch-Carlson limits
 * the tangents so the interpolant cannot leave the data's own range - and it
 * costs the second derivative's continuity to get there. `overshoot` measures
 * both, so the trade is a number.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Interpolation = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* ------------------------------------------------------------- nodes */

  function equallySpaced(count, from, to) {
    const out = [];
    for (let i = 0; i < count; i += 1) {
      out.push(count === 1 ? from : from + (to - from) * (i / (count - 1)));
    }
    return out;
  }

  /**
   * Chebyshev points of the second kind: the projections onto the axis of
   * equally spaced points on a semicircle. They cluster towards the ends at a
   * density of 1/√(1 − x²), which is exactly the density that makes the
   * interpolation error uniform instead of exploding at the edges.
   */
  function chebyshevNodes(count, from, to) {
    const out = [];
    for (let i = 0; i < count; i += 1) {
      const angle = Math.PI * i / Math.max(1, count - 1);
      const unit = -Math.cos(angle);
      out.push(from + (to - from) * (unit + 1) / 2);
    }
    return out;
  }

  /* -------------------------------------------------------- polynomials */

  /**
   * Barycentric Lagrange evaluation. The textbook Lagrange form is O(n²) per
   * evaluation and numerically poor; the barycentric form precomputes the
   * weights once and is O(n) per point AND stable, which is why it is what a
   * library actually uses. The guard for landing exactly on a node is not a
   * special case for tidiness - without it the formula divides by zero at
   * precisely the points where the answer is known exactly.
   */
  function barycentric(nodes, values) {
    const weights = barycentricWeights(nodes);

    return function (x) {
      let top = 0;
      let bottom = 0;
      for (let i = 0; i < nodes.length; i += 1) {
        const gap = x - nodes[i];
        if (gap === 0) return values[i];
        const term = weights[i] / gap;
        top += term * values[i];
        bottom += term;
      }
      return top / bottom;
    };
  }

  function barycentricWeights(nodes) {
    const weights = new Float64Array(nodes.length);
    for (let i = 0; i < nodes.length; i += 1) {
      let product = 1;
      for (let j = 0; j < nodes.length; j += 1) {
        if (i !== j) product *= nodes[i] - nodes[j];
      }
      weights[i] = 1 / product;
    }
    return weights;
  }

  /** Newton's divided differences, kept because the coefficients themselves
   *  are the teaching: each one is a derivative estimate of rising order, and
   *  adding a node extends the table rather than rebuilding it. */
  function dividedDifferences(nodes, values) {
    const table = values.slice();
    const coefficients = [table[0]];

    for (let order = 1; order < nodes.length; order += 1) {
      for (let i = nodes.length - 1; i >= order; i -= 1) {
        table[i] = (table[i] - table[i - 1]) / (nodes[i] - nodes[i - order]);
      }
      coefficients.push(table[order]);
    }
    return coefficients;
  }

  function newtonForm(nodes, coefficients) {
    return function (x) {
      let value = coefficients[coefficients.length - 1];
      for (let i = coefficients.length - 2; i >= 0; i -= 1) {
        value = value * (x - nodes[i]) + coefficients[i];
      }
      return value;
    };
  }

  /* ------------------------------------------------------------ splines */

  /**
   * Natural cubic spline: C² everywhere, with the second derivative set to
   * zero at both ends. Building it is one tridiagonal solve, which is O(n) by
   * the Thomas algorithm rather than the O(n³) a general solve would cost -
   * and the tridiagonal structure is not a coincidence, it is the continuity
   * conditions coupling only neighbouring intervals.
   */
  function naturalCubic(nodes, values) {
    return cubicSpline(nodes, values, { clamped: false });
  }

  /** Clamped: the end slopes are given rather than inferred, which is what an
   *  animation curve wants when it must start and finish at rest. */
  function clampedCubic(nodes, values, slopes) {
    return cubicSpline(nodes, values, { clamped: true, slopes: slopes });
  }

  function cubicSpline(nodes, values, options) {
    const n = nodes.length;
    const h = [];
    for (let i = 0; i < n - 1; i += 1) h.push(nodes[i + 1] - nodes[i]);

    const system = buildSplineSystem(nodes, values, h, options);
    const second = thomas(system.lower, system.diagonal, system.upper, system.rhs);
    return splineEvaluator(nodes, values, h, second);
  }

  function buildSplineSystem(nodes, values, h, options) {
    const n = nodes.length;
    const lower = new Float64Array(n);
    const diagonal = new Float64Array(n);
    const upper = new Float64Array(n);
    const rhs = new Float64Array(n);

    for (let i = 1; i < n - 1; i += 1) {
      lower[i] = h[i - 1];
      diagonal[i] = 2 * (h[i - 1] + h[i]);
      upper[i] = h[i];
      rhs[i] = 6 * ((values[i + 1] - values[i]) / h[i] -
        (values[i] - values[i - 1]) / h[i - 1]);
    }
    if (!options.clamped) {
      diagonal[0] = 1; diagonal[n - 1] = 1;
      return { lower: lower, diagonal: diagonal, upper: upper, rhs: rhs };
    }
    const slopes = options.slopes || [0, 0];
    diagonal[0] = 2 * h[0]; upper[0] = h[0];
    rhs[0] = 6 * ((values[1] - values[0]) / h[0] - slopes[0]);
    lower[n - 1] = h[n - 2]; diagonal[n - 1] = 2 * h[n - 2];
    rhs[n - 1] = 6 * (slopes[1] - (values[n - 1] - values[n - 2]) / h[n - 2]);
    return { lower: lower, diagonal: diagonal, upper: upper, rhs: rhs };
  }

  /** The Thomas algorithm: Gaussian elimination that knows the matrix is
   *  tridiagonal, so it is O(n) rather than O(n³) and needs no pivoting
   *  because the spline system is diagonally dominant by construction. */
  function thomas(lower, diagonal, upper, rhs) {
    const n = diagonal.length;
    const c = new Float64Array(n);
    const d = new Float64Array(n);

    c[0] = upper[0] / diagonal[0];
    d[0] = rhs[0] / diagonal[0];
    for (let i = 1; i < n; i += 1) {
      const denominator = diagonal[i] - lower[i] * c[i - 1];
      c[i] = upper[i] / denominator;
      d[i] = (rhs[i] - lower[i] * d[i - 1]) / denominator;
    }
    const x = new Float64Array(n);
    x[n - 1] = d[n - 1];
    for (let i = n - 2; i >= 0; i -= 1) x[i] = d[i] - c[i] * x[i + 1];
    return x;
  }

  function splineEvaluator(nodes, values, h, second) {
    const evaluate = function (x) {
      const i = intervalFor(nodes, x);
      const width = h[i];
      const left = nodes[i + 1] - x;
      const right = x - nodes[i];
      return (second[i] * left * left * left + second[i + 1] * right * right * right) /
        (6 * width) +
        (values[i] / width - second[i] * width / 6) * left +
        (values[i + 1] / width - second[i + 1] * width / 6) * right;
    };
    evaluate.secondDerivative = function (x) {
      const i = intervalFor(nodes, x);
      const width = h[i];
      return (second[i] * (nodes[i + 1] - x) + second[i + 1] * (x - nodes[i])) / width;
    };
    evaluate.moments = Array.from(second);
    return evaluate;
  }

  function intervalFor(nodes, x) {
    let low = 0;
    let high = nodes.length - 2;
    if (x <= nodes[0]) return 0;
    if (x >= nodes[nodes.length - 1]) return high;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (nodes[mid] <= x) low = mid; else high = mid - 1;
    }
    return low;
  }

  /**
   * Fritsch-Carlson monotone cubic. Start from a slope estimate, then limit
   * each tangent so no interval can overshoot: the constraint is that the
   * scaled tangents stay inside a circle of radius three, which is exactly the
   * region where a cubic Hermite segment is monotone. It gives up C² - the
   * second derivative jumps at the knots - and in exchange it cannot produce a
   * value outside the data's own range.
   */
  function monotoneCubic(nodes, values) {
    const n = nodes.length;
    const slopes = secantSlopes(nodes, values);
    const tangents = initialTangents(slopes);
    limitTangents(slopes, tangents);

    return function (x) {
      const i = intervalFor(nodes, x);
      const width = nodes[i + 1] - nodes[i];
      const t = (x - nodes[i]) / width;
      const t2 = t * t;
      const t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * values[i] +
        (t3 - 2 * t2 + t) * width * tangents[i] +
        (-2 * t3 + 3 * t2) * values[i + 1] +
        (t3 - t2) * width * tangents[i + 1];
    };
  }

  function secantSlopes(nodes, values) {
    const out = [];
    for (let i = 0; i < nodes.length - 1; i += 1) {
      out.push((values[i + 1] - values[i]) / (nodes[i + 1] - nodes[i]));
    }
    return out;
  }

  function initialTangents(slopes) {
    const n = slopes.length + 1;
    const tangents = new Float64Array(n);
    tangents[0] = slopes[0];
    tangents[n - 1] = slopes[slopes.length - 1];
    for (let i = 1; i < n - 1; i += 1) {
      tangents[i] = slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2;
    }
    return tangents;
  }

  function limitTangents(slopes, tangents) {
    for (let i = 0; i < slopes.length; i += 1) {
      if (slopes[i] === 0) { tangents[i] = 0; tangents[i + 1] = 0; continue; }
      const alpha = tangents[i] / slopes[i];
      const beta = tangents[i + 1] / slopes[i];
      const length = Math.hypot(alpha, beta);
      if (length <= 3) continue;
      const scale = 3 / length;
      tangents[i] = scale * alpha * slopes[i];
      tangents[i + 1] = scale * beta * slopes[i];
    }
  }

  /* -------------------------------------------------------------- Bézier */

  /**
   * De Casteljau: repeatedly interpolate between neighbouring control points
   * until one remains. It is slower than evaluating the Bernstein polynomial
   * and it is numerically stable - every step is a convex combination, so
   * nothing can grow - and it hands you the subdivision for free, which is
   * what a renderer actually needs.
   */
  function deCasteljau(points, t) {
    let current = points.map(function (p) { return { x: p.x, y: p.y }; });
    const levels = [current];

    while (current.length > 1) {
      const next = [];
      for (let i = 0; i < current.length - 1; i += 1) {
        next.push({
          x: current[i].x + t * (current[i + 1].x - current[i].x),
          y: current[i].y + t * (current[i + 1].y - current[i].y)
        });
      }
      current = next;
      levels.push(current);
    }
    return { point: current[0], levels: levels };
  }

  /* ------------------------------------------------------------ scoring */

  /** The worst error over a dense sample, which is the norm the Runge
   *  phenomenon is stated in - an average would hide it, because the
   *  divergence is confined to the ends. */
  function maximumError(f, approximation, from, to, samples) {
    const count = samples || 2001;
    let worst = 0;
    let at = from;
    for (let i = 0; i < count; i += 1) {
      const x = from + (to - from) * (i / (count - 1));
      const error = Math.abs(f(x) - approximation(x));
      if (error > worst) { worst = error; at = x; }
    }
    return { error: worst, at: at };
  }

  /** How far outside the data's own range an interpolant strays. Zero is the
   *  property monotone interpolation exists to guarantee. */
  function overshoot(values, approximation, nodes, samples) {
    const count = samples || 2001;
    const low = Math.min.apply(null, values);
    const high = Math.max.apply(null, values);
    let above = 0;
    let below = 0;

    for (let i = 0; i < count; i += 1) {
      const x = nodes[0] + (nodes[nodes.length - 1] - nodes[0]) * (i / (count - 1));
      const y = approximation(x);
      above = Math.max(above, y - high);
      below = Math.max(below, low - y);
    }
    return { above: above, below: below, worst: Math.max(above, below) };
  }

  /** The Runge function itself: the standard fixture, and pathological for a
   *  concrete reason - its poles at ±i/5 sit close enough to the real interval
   *  that equally spaced interpolation diverges there. */
  function runge(x) { return 1 / (1 + 25 * x * x); }

  return {
    equallySpaced: equallySpaced,
    chebyshevNodes: chebyshevNodes,
    barycentric: barycentric,
    barycentricWeights: barycentricWeights,
    dividedDifferences: dividedDifferences,
    newtonForm: newtonForm,
    naturalCubic: naturalCubic,
    clampedCubic: clampedCubic,
    monotoneCubic: monotoneCubic,
    thomas: thomas,
    deCasteljau: deCasteljau,
    maximumError: maximumError,
    overshoot: overshoot,
    runge: runge,
    intervalFor: intervalFor
  };
}));
