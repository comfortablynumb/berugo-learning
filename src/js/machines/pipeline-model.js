/**
 * PipelineModel - how deep is worth pipelining, as arithmetic.
 *
 * Cutting a fixed amount of logic into more stages shortens the clock and
 * lengthens nothing else - until you count the two things that do not divide.
 * The flip-flop overhead is paid once per stage whatever the stage contains,
 * so it grows with depth; and the branch penalty is measured in stages, so it
 * grows with depth too. Both push back, and the result is a curve with a peak
 * rather than a monotone gain.
 *
 * The model is deliberately small enough to check by hand:
 *
 *     period(k) = ceil(logic / k) + overhead
 *     penalty(k) = the stages between fetch and branch resolution
 *     CPI(k) = 1 + hazardStalls + branchRate x mispredictRate x penalty(k)
 *     time = instructions x CPI(k) x period(k)
 *
 * Its defaults come from the machine this curriculum built: 175 gate delays of
 * logic and 3 of flip-flop overhead, measured in M34.4.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.PipelineModel = api;
}(this, function () {
  'use strict';

  const DEFAULTS = {
    logic: 175,
    overhead: 3,
    resolveFraction: 0.8,
    instructions: 1000,
    branchRate: 0.25,
    mispredictRate: 0.12,
    hazardStalls: 0.15,
    latchShare: 0.1,
    from: 1,
    to: 40
  };

  function settingsFrom(options) {
    return Object.assign({}, DEFAULTS, options || {});
  }

  /** The clock period at a given depth: the logic divided, plus the overhead
   *  that does not divide. */
  function period(depth, options) {
    const settings = settingsFrom(options);

    return Math.ceil(settings.logic / Math.max(1, depth)) + settings.overhead;
  }

  /** How many instructions a mispredicted branch throws away. It is measured
   *  in stages, so it grows with depth - which is the trap: the thing that
   *  made the clock faster also made every mistake more expensive. */
  function penalty(depth, options) {
    const settings = settingsFrom(options);

    return Math.max(1, Math.round(depth * settings.resolveFraction));
  }

  function cpi(depth, options) {
    const settings = settingsFrom(options);

    return 1 + settings.hazardStalls +
      settings.branchRate * settings.mispredictRate * penalty(depth, settings);
  }

  /** Total time in gate delays, which is the only unit that lets two designs
   *  with different clocks be compared. */
  function timeAt(depth, options) {
    const settings = settingsFrom(options);

    return settings.instructions * cpi(depth, settings) * period(depth, settings);
  }

  /**
   * Power, relative rather than absolute - watts need a process and a
   * capacitance this model does not have. Dynamic power is switching activity
   * times frequency, and each pipeline register adds activity that computes
   * nothing, so the activity term grows with depth while the frequency term
   * grows with the clock the depth bought.
   */
  function power(depth, options) {
    const settings = settingsFrom(options);

    return (1 + settings.latchShare * depth) / period(depth, settings);
  }

  /**
   * Performance cubed per watt, which is the metric the pipeline-depth
   * literature uses and it is not arbitrary: performance per watt on its own
   * is maximised by an arbitrarily slow machine, because power falls faster
   * than speed does. Cubing performance is what stops the metric rewarding
   * doing nothing.
   */
  function efficiency(depth, options) {
    const settings = settingsFrom(options);
    const rate = 1 / timeAt(depth, settings);

    return Math.pow(rate, 3) / power(depth, settings);
  }

  function pointAt(depth, options) {
    const settings = settingsFrom(options);
    const p = period(depth, settings);

    return { depth: depth, period: p, frequency: 1 / p, cpi: cpi(depth, settings),
      penalty: penalty(depth, settings), time: timeAt(depth, settings),
      power: power(depth, settings), efficiency: efficiency(depth, settings),
      overheadShare: settings.overhead / p };
  }

  /** The whole curve, and the peak in it. A model that only reported the
   *  optimum would hide the shape, and the shape is the lesson: the curve is
   *  steep on the left and almost flat to the right of the peak, which is why
   *  a design that overshoots the optimum loses much less than one that
   *  undershoots it. */
  function curve(options) {
    const settings = settingsFrom(options);
    const from = settings.from || 1;
    const to = settings.to || 24;
    const points = [];

    for (let depth = from; depth <= to; depth += 1) points.push(pointAt(depth, settings));
    const best = points.reduce(function (winner, point) {
      return point.time < winner.time ? point : winner;
    }, points[0]);
    const green = points.reduce(function (winner, point) {
      return point.efficiency > winner.efficiency ? point : winner;
    }, points[0]);

    return { points: points, best: best, green: green, settings: settings,
      speedup: points[0].time / best.time,
      greenSpeedup: points[0].time / green.time };
  }

  /**
   * Two workloads, one machine. The optimum depth is not a property of the
   * pipeline: a workload with unpredictable branches wants a shallow one and a
   * workload with predictable branches can afford a deep one, and the same
   * silicon is right for one and wrong for the other.
   */
  const WORKLOADS = {
    predictable: { name: 'predictable branches', branchRate: 0.2, mispredictRate: 0.02,
      hazardStalls: 0.10,
      about: 'tight loops with a well-predicted exit — the case deep pipelines were built for' },
    branchy: { name: 'unpredictable branches', branchRate: 0.25, mispredictRate: 0.15,
      hazardStalls: 0.20,
      about: 'data-dependent decisions a predictor cannot learn' },
    memory: { name: 'memory bound', branchRate: 0.15, mispredictRate: 0.05,
      hazardStalls: 0.45,
      about: 'load-use everywhere; the clock is not what is limiting it' }
  };

  function compareWorkloads(options) {
    const settings = settingsFrom(options);

    return Object.keys(WORKLOADS).map(function (key) {
      const workload = WORKLOADS[key];
      const found = curve(Object.assign({}, settings, workload));

      return { key: key, name: workload.name, about: workload.about,
        best: found.best, speedup: found.speedup, curve: found };
    });
  }

  return { DEFAULTS: DEFAULTS, WORKLOADS: WORKLOADS, period: period, penalty: penalty,
    cpi: cpi, timeAt: timeAt, pointAt: pointAt, curve: curve,
    compareWorkloads: compareWorkloads };
}));
