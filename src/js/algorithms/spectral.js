/**
 * Spectral graph methods: the Laplacian, the Fiedler vector, spectral
 * bisection, and PageRank by power iteration with a direct linear solve as the
 * oracle.
 *
 * **Dangling nodes are the detail that breaks naive PageRank.** A vertex with
 * no outgoing edge has nowhere to send its share, so a transition matrix built
 * naively has a column of zeros and the iteration leaks probability: the
 * vector stops summing to one and every ranking drifts. The fix is to
 * redistribute a dangling vertex's mass across the whole graph, and this
 * module can run with that redistribution switched off so the leak is a
 * measured number rather than a warning.
 *
 * The Fiedler vector - the eigenvector of the second-smallest Laplacian
 * eigenvalue - is computed by power iteration on a shifted matrix with the
 * all-ones direction projected out, because the smallest eigenvalue is always
 * zero and its eigenvector is exactly that constant vector.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Spectral = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { iterations: 0, multiplications: 0, residual: 0, danglingNodes: 0,
      leakedMass: 0, converged: false };
  }

  /* ------------------------------------------------------- the matrices */

  function degreesOf(adjacency) {
    return adjacency.map(function (list) { return list.length; });
  }

  /** L = D − A. Every row sums to zero, so the all-ones vector is always an
   *  eigenvector with eigenvalue zero - which is why the *second* eigenvalue
   *  is the one carrying the connectivity information. */
  function laplacian(adjacency) {
    const n = adjacency.length;
    const matrix = [];

    for (let v = 0; v < n; v += 1) matrix.push(new Array(n).fill(0));
    adjacency.forEach(function (list, v) {
      matrix[v][v] = list.length;
      list.forEach(function (w) { matrix[v][w] -= 1; });
    });
    return matrix;
  }

  function multiply(matrix, vector, report) {
    const out = new Array(vector.length).fill(0);

    for (let i = 0; i < matrix.length; i += 1) {
      let sum = 0;

      for (let j = 0; j < vector.length; j += 1) {
        if (matrix[i][j] === 0) continue;
        sum += matrix[i][j] * vector[j];
        report.multiplications += 1;
      }
      out[i] = sum;
    }
    return out;
  }

  function normalise(vector) {
    let norm = 0;

    vector.forEach(function (value) { norm += value * value; });
    norm = Math.sqrt(norm);

    if (norm === 0) return vector.slice();
    return vector.map(function (value) { return value / norm; });
  }

  /** Remove the constant component, which is the eigenvector of the zero
   *  eigenvalue and would otherwise dominate every iteration. */
  function deflate(vector) {
    const mean = vector.reduce(function (a, b) { return a + b; }, 0) / vector.length;
    return vector.map(function (value) { return value - mean; });
  }

  /* --------------------------------------------------- the Fiedler vector */

  /**
   * Power-iterate on (cI − L) with the constant direction projected out. The
   * shift makes the matrix positive semi-definite and turns "second smallest
   * eigenvalue of L" into "largest eigenvalue of the shifted matrix in the
   * deflated subspace", which power iteration can find.
   */
  function fiedlerVector(adjacency, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const n = adjacency.length;
    const matrix = laplacian(adjacency);
    let shift = 0;

    degreesOf(adjacency).forEach(function (d) { shift = Math.max(shift, 2 * d); });
    const shifted = matrix.map(function (row, i) {
      return row.map(function (value, j) { return (i === j ? shift : 0) - value; });
    });
    let vector = normalise(deflate(startVector(n)));
    const limit = settings.iterations || 400;

    for (let step = 0; step < limit; step += 1) {
      report.iterations += 1;
      const next = normalise(deflate(multiply(shifted, vector, report)));
      let delta = 0;

      next.forEach(function (value, i) { delta = Math.max(delta, Math.abs(value - vector[i])); });
      vector = next;
      report.residual = delta;

      if (delta >= (settings.tolerance || 1e-10)) continue;
      report.converged = true;
      break;
    }
    return { vector: vector, eigenvalue: rayleigh(matrix, vector, report), report: report };
  }

  /** A deterministic, non-constant starting vector. */
  function startVector(n) {
    const out = [];

    for (let v = 0; v < n; v += 1) out.push(Math.sin(v + 1));
    return out;
  }

  function rayleigh(matrix, vector, report) {
    const product = multiply(matrix, vector, report);
    let top = 0;
    let bottom = 0;

    vector.forEach(function (value, i) {
      top += value * product[i];
      bottom += value * value;
    });
    return bottom === 0 ? 0 : top / bottom;
  }

  /**
   * Split by the sign of the Fiedler vector. The cut it produces is the
   * *measurement* that matters, not the eigenvalue: a bisection is only worth
   * having if the number of edges crossing it is small.
   */
  function spectralBisection(adjacency, options) {
    const run = fiedlerVector(adjacency, options || {});
    const side = run.vector.map(function (value) { return value >= 0 ? 0 : 1; });
    let cut = 0;
    let balance = 0;

    side.forEach(function (group) { if (group === 0) balance += 1; });
    adjacency.forEach(function (list, v) {
      list.forEach(function (w) {
        if (side[v] === side[w] || v > w) return;
        cut += 1;
      });
    });
    return { side: side, cut: cut, sizes: [balance, side.length - balance],
      eigenvalue: run.eigenvalue, report: run.report };
  }

  /* -------------------------------------------------------------- PageRank */

  function outDegrees(adjacency) {
    return adjacency.map(function (list) { return list.length; });
  }

  /**
   * One power-iteration step. `redistribute: false` drops the dangling mass on
   * the floor instead of spreading it, which is the bug this section exists
   * for: the vector stops summing to one and the ranking drifts.
   */
  function pageRankStep(adjacency, rank, context) {
    const n = adjacency.length;
    const next = new Array(n).fill(0);
    let dangling = 0;

    for (let v = 0; v < n; v += 1) {
      if (context.degree[v] === 0) { dangling += rank[v]; continue; }
      const share = rank[v] / context.degree[v];

      adjacency[v].forEach(function (w) {
        next[w] += share;
        context.report.multiplications += 1;
      });
    }
    const spread = context.redistribute ? dangling / n : 0;

    context.report.leakedMass = context.redistribute ? 0 : dangling;

    for (let v = 0; v < n; v += 1) {
      next[v] = context.damping * (next[v] + spread) + (1 - context.damping) / n;
    }
    return next;
  }

  /**
   * PageRank by power iteration. `damping` is the probability of following a
   * link rather than jumping; `redistribute` controls whether a dangling
   * vertex's mass is spread over the graph or lost.
   */
  function pageRank(adjacency, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const n = adjacency.length;
    const degree = outDegrees(adjacency);
    const context = { degree: degree, report: report,
      damping: settings.damping === undefined ? 0.85 : settings.damping,
      redistribute: settings.redistribute !== false };

    report.danglingNodes = degree.filter(function (d) { return d === 0; }).length;
    let rank = new Array(n).fill(1 / n);
    const limit = settings.iterations || 200;

    for (let step = 0; step < limit; step += 1) {
      report.iterations += 1;
      const next = pageRankStep(adjacency, rank, context);
      let delta = 0;

      next.forEach(function (value, v) { delta += Math.abs(value - rank[v]); });
      rank = next;
      report.residual = delta;

      if (delta >= (settings.tolerance || 1e-12)) continue;
      report.converged = true;
      break;
    }
    return { rank: rank, total: rank.reduce(function (a, b) { return a + b; }, 0),
      report: report };
  }

  /**
   * The same answer by solving (I − dM)r = (1 − d)/n directly with Gaussian
   * elimination. Cubic and useless at scale, and the only way to know the
   * iteration converged to the right vector rather than to a plausible one.
   */
  function pageRankBySolve(adjacency, options) {
    const settings = options || {};
    const n = adjacency.length;
    const damping = settings.damping === undefined ? 0.85 : settings.damping;
    const degree = outDegrees(adjacency);
    const matrix = [];

    for (let i = 0; i < n; i += 1) {
      const row = new Array(n + 1).fill(0);

      row[i] = 1;

      for (let j = 0; j < n; j += 1) {
        const share = degree[j] === 0 ? 1 / n : (adjacency[j].indexOf(i) === -1 ? 0 : 1 / degree[j]);

        row[j] -= damping * share;
      }
      row[n] = (1 - damping) / n;
      matrix.push(row);
    }
    return { rank: solveLinear(matrix, n) };
  }

  /** Gaussian elimination with partial pivoting. */
  function solveLinear(matrix, n) {
    for (let column = 0; column < n; column += 1) {
      let pivot = column;

      for (let row = column + 1; row < n; row += 1) {
        if (Math.abs(matrix[row][column]) <= Math.abs(matrix[pivot][column])) continue;
        pivot = row;
      }
      const swap = matrix[column];

      matrix[column] = matrix[pivot];
      matrix[pivot] = swap;

      for (let row = 0; row < n; row += 1) {
        if (row === column || matrix[column][column] === 0) continue;
        const factor = matrix[row][column] / matrix[column][column];

        for (let k = column; k <= n; k += 1) matrix[row][k] -= factor * matrix[column][k];
      }
    }
    const out = new Array(n).fill(0);

    for (let i = 0; i < n; i += 1) {
      out[i] = matrix[i][i] === 0 ? 0 : matrix[i][n] / matrix[i][i];
    }
    return out;
  }

  /* --------------------------------------------------------- invariants */

  /** A probability vector sums to one and has no negative entry. Both fail
   *  the moment dangling mass is dropped. */
  function checkDistribution(vector) {
    const total = vector.reduce(function (a, b) { return a + b; }, 0);
    let negative = 0;

    vector.forEach(function (value) { if (value < -1e-12) negative += 1; });
    return { total: total, negative: negative,
      valid: Math.abs(total - 1) < 1e-9 && negative === 0 };
  }

  function maxDifference(left, right) {
    let worst = 0;

    left.forEach(function (value, i) { worst = Math.max(worst, Math.abs(value - right[i])); });
    return worst;
  }

  return {
    emptyReport: emptyReport, laplacian: laplacian, degreesOf: degreesOf,
    multiply: multiply, normalise: normalise, deflate: deflate,
    fiedlerVector: fiedlerVector, spectralBisection: spectralBisection,
    pageRank: pageRank, pageRankBySolve: pageRankBySolve, solveLinear: solveLinear,
    checkDistribution: checkDistribution, maxDifference: maxDifference
  };
}));
