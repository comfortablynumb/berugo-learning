/**
 * Integrators for initial-value problems, and the distinction that decides
 * which one a simulation wants: accuracy over one step against structure over
 * a million.
 *
 * The headline result is that a *more accurate* integrator makes an orbit
 * decay. RK4 has fourth-order local error and Verlet has second-order, so on
 * any single step RK4 is far closer to the truth - and over a hundred thousand
 * steps the RK4 orbit spirals inwards while the Verlet orbit holds its energy
 * and merely precesses. The reason is that Verlet is *symplectic*: it exactly
 * conserves a quantity close to the true energy, so its error oscillates
 * rather than accumulating, while RK4's error is smaller per step and has a
 * direction. Games use Verlet for that reason and not because anyone thinks it
 * is more accurate.
 *
 * The other result is stiffness. A stiff system has components decaying on
 * wildly different timescales, and an explicit method's step size is bounded
 * by the FASTEST of them even after that component has died away to nothing.
 * `stabilityLimit` computes that bound so the demo shows an explicit method
 * taking absurdly many steps to integrate something that stopped moving.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.OdeSolvers = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function addScaled(state, direction, factor) {
    const out = new Float64Array(state.length);
    for (let i = 0; i < state.length; i += 1) out[i] = state[i] + factor * direction[i];
    return out;
  }

  /* -------------------------------------------------------- explicit */

  /** Explicit Euler: one derivative evaluation, first-order error, and the
   *  baseline everything else is measured against. */
  function euler(f, state, t, h) {
    return { state: addScaled(state, f(t, state), h), evaluations: 1 };
  }

  /** Midpoint: evaluate at the half step and use that slope for the whole
   *  one. Second order for two evaluations. */
  function midpoint(f, state, t, h) {
    const k1 = f(t, state);
    const k2 = f(t + h / 2, addScaled(state, k1, h / 2));
    return { state: addScaled(state, k2, h), evaluations: 2 };
  }

  /**
   * Classical RK4: four slopes, weighted 1/6, 1/3, 1/3, 1/6. Fourth-order
   * local error for four evaluations, which is the best ratio of any explicit
   * method at this order and the reason it is the default.
   */
  function rk4(f, state, t, h) {
    const k1 = f(t, state);
    const k2 = f(t + h / 2, addScaled(state, k1, h / 2));
    const k3 = f(t + h / 2, addScaled(state, k2, h / 2));
    const k4 = f(t + h, addScaled(state, k3, h));

    const out = new Float64Array(state.length);
    for (let i = 0; i < state.length; i += 1) {
      out[i] = state[i] + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    }
    return { state: out, evaluations: 4 };
  }

  /**
   * Velocity Verlet, for second-order systems where the acceleration depends
   * on position alone. Second-order and symplectic: the position update uses
   * the current acceleration and the velocity update averages the old and new
   * ones, which is what makes the scheme time-reversible - and time-reversible
   * is what makes the energy error bounded instead of drifting.
   */
  function velocityVerlet(acceleration, state, t, h) {
    const half = state.length / 2;
    const position = state.slice(0, half);
    const velocity = state.slice(half);
    const a0 = acceleration(t, position);

    const nextPosition = new Float64Array(half);
    for (let i = 0; i < half; i += 1) {
      nextPosition[i] = position[i] + velocity[i] * h + 0.5 * a0[i] * h * h;
    }
    const a1 = acceleration(t + h, nextPosition);
    const out = new Float64Array(state.length);
    for (let i = 0; i < half; i += 1) {
      out[i] = nextPosition[i];
      out[half + i] = velocity[i] + 0.5 * (a0[i] + a1[i]) * h;
    }
    return { state: out, evaluations: 2 };
  }

  /** Leapfrog in kick-drift-kick form: the same scheme as velocity Verlet,
   *  written the way a physics engine stages it. */
  function leapfrog(acceleration, state, t, h) {
    return velocityVerlet(acceleration, state, t, h);
  }

  /* --------------------------------------------------------- integration */

  const METHODS = [
    { id: 'euler', label: 'explicit Euler', order: 1, symplectic: false, step: euler },
    { id: 'midpoint', label: 'midpoint', order: 2, symplectic: false, step: midpoint },
    { id: 'rk4', label: 'RK4', order: 4, symplectic: false, step: rk4 },
    { id: 'verlet', label: 'velocity Verlet', order: 2, symplectic: true, step: null }
  ];

  function methodFor(id) {
    for (let i = 0; i < METHODS.length; i += 1) {
      if (METHODS[i].id === id) return METHODS[i];
    }
    return METHODS[2];
  }

  /**
   * Run a system to a horizon, sampling whatever the caller wants to watch.
   * `system` supplies `derivative` for the general methods and `acceleration`
   * for the symplectic ones, because Verlet needs the second-order structure
   * and cannot be handed a first-order right-hand side.
   */
  function integrate(system, options) {
    const settings = options || {};
    const method = methodFor(settings.method);
    const h = settings.step || 0.01;
    const steps = settings.steps || 1000;
    const sampleEvery = Math.max(1, Math.floor(steps / (settings.samples || 200)));

    let state = system.initial.slice();
    let t = 0;
    let evaluations = 0;
    const trail = [];

    for (let i = 0; i < steps; i += 1) {
      const advanced = method.symplectic
        ? velocityVerlet(system.acceleration, state, t, h)
        : method.step(system.derivative, state, t, h);
      state = advanced.state;
      evaluations += advanced.evaluations;
      t += h;
      if (i % sampleEvery === 0 || i === steps - 1) trail.push(sampleOf(system, state, t));
      if (!Number.isFinite(state[0])) break;
    }
    return { method: method.id, label: method.label, order: method.order,
      symplectic: method.symplectic, state: state, t: t, steps: steps,
      evaluations: evaluations, trail: trail };
  }

  function sampleOf(system, state, t) {
    const point = { t: t, state: Array.from(state) };
    if (system.energy) point.energy = system.energy(state);
    if (system.exact) {
      const truth = system.exact(t);
      let error = 0;
      for (let i = 0; i < truth.length; i += 1) {
        error = Math.max(error, Math.abs(state[i] - truth[i]));
      }
      point.error = error;
    }
    return point;
  }

  /**
   * Halve the step, measure the error, and read the order off the ratio: a
   * method of order p should improve by 2^p. This is the check that turns
   * "RK4 is fourth order" into a measurement, and it is also how an
   * implementation bug in the coefficients is caught - a wrong weight usually
   * drops the observed order without breaking anything visibly.
   */
  function orderStudy(system, options) {
    const settings = options || {};
    const method = settings.method || 'rk4';
    const horizon = settings.horizon || 1;
    const rows = [];

    for (let level = 0; level < (settings.levels || 6); level += 1) {
      const steps = (settings.baseSteps || 20) * Math.pow(2, level);
      const run = integrate(system, { method: method, step: horizon / steps,
        steps: steps, samples: 1 });
      const truth = system.exact(run.t);
      let error = 0;
      for (let i = 0; i < truth.length; i += 1) {
        error = Math.max(error, Math.abs(run.state[i] - truth[i]));
      }
      rows.push({ steps: steps, step: horizon / steps, error: error,
        evaluations: run.evaluations });
    }
    for (let i = 1; i < rows.length; i += 1) {
      const ratio = rows[i - 1].error / rows[i].error;
      rows[i].ratio = ratio;
      rows[i].observedOrder = Number.isFinite(ratio) && ratio > 0
        ? Math.log2(ratio) : null;
    }
    return rows;
  }

  /** How far the energy drifted, relative to where it started - the quantity
   *  that separates a symplectic integrator from an accurate one. */
  function energyDrift(run) {
    if (run.trail.length === 0 || run.trail[0].energy === undefined) return null;
    const first = run.trail[0].energy;
    let worst = 0;
    let last = first;
    run.trail.forEach(function (point) {
      worst = Math.max(worst, Math.abs(point.energy - first));
      last = point.energy;
    });
    return { initial: first, final: last, worst: worst,
      relativeFinal: Math.abs((last - first) / first),
      relativeWorst: worst / Math.abs(first) };
  }

  /* ------------------------------------------------------------ systems */

  /** A unit spring: the simplest system with an energy to conserve, and the
   *  one whose exact solution is a cosine. */
  function spring(options) {
    const settings = options || {};
    const k = settings.k || 1;
    const amplitude = settings.amplitude || 1;

    return {
      id: 'spring',
      initial: new Float64Array([amplitude, 0]),
      derivative: function (t, state) {
        return new Float64Array([state[1], -k * state[0]]);
      },
      acceleration: function (t, position) {
        return new Float64Array([-k * position[0]]);
      },
      energy: function (state) { return 0.5 * state[1] * state[1] + 0.5 * k * state[0] * state[0]; },
      exact: function (t) {
        const omega = Math.sqrt(k);
        return [amplitude * Math.cos(omega * t), -amplitude * omega * Math.sin(omega * t)];
      }
    };
  }

  /**
   * A two-body orbit in the plane, started on a circular orbit. The energy is
   * the quantity that decays under RK4 and holds under Verlet, and the orbit
   * radius is the visible consequence.
   */
  function orbit(options) {
    const settings = options || {};
    const mu = settings.mu || 1;
    const radius = settings.radius || 1;
    const speed = Math.sqrt(mu / radius) * (settings.eccentricity === undefined
      ? 1 : 1 - settings.eccentricity);

    return {
      id: 'orbit',
      initial: new Float64Array([radius, 0, 0, speed]),
      derivative: function (t, state) {
        const r = Math.hypot(state[0], state[1]);
        const factor = -mu / (r * r * r);
        return new Float64Array([state[2], state[3], factor * state[0], factor * state[1]]);
      },
      acceleration: function (t, position) {
        const r = Math.hypot(position[0], position[1]);
        const factor = -mu / (r * r * r);
        return new Float64Array([factor * position[0], factor * position[1]]);
      },
      energy: function (state) {
        const r = Math.hypot(state[0], state[1]);
        return 0.5 * (state[2] * state[2] + state[3] * state[3]) - mu / r;
      },
      radiusOf: function (state) { return Math.hypot(state[0], state[1]); }
    };
  }

  /**
   * A stiff linear system: two decaying modes whose rates differ by the
   * stiffness factor. After the fast mode has died the solution is smooth and
   * an explicit method still cannot take a large step, which is the whole
   * definition of stiffness.
   */
  function stiff(options) {
    const settings = options || {};
    const fast = settings.fast || 1000;
    const slow = settings.slow || 1;

    return {
      id: 'stiff',
      fast: fast,
      slow: slow,
      initial: new Float64Array([1, 1]),
      derivative: function (t, state) {
        return new Float64Array([-fast * state[0], -slow * state[1]]);
      },
      exact: function (t) { return [Math.exp(-fast * t), Math.exp(-slow * t)]; }
    };
  }

  /**
   * The largest step an explicit method can take on a linear problem before it
   * amplifies rather than damps. For Euler the stability region on the real
   * axis is |1 + hλ| ≤ 1, so h ≤ 2/|λ|; RK4's is about 2.785/|λ|. That bound
   * is set by the fastest mode and does not relax when that mode dies.
   */
  function stabilityLimit(rate, method) {
    const factors = { euler: 2, midpoint: 2, rk4: 2.785 };
    return (factors[method] || 2) / Math.abs(rate);
  }

  /**
   * The implicit Euler step for the stiff system, solved exactly because the
   * system is linear: x_{n+1} = x_n / (1 + hλ). Unconditionally stable, so the
   * step size is chosen by accuracy rather than by the fastest mode - which is
   * the entire reason implicit methods exist.
   */
  function implicitEulerStiff(system, options) {
    const settings = options || {};
    const h = settings.step || 0.1;
    const steps = settings.steps || 100;
    let state = system.initial.slice();
    const trail = [];

    for (let i = 0; i < steps; i += 1) {
      state = new Float64Array([state[0] / (1 + h * system.fast),
        state[1] / (1 + h * system.slow)]);
      if (i % Math.max(1, Math.floor(steps / 100)) === 0) {
        trail.push({ t: (i + 1) * h, state: Array.from(state) });
      }
    }
    const truth = system.exact(steps * h);
    return { method: 'implicit euler', state: state, steps: steps, trail: trail,
      error: Math.max(Math.abs(state[0] - truth[0]), Math.abs(state[1] - truth[1])) };
  }

  return {
    METHODS: METHODS,
    methodFor: methodFor,
    euler: euler,
    midpoint: midpoint,
    rk4: rk4,
    velocityVerlet: velocityVerlet,
    leapfrog: leapfrog,
    integrate: integrate,
    orderStudy: orderStudy,
    energyDrift: energyDrift,
    spring: spring,
    orbit: orbit,
    stiff: stiff,
    stabilityLimit: stabilityLimit,
    implicitEulerStiff: implicitEulerStiff
  };
}));
