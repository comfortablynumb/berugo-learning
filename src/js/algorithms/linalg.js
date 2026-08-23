/**
 * Dense matrices over typed arrays, LU with and without pivoting, Cholesky,
 * and the norms every error claim in this milestone is measured with.
 *
 * Two decisions here shape the whole milestone.
 *
 * **Pivoting is available and also switchable off.** `lu` takes a `pivot`
 * flag, and the unpivoted path is not a bug to be fixed - it is the fixture
 * that shows why the pivoted one exists. Pivoting is usually explained as
 * "swap rows when the pivot is zero", which is wrong in the way that matters:
 * the pivot is almost never exactly zero, it is merely small, and dividing by
 * a small number multiplies every subsequent rounding error by its reciprocal.
 * The `growth` factor this module reports is exactly that amplification, and
 * on the classic fixture it is the difference between a correct answer and a
 * confident wrong one.
 *
 * **Residual and error are separate fields and never conflated.** The residual
 * ‖Ax − b‖ says the answer satisfies the equations as written; the error
 * ‖x − x*‖ says it is the answer. On an ill-conditioned system the first is
 * tiny while the second is enormous, and reporting the residual as evidence of
 * correctness is the most common mistake in numerical code. Everything here
 * returns both.
 *
 * Storage is row-major in a `Float64Array` because that is what a cache wants
 * and what every other library agrees on; the `at` and `put` helpers exist so
 * the index arithmetic appears once.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Linalg = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function create(rows, cols) {
    return { rows: rows, cols: cols, data: new Float64Array(rows * cols) };
  }

  function from2d(values) {
    const rows = values.length;
    const cols = values[0].length;
    const matrix = create(rows, cols);
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) matrix.data[r * cols + c] = values[r][c];
    }
    return matrix;
  }

  function to2d(matrix) {
    const out = [];
    for (let r = 0; r < matrix.rows; r += 1) {
      const row = [];
      for (let c = 0; c < matrix.cols; c += 1) row.push(matrix.data[r * matrix.cols + c]);
      out.push(row);
    }
    return out;
  }

  function at(matrix, r, c) { return matrix.data[r * matrix.cols + c]; }
  function put(matrix, r, c, value) { matrix.data[r * matrix.cols + c] = value; }

  function clone(matrix) {
    return { rows: matrix.rows, cols: matrix.cols, data: matrix.data.slice() };
  }

  function identity(n) {
    const matrix = create(n, n);
    for (let i = 0; i < n; i += 1) matrix.data[i * n + i] = 1;
    return matrix;
  }

  function transpose(matrix) {
    const out = create(matrix.cols, matrix.rows);
    for (let r = 0; r < matrix.rows; r += 1) {
      for (let c = 0; c < matrix.cols; c += 1) put(out, c, r, at(matrix, r, c));
    }
    return out;
  }

  function multiply(a, b) {
    const out = create(a.rows, b.cols);
    for (let r = 0; r < a.rows; r += 1) {
      for (let k = 0; k < a.cols; k += 1) {
        const left = at(a, r, k);
        if (left === 0) continue;
        for (let c = 0; c < b.cols; c += 1) {
          out.data[r * b.cols + c] += left * at(b, k, c);
        }
      }
    }
    return out;
  }

  function apply(matrix, vector) {
    const out = new Float64Array(matrix.rows);
    for (let r = 0; r < matrix.rows; r += 1) {
      let sum = 0;
      for (let c = 0; c < matrix.cols; c += 1) sum += at(matrix, r, c) * vector[c];
      out[r] = sum;
    }
    return out;
  }

  /* ------------------------------------------------------------------ norms */

  function norm2(vector) {
    let sum = 0;
    for (let i = 0; i < vector.length; i += 1) sum += vector[i] * vector[i];
    return Math.sqrt(sum);
  }

  function normInf(vector) {
    let worst = 0;
    for (let i = 0; i < vector.length; i += 1) worst = Math.max(worst, Math.abs(vector[i]));
    return worst;
  }

  function subtract(a, b) {
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i += 1) out[i] = a[i] - b[i];
    return out;
  }

  /** The two numbers that must never be conflated. */
  function scoreSolution(matrix, x, b, truth) {
    const residual = subtract(apply(matrix, x), b);
    const scale = norm2(b) || 1;
    const answer = {
      residual: norm2(residual),
      relativeResidual: norm2(residual) / scale
    };
    if (!truth) return answer;
    answer.error = norm2(subtract(x, truth));
    answer.relativeError = norm2(subtract(x, truth)) / (norm2(truth) || 1);
    return answer;
  }

  /* -------------------------------------------------------------------- LU */

  /**
   * LU with optional partial pivoting.
   *
   * `growth` is the ratio of the largest entry seen during elimination to the
   * largest entry of the original matrix, and it is the number the whole
   * pivoting argument is about: every rounding error introduced during the
   * factorisation is amplified by roughly that factor. With partial pivoting
   * it is bounded in practice by a small constant; without it, it is
   * unbounded, and the fixture in `numeric-lab` drives it into the millions.
   */
  function lu(matrix, options) {
    const settings = options || {};
    const pivot = settings.pivot !== false;
    const n = matrix.rows;
    const work = clone(matrix);
    const perm = [];
    for (let i = 0; i < n; i += 1) perm.push(i);

    const state = { swaps: 0, growth: 1, singular: false, largest: largestEntry(matrix) };
    for (let k = 0; k < n; k += 1) eliminateColumn(work, k, { pivot: pivot, perm: perm, state: state });
    return { lu: work, perm: perm, swaps: state.swaps, growth: state.growth,
      singular: state.singular, pivoted: pivot };
  }

  function largestEntry(matrix) {
    let worst = 0;
    for (let i = 0; i < matrix.data.length; i += 1) {
      worst = Math.max(worst, Math.abs(matrix.data[i]));
    }
    return worst || 1;
  }

  function eliminateColumn(work, k, context) {
    const n = work.rows;
    if (context.pivot) choosePivot(work, k, context);

    const pivotValue = at(work, k, k);
    if (pivotValue === 0) { context.state.singular = true; return; }

    for (let r = k + 1; r < n; r += 1) {
      const factor = at(work, r, k) / pivotValue;
      put(work, r, k, factor);
      if (factor === 0) continue;
      for (let c = k + 1; c < n; c += 1) {
        put(work, r, c, at(work, r, c) - factor * at(work, k, c));
      }
    }
    const seen = largestEntry(work);
    context.state.growth = Math.max(context.state.growth, seen / context.state.largest);
  }

  /** The largest magnitude in the column, which is what bounds the multipliers
   *  by one and therefore bounds the growth. */
  function choosePivot(work, k, context) {
    const n = work.rows;
    let best = k;
    for (let r = k + 1; r < n; r += 1) {
      if (Math.abs(at(work, r, k)) > Math.abs(at(work, best, k))) best = r;
    }
    if (best === k) return;
    swapRows(work, k, best);
    const tmp = context.perm[k];
    context.perm[k] = context.perm[best];
    context.perm[best] = tmp;
    context.state.swaps += 1;
  }

  function swapRows(matrix, a, b) {
    for (let c = 0; c < matrix.cols; c += 1) {
      const tmp = at(matrix, a, c);
      put(matrix, a, c, at(matrix, b, c));
      put(matrix, b, c, tmp);
    }
  }

  function luSolve(factorisation, b) {
    const n = factorisation.lu.rows;
    const y = new Float64Array(n);

    for (let r = 0; r < n; r += 1) {
      let sum = b[factorisation.perm[r]];
      for (let c = 0; c < r; c += 1) sum -= at(factorisation.lu, r, c) * y[c];
      y[r] = sum;
    }
    const x = new Float64Array(n);
    for (let r = n - 1; r >= 0; r -= 1) {
      let sum = y[r];
      for (let c = r + 1; c < n; c += 1) sum -= at(factorisation.lu, r, c) * x[c];
      x[r] = sum / at(factorisation.lu, r, r);
    }
    return x;
  }

  function solve(matrix, b, options) {
    return luSolve(lu(matrix, options), b);
  }

  function determinant(matrix) {
    const factorisation = lu(matrix);
    let value = factorisation.swaps % 2 === 0 ? 1 : -1;
    for (let i = 0; i < matrix.rows; i += 1) value *= at(factorisation.lu, i, i);
    return value;
  }

  /**
   * The explicit inverse, provided so the section can show what it costs.
   * Forming it is n solves and then every use is a matrix-vector product with
   * a matrix that has already accumulated error - which is why "never invert a
   * matrix" is a numerical rule rather than a stylistic one.
   */
  function inverse(matrix) {
    const n = matrix.rows;
    const factorisation = lu(matrix);
    const out = create(n, n);
    const unit = new Float64Array(n);

    for (let c = 0; c < n; c += 1) {
      unit.fill(0);
      unit[c] = 1;
      const column = luSolve(factorisation, unit);
      for (let r = 0; r < n; r += 1) put(out, r, c, column[r]);
    }
    return out;
  }

  /* -------------------------------------------------------------- Cholesky */

  /**
   * Cholesky for symmetric positive-definite matrices: half the work of LU and
   * no pivoting needed at all, because the diagonal dominance the definiteness
   * guarantees is what pivoting would otherwise have to find. Returning null
   * rather than throwing is deliberate - "this matrix is not positive
   * definite" is a useful answer, and it is how a caller tests definiteness.
   */
  function cholesky(matrix) {
    const n = matrix.rows;
    const out = create(n, n);

    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c <= r; c += 1) {
        let sum = at(matrix, r, c);
        for (let k = 0; k < c; k += 1) sum -= at(out, r, k) * at(out, c, k);
        if (r !== c) { put(out, r, c, sum / at(out, c, c)); continue; }
        if (sum <= 0) return null;
        put(out, r, r, Math.sqrt(sum));
      }
    }
    return out;
  }

  function choleskySolve(lower, b) {
    const n = lower.rows;
    const y = new Float64Array(n);

    for (let r = 0; r < n; r += 1) {
      let sum = b[r];
      for (let c = 0; c < r; c += 1) sum -= at(lower, r, c) * y[c];
      y[r] = sum / at(lower, r, r);
    }
    const x = new Float64Array(n);
    for (let r = n - 1; r >= 0; r -= 1) {
      let sum = y[r];
      for (let c = r + 1; c < n; c += 1) sum -= at(lower, c, r) * x[c];
      x[r] = sum / at(lower, r, r);
    }
    return x;
  }

  /* ------------------------------------------------------------- fixtures */

  /**
   * A Hilbert matrix: the standard ill-conditioned fixture, and ill-conditioned
   * for a reason worth knowing - its columns are samples of 1, x, x², … which
   * become nearly parallel as the degree rises. Its condition number grows
   * faster than exponentially in n.
   */
  function hilbert(n) {
    const matrix = create(n, n);
    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) put(matrix, r, c, 1 / (r + c + 1));
    }
    return matrix;
  }

  /**
   * The matrix elimination without pivoting destroys: a tiny leading entry
   * that is not zero, so a "swap when the pivot is zero" rule never fires.
   */
  function tinyPivot(epsilon) {
    return from2d([[epsilon, 1], [1, 1]]);
  }

  /**
   * Wilkinson's growth matrix: unit lower triangle, ones on the diagonal, and
   * a final column of ones. Partial pivoting never swaps anything on it and
   * the growth factor still reaches 2^(n−1), which is the standard
   * demonstration that the pivoting bound is a worst case rather than a
   * guarantee of small growth.
   */
  function wilkinson(n) {
    const matrix = create(n, n);
    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) {
        if (c === n - 1 || r === c) put(matrix, r, c, 1);
        else if (r > c) put(matrix, r, c, -1);
      }
    }
    return matrix;
  }

  /** A Vandermonde matrix, which is what polynomial fitting actually solves. */
  function vandermonde(nodes, degree) {
    const matrix = create(nodes.length, degree + 1);
    for (let r = 0; r < nodes.length; r += 1) {
      let power = 1;
      for (let c = 0; c <= degree; c += 1) { put(matrix, r, c, power); power *= nodes[r]; }
    }
    return matrix;
  }

  /** A symmetric positive-definite matrix with a chosen spectrum, so a demo
   *  can set the condition number rather than discover it. */
  function spdWithCondition(n, condition, rng) {
    const q = randomOrthogonal(n, rng);
    const scaled = create(n, n);
    for (let i = 0; i < n; i += 1) {
      const value = Math.pow(condition, -i / Math.max(1, n - 1));
      for (let r = 0; r < n; r += 1) put(scaled, r, i, at(q, r, i) * value);
    }
    return multiply(scaled, transpose(q));
  }

  /** Gram-Schmidt on random columns, run in the modified form so the result is
   *  orthogonal to machine precision rather than merely nearly so. */
  function randomOrthogonal(n, rng) {
    const matrix = create(n, n);
    for (let i = 0; i < matrix.data.length; i += 1) matrix.data[i] = rng.gaussian(0, 1);

    for (let c = 0; c < n; c += 1) {
      for (let previous = 0; previous < c; previous += 1) {
        let dot = 0;
        for (let r = 0; r < n; r += 1) dot += at(matrix, r, c) * at(matrix, r, previous);
        for (let r = 0; r < n; r += 1) {
          put(matrix, r, c, at(matrix, r, c) - dot * at(matrix, r, previous));
        }
      }
      let length = 0;
      for (let r = 0; r < n; r += 1) length += at(matrix, r, c) * at(matrix, r, c);
      length = Math.sqrt(length) || 1;
      for (let r = 0; r < n; r += 1) put(matrix, r, c, at(matrix, r, c) / length);
    }
    return matrix;
  }

  return {
    create: create,
    from2d: from2d,
    to2d: to2d,
    at: at,
    put: put,
    clone: clone,
    identity: identity,
    transpose: transpose,
    multiply: multiply,
    apply: apply,
    norm2: norm2,
    normInf: normInf,
    subtract: subtract,
    scoreSolution: scoreSolution,
    lu: lu,
    luSolve: luSolve,
    solve: solve,
    determinant: determinant,
    inverse: inverse,
    cholesky: cholesky,
    choleskySolve: choleskySolve,
    hilbert: hilbert,
    tinyPivot: tinyPivot,
    wilkinson: wilkinson,
    vandermonde: vandermonde,
    spdWithCondition: spdWithCondition,
    randomOrthogonal: randomOrthogonal,
    largestEntry: largestEntry
  };
}));
