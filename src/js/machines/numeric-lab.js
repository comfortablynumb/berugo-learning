/**
 * NumericLab - the harness for conditioning, root finding, linear systems,
 * least squares and eigenvalues (M18.1-M18.5).
 *
 * One rule runs through all of it: **residual and error are separate columns
 * and are never conflated.** A small residual says the answer satisfies the
 * equations as written; a small error says it is the answer. On an
 * ill-conditioned problem the first is tiny while the second is enormous, and
 * reporting the residual as evidence of correctness is the single most common
 * mistake in numerical code. Every run here returns both, and the sections
 * are built around the gap between them.
 *
 * The reference solutions are constructed rather than computed wherever that
 * is possible: pick the answer, multiply to get the right-hand side, and the
 * truth is known exactly. That is what makes "solution error" a measurement
 * rather than a comparison between two approximations.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.NumericLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const L = scope && scope.Linalg ? scope.Linalg : require('../algorithms/linalg.js');
  const QR = scope && scope.QrSvd ? scope.QrSvd : require('../algorithms/qr-svd.js');
  const Roots = scope && scope.RootFinding ? scope.RootFinding
    : require('../algorithms/root-finding.js');
  const Iterative = scope && scope.IterativeSolvers ? scope.IterativeSolvers
    : require('../algorithms/iterative-solvers.js');
  const Eig = scope && scope.Eigen ? scope.Eigen : require('../algorithms/eigen.js');
  const Random = scope && scope.Random ? scope.Random : require('../utils/random.js');

  /* --------------------------------------------------- 18.1 conditioning */

  /**
   * The same system solved at a range of condition numbers, with the residual
   * and the solution error reported separately. The residual stays at machine
   * precision throughout; the error rises in lockstep with the condition
   * number. That divergence is the section.
   */
  function conditioningSweep(options) {
    const settings = options || {};
    const size = settings.size || 8;
    const conditions = settings.conditions ||
      [1e0, 1e2, 1e4, 1e6, 1e8, 1e10, 1e12, 1e14, 1e16];

    return conditions.map(function (condition) {
      return conditioningRow(size, condition, settings.seed || 11);
    });
  }

  function conditioningRow(size, condition, seed) {
    const rng = Random.seeded(seed);
    const matrix = L.spdWithCondition(size, condition, rng);
    const truth = new Float64Array(size);
    for (let i = 0; i < size; i += 1) truth[i] = 1 + i * 0.1;

    const b = L.apply(matrix, truth);
    const x = L.solve(matrix, b);
    const scored = L.scoreSolution(matrix, x, b, truth);

    return {
      requested: condition,
      measured: QR.conditionNumber(matrix),
      relativeResidual: scored.relativeResidual,
      relativeError: scored.relativeError,
      /* The bound the condition number promises: a relative input
         perturbation of machine epsilon can become an output error of
         kappa times it, and the measured error should sit under that. */
      bound: QR.conditionNumber(matrix) * Number.EPSILON,
      withinBound: scored.relativeError <= QR.conditionNumber(matrix) * Number.EPSILON * 100
    };
  }

  /**
   * The Hilbert matrix at a range of sizes: the standard demonstration that
   * an innocuous-looking matrix can be ill-conditioned past any hope of a
   * useful answer, and that nothing about the residual warns you.
   */
  function hilbertLadder(sizes) {
    return (sizes || [3, 5, 7, 9, 11, 13]).map(function (n) {
      const matrix = L.hilbert(n);
      const truth = new Float64Array(n).fill(1);
      const b = L.apply(matrix, truth);
      const x = L.solve(matrix, b);
      const scored = L.scoreSolution(matrix, x, b, truth);

      return {
        n: n,
        condition: QR.conditionNumber(matrix),
        relativeResidual: scored.relativeResidual,
        relativeError: scored.relativeError,
        digitsLost: Math.max(0, Math.round(Math.log10(QR.conditionNumber(matrix))))
      };
    });
  }

  /* ---------------------------------------------------- 18.2 root finding */

  const FUNCTIONS = [
    {
      id: 'cubic', label: 'x³ − 2x − 5', bracket: { low: 1, high: 3 }, start: 3,
      truth: 2.0945514815423265,
      f: function (x) { return x * x * x - 2 * x - 5; },
      derivative: function (x) { return 3 * x * x - 2; }
    },
    {
      id: 'exponential', label: 'eˣ − 4', bracket: { low: 0, high: 5 }, start: 4,
      truth: Math.log(4),
      f: function (x) { return Math.exp(x) - 4; },
      derivative: function (x) { return Math.exp(x); }
    },
    {
      id: 'arctan', label: 'arctan(x)', bracket: { low: -3, high: 3 }, start: 1.5,
      truth: 0,
      f: function (x) { return Math.atan(x); },
      derivative: function (x) { return 1 / (1 + x * x); }
    },
    {
      id: 'multiroot', label: 'x³ − 2x', bracket: { low: -0.5, high: 2 }, start: 0.9,
      truth: Math.SQRT2,
      f: function (x) { return x * x * x - 2 * x; },
      derivative: function (x) { return 3 * x * x - 2; }
    },
    {
      id: 'cycling', label: 'x³ − 2x + 2', bracket: { low: -3, high: 0 }, start: 0,
      truth: -1.7692923542386314,
      f: function (x) { return x * x * x - 2 * x + 2; },
      derivative: function (x) { return 3 * x * x - 2; }
    }
  ];

  function functionFor(id) {
    for (let i = 0; i < FUNCTIONS.length; i += 1) {
      if (FUNCTIONS[i].id === id) return FUNCTIONS[i];
    }
    return FUNCTIONS[0];
  }

  /**
   * Every method on one function. The order column is left blank for the
   * bracketing methods whose iterate error is not geometric - reporting a
   * fitted number there invites a comparison that does not mean anything, so
   * they report their bracket contraction instead.
   */
  function rootRace(id, options) {
    const settings = options || {};
    const spec = functionFor(id);
    const start = settings.start === undefined ? spec.start : settings.start;
    const shared = { truth: spec.truth, tolerance: settings.tolerance || 1e-12,
      limit: settings.limit || 100 };

    return [
      decorate(Roots.bisection(spec.f, spec.bracket, shared), true),
      decorate(Roots.falsePosition(spec.f, spec.bracket, shared), true),
      decorate(Roots.newton(spec.f, spec.derivative, start, shared), false),
      decorate(Roots.secant(spec.f, start - 0.5, start, shared), false),
      decorate(Roots.brent(spec.f, spec.bracket, shared), true)
    ];
  }

  function decorate(result, bracketing) {
    return Object.assign({}, result, {
      reportOrder: bracketing ? null : result.order,
      reportContraction: bracketing ? result.contraction : null,
      accurate: Number.isFinite(result.root)
    });
  }

  /**
   * Newton from a range of starting points, so each failure mode is a row
   * rather than a paragraph.
   *
   * The default starts straddle √(2/3) ≈ 0.8165, where the derivative of
   * x³ − 2x vanishes. Just below it Newton converges to −√2 - the root on the
   * far side, past the root at 0 that sits between - and just above it to
   * +√2. Nothing about the iteration announces that it went the wrong way,
   * and "the nearest root" is not what it finds.
   */
  const BASIN_STARTS = [-2, -1, 0.5, 0.75, 0.8, 0.815, 0.8165, 0.9, 1.5];

  function newtonBasins(id, starts, options) {
    const spec = functionFor(id);
    const settings = options || {};

    return (starts || BASIN_STARTS).map(function (start) {
      const run = Roots.newton(spec.f, spec.derivative, start,
        { limit: settings.limit || 60, tolerance: 1e-12 });
      return {
        start: start,
        root: run.root,
        iterations: run.iterations,
        converged: run.converged,
        reason: run.reason,
        nearest: nearestRootLabel(spec, start)
      };
    });
  }

  function nearestRootLabel(spec, start) {
    if (spec.id !== 'multiroot') return null;
    const roots = [-Math.SQRT2, 0, Math.SQRT2];
    let best = roots[0];
    roots.forEach(function (value) {
      if (Math.abs(value - start) < Math.abs(best - start)) best = value;
    });
    return best;
  }

  /** The same equation rearranged two ways, with the contraction factor that
   *  decides which of them converges. */
  function fixedPointPair(options) {
    const settings = options || {};
    const target = (1 + Math.sqrt(5)) / 2;
    const start = settings.start === undefined ? 1.5 : settings.start;

    const forms = [
      { label: 'g(x) = 1 + 1/x', g: function (x) { return 1 + 1 / x; } },
      { label: 'g(x) = x² − 1', g: function (x) { return x * x - 1; } }
    ];
    return forms.map(function (form) {
      const run = Roots.fixedPoint(form.g, start, { truth: target, limit: 200 });
      return {
        label: form.label,
        factor: Roots.contractionFactor(form.g, target),
        contraction: Roots.contractionFactor(form.g, target) < 1,
        converged: run.converged,
        iterations: run.iterations,
        root: run.root,
        reason: run.reason
      };
    });
  }

  /* -------------------------------------------------- 18.3 linear systems */

  /**
   * The pivoting fixture. The leading entry is tiny and NOT zero, so a rule
   * that swaps only on an exact zero never fires - which is the whole point,
   * because the textbook explanation of pivoting is about zeros and the real
   * reason is about growth.
   */
  function pivotingDemo(options) {
    const settings = options || {};
    const epsilon = settings.epsilon === undefined ? 1e-18 : settings.epsilon;
    const matrix = L.tinyPivot(epsilon);
    const b = new Float64Array([1, 2]);
    const truth = exactTinyPivotSolution(epsilon);

    return [true, false].map(function (pivot) {
      const factorisation = L.lu(matrix, { pivot: pivot });
      const x = L.luSolve(factorisation, b);
      const scored = L.scoreSolution(matrix, x, b, truth);
      return {
        pivoted: pivot,
        growth: factorisation.growth,
        swaps: factorisation.swaps,
        x: Array.from(x),
        relativeResidual: scored.relativeResidual,
        relativeError: scored.relativeError
      };
    });
  }

  /**
   * The exact answer to [[e, 1], [1, 1]] x = [1, 2], derived rather than
   * solved - and derived in the ONE arrangement that survives a tiny e.
   *
   * Subtracting the rows gives (e − 1)x₁ = −1, so x₁ = 1/(1 − e), and
   * x₂ = 2 − x₁. Both are well conditioned for small e. The obvious
   * alternative - solve for x₂ first, then recover x₁ as (1 − x₂)/e - is
   * algebraically identical and numerically hopeless: at e = 1e-18 the
   * subtraction 1 − x₂ cancels to exactly zero and the "exact" reference
   * comes back as [0, 1], which is the WRONG answer. An earlier version did
   * exactly that and scored the correctly pivoted solve as the failure.
   */
  function exactTinyPivotSolution(epsilon) {
    const x1 = 1 / (1 - epsilon);
    return new Float64Array([x1, 2 - x1]);
  }

  /** Wilkinson's matrix: partial pivoting never swaps and the growth still
   *  reaches 2^(n−1), which is why the pivoting bound is a worst case rather
   *  than a promise of small growth. */
  function growthLadder(sizes) {
    return (sizes || [4, 8, 12, 16, 20, 24]).map(function (n) {
      const matrix = L.wilkinson(n);
      const factorisation = L.lu(matrix);
      return {
        n: n,
        growth: factorisation.growth,
        swaps: factorisation.swaps,
        predicted: Math.pow(2, n - 1),
        matchesPrediction: Math.abs(factorisation.growth - Math.pow(2, n - 1)) < 1
      };
    });
  }

  /**
   * Factor once and reuse against many right-hand sides, against solving
   * from scratch each time - and against the explicit inverse, which is the
   * option that is both slower and less accurate.
   *
   * `inversePenalty` is a ratio of two rounding-error norms, and it is the one
   * figure here that is NOT reproducible to its digits. The right-hand sides
   * come from a Gaussian, which is built on `Math.log`; that function is not
   * required to be correctly rounded and V8 has changed it between releases,
   * so the last bits of the test vectors differ by engine and a ratio of two
   * near-cancelling quantities amplifies the difference. Measured: 8.41 on
   * Node 24 and 6.02 on Node 22, from identical source and an identical seed.
   * The claim the section makes is therefore the one that survives that -
   * several times worse, for more work - and the prose quotes a band rather
   * than a decimal.
   */
  function reuseStudy(options) {
    const settings = options || {};
    const n = settings.size || 60;
    const count = settings.rightHandSides || 20;
    const rng = Random.seeded(settings.seed || 13);
    const matrix = L.spdWithCondition(n, settings.condition || 1e6, rng);

    const factorisation = L.lu(matrix);
    const inverse = L.inverse(matrix);
    let reusedError = 0;
    let freshError = 0;
    let inverseError = 0;

    for (let i = 0; i < count; i += 1) {
      const truth = new Float64Array(n);
      for (let k = 0; k < n; k += 1) truth[k] = rng.gaussian(0, 1);
      const b = L.apply(matrix, truth);

      reusedError = Math.max(reusedError, relativeError(L.luSolve(factorisation, b), truth));
      freshError = Math.max(freshError, relativeError(L.solve(matrix, b), truth));
      inverseError = Math.max(inverseError, relativeError(L.apply(inverse, b), truth));
    }
    return {
      size: n, rightHandSides: count,
      factorisations: { reused: 1, fresh: count, inverse: 1 },
      reusedError: reusedError, freshError: freshError, inverseError: inverseError,
      inversePenalty: inverseError / Math.max(reusedError, Number.MIN_VALUE)
    };
  }

  function relativeError(x, truth) {
    return L.norm2(L.subtract(x, truth)) / (L.norm2(truth) || 1);
  }

  /** Every iterative method on the same system, plus conjugate gradient's
   *  bound to read the residual curve against. */
  function iterativeRace(options) {
    const settings = options || {};
    const n = settings.size || 40;
    const matrix = settings.scaled
      ? Iterative.scaledPoisson(n, settings.spread || 1e3) : Iterative.poisson1d(n);
    const rng = Random.seeded(settings.seed || 5);
    const truth = new Float64Array(n);
    for (let i = 0; i < n; i += 1) truth[i] = rng.gaussian(0, 1);
    const b = L.apply(matrix, truth);
    const shared = { truth: truth, tolerance: settings.tolerance || 1e-10, limit: 40000 };

    const rows = [
      Iterative.jacobi(matrix, b, shared),
      Iterative.gaussSeidel(matrix, b, shared),
      Iterative.sor(matrix, b, Object.assign({ omega: settings.omega || 1.8 }, shared)),
      Iterative.conjugateGradient(matrix, b, shared)
    ];
    const preconditioned = Iterative.jacobiPrecondition(matrix, b);
    const preconditionedRun = Iterative.conjugateGradient(preconditioned.matrix,
      preconditioned.b, { tolerance: shared.tolerance, limit: shared.limit });

    return {
      size: n,
      condition: QR.conditionNumber(matrix),
      preconditionedCondition: QR.conditionNumber(preconditioned.matrix),
      rows: rows.map(function (run) {
        return { method: run.method, iterations: run.iterations, converged: run.converged,
          diverged: run.diverged, residual: run.residual, history: run.history };
      }),
      preconditioned: { method: 'CG, Jacobi preconditioned',
        iterations: preconditionedRun.iterations, converged: preconditionedRun.converged,
        history: preconditionedRun.history },
      bound: Iterative.cgBound(QR.conditionNumber(matrix),
        Math.max(1, rows[3].iterations))
    };
  }

  /** The omega sweep, so the optimal relaxation is found rather than quoted. */
  function omegaSweep(options) {
    const settings = options || {};
    const n = settings.size || 32;
    const matrix = Iterative.poisson1d(n);
    const truth = new Float64Array(n).fill(1);
    const b = L.apply(matrix, truth);

    return (settings.values || [1, 1.2, 1.4, 1.6, 1.7, 1.8, 1.85, 1.9, 1.95]).map(function (omega) {
      const run = Iterative.sor(matrix, b, { omega: omega, tolerance: 1e-10, limit: 20000 });
      return { omega: omega, iterations: run.iterations, converged: run.converged };
    });
  }

  /* --------------------------------------------------- 18.4 least squares */

  /**
   * Fit a polynomial to noisy data by the normal equations and by QR as the
   * degree rises. The normal equations square the condition number, so they
   * lose their digits at half the degree - and the demo reports both
   * condition numbers so the factor of two is visible rather than asserted.
   */
  function fittingSweep(options) {
    const settings = options || {};
    const points = settings.points || 25;
    const rng = Random.seeded(settings.seed || 17);
    const nodes = [];
    const values = [];

    for (let i = 0; i < points; i += 1) {
      const x = i / (points - 1);
      nodes.push(x);
      values.push(Math.exp(x) + (settings.noise || 0) * rng.gaussian(0, 1));
    }
    const target = Float64Array.from(values);

    return (settings.degrees || [2, 4, 6, 8, 10, 12, 14]).map(function (degree) {
      return fittingRow(nodes, target, degree);
    });
  }

  function fittingRow(nodes, target, degree) {
    const matrix = L.vandermonde(nodes, degree);
    const gram = L.multiply(L.transpose(matrix), matrix);

    const viaQr = QR.qrSolve(matrix, target);
    const viaNormal = QR.normalEquationsSolve(matrix, target);

    return {
      degree: degree,
      condition: QR.conditionNumber(matrix),
      normalCondition: QR.conditionNumber(gram),
      squared: QR.conditionNumber(gram) / Math.pow(QR.conditionNumber(matrix), 2),
      qrResidual: residualNorm(matrix, viaQr, target),
      normalResidual: residualNorm(matrix, viaNormal, target),
      qrCoefficientNorm: L.norm2(viaQr),
      normalCoefficientNorm: L.norm2(viaNormal)
    };
  }

  function residualNorm(matrix, x, target) {
    return L.norm2(L.subtract(L.apply(matrix, x), target)) / (L.norm2(target) || 1);
  }

  /** The three QR variants on the same matrix, scored by how far from
   *  orthogonal each factor came out. */
  function orthogonalityRace(options) {
    const settings = options || {};
    const points = settings.points || 12;
    const degree = settings.degree || 9;
    const nodes = [];
    for (let i = 0; i < points; i += 1) nodes.push(i / (points - 1));
    const matrix = L.vandermonde(nodes, degree);

    return [
      { id: 'classical', label: 'classical Gram-Schmidt', run: QR.classicalGramSchmidt },
      { id: 'modified', label: 'modified Gram-Schmidt', run: QR.modifiedGramSchmidt },
      { id: 'householder', label: 'Householder reflections', run: QR.householderQr }
    ].map(function (entry) {
      const decomposition = entry.run(matrix);
      return { id: entry.id, label: entry.label,
        loss: QR.orthogonalityLoss(decomposition.q),
        condition: QR.conditionNumber(matrix) };
    });
  }

  /** Singular values and what truncating them costs, which is the Eckart-Young
   *  theorem made into a table. */
  function truncationStudy(options) {
    const settings = options || {};
    const size = settings.size || 12;
    const rng = Random.seeded(settings.seed || 23);
    const matrix = L.spdWithCondition(size, settings.condition || 1e6, rng);
    const decomposition = QR.svd(matrix);

    const rows = [];
    for (let k = 1; k <= size; k += 1) {
      const approximation = QR.lowRank(matrix, k);
      rows.push({ k: k, singular: decomposition.s[k - 1],
        spectralBound: approximation.errorBound,
        frobeniusBound: approximation.frobeniusBound,
        stored: k * (matrix.rows + matrix.cols + 1),
        full: matrix.rows * matrix.cols,
        measured: frobeniusDifference(matrix, approximation.matrix) });
    }
    return { singular: decomposition.s, rows: rows,
      rank: QR.numericalRank(matrix).rank };
  }

  function frobeniusDifference(a, b) {
    let sum = 0;
    for (let i = 0; i < a.data.length; i += 1) {
      const difference = a.data[i] - b.data[i];
      sum += difference * difference;
    }
    return Math.sqrt(sum);
  }

  /* ----------------------------------------------------- 18.5 eigenvalues */

  /** Power iteration at a range of eigenvalue gaps, with the predicted rate
   *  beside the measured iteration count. */
  function gapStudy(options) {
    const settings = options || {};
    const gaps = settings.gaps || [0.1, 0.3, 0.5, 0.7, 0.9, 0.95, 0.99];

    return gaps.map(function (gap) {
      const rng = Random.seeded(settings.seed || 3);
      const spectrum = [10, 10 * gap, 2, 1];
      const matrix = Eig.symmetricWithSpectrum(spectrum, rng);
      const run = Eig.powerIteration(matrix, { tolerance: settings.tolerance || 1e-10,
        limit: 20000 });

      return {
        gap: gap,
        iterations: run.iterations,
        value: run.value,
        residual: run.residual,
        /* Predicted: the error falls by the gap each step, so reaching a
           tolerance takes log(tolerance)/log(gap) steps. */
        predicted: Math.log(settings.tolerance || 1e-10) / Math.log(gap)
      };
    });
  }

  /** Shifted inverse iteration reaching each eigenvalue in turn from a nearby
   *  target, at a cost that does not depend on which one it is. */
  function shiftStudy(options) {
    const settings = options || {};
    const spectrum = settings.spectrum || [10, 5, 2, 1];
    const rng = Random.seeded(settings.seed || 3);
    const matrix = Eig.symmetricWithSpectrum(spectrum, rng);

    return spectrum.map(function (value, index) {
      const shift = value + (settings.offset === undefined ? 0.2 : settings.offset);
      const run = Eig.shiftedInverse(matrix, shift, { tolerance: 1e-12, limit: 200 });
      return { target: value, shift: shift, found: run.value, index: index,
        iterations: run.iterations, residual: run.residual,
        correct: Math.abs(run.value - value) < 1e-8 };
    });
  }

  /** The QR algorithm converging to triangular, with the subdiagonal norm as
   *  the quantity that has to reach zero. */
  function qrConvergence(options) {
    const settings = options || {};
    const rng = Random.seeded(settings.seed || 3);
    const matrix = Eig.symmetricWithSpectrum(settings.spectrum || [10, 5, 2, 1], rng);
    const run = Eig.qrAlgorithm(matrix, { tolerance: settings.tolerance || 1e-10,
      limit: settings.limit || 2000 });

    return {
      iterations: run.iterations,
      converged: run.converged,
      values: run.values.slice().sort(function (a, b) { return b - a; }),
      expected: (settings.spectrum || [10, 5, 2, 1]).slice(),
      trail: run.trail.map(function (point) { return point.subdiagonal; })
    };
  }

  /** Wilkinson's polynomial, measured at several degrees - the argument
   *  against ever forming the characteristic polynomial. */
  function polynomialLadder(sizes, epsilon) {
    return (sizes || [5, 10, 15, 20]).map(function (n) {
      return Eig.polynomialPeril(n, epsilon === undefined ? 1e-10 : epsilon);
    });
  }

  return {
    FUNCTIONS: FUNCTIONS,
    functionFor: functionFor,
    conditioningSweep: conditioningSweep,
    hilbertLadder: hilbertLadder,
    rootRace: rootRace,
    newtonBasins: newtonBasins,
    fixedPointPair: fixedPointPair,
    pivotingDemo: pivotingDemo,
    exactTinyPivotSolution: exactTinyPivotSolution,
    growthLadder: growthLadder,
    reuseStudy: reuseStudy,
    iterativeRace: iterativeRace,
    omegaSweep: omegaSweep,
    fittingSweep: fittingSweep,
    orthogonalityRace: orthogonalityRace,
    truncationStudy: truncationStudy,
    gapStudy: gapStudy,
    shiftStudy: shiftStudy,
    qrConvergence: qrConvergence,
    polynomialLadder: polynomialLadder
  };
}));
