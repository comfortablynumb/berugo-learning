/**
 * Strassen's matrix multiplication beside the triple loop, with the scalar
 * multiplications counted and the numerical cost measured rather than warned
 * about.
 *
 * The cubic algorithm does n³ scalar products. Strassen computes a 2×2 block
 * product from seven block products instead of eight, at the cost of eighteen
 * block additions, so T(n) = 7T(n/2) + O(n²) = n^log2(7) ≈ n^2.807. That is a
 * real asymptotic improvement and it is famous for two reasons beyond the
 * exponent: it proved the cubic algorithm is not optimal, and it is the
 * standard example of an algorithm whose asymptotics win long after its
 * constants and its numerics have stopped being attractive.
 *
 * The numerical caveat is not a footnote. Strassen is not backward stable in
 * the componentwise sense: the additions and subtractions of blocks cancel,
 * so the error bound involves the norms of the whole matrices rather than of
 * the entries that produced each result. `errorAgainstCubic` measures that on
 * the matrices the section actually multiplies, so the caveat is a number.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Strassen = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { scalarProducts: 0, scalarAdditions: 0, calls: 0, baseCases: 0, maxDepth: 0, allocations: 0 };
  }

  function zeros(n) {
    const out = [];
    for (let i = 0; i < n; i += 1) out.push(new Array(n).fill(0));
    return out;
  }

  function nextPowerOfTwo(n) {
    let size = 1;
    while (size < n) size *= 2;
    return size;
  }

  /** Strassen needs a power-of-two side; padding with zeros is the standard
   *  answer and it is also the cliff, so `padded` travels with the result. */
  function pad(matrix, size) {
    const out = zeros(size);
    for (let i = 0; i < matrix.length; i += 1) {
      for (let j = 0; j < matrix[i].length; j += 1) out[i][j] = matrix[i][j];
    }
    return out;
  }

  function addMatrix(a, b, sign, report) {
    const n = a.length;
    const out = zeros(n);
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        out[i][j] = a[i][j] + sign * b[i][j];
        report.scalarAdditions += 1;
      }
    }
    report.allocations += 1;
    return out;
  }

  function quadrant(matrix, rowOffset, columnOffset, size) {
    const out = zeros(size);
    for (let i = 0; i < size; i += 1) {
      for (let j = 0; j < size; j += 1) out[i][j] = matrix[rowOffset + i][columnOffset + j];
    }
    return out;
  }

  function join(topLeft, topRight, bottomLeft, bottomRight) {
    const half = topLeft.length;
    const out = zeros(half * 2);
    for (let i = 0; i < half; i += 1) {
      for (let j = 0; j < half; j += 1) {
        out[i][j] = topLeft[i][j];
        out[i][j + half] = topRight[i][j];
        out[i + half][j] = bottomLeft[i][j];
        out[i + half][j + half] = bottomRight[i][j];
      }
    }
    return out;
  }

  /** The triple loop, counted the same way so the comparison is measurement
   *  against measurement. */
  function cubic(a, b, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const n = a.length;
    const inner = b.length;
    const columns = b[0].length;
    const out = [];

    for (let i = 0; i < n; i += 1) {
      const row = new Array(columns).fill(0);
      for (let k = 0; k < inner; k += 1) {
        for (let j = 0; j < columns; j += 1) {
          row[j] += a[i][k] * b[k][j];
          report.scalarProducts += 1;
          report.scalarAdditions += 1;
        }
      }
      out.push(row);
    }
    report.allocations += 1;
    return { matrix: out, report: report };
  }

  function sevenProducts(left, right, multiply, report) {
    const half = left.a.length;
    const plus = function (x, y) { return addMatrix(x, y, 1, report); };
    const minus = function (x, y) { return addMatrix(x, y, -1, report); };

    return {
      half: half,
      m1: multiply(plus(left.a, left.d), plus(right.a, right.d)),
      m2: multiply(plus(left.c, left.d), right.a),
      m3: multiply(left.a, minus(right.b, right.d)),
      m4: multiply(left.d, minus(right.c, right.a)),
      m5: multiply(plus(left.a, left.b), right.d),
      m6: multiply(minus(left.c, left.a), plus(right.a, right.b)),
      m7: multiply(minus(left.b, left.d), plus(right.c, right.d))
    };
  }

  function quadrantsOf(matrix, half) {
    return {
      a: quadrant(matrix, 0, 0, half), b: quadrant(matrix, 0, half, half),
      c: quadrant(matrix, half, 0, half), d: quadrant(matrix, half, half, half)
    };
  }

  /**
   * Strassen with a cutoff, because a pure recursion to 1×1 is slower than the
   * triple loop at every size a browser can run. The cutoff is the parameter
   * that makes the algorithm practical and the one every library tunes.
   */
  function strassen(a, b, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const cutoff = Math.max(1, settings.cutoff === undefined ? 32 : settings.cutoff);
    const size = nextPowerOfTwo(Math.max(a.length, b.length));
    const left = pad(a, size);
    const right = pad(b, size);

    function multiply(x, y, depth) {
      report.calls += 1;
      report.maxDepth = Math.max(report.maxDepth, depth || 1);
      if (x.length <= cutoff) {
        report.baseCases += 1;
        return cubic(x, y, { report: report }).matrix;
      }

      const half = x.length / 2;
      const step = function (p, q) { return multiply(p, q, (depth || 1) + 1); };
      const m = sevenProducts(quadrantsOf(x, half), quadrantsOf(y, half), step, report);
      const plus = function (p, q) { return addMatrix(p, q, 1, report); };
      const minus = function (p, q) { return addMatrix(p, q, -1, report); };

      return join(
        plus(minus(plus(m.m1, m.m4), m.m5), m.m7),
        plus(m.m3, m.m5),
        plus(m.m2, m.m4),
        plus(minus(plus(m.m1, m.m3), m.m2), m.m6)
      );
    }

    const padded = multiply(left, right, 1);
    const out = [];
    for (let i = 0; i < a.length; i += 1) out.push(padded[i].slice(0, b[0].length));
    return { matrix: out, report: report, paddedTo: size, padding: size - a.length };
  }

  function maxAbsoluteDifference(x, y) {
    let worst = 0;
    for (let i = 0; i < x.length; i += 1) {
      for (let j = 0; j < x[i].length; j += 1) {
        worst = Math.max(worst, Math.abs(x[i][j] - y[i][j]));
      }
    }
    return worst;
  }

  /**
   * The numerical caveat, measured: the largest entrywise disagreement between
   * the two algorithms and the largest entry of the product, so the reader can
   * see the relative size rather than take the warning on trust.
   */
  function errorAgainstCubic(a, b, options) {
    const exact = cubic(a, b, {}).matrix;
    const fast = strassen(a, b, options || {}).matrix;
    let largest = 0;
    exact.forEach(function (row) {
      row.forEach(function (value) { largest = Math.max(largest, Math.abs(value)); });
    });

    const worst = maxAbsoluteDifference(exact, fast);
    return { worstAbsolute: worst, largestEntry: largest, relative: largest ? worst / largest : 0 };
  }

  return {
    EXPONENT: Math.log2(7),
    emptyReport: emptyReport,
    zeros: zeros,
    nextPowerOfTwo: nextPowerOfTwo,
    cubic: cubic,
    strassen: strassen,
    errorAgainstCubic: errorAgainstCubic,
    maxAbsoluteDifference: maxAbsoluteDifference
  };
}));
