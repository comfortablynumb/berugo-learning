/**
 * The two decompositions that make least squares and rank honest: QR by
 * Householder reflections, and the SVD by one-sided Jacobi.
 *
 * Split from `linalg.js` for size rather than for design - the matrix type,
 * LU and Cholesky live there, and this file is what sits on top of them.
 *
 * Three implementations of QR are here on purpose, and only one of them is
 * for using. Classical Gram-Schmidt is the version every textbook derives and
 * it loses orthogonality catastrophically on nearly parallel columns - which
 * is exactly the shape a polynomial fit produces. Modified Gram-Schmidt is one
 * line different and far better. Householder is what a library ships, and it
 * is orthogonal to machine precision because it never subtracts nearly equal
 * quantities: it reflects rather than projects-and-cancels. `orthogonalityLoss`
 * measures ‖QᵀQ − I‖ for each, which turns "unstable" into a number that grows
 * with the condition number in front of the reader.
 *
 * The SVD is one-sided Jacobi: repeatedly rotate pairs of columns until they
 * are orthogonal. It is not the fastest algorithm and it is the most robust
 * simple one, it needs no eigenvalue machinery, and its accuracy on small
 * singular values is better than the textbook "eigenvalues of AᵀA" route -
 * which squares the condition number for the same reason the normal equations
 * do.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.QrSvd = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const L = scope && scope.Linalg ? scope.Linalg : require('./linalg.js');

  /* -------------------------------------------------------- Gram-Schmidt */

  /**
   * Classical Gram-Schmidt: project the column onto every previous one using
   * the ORIGINAL column each time. Mathematically identical to the modified
   * form and numerically far worse, because each projection is computed from a
   * vector that already carries the error of the previous ones.
   */
  function classicalGramSchmidt(matrix) {
    return gramSchmidt(matrix, false);
  }

  /** Modified Gram-Schmidt: subtract each projection as it is computed, so the
   *  next one is taken against what is left rather than against the original. */
  function modifiedGramSchmidt(matrix) {
    return gramSchmidt(matrix, true);
  }

  function gramSchmidt(matrix, modified) {
    const q = L.clone(matrix);
    const r = L.create(matrix.cols, matrix.cols);

    for (let c = 0; c < matrix.cols; c += 1) {
      for (let previous = 0; previous < c; previous += 1) {
        const source = modified ? q : matrix;
        const dot = columnDot(source === q ? q : matrix, c, q, previous);
        L.put(r, previous, c, dot);
        subtractScaledColumn(q, c, q, previous, dot);
      }
      const length = columnNorm(q, c);
      L.put(r, c, c, length);
      if (length === 0) continue;
      scaleColumn(q, c, 1 / length);
    }
    return { q: q, r: r };
  }

  function columnDot(a, ac, b, bc) {
    let sum = 0;
    for (let row = 0; row < a.rows; row += 1) sum += L.at(a, row, ac) * L.at(b, row, bc);
    return sum;
  }

  function columnNorm(matrix, c) {
    return Math.sqrt(columnDot(matrix, c, matrix, c));
  }

  function subtractScaledColumn(target, tc, source, sc, factor) {
    for (let row = 0; row < target.rows; row += 1) {
      L.put(target, row, tc, L.at(target, row, tc) - factor * L.at(source, row, sc));
    }
  }

  function scaleColumn(matrix, c, factor) {
    for (let row = 0; row < matrix.rows; row += 1) {
      L.put(matrix, row, c, L.at(matrix, row, c) * factor);
    }
  }

  /* ---------------------------------------------------------- Householder */

  /**
   * Householder QR. Each step builds a reflection that maps the remaining
   * column onto a multiple of the first basis vector, and applies it to
   * everything to the right. The sign of the shift is chosen to move AWAY
   * from the leading entry rather than towards it, because the other choice
   * subtracts two nearly equal numbers when the column is already almost
   * aligned - the one place this algorithm could cancel, avoided by a sign.
   */
  function householderQr(matrix) {
    const r = L.clone(matrix);
    const q = L.identity(matrix.rows);
    const steps = Math.min(matrix.rows - 1, matrix.cols);

    for (let k = 0; k < steps; k += 1) {
      const v = reflectorFor(r, k);
      if (!v) continue;
      applyReflector(r, v, k, k);
      applyReflector(q, v, k, 0);
    }
    return { q: L.transpose(q), r: r };
  }

  function reflectorFor(matrix, k) {
    const v = new Float64Array(matrix.rows);
    let norm = 0;
    for (let row = k; row < matrix.rows; row += 1) {
      v[row] = L.at(matrix, row, k);
      norm += v[row] * v[row];
    }
    norm = Math.sqrt(norm);
    if (norm === 0) return null;

    /* Away from the leading entry: the other sign cancels. */
    const alpha = v[k] >= 0 ? -norm : norm;
    v[k] -= alpha;

    let length = 0;
    for (let row = k; row < matrix.rows; row += 1) length += v[row] * v[row];
    if (length === 0) return null;
    return { v: v, beta: 2 / length, from: k };
  }

  function applyReflector(matrix, reflector, fromRow, fromCol) {
    for (let c = fromCol; c < matrix.cols; c += 1) {
      let dot = 0;
      for (let row = fromRow; row < matrix.rows; row += 1) {
        dot += reflector.v[row] * L.at(matrix, row, c);
      }
      const factor = reflector.beta * dot;
      if (factor === 0) continue;
      for (let row = fromRow; row < matrix.rows; row += 1) {
        L.put(matrix, row, c, L.at(matrix, row, c) - factor * reflector.v[row]);
      }
    }
  }

  /** ‖QᵀQ − I‖ in the Frobenius norm: how far from orthogonal the factor
   *  actually came out, which is the number the three QR variants differ on. */
  function orthogonalityLoss(q) {
    const product = L.multiply(L.transpose(q), q);
    let sum = 0;
    for (let r = 0; r < product.rows; r += 1) {
      for (let c = 0; c < product.cols; c += 1) {
        const expected = r === c ? 1 : 0;
        const difference = L.at(product, r, c) - expected;
        sum += difference * difference;
      }
    }
    return Math.sqrt(sum);
  }

  /* ------------------------------------------------------- least squares */

  /** Least squares through QR: solve Rx = Qᵀb by back substitution, with no
   *  normal equations formed anywhere. */
  function qrSolve(matrix, b) {
    const decomposition = householderQr(matrix);
    const rhs = L.apply(L.transpose(decomposition.q), b);
    const n = matrix.cols;
    const x = new Float64Array(n);

    for (let row = n - 1; row >= 0; row -= 1) {
      let sum = rhs[row];
      for (let c = row + 1; c < n; c += 1) sum -= L.at(decomposition.r, row, c) * x[c];
      const pivot = L.at(decomposition.r, row, row);
      x[row] = pivot === 0 ? 0 : sum / pivot;
    }
    return x;
  }

  /**
   * The textbook route, kept because it is what people write: form AᵀA and
   * solve. It squares the condition number, which is not a subtlety - it is
   * the difference between losing half your digits and losing all of them.
   */
  function normalEquationsSolve(matrix, b) {
    const at = L.transpose(matrix);
    const gram = L.multiply(at, matrix);
    return L.solve(gram, L.apply(at, b));
  }

  /* ----------------------------------------------------------------- SVD */

  const JACOBI_SWEEPS = 60;

  /**
   * One-sided Jacobi. Rotate pairs of columns until every pair is orthogonal;
   * the column norms are then the singular values and the normalised columns
   * are the left singular vectors. Accumulating the same rotations on an
   * identity gives V.
   */
  function svd(matrix, options) {
    const settings = options || {};
    const tolerance = settings.tolerance || 1e-15;
    const u = L.clone(matrix);
    const v = L.identity(matrix.cols);
    let sweeps = 0;
    let rotations = 0;

    for (let sweep = 0; sweep < JACOBI_SWEEPS; sweep += 1) {
      const done = jacobiSweep(u, v, tolerance);
      sweeps += 1;
      rotations += done.rotations;
      if (done.rotations === 0) break;
    }
    return finishSvd(u, v, sweeps, rotations);
  }

  function jacobiSweep(u, v, tolerance) {
    let rotations = 0;
    for (let i = 0; i < u.cols - 1; i += 1) {
      for (let j = i + 1; j < u.cols; j += 1) {
        if (rotatePair(u, v, i, j, tolerance)) rotations += 1;
      }
    }
    return { rotations: rotations };
  }

  function rotatePair(u, v, i, j, tolerance) {
    const alpha = columnDot(u, i, u, i);
    const beta = columnDot(u, j, u, j);
    const gamma = columnDot(u, i, u, j);
    if (Math.abs(gamma) <= tolerance * Math.sqrt(alpha * beta) || gamma === 0) return false;

    const zeta = (beta - alpha) / (2 * gamma);
    const t = Math.sign(zeta || 1) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta));
    const cos = 1 / Math.sqrt(1 + t * t);
    const sin = cos * t;

    rotateColumns(u, i, j, cos, sin);
    rotateColumns(v, i, j, cos, sin);
    return true;
  }

  function rotateColumns(matrix, i, j, cos, sin) {
    for (let row = 0; row < matrix.rows; row += 1) {
      const left = L.at(matrix, row, i);
      const right = L.at(matrix, row, j);
      L.put(matrix, row, i, cos * left - sin * right);
      L.put(matrix, row, j, sin * left + cos * right);
    }
  }

  function finishSvd(u, v, sweeps, rotations) {
    const values = [];
    for (let c = 0; c < u.cols; c += 1) {
      const length = columnNorm(u, c);
      values.push({ value: length, index: c });
    }
    values.sort(function (a, b) { return b.value - a.value; });

    const orderedU = L.create(u.rows, u.cols);
    const orderedV = L.create(v.rows, v.cols);
    const singular = [];

    for (let c = 0; c < values.length; c += 1) {
      const source = values[c].index;
      const length = values[c].value;
      singular.push(length);
      for (let row = 0; row < u.rows; row += 1) {
        L.put(orderedU, row, c, length === 0 ? 0 : L.at(u, row, source) / length);
      }
      for (let row = 0; row < v.rows; row += 1) L.put(orderedV, row, c, L.at(v, row, source));
    }
    return { u: orderedU, s: singular, v: orderedV, sweeps: sweeps, rotations: rotations };
  }

  /** The condition number in the 2-norm: the ratio of the extreme singular
   *  values, and the factor by which a relative input error is magnified. */
  function conditionNumber(matrix) {
    const decomposition = svd(matrix);
    const largest = decomposition.s[0];
    const smallest = decomposition.s[decomposition.s.length - 1];
    if (smallest === 0) return Infinity;
    return largest / smallest;
  }

  /** Numerical rank: singular values above a tolerance scaled by the largest,
   *  which is the only defensible definition once rounding is involved. */
  function numericalRank(matrix, tolerance) {
    const decomposition = svd(matrix);
    const cutoff = (tolerance || 1e-12) * decomposition.s[0];
    let rank = 0;
    decomposition.s.forEach(function (value) { if (value > cutoff) rank += 1; });
    return { rank: rank, singular: decomposition.s, cutoff: cutoff };
  }

  /** The best rank-k approximation in both the 2-norm and the Frobenius norm,
   *  which is the Eckart-Young theorem and the reason truncation is principled
   *  rather than a heuristic. */
  function lowRank(matrix, k) {
    const decomposition = svd(matrix);
    const out = L.create(matrix.rows, matrix.cols);

    for (let t = 0; t < Math.min(k, decomposition.s.length); t += 1) {
      for (let r = 0; r < matrix.rows; r += 1) {
        for (let c = 0; c < matrix.cols; c += 1) {
          L.put(out, r, c, L.at(out, r, c) +
            decomposition.s[t] * L.at(decomposition.u, r, t) * L.at(decomposition.v, c, t));
        }
      }
    }
    const dropped = decomposition.s.slice(Math.min(k, decomposition.s.length));
    return { matrix: out, singular: decomposition.s,
      errorBound: dropped.length > 0 ? dropped[0] : 0 };
  }

  /** The pseudo-inverse, with small singular values discarded rather than
   *  inverted - inverting a singular value near zero is how a least-squares
   *  solution acquires an enormous norm and no meaning. */
  function pseudoInverse(matrix, tolerance) {
    const decomposition = svd(matrix);
    const cutoff = (tolerance || 1e-12) * decomposition.s[0];
    const out = L.create(matrix.cols, matrix.rows);

    for (let t = 0; t < decomposition.s.length; t += 1) {
      if (decomposition.s[t] <= cutoff) continue;
      const inverseValue = 1 / decomposition.s[t];
      for (let r = 0; r < matrix.cols; r += 1) {
        for (let c = 0; c < matrix.rows; c += 1) {
          L.put(out, r, c, L.at(out, r, c) +
            inverseValue * L.at(decomposition.v, r, t) * L.at(decomposition.u, c, t));
        }
      }
    }
    return out;
  }

  /** Ridge regression: add a multiple of the identity before solving, which
   *  shifts every singular value away from zero and trades bias for a bounded
   *  solution norm. */
  function ridgeSolve(matrix, b, lambda) {
    const rows = matrix.rows + matrix.cols;
    const augmented = L.create(rows, matrix.cols);
    const rhs = new Float64Array(rows);

    for (let r = 0; r < matrix.rows; r += 1) {
      rhs[r] = b[r];
      for (let c = 0; c < matrix.cols; c += 1) L.put(augmented, r, c, L.at(matrix, r, c));
    }
    const root = Math.sqrt(lambda);
    for (let c = 0; c < matrix.cols; c += 1) L.put(augmented, matrix.rows + c, c, root);
    return qrSolve(augmented, rhs);
  }

  return {
    classicalGramSchmidt: classicalGramSchmidt,
    modifiedGramSchmidt: modifiedGramSchmidt,
    householderQr: householderQr,
    orthogonalityLoss: orthogonalityLoss,
    qrSolve: qrSolve,
    normalEquationsSolve: normalEquationsSolve,
    svd: svd,
    conditionNumber: conditionNumber,
    numericalRank: numericalRank,
    lowRank: lowRank,
    pseudoInverse: pseudoInverse,
    ridgeSolve: ridgeSolve,
    columnDot: columnDot,
    columnNorm: columnNorm
  };
}));
