/**
 * Eigenvalues by iteration, never by the characteristic polynomial.
 *
 * The polynomial route is the one every algebra course teaches and no
 * numerical library uses, for a reason worth stating precisely: the roots of a
 * polynomial are wildly ill-conditioned in its coefficients. Wilkinson's
 * example is the classic - a degree-20 polynomial with roots at 1 … 20, where
 * perturbing one coefficient in the tenth decimal place moves a root by more
 * than half its value. Forming the characteristic polynomial therefore
 * destroys accuracy before any root-finding starts, and `polynomialPeril`
 * measures exactly that so the claim is a number rather than a warning.
 *
 * What is used instead is iteration. Power iteration finds the dominant
 * eigenvector by repeated multiplication, and its convergence rate is the
 * eigenvalue GAP |λ₂/λ₁| - which is why "PageRank converges slowly" is a
 * statement about the graph rather than about the implementation. Shifted
 * inverse iteration turns that around: shift by a target, invert, and the
 * eigenvalue nearest the target becomes dominant, so any eigenvalue can be
 * reached at the same rate. The QR algorithm is the general answer, and it is
 * power iteration on a whole basis at once.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Eigen = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const L = scope && scope.Linalg ? scope.Linalg : require('./linalg.js');
  const QR = scope && scope.QrSvd ? scope.QrSvd : require('./qr-svd.js');

  function normalise(vector) {
    const length = L.norm2(vector);
    if (length === 0) return vector;
    const out = new Float64Array(vector.length);
    for (let i = 0; i < vector.length; i += 1) out[i] = vector[i] / length;
    return out;
  }

  function dot(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
    return sum;
  }

  /** ‖Av − λv‖, the only honest way to score an eigenpair: it needs no
   *  reference answer and it is exactly what "eigenpair" means. */
  function residualOf(matrix, vector, value) {
    const applied = L.apply(matrix, vector);
    const scaled = new Float64Array(vector.length);
    for (let i = 0; i < vector.length; i += 1) scaled[i] = value * vector[i];
    return L.norm2(L.subtract(applied, scaled));
  }

  /* ------------------------------------------------------ power iteration */

  /**
   * Multiply and normalise. Every component of the starting vector along a
   * non-dominant eigenvector shrinks by |λᵢ/λ₁| each step, so after k steps
   * the second-largest is the one that matters and the error falls like
   * (|λ₂/λ₁|)^k. A gap near 1 means near-stagnation; a gap of 0.5 means one
   * bit per iteration.
   */
  function powerIteration(matrix, options) {
    const settings = options || {};
    const limit = settings.limit || 500;
    const tolerance = settings.tolerance || 1e-12;
    const n = matrix.rows;

    let v = settings.start ? normalise(settings.start) : startVector(n, settings.seedValue);
    const trail = [];
    let value = 0;
    let converged = false;

    for (let step = 0; step < limit; step += 1) {
      const next = L.apply(matrix, v);
      const length = L.norm2(next);
      if (length === 0) break;

      const candidate = dot(v, next);
      const normalised = normalise(next);
      const movement = L.norm2(L.subtract(normalised, v));
      trail.push({ value: candidate, movement: movement,
        residual: residualOf(matrix, normalised, candidate) });
      v = normalised;
      value = candidate;
      if (movement < tolerance || Math.abs(candidate) < 1e-300) { converged = true; break; }
    }
    return { vector: v, value: value, iterations: trail.length, trail: trail,
      converged: converged, residual: residualOf(matrix, v, value) };
  }

  function startVector(n, seedValue) {
    const v = new Float64Array(n);
    for (let i = 0; i < n; i += 1) v[i] = Math.sin((i + 1) * (seedValue || 1.7) + 0.3);
    return normalise(v);
  }

  /**
   * Shifted inverse iteration: apply (A − σI)⁻¹ rather than A, so the
   * eigenvalue closest to σ becomes the dominant one. The factorisation is
   * computed once and reused, which is what makes this cheap - and the
   * near-singularity of (A − σI) when σ is a good guess is not a problem but
   * the mechanism: the solve is ill-conditioned in exactly the direction of
   * the eigenvector being sought.
   */
  function shiftedInverse(matrix, shift, options) {
    const settings = options || {};
    const limit = settings.limit || 200;
    const tolerance = settings.tolerance || 1e-12;
    const n = matrix.rows;

    const shifted = L.clone(matrix);
    for (let i = 0; i < n; i += 1) L.put(shifted, i, i, L.at(shifted, i, i) - shift);
    const factorisation = L.lu(shifted);

    let v = settings.start ? normalise(settings.start) : startVector(n, settings.seedValue);
    const trail = [];
    let value = shift;
    let converged = false;

    for (let step = 0; step < limit; step += 1) {
      const solved = L.luSolve(factorisation, v);
      if (!Number.isFinite(L.norm2(solved))) break;
      const normalised = normalise(solved);
      const rayleigh = dot(normalised, L.apply(matrix, normalised));
      const movement = Math.min(L.norm2(L.subtract(normalised, v)),
        L.norm2(L.subtract(negate(normalised), v)));

      trail.push({ value: rayleigh, movement: movement,
        residual: residualOf(matrix, normalised, rayleigh) });
      v = normalised;
      value = rayleigh;
      if (movement < tolerance) { converged = true; break; }
    }
    return { vector: v, value: value, iterations: trail.length, trail: trail,
      converged: converged, residual: residualOf(matrix, v, value), shift: shift };
  }

  function negate(vector) {
    const out = new Float64Array(vector.length);
    for (let i = 0; i < vector.length; i += 1) out[i] = -vector[i];
    return out;
  }

  /** The Rayleigh quotient: the best eigenvalue estimate for a given vector,
   *  and accurate to the SQUARE of the vector's error on a symmetric matrix,
   *  which is why it is used rather than any single component ratio. */
  function rayleighQuotient(matrix, vector) {
    const v = normalise(vector);
    return dot(v, L.apply(matrix, v));
  }

  /* ---------------------------------------------------------- QR algorithm */

  /**
   * The unshifted QR algorithm: factor, multiply the factors back in the other
   * order, repeat. The matrix converges to upper triangular with the
   * eigenvalues on the diagonal, at a rate governed by the ratios of
   * consecutive eigenvalues - so it is power iteration on every subspace at
   * once, and it inherits the same gap dependence.
   */
  function qrAlgorithm(matrix, options) {
    const settings = options || {};
    const limit = settings.limit || 500;
    const tolerance = settings.tolerance || 1e-12;
    let current = L.clone(matrix);
    const trail = [];
    let converged = false;

    for (let step = 0; step < limit; step += 1) {
      const decomposition = QR.householderQr(current);
      current = L.multiply(decomposition.r, decomposition.q);
      const below = subdiagonalNorm(current);
      trail.push({ subdiagonal: below, diagonal: diagonalOf(current) });
      if (below < tolerance) { converged = true; break; }
    }
    return { matrix: current, values: diagonalOf(current), iterations: trail.length,
      trail: trail, converged: converged };
  }

  function diagonalOf(matrix) {
    const out = [];
    for (let i = 0; i < matrix.rows; i += 1) out.push(L.at(matrix, i, i));
    return out;
  }

  /** How far from triangular the iterate still is - the quantity that has to
   *  reach zero for the diagonal to be the eigenvalues. */
  function subdiagonalNorm(matrix) {
    let sum = 0;
    for (let r = 1; r < matrix.rows; r += 1) {
      for (let c = 0; c < r; c += 1) sum += L.at(matrix, r, c) * L.at(matrix, r, c);
    }
    return Math.sqrt(sum);
  }

  /**
   * The eigenvalue gap that governs power iteration, computed from the true
   * spectrum so a demo can plot the predicted rate against the measured one.
   * On a symmetric matrix the SVD's singular values are the absolute
   * eigenvalues, which is enough for the ratio.
   */
  function spectrumOf(matrix) {
    const decomposition = QR.svd(matrix);
    const magnitudes = decomposition.s.slice();
    const gap = magnitudes.length > 1 && magnitudes[0] > 0
      ? magnitudes[1] / magnitudes[0] : 0;
    return { magnitudes: magnitudes, gap: gap };
  }

  /* ------------------------------------------------------------- fixtures */

  /**
   * A symmetric matrix with a chosen spectrum, so the demo sets the gap rather
   * than discovering it. Built as QΛQᵀ from a random orthogonal Q.
   */
  function symmetricWithSpectrum(values, rng) {
    const n = values.length;
    const q = L.randomOrthogonal(n, rng);
    const scaled = L.create(n, n);
    for (let c = 0; c < n; c += 1) {
      for (let r = 0; r < n; r += 1) L.put(scaled, r, c, L.at(q, r, c) * values[c]);
    }
    return L.multiply(scaled, L.transpose(q));
  }

  /**
   * Wilkinson's polynomial peril, measured. The characteristic polynomial of a
   * diagonal matrix with entries 1 … n has those entries as its roots exactly;
   * perturb one coefficient by a relative epsilon and the roots move. This
   * returns how far, which is the argument against the polynomial route.
   */
  function polynomialPeril(n, epsilon) {
    const coefficients = expandRoots(n);
    const index = Math.max(1, n - 1);
    const perturbed = coefficients.slice();
    perturbed[index] *= 1 + (epsilon === undefined ? 1e-10 : epsilon);

    const original = evaluatePolynomial(coefficients, n);
    const shifted = evaluatePolynomial(perturbed, n);
    const derivative = evaluateDerivative(coefficients, n);

    /* One step of Newton from the unperturbed root estimates how far the
       perturbed root moved, which is exact to first order and is the whole
       content of the conditioning statement. */
    return {
      n: n,
      epsilon: epsilon === undefined ? 1e-10 : epsilon,
      coefficient: coefficients[index],
      rootShift: derivative === 0 ? Infinity : Math.abs((shifted - original) / derivative),
      relativeShift: derivative === 0 ? Infinity
        : Math.abs((shifted - original) / derivative) / n
    };
  }

  /** The coefficients of (x − 1)(x − 2)…(x − n), lowest power first. */
  function expandRoots(n) {
    let coefficients = [1];
    for (let r = 1; r <= n; r += 1) {
      const next = new Array(coefficients.length + 1).fill(0);
      for (let i = 0; i < coefficients.length; i += 1) {
        next[i + 1] += coefficients[i];
        next[i] -= r * coefficients[i];
      }
      coefficients = next;
    }
    return coefficients;
  }

  function evaluatePolynomial(coefficients, x) {
    let value = 0;
    for (let i = coefficients.length - 1; i >= 0; i -= 1) value = value * x + coefficients[i];
    return value;
  }

  function evaluateDerivative(coefficients, x) {
    let value = 0;
    for (let i = coefficients.length - 1; i >= 1; i -= 1) value = value * x + i * coefficients[i];
    return value;
  }

  return {
    powerIteration: powerIteration,
    shiftedInverse: shiftedInverse,
    rayleighQuotient: rayleighQuotient,
    qrAlgorithm: qrAlgorithm,
    subdiagonalNorm: subdiagonalNorm,
    spectrumOf: spectrumOf,
    residualOf: residualOf,
    symmetricWithSpectrum: symmetricWithSpectrum,
    polynomialPeril: polynomialPeril,
    expandRoots: expandRoots,
    evaluatePolynomial: evaluatePolynomial,
    normalise: normalise
  };
}));
