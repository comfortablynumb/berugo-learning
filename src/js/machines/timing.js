/**
 * Timing - what a clock frequency actually is, and where it goes.
 *
 * A synchronous circuit is a set of combinational paths BETWEEN registers, and
 * the clock period has to be long enough for the slowest of them plus the
 * flip-flop's own overhead: the time from a clock edge to its output changing,
 * and the time its input must be stable before the next edge. So
 *
 *     period >= clock-to-Q + longest combinational path + setup
 *
 * and everything anybody does to make a chip faster is an attack on one of
 * those three terms. Pipelining attacks the middle one by cutting the path in
 * half and paying the other two again, which is why it has diminishing returns
 * and why the returns stop entirely once the overhead dominates.
 *
 * The path analysis here is the one a static timing analyser does: four
 * classes of path - input to register, register to register, register to
 * output, and straight through - because a design can be limited by any of
 * them and only the second is what people mean by "the critical path".
 *
 * Power is estimated rather than measured, from the one thing this simulator
 * really knows: how many times each wire changed. Dynamic power is
 * proportional to activity times frequency, which is why clock gating (stop
 * the activity) and frequency scaling (stop the f) are the two levers, and why
 * a circuit that computes the same answer with less switching is cheaper even
 * though it is the same size.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Timing = api;
}(this, function (root) {
  'use strict';

  const Sim = root && root.LogicSim ? root.LogicSim : require('./logic-sim.js');

  const DEFAULTS = { clockToQ: 2, setup: 1, hold: 1, unit: 'ps' };

  function isStart(node) {
    return node.type === 'input' || node.type === 'dff';
  }

  /**
   * Longest combinational delay from every start point, where a start point is
   * an input or a flip-flop output and a path ENDS at an input of a flip-flop
   * or at an output. A flip-flop is a wall in both directions, which is the
   * whole reason a pipeline register shortens the critical path.
   */
  function forwardDelays(net, origin) {
    const depth = {};
    const from = {};

    net.order.forEach(function (id) {
      const node = net.nodes[id];

      if (isStart(node)) {
        depth[id] = id === origin ? 0 : null;
        from[id] = null;
        return;
      }
      let best = null;

      node.inputs.forEach(function (source) {
        if (source === null || depth[source] === null || depth[source] === undefined) return;
        if (best === null || depth[source] > depth[best]) best = source;
      });
      depth[id] = best === null ? null : depth[best] + node.delay;
      from[id] = best;
    });
    return { depth: depth, from: from };
  }

  function pathTo(net, from, id) {
    const path = [];
    const seen = {};
    let at = id;

    while (at !== null && at !== undefined && !seen[at]) {
      seen[at] = true;
      path.unshift({ id: at, label: net.nodes[at].label, type: net.nodes[at].type,
        delay: net.nodes[at].delay });
      at = from[at];
    }
    return path;
  }

  function endpointsOf(net) {
    const ends = [];

    net.order.forEach(function (id) {
      const node = net.nodes[id];

      if (node.type !== 'dff') return;
      if (node.inputs[0] !== null) ends.push({ id: node.inputs[0], kind: 'register', at: id });
    });
    net.outputs.forEach(function (row) {
      ends.push({ id: row.id, kind: 'output', at: row.label });
    });
    return ends;
  }

  function classOf(net, origin, kind) {
    const start = net.nodes[origin].type === 'dff' ? 'register' : 'input';

    return start + ' to ' + kind;
  }

  /**
   * Every path class, with the worst path in each. The register-to-register
   * class is the one that sets the clock period; the others set the
   * constraints on whatever is on the other side of the chip boundary, and a
   * design limited by one of them cannot be fixed by pipelining inside.
   */
  function paths(net) {
    const ends = endpointsOf(net);
    const worst = {};

    net.order.forEach(function (id) {
      if (!isStart(net.nodes[id])) return;
      const reach = forwardDelays(net, id);

      ends.forEach(function (end) {
        const delay = reach.depth[end.id];

        if (delay === null || delay === undefined) return;
        const key = classOf(net, id, end.kind);

        if (worst[key] && worst[key].delay >= delay) return;
        worst[key] = { delay: delay, from: net.nodes[id].label, to: end.at, kind: key,
          path: pathTo(net, reach.from, end.id) };
      });
    });
    return worst;
  }

  function longestOf(worst) {
    return Object.keys(worst).reduce(function (best, key) {
      return best === null || worst[key].delay > best.delay ? worst[key] : best;
    }, null);
  }

  /**
   * The clock period and what it is made of. `slack` is the headroom against a
   * target period, and a negative slack is the number every timing report
   * exists to show you.
   */
  function frequency(net, options) {
    const settings = Object.assign({}, DEFAULTS, options || {});
    const worst = paths(net);
    const register = worst['register to register'];
    const logic = register ? register.delay : (longestOf(worst) || { delay: 0 }).delay;
    const period = settings.clockToQ + logic + settings.setup;

    return { period: period, logic: logic, clockToQ: settings.clockToQ,
      setup: settings.setup, overhead: settings.clockToQ + settings.setup,
      limitedBy: register ? 'register to register' : (longestOf(worst) || {}).kind,
      slack: settings.target === undefined ? null : settings.target - period,
      worst: worst, critical: register || longestOf(worst) };
  }

  /**
   * What pipelining buys, and where it stops buying. Cutting a path of length
   * L into k stages leaves L/k of logic per stage, and every stage pays the
   * flip-flop overhead again - so the period tends to the overhead and the
   * speedup tends to a constant no matter how many registers are added.
   */
  function pipelineEstimate(logic, stages, options) {
    const settings = Object.assign({}, DEFAULTS, options || {});
    const overhead = settings.clockToQ + settings.setup;
    const rows = [];

    for (let depth = 1; depth <= stages; depth += 1) {
      const period = Math.ceil(logic / depth) + overhead;

      rows.push({ stages: depth, period: period, latency: period * depth,
        throughput: 1 / period, speedup: (Math.ceil(logic) + overhead) / period });
    }
    return { rows: rows, overhead: overhead,
      ceiling: (Math.ceil(logic) + overhead) / overhead };
  }

  /* ------------------------------------------------------------- power */

  /**
   * Dynamic power is proportional to how often wires change, so the activity
   * count from a real simulation is the honest proxy. A glitch is switching
   * that computes nothing and costs the same as switching that does, which is
   * why the hazard-free version of a circuit is cheaper to run as well as
   * safer to use asynchronously.
   */
  function activity(net, transitions) {
    let changes = 0;
    let wasted = 0;

    transitions.forEach(function (pair) {
      const run = Sim.transition(net, pair[0], pair[1], { record: false });

      Object.keys(run.changes).forEach(function (id) {
        changes += run.changes[id];
        if (run.changes[id] > 1) wasted += run.changes[id] - 1;
      });
    });
    return { changes: changes, wasted: wasted, transitions: transitions.length,
      perTransition: transitions.length ? changes / transitions.length : 0,
      wastedShare: changes ? wasted / changes : 0 };
  }

  /**
   * The power equation, as a comparison rather than as an absolute. Dynamic
   * power goes as activity x capacitance x voltage squared x frequency, and
   * the square on the voltage is the entire reason the industry stopped
   * raising frequency and started adding cores.
   */
  function power(options) {
    const settings = options || {};
    const activityFactor = settings.activity === undefined ? 1 : settings.activity;
    const voltage = settings.voltage === undefined ? 1 : settings.voltage;
    const frequencyValue = settings.frequency === undefined ? 1 : settings.frequency;
    const leakage = settings.leakage === undefined ? 0.2 : settings.leakage;

    return { dynamic: activityFactor * voltage * voltage * frequencyValue,
      leakage: leakage * voltage,
      total: activityFactor * voltage * voltage * frequencyValue + leakage * voltage };
  }

  /** Two designs at equal throughput: one core at f, or two at f/2 with the
   *  voltage lowered — which is the multicore argument in one calculation. */
  function scaling(options) {
    const settings = options || {};
    const cores = settings.cores || 2;
    const single = power({ activity: 1, voltage: 1, frequency: 1, leakage: settings.leakage });
    const lowered = Math.pow(1 / cores, settings.exponent === undefined ? 1 : settings.exponent);
    const many = power({ activity: cores, voltage: lowered, frequency: 1 / cores,
      leakage: settings.leakage });

    return { single: single, many: many, cores: cores, voltage: lowered,
      ratio: many.total / single.total };
  }

  return { DEFAULTS: DEFAULTS, paths: paths, longestOf: longestOf,
    forwardDelays: forwardDelays, frequency: frequency,
    pipelineEstimate: pipelineEstimate, activity: activity, power: power,
    scaling: scaling, endpointsOf: endpointsOf };
}));
