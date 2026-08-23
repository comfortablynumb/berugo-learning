/**
 * Iterative linear solvers, and the conditioning that decides whether they
 * are worth reaching for.
 *
 * A direct factorisation costs O(n³) once and answers exactly (up to
 * rounding). An iterative method costs a matrix-vector product per step and
 * answers approximately, which is the wrong trade at n = 100 and the only
 * option at n = 10⁷ - a sparse matrix with a hundred million non-zeros has an
 * LU factorisation that does not fit in memory, because elimination fills in
 * the zeros. Everything here is therefore about *how many steps*, and the
 * answer is governed by the condition number rather than by the size.
 *
 * The stationary methods (Jacobi, Gauss-Seidel, SOR) converge when the
 * iteration matrix has spectral radius below one, and `spectralRadius`
 * estimates it by power iteration so the demo can show a divergent case
 * rather than assert that one exists. Conjugate gradient is the different
 * animal: on a symmetric positive-definite system it converges in at most n
 * steps exactly, and in far fewer when the eigenvalues are clustered, with an
 * error bound governed by the SQUARE ROOT of the condition number. That square
 * root is the whole reason preconditioning is worth doing.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.IterativeSolvers = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const L = scope && scope.Linalg ? scope.Linalg : require('./linalg.js');

  const DEFAULT_LIMIT = 500;
  const DEFAULT_TOLERANCE = 1e-10;

  function settingsFor(options) {
    const given = options || {};
    return {
      limit: given.limit || DEFAULT_LIMIT,
      tolerance: given.tolerance === undefined ? DEFAULT_TOLERANCE : given.tolerance,
      omega: given.omega === undefined ? 1.5 : given.omega,
      truth: given.truth
    };
  }

  function trace(matrix, b, x, settings, truth) {
    const residual = L.norm2(L.subtract(L.apply(matrix, x), b));
    const point = { residual: residual, relativeResidual: residual / (L.norm2(b) || 1) };
    if (truth) point.error = L.norm2(L.subtract(x, truth));
    return point;
  }

  /* ------------------------------------------------------- stationary */

  /**
   * Jacobi: solve each equation for its own variable using the PREVIOUS
   * sweep's values for everything else. Every update is independent, which is
   * why it parallelises perfectly and why it converges slowest - each sweep
   * propagates information exactly one equation.
   */
  function jacobi(matrix, b, options) {
    return stationary(matrix, b, settingsFor(options), 'jacobi');
  }

  /**
   * Gauss-Seidel: the same sweep using the CURRENT values as soon as they are
   * available. Information crosses the whole system in one sweep, so it
   * typically halves the iteration count - and it is inherently sequential for
   * exactly the same reason.
   */
  function gaussSeidel(matrix, b, options) {
    return stationary(matrix, b, settingsFor(options), 'gauss-seidel');
  }

  /**
   * Successive over-relaxation: take the Gauss-Seidel step and then go past
   * it by a factor omega. Below 1 it is under-relaxation and slower; above 2
   * it always diverges; the optimal value depends on the spectrum and is
   * usually found by sweeping, which is what the demo does.
   */
  function sor(matrix, b, options) {
    return stationary(matrix, b, settingsFor(options), 'sor');
  }

  function stationary(matrix, b, settings, kind) {
    const n = matrix.rows;
    const x = new Float64Array(n);
    const history = [];
    let converged = false;
    let diverged = false;

    for (let step = 0; step < settings.limit; step += 1) {
      sweep(matrix, b, x, { kind: kind, omega: settings.omega });
      const point = trace(matrix, b, x, settings, settings.truth);
      history.push(point);

      if (!Number.isFinite(point.residual) || point.residual > 1e12) { diverged = true; break; }
      if (point.relativeResidual < settings.tolerance) { converged = true; break; }
    }
    return { method: kind, x: x, iterations: history.length, history: history,
      converged: converged, diverged: diverged,
      residual: history.length > 0 ? history[history.length - 1].residual : Infinity };
  }

  function sweep(matrix, b, x, config) {
    const n = matrix.rows;
    const previous = config.kind === 'jacobi' ? x.slice() : x;

    for (let r = 0; r < n; r += 1) {
      let sum = b[r];
      for (let c = 0; c < n; c += 1) {
        if (c === r) continue;
        sum -= L.at(matrix, r, c) * previous[c];
      }
      const candidate = sum / L.at(matrix, r, r);
      x[r] = config.kind === 'sor' ? x[r] + config.omega * (candidate - x[r]) : candidate;
    }
  }

  /**
   * The spectral radius of the iteration matrix, estimated by power iteration
   * on the update operator rather than formed explicitly. Below one the method
   * converges and the value is the per-sweep error contraction; at or above
   * one it does not, whatever the residual looks like for the first few steps.
   */
  function spectralRadius(matrix, kind, options) {
    const settings = settingsFor(options);
    const n = matrix.rows;
    const zero = new Float64Array(n);
    let v = new Float64Array(n);
    for (let i = 0; i < n; i += 1) v[i] = 1 / Math.sqrt(n);
    let estimate = 0;

    for (let step = 0; step < (settings.limit > 200 ? 200 : settings.limit); step += 1) {
      const next = v.slice();
      sweep(matrix, zero, next, { kind: kind, omega: settings.omega });
      const length = L.norm2(next);
      if (length === 0) return 0;
      estimate = length / L.norm2(v);
      for (let i = 0; i < n; i += 1) next[i] /= length;
      v = next;
    }
    return estimate;
  }

  /* -------------------------------------------------- conjugate gradient */

  /**
   * Conjugate gradient for symmetric positive-definite systems. Each step
   * minimises the error in the A-norm over a Krylov subspace one dimension
   * larger, so in exact arithmetic it terminates in at most n steps - and in
   * practice it is used long before that, because the error bound falls like
   * ((√κ − 1)/(√κ + 1))^k. The square root is the point: a system with a
   * condition number of 10⁴ needs about a hundred steps, not ten thousand.
   */
  function conjugateGradient(matrix, b, options) {
    const settings = settingsFor(options);
    const n = matrix.rows;
    const x = new Float64Array(n);
    let r = L.subtract(b, L.apply(matrix, x));
    let p = r.slice();
    let rr = dot(r, r);
    const history = [];
    let converged = false;

    for (let step = 0; step < Math.min(settings.limit, 4 * n + 50); step += 1) {
      const ap = L.apply(matrix, p);
      const pap = dot(p, ap);
      if (pap <= 0) break;

      const alpha = rr / pap;
      for (let i = 0; i < n; i += 1) { x[i] += alpha * p[i]; r[i] -= alpha * ap[i]; }
      const next = dot(r, r);
      history.push(trace(matrix, b, x, settings, settings.truth));

      if (Math.sqrt(next) / (L.norm2(b) || 1) < settings.tolerance) { converged = true; break; }
      const beta = next / rr;
      for (let i = 0; i < n; i += 1) p[i] = r[i] + beta * p[i];
      rr = next;
    }
    return { method: 'conjugate gradient', x: x, iterations: history.length,
      history: history, converged: converged, diverged: false,
      residual: history.length > 0 ? history[history.length - 1].residual : Infinity };
  }

  function dot(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
    return sum;
  }

  /**
   * The textbook error bound for conjugate gradient, so the measured residual
   * curve has something to be read against rather than admired alone.
   */
  function cgBound(condition, steps) {
    const root = Math.sqrt(condition);
    const rate = (root - 1) / (root + 1);
    const out = [];
    for (let k = 1; k <= steps; k += 1) out.push({ k: k, bound: 2 * Math.pow(rate, k) });
    return out;
  }

  /**
   * Jacobi preconditioning: scale each row and column by the reciprocal square
   * root of its diagonal. It is the cheapest preconditioner there is and it
   * does nothing at all when the diagonal is already uniform - which is the
   * honest caveat, and the reason a demo has to show a matrix where the
   * diagonal varies.
   */
  function jacobiPrecondition(matrix, b) {
    const n = matrix.rows;
    const scale = new Float64Array(n);
    for (let i = 0; i < n; i += 1) {
      const diagonal = L.at(matrix, i, i);
      scale[i] = diagonal > 0 ? 1 / Math.sqrt(diagonal) : 1;
    }
    const out = L.create(n, n);
    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) L.put(out, r, c, L.at(matrix, r, c) * scale[r] * scale[c]);
    }
    const rhs = new Float64Array(n);
    for (let i = 0; i < n; i += 1) rhs[i] = b[i] * scale[i];
    return { matrix: out, b: rhs, scale: scale };
  }

  /** Undo the preconditioning scaling to recover the original unknowns. */
  function unscale(x, scale) {
    const out = new Float64Array(x.length);
    for (let i = 0; i < x.length; i += 1) out[i] = x[i] * scale[i];
    return out;
  }

  /* ------------------------------------------------------------ fixtures */

  /**
   * The 1-D Poisson matrix: tridiagonal, −1 2 −1, symmetric positive definite,
   * and the canonical sparse system. Its condition number grows like n², which
   * is why it is also the canonical demonstration that a bigger grid is a
   * harder solve rather than merely a longer one.
   */
  function poisson1d(n) {
    const matrix = L.create(n, n);
    for (let i = 0; i < n; i += 1) {
      L.put(matrix, i, i, 2);
      if (i > 0) L.put(matrix, i, i - 1, -1);
      if (i < n - 1) L.put(matrix, i, i + 1, -1);
    }
    return matrix;
  }

  /**
   * The Poisson matrix with each row and column scaled by a widely varying
   * factor. It exists because Jacobi preconditioning does exactly NOTHING on
   * the plain Poisson matrix - every diagonal entry is 2, so scaling by the
   * reciprocal square root of the diagonal is scaling by a constant, and a
   * demo run on it would show a preconditioner that never helps. Here the
   * diagonal spans orders of magnitude, the condition number is wrecked by
   * the scaling alone, and undoing that scaling is precisely what the
   * preconditioner does.
   */
  function scaledPoisson(n, spread) {
    const base = poisson1d(n);
    const factor = new Float64Array(n);
    for (let i = 0; i < n; i += 1) {
      factor[i] = Math.pow(spread === undefined ? 1e3 : spread, i / Math.max(1, n - 1));
    }
    const out = L.create(n, n);
    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) {
        L.put(out, r, c, L.at(base, r, c) * factor[r] * factor[c]);
      }
    }
    return out;
  }

  /** A strictly diagonally dominant matrix, where every stationary method is
   *  guaranteed to converge - the case the textbook condition covers. */
  function diagonallyDominant(n, rng) {
    const matrix = L.create(n, n);
    for (let r = 0; r < n; r += 1) {
      let offDiagonal = 0;
      for (let c = 0; c < n; c += 1) {
        if (c === r) continue;
        const value = rng.gaussian(0, 1);
        L.put(matrix, r, c, value);
        offDiagonal += Math.abs(value);
      }
      L.put(matrix, r, r, offDiagonal + 1 + Math.abs(rng.gaussian(0, 1)));
    }
    return matrix;
  }

  /** The same matrix with the dominance removed, so Jacobi diverges on it and
   *  the demo can show the spectral radius crossing one. */
  function weaklyDiagonal(n, rng, factor) {
    const matrix = diagonallyDominant(n, rng);
    for (let i = 0; i < n; i += 1) {
      L.put(matrix, i, i, L.at(matrix, i, i) * (factor === undefined ? 0.2 : factor));
    }
    return matrix;
  }

  return {
    jacobi: jacobi,
    gaussSeidel: gaussSeidel,
    sor: sor,
    spectralRadius: spectralRadius,
    conjugateGradient: conjugateGradient,
    cgBound: cgBound,
    jacobiPrecondition: jacobiPrecondition,
    unscale: unscale,
    poisson1d: poisson1d,
    scaledPoisson: scaledPoisson,
    diagonallyDominant: diagonallyDominant,
    weaklyDiagonal: weaklyDiagonal,
    dot: dot
  };
}));
