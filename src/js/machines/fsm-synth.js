/**
 * FsmSynth - a state machine, synthesised into gates three different ways.
 *
 * The machine is data: states, an initial state, and a transition per state
 * per input value. Synthesis turns it into a state register plus two blocks of
 * combinational logic - one computing the next state, one computing the output
 * - and the interesting part is that the SAME machine produces very different
 * circuits depending on how the states are numbered.
 *
 * Three encodings are offered because the trade between them is the section:
 *
 * - **binary** uses ceil(log2(n)) flip-flops, the fewest possible, and pays
 *   for it with next-state logic that depends on all of them.
 * - **one-hot** uses one flip-flop per state, which is more area, and buys
 *   next-state logic where each bit depends on a handful of others - shorter
 *   paths, and a machine that is easy to read in a waveform.
 * - **Gray** numbers the states so that adjacent ones differ in one bit, which
 *   matters when the state bits leave the clock domain.
 *
 * Moore and Mealy are both here. A Moore output depends on the state alone and
 * therefore appears one cycle after the input that caused it; a Mealy output
 * depends on the state AND the input, so it appears in the same cycle and
 * follows the input's glitches. The demo shows both from one description,
 * which is the cleanest way to see that they accept the same language and
 * differ in timing.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.FsmSynth = api;
}(this, function (root) {
  'use strict';

  const Sim = root && root.LogicSim ? root.LogicSim : require('./logic-sim.js');
  const Min = root && root.BooleanMin ? root.BooleanMin : require('../algorithms/boolean-min.js');

  const ENCODINGS = [
    { id: 'binary', name: 'binary', about: 'the fewest flip-flops' },
    { id: 'onehot', name: 'one-hot', about: 'one flip-flop per state, shorter logic' },
    { id: 'gray', name: 'Gray', about: 'adjacent states differ in one bit' }
  ];

  /* ------------------------------------------------------------ encoding */

  function grayOf(index) {
    return index ^ (index >> 1);
  }

  function encode(machine, scheme) {
    const codes = {};
    const count = machine.states.length;

    if (scheme === 'onehot') {
      machine.states.forEach(function (state, at) { codes[state.name] = 1 << at; });
      return { bits: count, codes: codes, scheme: scheme };
    }
    const bits = Math.max(1, Math.ceil(Math.log2(count)));

    machine.states.forEach(function (state, at) {
      codes[state.name] = scheme === 'gray' ? grayOf(at) : at;
    });
    return { bits: bits, codes: codes, scheme: scheme };
  }

  /* ------------------------------------------------- the behavioural model */

  function transitionOf(machine, from, input) {
    return machine.transitions.filter(function (row) {
      return row.from === from && row.on === input;
    })[0] || null;
  }

  function stateOf(machine, name) {
    return machine.states.filter(function (row) { return row.name === name; })[0];
  }

  /**
   * Run the machine over an input string. A Moore output is read from the
   * state BEFORE the transition, which is what makes it lag; a Mealy output is
   * read from the transition itself.
   */
  function run(machine, input) {
    const trace = [];
    let current = machine.initial;
    let output = '';

    for (let at = 0; at < input.length; at += 1) {
      const bit = input[at] === '1' ? 1 : 0;
      const step = transitionOf(machine, current, bit);
      const emitted = machine.type === 'mealy'
        ? (step ? step.output : 0) : stateOf(machine, current).output;

      trace.push({ at: at, from: current, input: bit, to: step ? step.to : current,
        output: emitted });
      output += String(emitted);
      current = step ? step.to : current;
    }
    return { output: output, trace: trace, state: current };
  }

  /* ----------------------------------------------------------- synthesis */

  /**
   * The truth table for one next-state bit, over (state bits, input). Every
   * unreachable code is a DON'T-CARE, which is where a lot of the logic
   * saving comes from - and is also why an unreachable state can be entered on
   * power-up and never left, unless the reset covers it.
   */
  function nextStateTable(machine, coding, bit) {
    const minterms = [];
    const dontCares = [];
    const total = Math.pow(2, coding.bits + 1);

    for (let mask = 0; mask < total; mask += 1) {
      const input = mask & 1;
      const code = mask >> 1;
      const from = nameFor(coding, code);

      if (from === null) { dontCares.push(mask); continue; }
      const step = transitionOf(machine, from, input);
      const target = step ? coding.codes[step.to] : code;

      if ((target >> bit) & 1) minterms.push(mask);
    }
    return { minterms: minterms, dontCares: dontCares, bits: coding.bits + 1 };
  }

  function outputTable(machine, coding) {
    const minterms = [];
    const dontCares = [];
    const total = Math.pow(2, coding.bits + 1);

    for (let mask = 0; mask < total; mask += 1) {
      const input = mask & 1;
      const from = nameFor(coding, mask >> 1);

      if (from === null) { dontCares.push(mask); continue; }
      const step = transitionOf(machine, from, input);
      const value = machine.type === 'mealy'
        ? (step ? step.output : 0) : stateOf(machine, from).output;

      if (value) minterms.push(mask);
    }
    return { minterms: minterms, dontCares: dontCares, bits: coding.bits + 1 };
  }

  function nameFor(coding, code) {
    const names = Object.keys(coding.codes).filter(function (name) {
      return coding.codes[name] === code;
    });

    return names.length ? names[0] : null;
  }

  /**
   * Build the circuit: one flip-flop per state bit, the next-state logic
   * driving them, and the output logic beside it. The flip-flop data inputs
   * are left unconnected until the logic that feeds them exists, because the
   * logic reads the flip-flops - a state machine is a loop by definition.
   */
  function synthesise(machine, scheme) {
    const coding = encode(machine, scheme);
    const net = Sim.create(machine.name + ' (' + scheme + ')');
    const input = Sim.addInput(net, 'x');
    const clock = Sim.addInput(net, 'clk');
    const flops = [];

    for (let bit = 0; bit < coding.bits; bit += 1) {
      flops.push(Sim.addGate(net, 'dff', [null, clock]));
      Sim.setInitial(net, flops[bit], (coding.codes[machine.initial] >> bit) & 1);
    }
    flops.forEach(function (id, bit) {
      const table = nextStateTable(machine, coding, bit);

      Sim.connect(net, id, 0, buildLogic(net, table, flops, input));
      Sim.addOutput(net, 'q' + bit, id);
    });
    Sim.addOutput(net, 'y', buildLogic(net, outputTable(machine, coding), flops, input));
    return { net: net, coding: coding, machine: machine };
  }

  /**
   * Sum of products from a minimised cover. The variables are the state bits
   * (most significant first) and then the input, which is the order the truth
   * tables above are built in.
   */
  function buildLogic(net, table, flops, input) {
    const cover = Min.greedyCover(table.minterms, table.dontCares, table.bits);
    const sources = flops.slice().reverse().concat([input]);

    if (!cover.terms.length) return Sim.addNode(net, 'const0', []);
    const products = cover.terms.map(function (term) {
      return productOf(net, term, sources);
    });

    return orChain(net, products);
  }

  function productOf(net, term, sources) {
    let node = null;

    term.split('').forEach(function (ch, at) {
      if (ch === '-') return;
      const line = ch === '1' ? sources[at] : Sim.addGate(net, 'not', [sources[at]]);

      node = node === null ? line : Sim.addGate(net, 'and', [node, line]);
    });
    return node === null ? Sim.addNode(net, 'const1', []) : node;
  }

  function orChain(net, nodes) {
    let level = nodes.slice();

    while (level.length > 1) {
      const next = [];

      for (let at = 0; at < level.length; at += 2) {
        next.push(at + 1 < level.length
          ? Sim.addGate(net, 'or', [level[at], level[at + 1]]) : level[at]);
      }
      level = next;
    }
    return level[0];
  }

  /* ------------------------------------------------------- the differential */

  /**
   * Drive the synthesised circuit with the same input string the behavioural
   * model saw, one clock cycle per character, and compare the outputs. This is
   * the check that makes "synthesis" mean something: a netlist that computes a
   * different language from the machine it was built from is not an encoding
   * choice, it is a bug.
   */
  function simulateMachine(built, input) {
    const output = [];
    let state = {};

    for (let at = 0; at < input.length; at += 1) {
      const values = { x: input[at] === '1' ? 1 : 0 };
      const step = Sim.cycle(built.net, values, state, 'clk');

      /* A Moore output depends on the state before the edge and a Mealy
         output on the state and the input, so both are read BEFORE the edge —
         which is exactly when a downstream register would sample them. */
      output.push(step.before.y);
      state = step.state;
    }
    return { output: output.join(''), state: state };
  }

  function compare(machine, scheme, inputs) {
    const built = synthesise(machine, scheme);
    const rows = inputs.map(function (input) {
      const wanted = run(machine, input).output;
      const got = simulateMachine(built, input).output;

      return { input: input, wanted: wanted, got: got, ok: wanted === got };
    });

    return { built: built, rows: rows,
      mismatches: rows.filter(function (row) { return !row.ok; }),
      flops: built.coding.bits, gates: Sim.gateCount(built.net),
      delay: Sim.criticalPath(built.net).delay };
  }

  /** Every input string of a given length, which for a small machine is the
   *  whole behaviour rather than a sample of it. */
  function allInputs(length) {
    const out = [];

    for (let mask = 0; mask < Math.pow(2, length); mask += 1) {
      let text = '';

      for (let at = length - 1; at >= 0; at -= 1) text += (mask >> at) & 1;
      out.push(text);
    }
    return out;
  }

  /* ---------------------------------------------------------- a fixture */

  /** The classic: a detector for the sequence 1101, as a Moore machine and as
   *  a Mealy machine over the same states. */
  function sequenceDetector(type) {
    const moore = type !== 'mealy';

    return { name: '1101 detector, ' + (moore ? 'Moore' : 'Mealy'),
      type: moore ? 'moore' : 'mealy', initial: 'start',
      states: [
        { name: 'start', output: 0 }, { name: 'one', output: 0 },
        { name: 'oneOne', output: 0 }, { name: 'oneOneZero', output: 0 },
        { name: 'found', output: moore ? 1 : 0 }
      ],
      transitions: mooreTransitions(moore) };
  }

  function mooreTransitions(moore) {
    return [
      { from: 'start', on: 1, to: 'one', output: 0 },
      { from: 'start', on: 0, to: 'start', output: 0 },
      { from: 'one', on: 1, to: 'oneOne', output: 0 },
      { from: 'one', on: 0, to: 'start', output: 0 },
      { from: 'oneOne', on: 1, to: 'oneOne', output: 0 },
      { from: 'oneOne', on: 0, to: 'oneOneZero', output: 0 },
      { from: 'oneOneZero', on: 1, to: moore ? 'found' : 'one', output: moore ? 0 : 1 },
      { from: 'oneOneZero', on: 0, to: 'start', output: 0 },
      { from: 'found', on: 1, to: 'oneOne', output: 0 },
      { from: 'found', on: 0, to: 'oneOneZero', output: 0 }
    ];
  }

  return { ENCODINGS: ENCODINGS, encode: encode, grayOf: grayOf, run: run,
    nextStateTable: nextStateTable, outputTable: outputTable, nameFor: nameFor,
    synthesise: synthesise, simulateMachine: simulateMachine, compare: compare,
    allInputs: allInputs, sequenceDetector: sequenceDetector,
    transitionOf: transitionOf, stateOf: stateOf };
}));
