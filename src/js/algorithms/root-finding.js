/**
 * Root finders, each instrumented so "converges quadratically" is an estimate
 * from the iterates rather than a claim from a textbook.
 *
 * Every method returns its whole trail, and `convergenceOrder` fits an order
 * to it: if the error at each step is roughly a constant times the previous
 * error to the power p, then the ratio of successive log-errors estimates p.
 * Bisection comes out at 1, the secant method near 1.618 - the golden ratio,
 * which is not a coincidence but the root of its error recurrence - and
 * Newton at 2. Seeing those numbers fall out of the iterates is the point;
 * being told them is not.
 *
 * Newton is also here in each of its three failure modes, reachable from
 * chosen start points rather than described: a flat derivative that throws the
 * iterate to infinity, a cycle that never terminates, and convergence to the
 * wrong root. All three are silent - Newton does not report that it has
 * failed, it simply returns something - which is the entire reason every
 * production root finder is a hybrid with a bracketing guarantee underneath.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RootFinding = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const DEFAULT_TOLERANCE = 1e-12;
  const DEFAULT_LIMIT = 100;

  function settingsFor(options) {
    const given = options || {};
    return {
      tolerance: given.tolerance || DEFAULT_TOLERANCE,
      limit: given.limit || DEFAULT_LIMIT,
      truth: given.truth
    };
  }

  function result(name, state, settings) {
    return {
      method: name,
      root: state.root,
      iterations: state.trail.length,
      evaluations: state.evaluations,
      trail: state.trail,
      converged: state.converged,
      bracketed: !!state.bracketed,
      reason: state.reason || (state.converged ? 'tolerance reached' : 'iteration limit'),
      order: convergenceOrder(state.trail, settings.truth),
      contraction: bracketContraction(state.trail)
    };
  }

  /**
   * Fit p in |e_{k+1}| ~ C |e_k|^p from consecutive errors, and return null
   * when the sequence does not support the fit.
   *
   * Three guards, each for a case that otherwise produces a confident wrong
   * number. Steps where the error has already reached machine precision are
   * excluded, because there the "error" is rounding. Steps where the error
   * did not decrease are excluded, and that exclusion is what makes bisection
   * report NOTHING rather than a number: bisection halves the BRACKET, not
   * the error, and the midpoint of a halved bracket can be further from the
   * root than the previous midpoint was. An earlier version without this guard
   * reported an order of 1.857 for a method whose iterate error is not
   * geometric at all. And the answer is the median of the per-step estimates
   * rather than the last, so one unlucky step does not decide it.
   *
   * `bracketContraction` is what bisection does have, and it is exactly 0.5.
   */
  function convergenceOrder(trail, truth) {
    if (truth === undefined || trail.length < 4) return null;
    const errors = trail.map(function (step) { return Math.abs(step.x - truth); });
    const ratios = [];

    for (let i = 1; i < errors.length - 1; i += 1) {
      if (!(errors[i] > 1e-13) || !(errors[i + 1] > 1e-15)) continue;
      if (!(errors[i - 1] > errors[i]) || !(errors[i] > errors[i + 1])) continue;
      const top = Math.log(errors[i + 1] / errors[i]);
      const bottom = Math.log(errors[i] / errors[i - 1]);
      if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom === 0) continue;
      ratios.push(top / bottom);
    }
    if (ratios.length < 2) return null;
    ratios.sort(function (a, b) { return a - b; });
    const middle = Math.floor(ratios.length / 2);
    return ratios.length % 2 === 1 ? ratios[middle]
      : (ratios[middle - 1] + ratios[middle]) / 2;
  }

  /**
   * How much the bracket shrinks per step, for the methods that keep one.
   * Bisection is exactly 0.5 by construction; false position is close to 1 on
   * a convex function, which is the same stalling its `stalled` counter
   * reports, seen from the other side.
   */
  function bracketContraction(trail) {
    const widths = trail.map(function (step) { return step.width; })
      .filter(function (width) { return Number.isFinite(width) && width > 0; });
    if (widths.length < 3) return null;

    const ratios = [];
    for (let i = 1; i < widths.length; i += 1) ratios.push(widths[i] / widths[i - 1]);
    ratios.sort(function (a, b) { return a - b; });
    return ratios[Math.floor(ratios.length / 2)];
  }

  /* ------------------------------------------------------------ bisection */

  /**
   * The only method here with a guarantee: if the endpoints disagree in sign
   * the interval contains a root and halving it cannot lose it. One bit per
   * iteration, always, which is slow and is never surprising.
   */
  function bisection(f, bracket, options) {
    const settings = settingsFor(options);
    const state = { trail: [], evaluations: 2, converged: false, bracketed: true };
    let low = bracket.low;
    let high = bracket.high;
    let flow = f(low);
    const fhigh = f(high);

    if (flow * fhigh > 0) {
      return result('bisection', { trail: [], evaluations: 2, converged: false,
        reason: 'the endpoints do not bracket a root', root: NaN }, settings);
    }
    for (let i = 0; i < settings.limit; i += 1) {
      const mid = low + (high - low) / 2;
      const value = f(mid);
      state.evaluations += 1;
      state.trail.push({ x: mid, value: value, width: high - low });
      state.root = mid;
      if (Math.abs(value) === 0 || (high - low) / 2 < settings.tolerance) {
        state.converged = true;
        break;
      }
      if (flow * value < 0) { high = mid; } else { low = mid; flow = value; }
    }
    return result('bisection', state, settings);
  }

  /**
   * False position keeps the bracket and interpolates instead of halving,
   * which is faster on well-behaved functions and has a trap: on a convex
   * function one endpoint sticks, the interval never shrinks past it, and
   * convergence degrades to linear with a terrible constant. `stalled` counts
   * how many iterations kept the same endpoint.
   */
  function falsePosition(f, bracket, options) {
    const settings = settingsFor(options);
    const state = { trail: [], evaluations: 2, converged: false, bracketed: true, stalled: 0 };
    let low = bracket.low;
    let high = bracket.high;
    let flow = f(low);
    let fhigh = f(high);
    let lastMoved = null;

    if (flow * fhigh > 0) {
      return result('false position', { trail: [], evaluations: 2, converged: false,
        reason: 'the endpoints do not bracket a root', root: NaN }, settings);
    }
    for (let i = 0; i < settings.limit; i += 1) {
      const x = (low * fhigh - high * flow) / (fhigh - flow);
      const value = f(x);
      state.evaluations += 1;
      state.trail.push({ x: x, value: value, width: high - low });
      state.root = x;
      if (Math.abs(value) < settings.tolerance) { state.converged = true; break; }

      if (flow * value < 0) {
        high = x; fhigh = value;
        if (lastMoved === 'high') state.stalled += 1;
        lastMoved = 'high';
      } else {
        low = x; flow = value;
        if (lastMoved === 'low') state.stalled += 1;
        lastMoved = 'low';
      }
    }
    const answer = result('false position', state, settings);
    answer.stalled = state.stalled;
    return answer;
  }

  /* --------------------------------------------------------------- Newton */

  /**
   * Newton: follow the tangent to the axis. Quadratic when it works, and it
   * fails in three distinct ways that all look like an answer. The `reason`
   * field names which one happened rather than returning silently.
   */
  function newton(f, derivative, start, options) {
    const settings = settingsFor(options);
    const state = { trail: [], evaluations: 0, converged: false };
    let x = start;

    for (let i = 0; i < settings.limit; i += 1) {
      const value = f(x);
      const slope = derivative(x);
      state.evaluations += 2;
      state.trail.push({ x: x, value: value, slope: slope });
      state.root = x;

      if (Math.abs(value) < settings.tolerance) { state.converged = true; break; }
      if (slope === 0 || !Number.isFinite(slope)) {
        state.reason = 'the derivative vanished, so the tangent never meets the axis';
        break;
      }
      const next = x - value / slope;
      if (!Number.isFinite(next)) { state.reason = 'the iterate left the real line'; break; }
      if (Math.abs(next) > 1e12) {
        state.reason = 'the iterate was thrown far from the root by a flat derivative';
        state.root = next;
        break;
      }
      x = next;
    }
    if (!state.converged && !state.reason) state.reason = 'iteration limit, possibly cycling';
    return result('newton', state, settings);
  }

  /** The secant method: Newton with the derivative replaced by a difference
   *  quotient over the last two iterates. One evaluation per step instead of
   *  two, and an order of about 1.618 instead of 2 - which is more function
   *  evaluations per digit only if the derivative is free. */
  function secant(f, first, second, options) {
    const settings = settingsFor(options);
    const state = { trail: [], evaluations: 2, converged: false };
    let previous = first;
    let current = second;
    let fPrevious = f(previous);
    let fCurrent = f(current);

    for (let i = 0; i < settings.limit; i += 1) {
      state.trail.push({ x: current, value: fCurrent });
      state.root = current;
      if (Math.abs(fCurrent) < settings.tolerance) { state.converged = true; break; }
      if (fCurrent === fPrevious) { state.reason = 'the secant went flat'; break; }

      const next = current - fCurrent * (current - previous) / (fCurrent - fPrevious);
      previous = current; fPrevious = fCurrent;
      current = next; fCurrent = f(current);
      state.evaluations += 1;
      if (!Number.isFinite(current)) { state.reason = 'the iterate left the real line'; break; }
    }
    return result('secant', state, settings);
  }

  /* ---------------------------------------------------------------- Brent */

  /**
   * Brent's method: try inverse quadratic interpolation, fall back to the
   * secant, and fall back to bisection whenever the interpolated step fails
   * to make enough progress. That last clause is what makes it a hybrid rather
   * than a fast method with a safety net - the bracket is never given up, so
   * the guarantee bisection has is retained while the speed of interpolation
   * is available whenever the function cooperates.
   */
  function brent(f, bracket, options) {
    const settings = settingsFor(options);
    const state = { trail: [], evaluations: 2, converged: false, bracketed: true,
      bisections: 0, interpolations: 0 };
    const span = { a: bracket.low, b: bracket.high, fa: f(bracket.low), fb: f(bracket.high) };

    if (span.fa * span.fb > 0) {
      return result('brent', { trail: [], evaluations: 2, converged: false,
        reason: 'the endpoints do not bracket a root', root: NaN }, settings);
    }
    if (Math.abs(span.fa) < Math.abs(span.fb)) swapEnds(span);
    span.c = span.a; span.fc = span.fa; span.usedBisection = true;

    for (let i = 0; i < settings.limit; i += 1) {
      if (brentStep(f, span, state, settings)) { state.converged = true; break; }
    }
    state.root = span.b;
    const answer = result('brent', state, settings);
    answer.bisections = state.bisections;
    answer.interpolations = state.interpolations;
    return answer;
  }

  function swapEnds(span) {
    const a = span.a; const fa = span.fa;
    span.a = span.b; span.fa = span.fb;
    span.b = a; span.fb = fa;
  }

  function brentStep(f, span, state, settings) {
    state.trail.push({ x: span.b, value: span.fb, width: Math.abs(span.b - span.a) });
    if (Math.abs(span.fb) < settings.tolerance ||
      Math.abs(span.b - span.a) < settings.tolerance) return true;

    let s = interpolate(span);
    if (!acceptable(s, span)) { s = (span.a + span.b) / 2; state.bisections += 1; }
    else state.interpolations += 1;

    const fs = f(s);
    state.evaluations += 1;
    span.d = span.c; span.c = span.b; span.fc = span.fb;

    if (span.fa * fs < 0) { span.b = s; span.fb = fs; }
    else { span.a = s; span.fa = fs; }
    if (Math.abs(span.fa) < Math.abs(span.fb)) swapEnds(span);
    return false;
  }

  /** Inverse quadratic through three points when they are distinct, and the
   *  secant when two of them coincide. */
  function interpolate(span) {
    if (span.fa !== span.fc && span.fb !== span.fc) {
      return (span.a * span.fb * span.fc) / ((span.fa - span.fb) * (span.fa - span.fc)) +
        (span.b * span.fa * span.fc) / ((span.fb - span.fa) * (span.fb - span.fc)) +
        (span.c * span.fa * span.fb) / ((span.fc - span.fa) * (span.fc - span.fb));
    }
    return span.b - span.fb * (span.b - span.a) / (span.fb - span.fa);
  }

  /** The progress conditions: the step must land inside the bracket's upper
   *  quarter and must halve the interval often enough. Failing either is what
   *  sends Brent back to bisection. */
  function acceptable(s, span) {
    const low = (3 * span.a + span.b) / 4;
    const inside = (s > Math.min(low, span.b) && s < Math.max(low, span.b));
    if (!inside) return false;
    return Math.abs(s - span.b) < Math.abs(span.b - span.c) / 2;
  }

  /* --------------------------------------------------------- fixed point */

  /**
   * Fixed-point iteration converges when |g'(x)| < 1 near the root, and that
   * condition is checkable rather than hopeful. The same equation rearranged
   * two ways gives one iteration that converges and one that diverges from
   * the same start, which is the whole content of the contraction condition.
   */
  function fixedPoint(g, start, options) {
    const settings = settingsFor(options);
    const state = { trail: [], evaluations: 0, converged: false };
    let x = start;

    for (let i = 0; i < settings.limit; i += 1) {
      const next = g(x);
      state.evaluations += 1;
      state.trail.push({ x: x, value: next - x });
      state.root = next;
      if (!Number.isFinite(next) || Math.abs(next) > 1e12) {
        state.reason = 'the iteration diverged';
        break;
      }
      if (Math.abs(next - x) < settings.tolerance) { state.converged = true; x = next; break; }
      x = next;
    }
    state.root = x;
    return result('fixed point', state, settings);
  }

  /** |g'| near the root, estimated by a central difference - the number that
   *  decides whether the iteration is a contraction. */
  function contractionFactor(g, x, h) {
    const step = h || 1e-6;
    return Math.abs((g(x + step) - g(x - step)) / (2 * step));
  }

  return {
    DEFAULT_TOLERANCE: DEFAULT_TOLERANCE,
    convergenceOrder: convergenceOrder,
    bracketContraction: bracketContraction,
    bisection: bisection,
    falsePosition: falsePosition,
    newton: newton,
    secant: secant,
    brent: brent,
    fixedPoint: fixedPoint,
    contractionFactor: contractionFactor
  };
}));
