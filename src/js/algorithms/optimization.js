/**
 * Continuous optimisation, and the one hyperparameter a line search removes.
 *
 * Most "the optimiser did not converge" reports are a step-size problem on an
 * ill-conditioned surface, and the demonstration here is direct: on
 * Rosenbrock's valley, gradient descent with a fixed step either diverges or
 * crawls, and the same descent direction with a backtracking line search
 * converges. The step size was never a property of the problem to be tuned -
 * it was a quantity that could be computed at each iteration, and computing it
 * costs a handful of extra function evaluations.
 *
 * The other measurement is conditioning. On a quadratic bowl, gradient descent
 * needs a number of iterations proportional to the condition number, and each
 * step is perpendicular to the last, so on an elongated valley it zig-zags
 * across rather than travelling along. Newton's method rescales by the
 * curvature and is therefore invariant to that stretching - it takes the same
 * number of steps whatever the aspect ratio - and BFGS builds an approximation
 * to that rescaling from gradients alone, which is what makes it usable when
 * the Hessian is unavailable or too large.
 *
 * Every method reports `objectives` so monotone decrease is a checked property
 * rather than an assumption; a line search that does not enforce it is a line
 * search with a bug.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Optimization = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const L = scope && scope.Linalg ? scope.Linalg : require('./linalg.js');

  function norm(vector) {
    let sum = 0;
    for (let i = 0; i < vector.length; i += 1) sum += vector[i] * vector[i];
    return Math.sqrt(sum);
  }

  function dot(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
    return sum;
  }

  function step(x, direction, length) {
    const out = new Float64Array(x.length);
    for (let i = 0; i < x.length; i += 1) out[i] = x[i] + length * direction[i];
    return out;
  }

  /* -------------------------------------------------------- line search */

  /**
   * Backtracking until the Armijo condition holds: the step must reduce the
   * objective by at least a fraction c of what the linear model predicted.
   * Without that fraction any decrease counts and the iteration can creep
   * forever with steps that shrink faster than the progress they make; with
   * it, sufficient decrease is guaranteed and the iteration terminates.
   */
  function backtracking(problem, x, direction, options) {
    const settings = options || {};
    const c = settings.c === undefined ? 1e-4 : settings.c;
    const shrink = settings.shrink === undefined ? 0.5 : settings.shrink;
    const value = problem.f(x);
    const slope = dot(problem.gradient(x), direction);
    let length = settings.initial === undefined ? 1 : settings.initial;
    let evaluations = 1;

    if (slope >= 0) return { length: 0, evaluations: evaluations, ascent: true };
    for (let i = 0; i < (settings.limit || 60); i += 1) {
      const candidate = problem.f(step(x, direction, length));
      evaluations += 1;
      if (candidate <= value + c * length * slope) {
        return { length: length, evaluations: evaluations, ascent: false, backtracks: i };
      }
      length *= shrink;
    }
    return { length: length, evaluations: evaluations, ascent: false, exhausted: true };
  }

  /** The curvature half of the Wolfe conditions: the step must also flatten
   *  the slope, which is what stops a line search from taking a step so short
   *  that a quasi-Newton update learns nothing from it. */
  function wolfeCheck(problem, x, direction, length) {
    const c1 = 1e-4;
    const c2 = 0.9;
    const value = problem.f(x);
    const slope = dot(problem.gradient(x), direction);
    const moved = step(x, direction, length);
    const nextSlope = dot(problem.gradient(moved), direction);

    return {
      armijo: problem.f(moved) <= value + c1 * length * slope,
      curvature: nextSlope >= c2 * slope,
      slope: slope,
      nextSlope: nextSlope
    };
  }

  /* ---------------------------------------------------- gradient descent */

  function record(problem, x, history) {
    const gradient = problem.gradient(x);
    history.push({ x: Array.from(x), objective: problem.f(x), gradientNorm: norm(gradient) });
    return gradient;
  }

  function finish(name, problem, x, history, state) {
    let increases = 0;
    for (let i = 1; i < history.length; i += 1) {
      if (history[i].objective > history[i - 1].objective + 1e-15) increases += 1;
    }
    return {
      method: name, x: Array.from(x), objective: problem.f(x),
      iterations: history.length, history: history,
      converged: !!state.converged, diverged: !!state.diverged,
      evaluations: state.evaluations || history.length,
      monotone: increases === 0, increases: increases
    };
  }

  /**
   * Gradient descent with a fixed step. Kept because it is what everybody
   * writes first, and because its failure is the section's argument: too large
   * and it diverges, too small and it never arrives, and the boundary between
   * them is 2/L where L is the largest curvature - a quantity nobody has.
   */
  function gradientDescent(problem, start, options) {
    const settings = options || {};
    const limit = settings.limit || 2000;
    const tolerance = settings.tolerance || 1e-8;
    const history = [];
    const state = { evaluations: 0 };
    let x = Float64Array.from(start);
    let velocity = new Float64Array(start.length);

    for (let i = 0; i < limit; i += 1) {
      const gradient = record(problem, x, history);
      state.evaluations += 2;
      if (!Number.isFinite(history[history.length - 1].objective) ||
        history[history.length - 1].objective > 1e14) { state.diverged = true; break; }
      if (norm(gradient) < tolerance) { state.converged = true; break; }

      const length = chooseStep(problem, x, gradient, settings, state);
      if (length === 0) { state.converged = true; break; }
      const direction = descentDirection(gradient, velocity, settings.momentum);
      velocity = direction;
      x = step(x, direction, length);
    }
    return finish(settings.momentum ? 'momentum' : 'gradient descent',
      problem, x, history, state);
  }

  function descentDirection(gradient, velocity, momentum) {
    const out = new Float64Array(gradient.length);
    for (let i = 0; i < gradient.length; i += 1) {
      out[i] = -gradient[i] + (momentum || 0) * velocity[i];
    }
    return out;
  }

  function chooseStep(problem, x, gradient, settings, state) {
    if (!settings.lineSearch) return settings.step === undefined ? 0.001 : settings.step;
    const direction = new Float64Array(gradient.length);
    for (let i = 0; i < gradient.length; i += 1) direction[i] = -gradient[i];
    const found = backtracking(problem, x, direction, settings);
    state.evaluations += found.evaluations;
    return found.length;
  }

  /* ------------------------------------------------------------- Newton */

  /**
   * Newton's method on a function: solve H·d = −g and step. It rescales by the
   * curvature, so it is invariant to a linear change of variables - which is
   * exactly why an elongated valley costs it nothing and costs gradient
   * descent everything. The price is the Hessian: n² entries and an O(n³)
   * solve per step.
   */
  function newtonMethod(problem, start, options) {
    const settings = options || {};
    const limit = settings.limit || 200;
    const tolerance = settings.tolerance || 1e-10;
    const history = [];
    const state = { evaluations: 0 };
    let x = Float64Array.from(start);

    for (let i = 0; i < limit; i += 1) {
      const gradient = record(problem, x, history);
      state.evaluations += 3;
      if (norm(gradient) < tolerance) { state.converged = true; break; }
      if (!problem.hessian) break;

      const negative = new Float64Array(gradient.length);
      for (let k = 0; k < gradient.length; k += 1) negative[k] = -gradient[k];
      const direction = L.solve(problem.hessian(x), negative);
      if (!Number.isFinite(norm(direction))) { state.diverged = true; break; }

      const found = backtracking(problem, x, direction, settings);
      state.evaluations += found.evaluations;
      if (found.length === 0) { state.converged = true; break; }
      x = step(x, direction, found.length);
    }
    return finish('newton', problem, x, history, state);
  }

  /**
   * BFGS: build an approximation to the inverse Hessian from the changes in
   * the gradient, so the curvature rescaling is available without ever forming
   * a second derivative. The update keeps the approximation positive definite,
   * which is what guarantees the direction is a descent direction - and it is
   * why the curvature condition in the line search matters, since a step that
   * does not flatten the slope produces an update that would break it.
   */
  function bfgs(problem, start, options) {
    const settings = options || {};
    const limit = settings.limit || 500;
    const tolerance = settings.tolerance || 1e-10;
    const n = start.length;
    const history = [];
    const state = { evaluations: 0 };

    let x = Float64Array.from(start);
    let inverse = L.identity(n);
    let gradient = problem.gradient(x);

    for (let i = 0; i < limit; i += 1) {
      history.push({ x: Array.from(x), objective: problem.f(x), gradientNorm: norm(gradient) });
      state.evaluations += 2;
      if (norm(gradient) < tolerance) { state.converged = true; break; }

      const direction = negatedApply(inverse, gradient);
      const found = backtracking(problem, x, direction, settings);
      state.evaluations += found.evaluations;
      if (found.length === 0) { state.converged = true; break; }

      const next = step(x, direction, found.length);
      const nextGradient = problem.gradient(next);
      inverse = bfgsUpdate(inverse, L.subtract(next, x), L.subtract(nextGradient, gradient));
      x = next;
      gradient = nextGradient;
    }
    return finish('bfgs', problem, x, history, state);
  }

  function negatedApply(inverse, gradient) {
    const applied = L.apply(inverse, gradient);
    const out = new Float64Array(applied.length);
    for (let i = 0; i < applied.length; i += 1) out[i] = -applied[i];
    return out;
  }

  /** The Sherman-Morrison-style rank-two update. Skipped when the curvature
   *  condition fails, because applying it then destroys positive definiteness
   *  and the next direction is an ascent direction. */
  function bfgsUpdate(inverse, s, y) {
    const sy = dot(s, y);
    if (!(sy > 1e-12)) return inverse;

    const n = s.length;
    const rho = 1 / sy;
    const left = L.identity(n);
    const right = L.identity(n);
    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) {
        L.put(left, r, c, L.at(left, r, c) - rho * s[r] * y[c]);
        L.put(right, r, c, L.at(right, r, c) - rho * y[r] * s[c]);
      }
    }
    const updated = L.multiply(L.multiply(left, inverse), right);
    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) {
        L.put(updated, r, c, L.at(updated, r, c) + rho * s[r] * s[c]);
      }
    }
    return updated;
  }

  /**
   * Coordinate descent: minimise along one axis at a time. It needs no
   * gradient at all and it is what a LASSO solver uses, and it fails exactly
   * where the axes are not aligned with the valley - on a rotated quadratic it
   * can stall at a point that is not a minimum in any diagonal direction.
   */
  function coordinateDescent(problem, start, options) {
    const settings = options || {};
    const limit = settings.limit || 500;
    const tolerance = settings.tolerance || 1e-10;
    const history = [];
    const state = { evaluations: 0 };
    let x = Float64Array.from(start);

    for (let sweepIndex = 0; sweepIndex < limit; sweepIndex += 1) {
      const before = problem.f(x);
      history.push({ x: Array.from(x), objective: before, gradientNorm: norm(problem.gradient(x)) });
      state.evaluations += 2;

      for (let axis = 0; axis < x.length; axis += 1) {
        x = minimiseAxis(problem, x, axis, state);
      }
      if (Math.abs(before - problem.f(x)) < tolerance) { state.converged = true; break; }
    }
    return finish('coordinate descent', problem, x, history, state);
  }

  /** A golden-section search along one axis, which needs only evaluations. */
  function minimiseAxis(problem, x, axis, state) {
    const phi = (Math.sqrt(5) - 1) / 2;
    let low = x[axis] - 2;
    let high = x[axis] + 2;
    const probe = function (value) {
      const trial = Float64Array.from(x);
      trial[axis] = value;
      state.evaluations += 1;
      return problem.f(trial);
    };

    for (let i = 0; i < 60; i += 1) {
      const a = high - phi * (high - low);
      const b = low + phi * (high - low);
      if (probe(a) < probe(b)) high = b; else low = a;
      if (high - low < 1e-12) break;
    }
    const out = Float64Array.from(x);
    out[axis] = (low + high) / 2;
    return out;
  }

  /* ------------------------------------------------------------ surfaces */

  /** A quadratic bowl with a chosen aspect ratio, so the demo sets the
   *  condition number rather than discovering it. */
  function quadratic(condition) {
    const scale = condition === undefined ? 1 : condition;
    return {
      id: 'quadratic',
      condition: scale,
      minimum: [0, 0],
      f: function (x) { return 0.5 * (x[0] * x[0] + scale * x[1] * x[1]); },
      gradient: function (x) { return new Float64Array([x[0], scale * x[1]]); },
      hessian: function () { return L.from2d([[1, 0], [0, scale]]); }
    };
  }

  /** Rosenbrock's banana: a narrow curved valley whose floor is easy to reach
   *  and whose minimum is hard to travel to. The standard fixture, and the
   *  reason it is standard is that the difficulty is the curvature of the
   *  valley rather than any steepness. */
  function rosenbrock() {
    return {
      id: 'rosenbrock',
      minimum: [1, 1],
      f: function (x) {
        const a = 1 - x[0];
        const b = x[1] - x[0] * x[0];
        return a * a + 100 * b * b;
      },
      gradient: function (x) {
        return new Float64Array([
          -2 * (1 - x[0]) - 400 * x[0] * (x[1] - x[0] * x[0]),
          200 * (x[1] - x[0] * x[0])
        ]);
      },
      hessian: function (x) {
        return L.from2d([
          [2 - 400 * (x[1] - 3 * x[0] * x[0]), -400 * x[0]],
          [-400 * x[0], 200]
        ]);
      }
    };
  }

  /** A quadratic rotated off the axes, which is where coordinate descent
   *  loses its advantage and the demo can show it. */
  function rotatedQuadratic(condition, angle) {
    const theta = angle === undefined ? Math.PI / 4 : angle;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const scale = condition === undefined ? 20 : condition;
    const q = L.from2d([[cos, -sin], [sin, cos]]);
    const d = L.from2d([[1, 0], [0, scale]]);
    const h = L.multiply(L.multiply(q, d), L.transpose(q));

    return {
      id: 'rotated quadratic',
      condition: scale,
      minimum: [0, 0],
      f: function (x) { return 0.5 * dot(x, L.apply(h, x)); },
      gradient: function (x) { return L.apply(h, x); },
      hessian: function () { return h; }
    };
  }

  const SURFACES = [
    { id: 'quadratic', label: 'a quadratic bowl', build: function () { return quadratic(1); } },
    { id: 'valley', label: 'an elongated valley', build: function () { return quadratic(100); } },
    { id: 'rotated', label: 'a rotated valley',
      build: function () { return rotatedQuadratic(20, Math.PI / 4); } },
    { id: 'rosenbrock', label: 'Rosenbrock’s banana', build: rosenbrock }
  ];

  function surfaceFor(id) {
    for (let i = 0; i < SURFACES.length; i += 1) {
      if (SURFACES[i].id === id) return SURFACES[i].build();
    }
    return SURFACES[0].build();
  }

  /** The largest fixed step that does not diverge on a quadratic: 2/L, where
   *  L is the largest eigenvalue of the Hessian. The number a fixed-step
   *  descent needs and nobody has. */
  function stableStep(problem) {
    if (!problem.hessian) return null;
    const h = problem.hessian([0, 0]);
    const largest = Math.max(L.at(h, 0, 0), L.at(h, 1, 1));
    return 2 / largest;
  }

  return {
    SURFACES: SURFACES,
    surfaceFor: surfaceFor,
    backtracking: backtracking,
    wolfeCheck: wolfeCheck,
    gradientDescent: gradientDescent,
    newtonMethod: newtonMethod,
    bfgs: bfgs,
    coordinateDescent: coordinateDescent,
    quadratic: quadratic,
    rosenbrock: rosenbrock,
    rotatedQuadratic: rotatedQuadratic,
    stableStep: stableStep,
    norm: norm,
    dot: dot
  };
}));
