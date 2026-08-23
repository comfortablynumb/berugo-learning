/**
 * Numerical integration, and the step-size trade-off that governs every
 * finite-difference derivative.
 *
 * The V curve is the result worth carrying away from this file. A finite
 * difference has two errors pulling in opposite directions: truncation error
 * falls as the step shrinks, and rounding error - the cancellation in
 * f(x + h) − f(x), two nearly equal numbers - grows as it shrinks. The total
 * is therefore V-shaped in h on log axes, with a minimum at about the square
 * root of machine epsilon for a forward difference and the cube root for a
 * central one. Choosing h = 1e-15 because "smaller is more accurate" lands on
 * the wrong side of that V and gives an answer with no correct digits at all.
 *
 * The complex-step derivative escapes the trade entirely, and it is the one
 * genuinely surprising trick here: evaluate f at x + ih and take the imaginary
 * part divided by h. There is no subtraction anywhere, so there is no
 * cancellation, so h can be 1e-200 and the answer is accurate to machine
 * precision. It only works for functions that are analytic and that you can
 * evaluate in complex arithmetic, which is the catch.
 *
 * On the integration side, Gauss-Legendre is the demonstration that where you
 * sample matters more than how often: n points chosen well integrate any
 * polynomial of degree 2n − 1 exactly, against degree n − 1 for n equally
 * spaced points.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Quadrature = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* --------------------------------------------------- finite differences */

  function forwardDifference(f, x, h) {
    return (f(x + h) - f(x)) / h;
  }

  /** Central differences cancel the first-order truncation term, so the error
   *  is O(h²) rather than O(h) - which moves the bottom of the V and deepens
   *  it, for one extra evaluation. */
  function centralDifference(f, x, h) {
    return (f(x + h) - f(x - h)) / (2 * h);
  }

  /**
   * Richardson extrapolation: compute at h and at h/2, then combine so the
   * leading error term cancels. For a central difference that takes O(h²) to
   * O(h⁴) with no new idea, only algebra - and it can be repeated, which is
   * what Romberg integration is.
   */
  function richardson(f, x, h) {
    const coarse = centralDifference(f, x, h);
    const fine = centralDifference(f, x, h / 2);
    return (4 * fine - coarse) / 3;
  }

  /**
   * The complex-step derivative. f(x + ih) = f(x) + i·h·f'(x) − h²f''(x)/2 …,
   * so the imaginary part over h is f'(x) with an error of O(h²) and - the
   * point - no subtraction of nearly equal quantities anywhere. The caller
   * supplies a complex-aware version of f, because JavaScript has no complex
   * numbers and there is no way to fake one.
   */
  function complexStep(complexF, x, h) {
    return complexF({ re: x, im: h }).im / h;
  }

  /** Complex arithmetic, only as much as the complex-step demo needs. */
  const Complex = {
    add: function (a, b) { return { re: a.re + b.re, im: a.im + b.im }; },
    mul: function (a, b) {
      return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
    },
    sin: function (a) {
      return { re: Math.sin(a.re) * Math.cosh(a.im), im: Math.cos(a.re) * Math.sinh(a.im) };
    },
    exp: function (a) {
      const scale = Math.exp(a.re);
      return { re: scale * Math.cos(a.im), im: scale * Math.sin(a.im) };
    }
  };

  /**
   * The V curve, swept. Each row is one step size with the error of each
   * method, so the minimum and the two slopes either side of it are visible
   * rather than described.
   */
  function stepSweep(spec) {
    const out = [];
    for (let power = spec.fromPower; power <= spec.toPower; power += 1) {
      const h = Math.pow(10, power);
      const row = {
        h: h,
        forward: Math.abs(forwardDifference(spec.f, spec.x, h) - spec.truth),
        central: Math.abs(centralDifference(spec.f, spec.x, h) - spec.truth),
        richardson: Math.abs(richardson(spec.f, spec.x, h) - spec.truth)
      };
      if (spec.complexF) {
        row.complex = Math.abs(complexStep(spec.complexF, spec.x, h) - spec.truth);
      }
      out.push(row);
    }
    return out;
  }

  /** The step size that actually minimised the error, and the theoretical
   *  optimum, so the sweep can be checked against the prediction rather than
   *  eyeballed. */
  function bestStep(sweep, key) {
    let best = sweep[0];
    sweep.forEach(function (row) { if (row[key] < best[key]) best = row; });
    return { h: best.h, error: best[key] };
  }

  /* ------------------------------------------------------------ quadrature */

  function trapezoid(f, from, to, panels) {
    const h = (to - from) / panels;
    let sum = (f(from) + f(to)) / 2;
    for (let i = 1; i < panels; i += 1) sum += f(from + i * h);
    return { value: sum * h, evaluations: panels + 1, method: 'trapezoid' };
  }

  /** Simpson: fit a parabola through each pair of panels. Exact for cubics as
   *  well as quadratics, which is one degree better than the derivation
   *  promises - the odd-order error term cancels by symmetry. */
  function simpson(f, from, to, panels) {
    const even = panels % 2 === 0 ? panels : panels + 1;
    const h = (to - from) / even;
    let sum = f(from) + f(to);
    for (let i = 1; i < even; i += 1) {
      sum += (i % 2 === 1 ? 4 : 2) * f(from + i * h);
    }
    return { value: sum * h / 3, evaluations: even + 1, method: 'simpson' };
  }

  /**
   * Gauss-Legendre. The nodes are the roots of the Legendre polynomial and the
   * weights follow from them; n of each integrate any polynomial of degree
   * 2n − 1 exactly. The nodes are computed by Newton on the polynomial rather
   * than tabulated, so any n works and the demo can sweep it.
   */
  function gaussLegendre(f, from, to, points) {
    const rule = legendreRule(points);
    const middle = (from + to) / 2;
    const half = (to - from) / 2;
    let sum = 0;
    for (let i = 0; i < points; i += 1) sum += rule.weights[i] * f(middle + half * rule.nodes[i]);
    return { value: sum * half, evaluations: points, method: 'gauss-legendre' };
  }

  const ruleCache = new Map();

  function legendreRule(n) {
    if (ruleCache.has(n)) return ruleCache.get(n);
    const nodes = new Float64Array(n);
    const weights = new Float64Array(n);

    for (let i = 0; i < n; i += 1) {
      let x = Math.cos(Math.PI * (i + 0.75) / (n + 0.5));
      for (let step = 0; step < 100; step += 1) {
        const evaluated = legendre(n, x);
        const delta = evaluated.value / evaluated.derivative;
        x -= delta;
        if (Math.abs(delta) < 1e-15) break;
      }
      const evaluated = legendre(n, x);
      nodes[i] = x;
      weights[i] = 2 / ((1 - x * x) * evaluated.derivative * evaluated.derivative);
    }
    const rule = { nodes: nodes, weights: weights };
    ruleCache.set(n, rule);
    return rule;
  }

  /** The Legendre polynomial and its derivative by the standard recurrence. */
  function legendre(n, x) {
    let previous = 1;
    let current = x;
    if (n === 0) return { value: 1, derivative: 0 };

    for (let k = 2; k <= n; k += 1) {
      const next = ((2 * k - 1) * x * current - (k - 1) * previous) / k;
      previous = current;
      current = next;
    }
    return { value: current, derivative: n * (x * current - previous) / (x * x - 1) };
  }

  /**
   * Adaptive Simpson: split an interval only where the two halves disagree
   * with the whole by more than the tolerance. The saving is entirely in where
   * it does NOT split, which is why a function that is flat over most of its
   * range and spiky over a little of it is the case adaptivity is for.
   */
  function adaptiveSimpson(f, from, to, options) {
    const settings = options || {};
    const tolerance = settings.tolerance || 1e-10;
    const state = { evaluations: 3, intervals: 0, deepest: 0 };
    const whole = simpsonPanel(f, from, to);
    const value = refine(f, from, to, whole, tolerance, 0, state);
    return { value: value, evaluations: state.evaluations, intervals: state.intervals,
      deepest: state.deepest, method: 'adaptive simpson' };
  }

  function simpsonPanel(f, from, to) {
    const middle = (from + to) / 2;
    return (to - from) / 6 * (f(from) + 4 * f(middle) + f(to));
  }

  function refine(f, from, to, whole, tolerance, depth, state) {
    const middle = (from + to) / 2;
    const left = simpsonPanel(f, from, middle);
    const right = simpsonPanel(f, middle, to);
    state.evaluations += 4;
    state.deepest = Math.max(state.deepest, depth);

    if (depth > 40 || Math.abs(left + right - whole) <= 15 * tolerance) {
      state.intervals += 1;
      return left + right + (left + right - whole) / 15;
    }
    return refine(f, from, middle, left, tolerance / 2, depth + 1, state) +
      refine(f, middle, to, right, tolerance / 2, depth + 1, state);
  }

  /**
   * Monte Carlo integration. Its error falls like 1/√n regardless of the
   * DIMENSION, which is terrible in one dimension - Simpson gets there in a
   * handful of points - and is the only thing that works in twenty, where a
   * grid with ten points per axis is 10²⁰ evaluations.
   */
  function monteCarlo(f, box, samples, rng) {
    const dimensions = box.length;
    const point = new Float64Array(dimensions);
    let volume = 1;
    box.forEach(function (span) { volume *= span.to - span.from; });

    let sum = 0;
    let sumSquares = 0;
    for (let i = 0; i < samples; i += 1) {
      for (let d = 0; d < dimensions; d += 1) {
        point[d] = box[d].from + (box[d].to - box[d].from) * rng.next();
      }
      const value = f(point);
      sum += value;
      sumSquares += value * value;
    }
    const mean = sum / samples;
    const variance = Math.max(0, sumSquares / samples - mean * mean);
    return {
      value: mean * volume,
      standardError: volume * Math.sqrt(variance / samples),
      evaluations: samples,
      dimensions: dimensions,
      method: 'monte carlo'
    };
  }

  /** How many points a product grid would need for the same resolution, which
   *  is the number that makes the curse of dimensionality concrete. */
  function gridCost(dimensions, perAxis) {
    return Math.pow(perAxis, dimensions);
  }

  return {
    forwardDifference: forwardDifference,
    centralDifference: centralDifference,
    richardson: richardson,
    complexStep: complexStep,
    Complex: Complex,
    stepSweep: stepSweep,
    bestStep: bestStep,
    trapezoid: trapezoid,
    simpson: simpson,
    gaussLegendre: gaussLegendre,
    legendreRule: legendreRule,
    adaptiveSimpson: adaptiveSimpson,
    monteCarlo: monteCarlo,
    gridCost: gridCost
  };
}));
