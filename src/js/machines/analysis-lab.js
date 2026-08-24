/**
 * AnalysisLab - the harness for interpolation, differentiation, differential
 * equations, transforms and optimisation (M18.6-M18.10).
 *
 * Split from `numeric-lab.js` for size rather than for design; the same rule
 * runs through both, which is that every claim arrives with the measurement
 * that supports it and the oracle it was scored against.
 *
 * Two of the runs here contradict what people expect, and both are the point
 * of their section. Raising the degree of an interpolating polynomial makes
 * the fit WORSE on equally spaced nodes, without bound. And a more accurate
 * integrator makes an orbit decay, while a less accurate symplectic one holds
 * it - because accuracy per step and structure over a million steps are
 * different properties.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.AnalysisLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const Interp = scope && scope.Interpolation ? scope.Interpolation
    : require('../algorithms/interpolation.js');
  const Quad = scope && scope.Quadrature ? scope.Quadrature
    : require('../algorithms/quadrature.js');
  const Auto = scope && scope.Autodiff ? scope.Autodiff : require('../algorithms/autodiff.js');
  const Ode = scope && scope.OdeSolvers ? scope.OdeSolvers
    : require('../algorithms/ode-solvers.js');
  const Fft = scope && scope.Fft ? scope.Fft : require('../algorithms/fft.js');
  const Opt = scope && scope.Optimization ? scope.Optimization
    : require('../algorithms/optimization.js');
  const Random = scope && scope.Random ? scope.Random : require('../utils/random.js');

  /* -------------------------------------------------- 18.6 interpolation */

  const TARGETS = [
    { id: 'runge', label: '1 / (1 + 25x²)', from: -1, to: 1, f: Interp.runge },
    { id: 'gaussian', label: 'exp(−4x²)', from: -1, to: 1,
      f: function (x) { return Math.exp(-4 * x * x); } },
    { id: 'step', label: 'a smoothed step', from: -1, to: 1,
      f: function (x) { return 1 / (1 + Math.exp(-12 * x)); } }
  ];

  function targetFor(id) {
    for (let i = 0; i < TARGETS.length; i += 1) {
      if (TARGETS[i].id === id) return TARGETS[i];
    }
    return TARGETS[0];
  }

  /**
   * The Runge sweep: the same function, the same node count, three schemes.
   * The equally spaced polynomial diverges as the degree rises; the Chebyshev
   * one converges; the spline converges fastest of all. Nothing about the
   * polynomial changed between the first two columns except where it was
   * asked to agree.
   */
  function nodeSweep(options) {
    const settings = options || {};
    const target = targetFor(settings.target);

    return (settings.counts || [5, 9, 13, 17, 21, 25]).map(function (count) {
      const equal = Interp.equallySpaced(count, target.from, target.to);
      const chebyshev = Interp.chebyshevNodes(count, target.from, target.to);
      const equalValues = equal.map(target.f);

      return {
        count: count,
        equal: Interp.maximumError(target.f,
          Interp.barycentric(equal, equalValues), target.from, target.to).error,
        chebyshev: Interp.maximumError(target.f,
          Interp.barycentric(chebyshev, chebyshev.map(target.f)),
          target.from, target.to).error,
        spline: Interp.maximumError(target.f,
          Interp.naturalCubic(equal, equalValues), target.from, target.to).error
      };
    });
  }

  /** Sampled curves for the plot, at one node count. */
  function interpolationCurves(options) {
    const settings = options || {};
    const target = targetFor(settings.target);
    const count = settings.count || 13;
    const samples = settings.samples || 240;

    const equal = Interp.equallySpaced(count, target.from, target.to);
    const chebyshev = Interp.chebyshevNodes(count, target.from, target.to);
    const equalValues = equal.map(target.f);
    const curves = {
      truth: target.f,
      equal: Interp.barycentric(equal, equalValues),
      chebyshev: Interp.barycentric(chebyshev, chebyshev.map(target.f)),
      spline: Interp.naturalCubic(equal, equalValues)
    };

    const points = { truth: [], equal: [], chebyshev: [], spline: [] };
    for (let i = 0; i < samples; i += 1) {
      const x = target.from + (target.to - target.from) * (i / (samples - 1));
      Object.keys(points).forEach(function (key) {
        points[key].push({ x: x, y: curves[key](x) });
      });
    }
    return { points: points, equal: equal, chebyshev: chebyshev,
      values: equalValues, label: target.label };
  }

  /**
   * Overshoot on monotone data. A natural cubic is C² and leaves the data's
   * range; a monotone cubic does not and gives up C² to manage it. Both
   * interpolate the points exactly, so the only difference is between them.
   */
  function overshootStudy(options) {
    const settings = options || {};
    const nodes = settings.nodes || [0, 1, 2, 3, 4, 5, 6];
    const values = settings.values || [0, 0, 0, 1, 1, 1, 1];

    return [
      { id: 'natural', label: 'natural cubic spline', build: Interp.naturalCubic },
      { id: 'monotone', label: 'monotone cubic (Fritsch-Carlson)', build: Interp.monotoneCubic }
    ].map(function (entry) {
      const curve = entry.build(nodes, values);
      const measured = Interp.overshoot(values, curve, nodes);
      let worstInterpolation = 0;
      nodes.forEach(function (x, i) {
        worstInterpolation = Math.max(worstInterpolation, Math.abs(curve(x) - values[i]));
      });
      return { id: entry.id, label: entry.label, above: measured.above,
        below: measured.below, worst: measured.worst,
        interpolationError: worstInterpolation,
        range: Math.max.apply(null, values) - Math.min.apply(null, values) };
    });
  }

  /* --------------------------------------------- 18.7 derivatives and AD */

  /** The V curve, with the theoretical optima beside the measured minima. */
  function stepStudy(options) {
    const settings = options || {};
    const at = settings.at === undefined ? 1 : settings.at;
    const sweep = Quad.stepSweep({
      f: Math.sin, x: at, truth: Math.cos(at),
      fromPower: settings.fromPower === undefined ? -16 : settings.fromPower,
      toPower: settings.toPower === undefined ? -1 : settings.toPower,
      complexF: function (a) { return Quad.Complex.sin(a); }
    });
    return {
      sweep: sweep,
      forward: Quad.bestStep(sweep, 'forward'),
      central: Quad.bestStep(sweep, 'central'),
      complex: Quad.bestStep(sweep, 'complex'),
      predictedForward: Math.sqrt(Number.EPSILON),
      predictedCentral: Math.cbrt(Number.EPSILON)
    };
  }

  /** Quadrature rules on one integral, with the evaluation count beside the
   *  error - which is the only comparison that means anything. */
  function quadratureRace(options) {
    const settings = options || {};
    const panels = settings.panels || 8;
    const truth = Math.E - 1;

    const rows = [
      Quad.trapezoid(Math.exp, 0, 1, panels),
      Quad.simpson(Math.exp, 0, 1, panels),
      Quad.gaussLegendre(Math.exp, 0, 1, Math.max(2, Math.round(panels / 2))),
      Quad.adaptiveSimpson(Math.exp, 0, 1, { tolerance: settings.tolerance || 1e-12 })
    ];
    return rows.map(function (row) {
      return { method: row.method, value: row.value, error: Math.abs(row.value - truth),
        evaluations: row.evaluations };
    });
  }

  /** Gauss-Legendre's exactness boundary, checked at degree 2n − 1 and 2n. */
  function gaussExactness(options) {
    const settings = options || {};

    return (settings.points || [2, 3, 4, 5]).map(function (n) {
      const exactDegree = 2 * n - 1;
      const beyond = 2 * n;
      return {
        points: n,
        exactDegree: exactDegree,
        errorAtExact: Math.abs(Quad.gaussLegendre(function (x) {
          return Math.pow(x, exactDegree);
        }, 0, 1, n).value - 1 / (exactDegree + 1)),
        errorBeyond: Math.abs(Quad.gaussLegendre(function (x) {
          return Math.pow(x, beyond);
        }, 0, 1, n).value - 1 / (beyond + 1))
      };
    });
  }

  /** Both autodiff modes against the analytic gradient, with the cost. */
  function autodiffRace(options) {
    const settings = options || {};

    return Auto.FIXTURES.map(function (fixture) {
      const at = Auto.pointFor(fixture);
      const forward = Auto.forwardGradient(fixture.f, at);
      const reverse = Auto.reverseGradient(fixture.f, at);
      const truth = fixture.gradient(at);
      const cost = Auto.costRatio(fixture.f, at);

      let forwardError = 0;
      let reverseError = 0;
      truth.forEach(function (value, i) {
        forwardError = Math.max(forwardError, Math.abs(forward.gradient[i] - value));
        reverseError = Math.max(reverseError, Math.abs(reverse.gradient[i] - value));
      });
      const central = truth.map(function (value, i) {
        const h = 1e-6;
        const plus = at.slice(); plus[i] += h;
        const minus = at.slice(); minus[i] -= h;
        return Math.abs((evaluatePlain(fixture, plus) - evaluatePlain(fixture, minus)) /
          (2 * h) - value);
      });

      return {
        id: fixture.id, label: fixture.label, inputs: at.length,
        forwardError: forwardError, reverseError: reverseError,
        centralError: Math.max.apply(null, central),
        forwardPasses: forward.passes, reversePasses: reverse.passes,
        forwardOperations: cost.forwardOperations, reverseOperations: cost.reverseOperations,
        ratio: cost.ratio, tapeSize: reverse.tapeSize
      };
    });
  }

  /** The same fixture under plain arithmetic, for the finite-difference
   *  comparison - one source, three evaluation strategies. */
  function evaluatePlain(fixture, at) {
    const plain = {
      constant: function (v) { return { value: v }; },
      add: function (a, b) { return { value: a.value + b.value }; },
      sub: function (a, b) { return { value: a.value - b.value }; },
      mul: function (a, b) { return { value: a.value * b.value }; },
      div: function (a, b) { return { value: a.value / b.value }; },
      sin: function (a) { return { value: Math.sin(a.value) }; },
      cos: function (a) { return { value: Math.cos(a.value) }; },
      exp: function (a) { return { value: Math.exp(a.value) }; },
      log: function (a) { return { value: Math.log(a.value) }; },
      sqrt: function (a) { return { value: Math.sqrt(a.value) }; },
      pow: function (a, k) { return { value: Math.pow(a.value, k) }; }
    };
    return fixture.f(at.map(function (v) { return { value: v }; }), plain).value;
  }

  /** The computation graph, for the demo to draw. */
  function tapeGraph(id) {
    const fixture = Auto.fixtureFor(id);
    return { label: fixture.label, nodes: Auto.graphOf(fixture.f, Auto.pointFor(fixture)) };
  }

  /* ---------------------------------------- 18.8 differential equations */

  /** The order study: halve the step, watch the error fall by 2^p. */
  function orderTable(options) {
    const settings = options || {};

    return ['euler', 'midpoint', 'rk4', 'verlet'].map(function (method) {
      const rows = Ode.orderStudy(Ode.spring({}), { method: method, horizon: 1,
        baseSteps: settings.baseSteps || 20, levels: settings.levels || 6 });
      const orders = rows.slice(1).map(function (row) { return row.observedOrder; })
        .filter(function (value) { return value !== null; });
      const expected = Ode.methodFor(method).order;

      return {
        method: method, label: Ode.methodFor(method).label, expected: expected,
        rows: rows,
        observed: orders.length > 0 ? orders[Math.floor(orders.length / 2)] : null,
        matches: orders.length > 0 &&
          Math.abs(orders[Math.floor(orders.length / 2)] - expected) < 0.15
      };
    });
  }

  /**
   * The orbit study. The step size is the control that makes the effect
   * appear at all: at h = 0.01 both RK4 and Verlet hold the orbit to nine
   * digits and there is nothing to see, and at h = 0.1 RK4's radius decays
   * while Verlet's oscillates. The demo therefore defaults to the step where
   * the difference is real rather than to the one that flatters RK4.
   */
  function orbitStudy(options) {
    const settings = options || {};
    const system = Ode.orbit({ eccentricity: settings.eccentricity || 0 });
    const step = settings.step === undefined ? 0.1 : settings.step;
    const steps = settings.steps || 200000;

    return ['euler', 'rk4', 'verlet'].map(function (method) {
      const run = Ode.integrate(system, { method: method, step: step, steps: steps,
        samples: settings.samples || 300 });
      const drift = Ode.energyDrift(run);
      const radii = run.trail.map(function (point) {
        return Math.hypot(point.state[0], point.state[1]);
      });

      return {
        method: method, label: Ode.methodFor(method).label,
        symplectic: Ode.methodFor(method).symplectic,
        evaluations: run.evaluations,
        energy: drift,
        radiusStart: radii[0], radiusEnd: radii[radii.length - 1],
        radiusMin: Math.min.apply(null, radii), radiusMax: Math.max.apply(null, radii),
        trail: run.trail
      };
    });
  }

  /** The stiffness study: an explicit method's step is bounded by the fastest
   *  mode even after that mode has died. */
  function stiffnessStudy(options) {
    const settings = options || {};
    const system = Ode.stiff({ fast: settings.fast || 1000, slow: settings.slow || 1 });
    const limit = Ode.stabilityLimit(system.fast, 'euler');
    const horizon = settings.horizon || 1;

    const explicit = (settings.steps || [limit * 0.75, limit * 0.95, limit * 1.25])
      .map(function (h) {
        const run = Ode.integrate(system, { method: 'euler', step: h,
          steps: Math.round(horizon / h), samples: 5 });
        const truth = system.exact(run.t);
        return { step: h, ratio: h / limit, steps: Math.round(horizon / h),
          final: Array.from(run.state),
          stable: Number.isFinite(run.state[0]) && Math.abs(run.state[0]) < 10,
          error: Math.max(Math.abs(run.state[0] - truth[0]), Math.abs(run.state[1] - truth[1])) };
      });

    const implicitStep = settings.implicitStep || 0.1;
    const implicit = Ode.implicitEulerStiff(system,
      { step: implicitStep, steps: Math.round(horizon / implicitStep) });

    return {
      fast: system.fast, slow: system.slow, limit: limit,
      explicit: explicit,
      explicitStepsNeeded: Math.ceil(horizon / limit),
      implicit: { step: implicitStep, steps: implicit.steps, error: implicit.error,
        ratioToLimit: implicitStep / limit }
    };
  }

  /* ------------------------------------------------- 18.9 transforms */

  /** The FFT against the naive DFT, with both operation counts. */
  function transformRace(options) {
    const settings = options || {};

    return (settings.sizes || [8, 16, 32, 64, 128, 256]).map(function (n) {
      const re = new Float64Array(n);
      for (let i = 0; i < n; i += 1) re[i] = Math.sin(3 * i) + 0.3 * Math.cos(7 * i);
      const fast = Fft.fft({ re: re });
      const slow = Fft.naiveDft(re);

      let worst = 0;
      for (let i = 0; i < n; i += 1) {
        worst = Math.max(worst, Math.hypot(fast.re[i] - slow.re[i], fast.im[i] - slow.im[i]));
      }
      return { n: n, difference: worst, butterflies: fast.butterflies,
        expected: fast.expected, naiveOperations: slow.operations,
        saving: slow.operations / fast.butterflies };
    });
  }

  /** Round-trip error at a range of sizes, which is the acceptance criterion
   *  the milestone states. */
  function roundTripStudy(sizes) {
    return (sizes || [256, 1024, 4096, 16384, 65536]).map(function (n) {
      const re = new Float64Array(n);
      for (let i = 0; i < n; i += 1) re[i] = Math.sin(0.01 * i) + 0.5 * Math.cos(0.13 * i);
      const back = Fft.fft(Fft.fft({ re: re }), { inverse: true });

      let worst = 0;
      let scale = 0;
      for (let i = 0; i < n; i += 1) {
        worst = Math.max(worst, Math.abs(back.re[i] - re[i]));
        scale = Math.max(scale, Math.abs(re[i]));
      }
      return { n: n, relativeError: worst / scale };
    });
  }

  /** The spectrum of a built signal, with the window applied. */
  function spectrumRun(options) {
    const settings = options || {};
    const size = settings.size || 256;
    const rate = settings.rate || 256;
    const components = settings.components ||
      [{ frequency: 10.5, amplitude: 1 }, { frequency: 40, amplitude: 0.4 }];

    const signal = Fft.synthesise(components, size, rate);
    const windowed = Fft.applyWindow(signal, settings.window || 'rectangular');
    const magnitudes = Fft.magnitudes(Fft.fft({ re: windowed }));
    const bins = Fft.binFrequencies(size, rate);
    const half = Array.from(magnitudes).slice(0, size / 2);

    return {
      signal: Array.from(signal).slice(0, Math.min(size, 128)),
      bins: Array.from(bins),
      magnitudes: half,
      peak: Math.max.apply(null, half),
      components: components,
      nyquist: rate / 2
    };
  }

  /** Every window on the same signal, scored by the sidelobe it leaves. */
  function leakageStudy(options) {
    const settings = options || {};
    const size = settings.size || 256;
    const signal = Fft.synthesise([{ frequency: settings.frequency || 10.5, amplitude: 1 }],
      size, settings.rate || 256);

    return Fft.WINDOWS.map(function (window) {
      const magnitudes = Fft.magnitudes(Fft.fft({ re: Fft.applyWindow(signal, window.id) }));
      const half = Array.from(magnitudes).slice(0, size / 2);
      const peak = Math.max.apply(null, half);
      const distant = Math.max.apply(null, half.slice(30));

      return { id: window.id, label: window.label, peak: peak, sidelobe: distant,
        ratio: peak / Math.max(distant, Number.MIN_VALUE) };
    });
  }

  /** Aliasing, as a table of where each component actually lands. */
  function aliasTable(options) {
    const settings = options || {};
    const rate = settings.rate || 1000;

    return (settings.frequencies || [100, 300, 450, 500, 700, 900, 1100, 1300])
      .map(function (frequency) { return Fft.aliasOf(frequency, rate); });
  }

  /** Convolution three ways, with the exactness bound the NTT needs. */
  function convolutionRace(options) {
    const settings = options || {};
    const a = settings.a || [3, 1, 4, 1, 5, 9, 2, 6];
    const b = settings.b || [2, 7, 1, 8, 2, 8];

    const naive = Fft.convolveNaive(a, b);
    const viaFft = Fft.convolve(a, b);
    const bound = Fft.exactBound(a, b);
    const exact = bound.fits ? Fft.convolveExact(a, b).map(Number) : null;

    const rounded = viaFft.values.map(function (v) { return Math.round(v); });
    let worst = 0;
    naive.values.forEach(function (value, i) {
      worst = Math.max(worst, Math.abs(viaFft.values[i] - value));
    });

    return {
      naive: naive.values, fft: rounded, exact: exact, bound: bound,
      naiveOperations: naive.operations, fftButterflies: viaFft.butterflies,
      worstFloatError: worst,
      fftMatches: rounded.join(',') === naive.values.join(','),
      nttMatches: exact !== null && exact.join(',') === naive.values.join(',')
    };
  }

  /* ------------------------------------------------- 18.10 optimisation */

  const OPTIMISER_LABELS = ['gradient descent, fixed step', 'gradient descent with momentum',
    'gradient descent, line search', 'BFGS', 'Newton'];

  /** Every method on one surface, with monotone decrease checked rather than
   *  assumed. */
  function optimiserRace(options) {
    const settings = options || {};
    const problem = Opt.surfaceFor(settings.surface || 'rosenbrock');
    const start = settings.start || (problem.id === 'rosenbrock' ? [-1.2, 1] : [1, 1]);
    const shared = { tolerance: settings.tolerance || 1e-8, limit: settings.limit || 5000 };

    const rows = [
      Opt.gradientDescent(problem, start,
        Object.assign({ step: settings.step || 0.001 }, shared)),
      Opt.gradientDescent(problem, start,
        Object.assign({ step: settings.step || 0.001, momentum: 0.9 }, shared)),
      Opt.gradientDescent(problem, start, Object.assign({ lineSearch: true }, shared)),
      Opt.bfgs(problem, start, shared)
    ];
    if (problem.hessian) rows.push(Opt.newtonMethod(problem, start, shared));

    return {
      surface: problem.id,
      minimum: problem.minimum,
      stableStep: Opt.stableStep(problem),
      /* The first three rows are all gradient descent and would otherwise
         appear under one name; what distinguishes them is the step rule,
         which is exactly what the section is comparing. */
      rows: rows.map(function (run, index) {
        return {
          method: OPTIMISER_LABELS[index] || run.method,
          iterations: run.iterations, objective: run.objective,
          converged: run.converged, diverged: run.diverged,
          monotone: run.monotone, increases: run.increases,
          evaluations: run.evaluations,
          distance: Math.hypot(run.x[0] - problem.minimum[0], run.x[1] - problem.minimum[1]),
          path: run.history.map(function (point) {
            return { x: point.x[0], y: point.x[1], objective: point.objective };
          })
        };
      })
    };
  }

  /** Fixed steps either side of the stability limit, so divergence is a row
   *  rather than a warning. */
  function stepStability(options) {
    const settings = options || {};
    const problem = Opt.surfaceFor(settings.surface || 'valley');
    const limit = Opt.stableStep(problem);

    return (settings.multiples || [0.5, 0.9, 1.0, 1.1, 2.0]).map(function (multiple) {
      const run = Opt.gradientDescent(problem, settings.start || [1, 1],
        { step: limit * multiple, tolerance: 1e-8, limit: 20000 });
      return { multiple: multiple, step: limit * multiple, iterations: run.iterations,
        objective: run.objective, converged: run.converged, diverged: run.diverged };
    });
  }

  /** Iterations against the condition number, for gradient descent and for
   *  Newton - the demonstration that one is affine invariant and one is not. */
  function conditionStudy(options) {
    const settings = options || {};

    return (settings.conditions || [1, 3, 10, 30, 100, 300, 1000]).map(function (condition) {
      const problem = Opt.quadratic(condition);
      const descent = Opt.gradientDescent(problem, [1, 1],
        { lineSearch: true, tolerance: 1e-8, limit: 40000 });
      const newton = Opt.newtonMethod(problem, [1, 1], { tolerance: 1e-10, limit: 100 });

      return { condition: condition, descent: descent.iterations, newton: newton.iterations,
        stableStep: Opt.stableStep(problem) };
    });
  }

  /** Coordinate descent aligned with the axes and rotated off them. */
  function coordinateStudy(options) {
    const settings = options || {};

    return [
      { id: 'aligned', label: 'axis-aligned valley', problem: Opt.quadratic(20) },
      { id: 'rotated', label: 'the same valley, rotated 45°',
        problem: Opt.rotatedQuadratic(20, Math.PI / 4) }
    ].map(function (entry) {
      const run = Opt.coordinateDescent(entry.problem, settings.start || [1, 1],
        { tolerance: 1e-12, limit: 500 });
      return { id: entry.id, label: entry.label, iterations: run.iterations,
        objective: run.objective, evaluations: run.evaluations, converged: run.converged };
    });
  }

  /** A contour grid for the plot. */
  function surfaceGrid(id, options) {
    const settings = options || {};
    const problem = Opt.surfaceFor(id);
    const size = settings.size || 48;
    const span = settings.span || 2;
    const rows = [];

    for (let r = 0; r < size; r += 1) {
      const row = [];
      for (let c = 0; c < size; c += 1) {
        const x = -span + 2 * span * (c / (size - 1));
        const y = -span + 2 * span * (r / (size - 1));
        row.push(problem.f([x, y]));
      }
      rows.push(row);
    }
    return { values: rows, span: span, size: size, minimum: problem.minimum };
  }

  return {
    TARGETS: TARGETS,
    targetFor: targetFor,
    nodeSweep: nodeSweep,
    interpolationCurves: interpolationCurves,
    overshootStudy: overshootStudy,
    stepStudy: stepStudy,
    quadratureRace: quadratureRace,
    gaussExactness: gaussExactness,
    autodiffRace: autodiffRace,
    tapeGraph: tapeGraph,
    orderTable: orderTable,
    orbitStudy: orbitStudy,
    stiffnessStudy: stiffnessStudy,
    transformRace: transformRace,
    roundTripStudy: roundTripStudy,
    spectrumRun: spectrumRun,
    leakageStudy: leakageStudy,
    aliasTable: aliasTable,
    convolutionRace: convolutionRace,
    optimiserRace: optimiserRace,
    stepStability: stepStability,
    conditionStudy: conditionStudy,
    coordinateStudy: coordinateStudy,
    surfaceGrid: surfaceGrid
  };
}));
