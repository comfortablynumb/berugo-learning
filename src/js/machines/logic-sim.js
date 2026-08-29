/**
 * LogicSim - gates, wires, delays, and the two answers a circuit has.
 *
 * A combinational circuit has a FINAL value, which is what the truth table
 * says and what the next clock edge samples, and it has a HISTORY, which is
 * every value the wires took on the way there. Those are different objects and
 * conflating them is how a glitch becomes a mystery: the final value can be
 * right on every input combination while an output pulses low for two
 * nanoseconds in the middle of a transition, and only one of the two answers
 * shows it.
 *
 * So there are two evaluators here and they do not share code:
 *
 * - `evaluate` walks the netlist in dependency order with no notion of time.
 *   It is the reference: what the circuit computes.
 * - `simulate` is event-driven. Every gate has a propagation delay, an event
 *   is "this wire changes to this value at this time", and a change schedules
 *   the gates it feeds. It reports the settled values, the waveform, and how
 *   many times each wire changed - a wire that changes more than once per
 *   input transition has glitched.
 *
 * The two must agree on the settled value for every input combination, which
 * is the differential the tests run. Where they disagree, the simulator is
 * wrong or the circuit has a feedback loop that does not settle - and the
 * simulator reports that as a fact rather than looping forever.
 *
 * Flip-flops are in the same netlist rather than in a separate layer, because
 * the interesting failures - setup violations, transparency, races through a
 * latch - are exactly the ones that only exist when the storage element and
 * the logic around it are simulated on the same clock.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LogicSim = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /** Propagation delays in arbitrary units, chosen so the ratios are the ones
   *  a designer would recognise: an inverter is cheapest, a two-level gate
   *  costs more, and XOR is a three-gate structure inside. */
  const DELAY = { not: 1, nand: 1, nor: 1, and: 2, or: 2, xor: 3, xnor: 3,
    mux: 3, buf: 1, dff: 1, input: 0, const0: 0, const1: 0 };

  const ARITY = { not: 1, buf: 1, and: 2, or: 2, nand: 2, nor: 2, xor: 2, xnor: 2,
    mux: 3, dff: 2, input: 0, const0: 0, const1: 0 };

  /* --------------------------------------------------------- construction */

  function create(name) {
    return { name: name || 'circuit', nodes: {}, order: [], inputs: [], outputs: [],
      nextId: 0, initial: {} };
  }

  /**
   * The power-up value of a wire inside a feedback loop.
   *
   * A cross-coupled pair started with both outputs at zero is in its
   * FORBIDDEN state, and with identical gate delays it then oscillates
   * forever: both gates see 0 and 0, both go high, both then see the other
   * high and go low. That is a real property of the circuit rather than a bug
   * in the simulator - it is metastability - but a latch in a real chip
   * powers up in one of its two STABLE states, and a simulation has to pick
   * one to be simulating anything at all.
   */
  function setInitial(net, id, value) {
    net.initial[id] = value ? 1 : 0;
    return id;
  }

  function startValue(net, state, id) {
    if (state && state[id] !== undefined) return state[id] ? 1 : 0;
    return net.initial[id] === undefined ? 0 : net.initial[id];
  }

  function addNode(net, type, inputs, options) {
    const settings = options || {};
    const id = settings.id || (type === 'input' ? 'i' : 'n') + net.nextId;

    net.nextId += 1;
    /* `null` is a deliberately unconnected port, closed later by `connect`.
       That is the only way to build a latch: bistability IS a cycle, and a
       builder that insisted every input already exist could not express one. */
    (inputs || []).forEach(function (source) {
      if (source === null) return;
      if (!net.nodes[source]) throw new Error(net.name + ': unknown input ' + source);
    });
    net.nodes[id] = { id: id, type: type, inputs: (inputs || []).slice(),
      delay: settings.delay === undefined ? DELAY[type] : settings.delay,
      label: settings.label || id };
    net.order.push(id);
    if (type === 'input') net.inputs.push(id);
    return id;
  }

  function addInput(net, label) {
    return addNode(net, 'input', [], { label: label });
  }

  function addGate(net, type, inputs, options) {
    if (ARITY[type] === undefined) throw new Error('unknown gate type ' + type);
    if (ARITY[type] !== (inputs || []).length) {
      throw new Error(type + ' takes ' + ARITY[type] + ' inputs, got ' + (inputs || []).length);
    }
    return addNode(net, type, inputs, options);
  }

  /** Close a feedback loop. The netlist stops being a DAG at this point, so
   *  `evaluate` switches from one topological pass to bounded relaxation. */
  function connect(net, id, port, source) {
    if (!net.nodes[id] || !net.nodes[source]) {
      throw new Error(net.name + ': cannot connect ' + source + ' to ' + id);
    }
    net.nodes[id].inputs[port] = source;
    net.hasFeedback = true;
    return id;
  }

  function addOutput(net, label, id) {
    if (!net.nodes[id]) throw new Error(net.name + ': unknown output source ' + id);
    net.outputs.push({ label: label, id: id });
    return id;
  }

  /* ------------------------------------------------------- the reference */

  function gateValue(type, args) {
    if (type === 'not') return args[0] ? 0 : 1;
    if (type === 'buf') return args[0] ? 1 : 0;
    if (type === 'and') return args[0] && args[1] ? 1 : 0;
    if (type === 'or') return args[0] || args[1] ? 1 : 0;
    if (type === 'nand') return args[0] && args[1] ? 0 : 1;
    if (type === 'nor') return args[0] || args[1] ? 0 : 1;
    if (type === 'xor') return args[0] !== args[1] ? 1 : 0;
    if (type === 'xnor') return args[0] === args[1] ? 1 : 0;
    if (type === 'mux') return args[2] ? args[1] : args[0];
    if (type === 'const1') return 1;
    return 0;
  }

  /**
   * The zero-delay answer. Nodes are stored in construction order and a gate
   * may only name inputs that already exist, so construction order IS a
   * topological order - which is why this needs no sort and why a cycle is
   * impossible to build except through a flip-flop.
   */
  function evaluate(net, values, state) {
    if (net.hasFeedback) return relax(net, values, state).wires;
    const wires = {};

    net.order.forEach(function (id) {
      const node = net.nodes[id];

      if (node.type === 'input') { wires[id] = values[node.label] ? 1 : 0; return; }
      if (node.type === 'dff') { wires[id] = (state || {})[id] ? 1 : 0; return; }
      wires[id] = gateValue(node.type, node.inputs.map(function (source) {
        return wires[source];
      }));
    });
    return wires;
  }

  /**
   * A circuit with feedback has no topological order, so the zero-delay
   * reference becomes a fixpoint computation: start from the current state,
   * re-evaluate every gate, and repeat until nothing changes. A latch settles
   * in two or three rounds; a ring oscillator never does, and the report says
   * so rather than looping.
   */
  function relax(net, values, state, options) {
    const settings = options || {};
    const rounds = settings.rounds || 64;
    const wires = {};

    net.order.forEach(function (id) { wires[id] = startValue(net, state, id); });
    for (let round = 0; round < rounds; round += 1) {
      if (!relaxOnce(net, values, wires)) {
        return { wires: wires, settled: true, rounds: round + 1 };
      }
    }
    return { wires: wires, settled: false, rounds: rounds,
      why: 'no fixpoint within ' + rounds + ' rounds — the circuit oscillates' };
  }

  function relaxOnce(net, values, wires) {
    let changed = false;

    net.order.forEach(function (id) {
      const node = net.nodes[id];
      const before = wires[id];

      if (node.type === 'input') wires[id] = values[node.label] ? 1 : 0;
      else if (node.type !== 'dff') {
        wires[id] = gateValue(node.type, node.inputs.map(function (source) {
          return source === null ? 0 : wires[source];
        }));
      }
      if (wires[id] !== before) changed = true;
    });
    return changed;
  }

  function outputsOf(net, wires) {
    const out = {};

    net.outputs.forEach(function (row) { out[row.label] = wires[row.id]; });
    return out;
  }

  /**
   * Every input combination, evaluated. Exhaustive is the right answer here:
   * a combinational block with ten inputs has 1 024 rows, and hardware
   * verification is exhaustive where software testing samples.
   */
  function truthTable(net, options) {
    const settings = options || {};
    const limit = settings.limit || 14;

    if (net.inputs.length > limit) {
      return { rows: [], skipped: true, inputs: net.inputs.length };
    }
    const rows = [];
    const total = Math.pow(2, net.inputs.length);

    for (let mask = 0; mask < total; mask += 1) {
      const values = assignmentOf(net, mask);

      rows.push({ mask: mask, inputs: values,
        outputs: outputsOf(net, evaluate(net, values, settings.state)) });
    }
    return { rows: rows, skipped: false, inputs: net.inputs.length };
  }

  function assignmentOf(net, mask) {
    const values = {};

    net.inputs.forEach(function (id, at) {
      values[net.nodes[id].label] = (mask >> at) & 1;
    });
    return values;
  }

  /* ------------------------------------------------------- the simulator */

  function fanoutOf(net) {
    const map = {};

    net.order.forEach(function (id) { map[id] = []; });
    net.order.forEach(function (id) {
      net.nodes[id].inputs.forEach(function (source, port) {
        if (source === null) return;
        map[source].push({ id: id, port: port });
      });
    });
    return map;
  }

  function newRun(net, options) {
    const settings = options || {};

    return { time: 0, wires: {}, queue: [], history: [], changes: {},
      fanout: fanoutOf(net), horizon: settings.horizon || 5000,
      state: Object.assign({}, settings.state || {}), events: 0,
      record: settings.record !== false };
  }

  function schedule(run, id, value, at) {
    run.queue.push({ id: id, value: value, at: at });
  }

  function popEarliest(run) {
    let best = 0;

    for (let at = 1; at < run.queue.length; at += 1) {
      if (run.queue[at].at < run.queue[best].at) best = at;
    }
    return run.queue.splice(best, 1)[0];
  }

  function apply(net, run, event) {
    const previous = run.wires[event.id];

    run.time = Math.max(run.time, event.at);
    if (previous === event.value) return false;
    run.wires[event.id] = event.value;
    run.changes[event.id] = (run.changes[event.id] || 0) + 1;
    if (run.record) {
      run.history.push({ time: event.at, id: event.id,
        label: net.nodes[event.id].label, value: event.value });
    }
    return true;
  }

  function propagate(net, run, id) {
    run.fanout[id].forEach(function (sink) {
      const node = net.nodes[sink.id];

      if (node.type === 'dff') { stepFlop(net, run, node, sink.port); return; }
      const args = node.inputs.map(function (source) {
        return source === null ? 0 : (run.wires[source] || 0);
      });

      schedule(run, node.id, gateValue(node.type, args), run.time + node.delay);
    });
  }

  /**
   * A flip-flop samples on the RISING edge of its clock and ignores its data
   * input at every other moment. That single rule is the difference between a
   * flip-flop and a latch, and it is why a synchronous circuit tolerates
   * glitches: everything settles between edges and only the settled value is
   * captured.
   */
  function stepFlop(net, run, node, port) {
    const clock = run.wires[node.inputs[1]] || 0;
    const previous = run.state[node.id + ':clk'] || 0;

    run.state[node.id + ':clk'] = clock;
    if (port !== 1 || !(clock === 1 && previous === 0)) return;
    schedule(run, node.id, run.wires[node.inputs[0]] || 0, run.time + node.delay);
  }

  /**
   * Drive the inputs, then run until the queue empties or the horizon is
   * reached. A circuit that never settles is reported rather than looped on:
   * an oscillator is a legitimate thing to build by accident and the report
   * has to be able to say so.
   */
  function simulate(net, values, options) {
    const run = newRun(net, options);

    seed(net, run, values);
    drain(net, run);
    return report(net, run);
  }

  /**
   * Inputs take their new values immediately and every gate is scheduled once,
   * which is the only correct starting point for an event-driven run.
   *
   * Two wrong versions were tried first and both are instructive. Scheduling
   * the INPUTS as events and letting change-detection do the rest looks
   * right and leaves every gate whose inputs happen to match their initial
   * zero unevaluated - an SR latch with s = 1 and r = 0 came out holding
   * zero, because nothing ever asked the NOR gates what they thought.
   * Leaving the inputs undefined instead makes every input "change" on the
   * first event even when its value did not, which re-evaluates the whole
   * circuit and turns the glitch count into noise.
   */
  function seed(net, run, values) {
    net.order.forEach(function (id) {
      const node = net.nodes[id];

      run.wires[id] = node.type === 'input' ? (values[node.label] ? 1 : 0)
        : startValue(net, run.state, id);
    });
    net.order.forEach(function (id) {
      const node = net.nodes[id];

      if (node.type === 'input' || node.type === 'dff') return;
      schedule(run, id, gateValue(node.type, node.inputs.map(function (source) {
        return source === null ? 0 : run.wires[source];
      })), node.delay);
    });
  }

  /**
   * Settle at `before`, then move to `after` and watch. This is the only
   * honest way to count glitches: from a cold start every wire changes once
   * on the way to its first value, and calling that a glitch would report one
   * on every circuit ever built. A glitch is a wire that changes MORE THAN
   * ONCE while going from one settled state to another.
   */
  function transition(net, before, after, options) {
    const settled = simulate(net, before, Object.assign({ record: false }, options || {}));
    const moved = simulate(net, after,
      Object.assign({}, options || {}, { state: settled.wires }));

    const glitches = moved.glitches.map(function (id) {
      return { id: id, label: labelOf(net, id), changes: moved.changes[id],
        output: net.outputs.some(function (row) { return row.id === id; }) };
    });

    /* An internal wire that glitches is normal and usually harmless; an OUTPUT
       that glitches is what reaches the next stage, and in asynchronous logic
       it is what breaks. Reporting them separately is the difference between
       "this circuit has a hazard" and "this circuit has wires in it". */
    return { before: settled.outputs, after: moved.outputs, glitches: glitches,
      outputGlitches: glitches.filter(function (row) { return row.output; }),
      settleTime: moved.settleTime, history: moved.history, changes: moved.changes,
      stable: !glitches.some(function (row) { return row.output; }) };
  }

  function labelOf(net, id) {
    const named = net.outputs.filter(function (row) { return row.id === id; })[0];

    return named ? named.label : net.nodes[id].label;
  }

  function drain(net, run) {
    while (run.queue.length && run.events < run.horizon) {
      const event = popEarliest(run);

      run.events += 1;
      if (apply(net, run, event)) propagate(net, run, event.id);
    }
  }

  function report(net, run) {
    const glitched = Object.keys(run.changes).filter(function (id) {
      return run.changes[id] > 1;
    });

    return { wires: run.wires, outputs: outputsOf(net, run.wires),
      settleTime: run.time, events: run.events, history: run.history,
      changes: run.changes, glitches: glitched,
      settled: run.queue.length === 0,
      why: run.queue.length ? 'the circuit did not settle within ' + run.horizon + ' events'
        : 'every wire reached a stable value' };
  }

  /**
   * One clock cycle: drive the inputs with the clock low, then high, then low
   * again, keeping the flip-flop state across all three. Returning the state
   * rather than mutating the netlist is what lets a caller run the same
   * circuit from two different starting states.
   */
  function cycle(net, values, state, clockName) {
    const clock = clockName || 'clk';
    const low = Object.assign({}, values);
    const high = Object.assign({}, values);

    low[clock] = 0;
    high[clock] = 1;
    const before = simulate(net, low, { state: state, record: false });
    const rising = simulate(net, high, { state: before.wires, record: false });
    const after = simulate(net, low, { state: rising.wires, record: false });

    /* Two readings of the same cycle, and they are not the same answer. A
       read port sampled BEFORE the edge sees what was stored last cycle; the
       same port sampled after the edge sees what was just written. Which one
       a design gives you is the whole read-during-write question, and it is
       why a pipeline needs a forwarding path. */
    return { outputs: after.outputs, before: before.outputs, after: after.outputs,
      state: after.wires,
      settleTime: before.settleTime + rising.settleTime + after.settleTime };
  }

  /* ------------------------------------------------ structural measurement */

  function gateCount(net) {
    return net.order.filter(function (id) {
      const type = net.nodes[id].type;

      return type !== 'input' && type !== 'const0' && type !== 'const1';
    }).length;
  }

  /**
   * The critical path: the longest delay from any input to any output, and
   * the path itself. A flip-flop ends a path rather than continuing it, which
   * is what makes pipelining shorten the critical path at all.
   */
  function criticalPath(net) {
    const depth = {};
    const from = {};

    net.order.forEach(function (id) {
      const node = net.nodes[id];

      if (node.type === 'input' || node.type === 'dff' || !node.inputs.length) {
        depth[id] = node.type === 'input' ? 0 : node.delay;
        from[id] = null;
        return;
      }
      let best = null;

      /* A source with no depth yet is a BACK EDGE - the netlist has a
         feedback loop and this is where it closes. Timing analysis cuts the
         loop there, exactly as it cuts at a flip-flop, because a path that
         goes round a loop is not a path. Following it instead walks the cycle
         for ever, which is what the first version of this did. */
      node.inputs.forEach(function (source) {
        if (source === null || depth[source] === undefined) return;
        if (best === null || depth[source] > depth[best]) best = source;
      });
      depth[id] = (best === null ? 0 : depth[best]) + node.delay;
      from[id] = best;
    });
    return longestOutput(net, depth, from);
  }

  function longestOutput(net, depth, from) {
    let worst = null;

    net.outputs.forEach(function (row) {
      if (worst === null || depth[row.id] > depth[worst.id]) worst = row;
    });
    if (!worst) return { delay: 0, path: [], output: null };
    const path = [];
    const seen = {};
    let at = worst.id;

    while (at !== null && at !== undefined && !seen[at]) {
      seen[at] = true;
      path.unshift({ id: at, label: net.nodes[at].label, type: net.nodes[at].type,
        delay: net.nodes[at].delay });
      at = from[at];
    }
    return { delay: depth[worst.id], path: path, output: worst.label, depth: depth };
  }

  return { DELAY: DELAY, ARITY: ARITY,
    create: create, addInput: addInput, addGate: addGate, addOutput: addOutput,
    connect: connect, relax: relax, setInitial: setInitial,
    startValue: startValue,
    addNode: addNode, gateValue: gateValue,
    evaluate: evaluate, outputsOf: outputsOf, truthTable: truthTable,
    assignmentOf: assignmentOf, simulate: simulate, transition: transition,
    cycle: cycle,
    gateCount: gateCount, criticalPath: criticalPath, fanoutOf: fanoutOf };
}));
