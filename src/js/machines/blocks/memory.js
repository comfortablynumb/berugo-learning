/**
 * Storage, built from the same gates as everything else.
 *
 * The whole of sequential logic starts with one observation: two NOR gates
 * wired into each other's inputs have two stable states, and which one they
 * are in is a bit of memory. Everything above - the D latch, the
 * edge-triggered flip-flop, the register, the register file - is that loop
 * with progressively more discipline about WHEN it may change.
 *
 * The three levels are all here because the difference between them is the
 * thing that matters:
 *
 * - an **SR latch** stores a bit and has a forbidden input combination;
 * - a **D latch** removes the forbidden state and is TRANSPARENT: while the
 *   enable is high the output follows the input, so a signal can race through
 *   it and reach the next stage in the same clock phase;
 * - a **master-slave D flip-flop** is two D latches on opposite clock phases,
 *   so the value is captured at the edge and nothing is ever transparent from
 *   input to output. That is what makes synchronous design work.
 *
 * The register file at the end answers the question M35's forwarding network
 * exists for: what a read port returns when it names the register being
 * written in the same cycle.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Blocks = scope.Blocks || {};
    scope.Blocks.Memory = api;
  }
}(this, function (root) {
  'use strict';

  const Sim = root && root.LogicSim ? root.LogicSim : require('../logic-sim.js');
  const Select = root && root.Blocks && root.Blocks.Select
    ? root.Blocks.Select : require('./select.js');

  /* ------------------------------------------------------------ latches */

  /** Two cross-coupled NOR gates. `set` forces q high, `reset` forces it low,
   *  both low holds, and both high is the forbidden state where q and its
   *  complement are equal. */
  function srLatch(net, set, reset) {
    const q = Sim.addGate(net, 'nor', [reset, null]);
    const notQ = Sim.addGate(net, 'nor', [set, q]);

    Sim.connect(net, q, 1, notQ);
    /* Power up in a stable state rather than in the forbidden one. Both
       outputs at zero is the state a symmetric pair oscillates from forever,
       which is a true statement about the circuit and a useless starting
       point for simulating it. */
    Sim.setInitial(net, q, 0);
    Sim.setInitial(net, notQ, 1);
    return { q: q, notQ: notQ };
  }

  /** A D latch: one data input, one enable, and no forbidden combination —
   *  at the price of transparency while the enable is high. */
  function dLatch(net, data, enable) {
    const notData = Sim.addGate(net, 'not', [data]);
    const set = Sim.addGate(net, 'and', [data, enable]);
    const reset = Sim.addGate(net, 'and', [notData, enable]);

    return srLatch(net, set, reset);
  }

  /**
   * Master-slave: the master follows while the clock is LOW and holds when it
   * rises; the slave holds while the clock is low and follows when it rises.
   * The value that appears at q is therefore the one that was at d at the
   * moment of the rising edge, and no path is ever transparent all the way
   * through.
   */
  function dFlipFlop(net, data, clock) {
    const notClock = Sim.addGate(net, 'not', [clock]);
    const master = dLatch(net, data, notClock);
    const slave = dLatch(net, master.q, clock);

    return { q: slave.q, notQ: slave.notQ, master: master.q };
  }

  function latchCircuit(kind) {
    const net = Sim.create(kind === 'sr' ? 'SR latch' : (kind === 'd' ? 'D latch'
      : 'master-slave D flip-flop'));

    if (kind === 'sr') {
      const set = Sim.addInput(net, 's');
      const reset = Sim.addInput(net, 'r');
      const cell = srLatch(net, set, reset);

      Sim.addOutput(net, 'q', cell.q);
      Sim.addOutput(net, 'nq', cell.notQ);
      return net;
    }
    const data = Sim.addInput(net, 'd');
    const control = Sim.addInput(net, kind === 'd' ? 'en' : 'clk');
    const cell = kind === 'd' ? dLatch(net, data, control) : dFlipFlop(net, data, control);

    Sim.addOutput(net, 'q', cell.q);
    Sim.addOutput(net, 'nq', cell.notQ);
    if (cell.master !== undefined) Sim.addOutput(net, 'master', cell.master);
    return net;
  }

  /* ---------------------------------------------------------- registers */

  /** n flip-flops sharing a clock, with a write enable that recirculates the
   *  old value when it is low — which is how a register keeps its contents
   *  without gating the clock. */
  function registerBits(net, data, clock, enable, width) {
    const bits = [];

    for (let at = 0; at < width; at += 1) {
      const hold = Sim.addGate(net, 'buf', [data[at]]);
      const chosen = Sim.addGate(net, 'mux', [null, hold, enable]);
      const cell = dFlipFlop(net, chosen, clock);

      Sim.connect(net, chosen, 0, cell.q);
      bits.push(cell.q);
    }
    return bits;
  }

  function register(options) {
    const settings = options || {};
    const width = settings.width || 4;
    const net = Sim.create(width + '-bit register');
    const data = [];

    for (let at = 0; at < width; at += 1) data.push(Sim.addInput(net, 'd' + at));
    const clock = Sim.addInput(net, 'clk');
    const enable = Sim.addInput(net, 'we');
    const bits = registerBits(net, data, clock, enable, width);

    bits.forEach(function (id, at) { Sim.addOutput(net, 'q' + at, id); });
    return net;
  }

  /* ------------------------------------------------------ register file */

  /**
   * A register file with two read ports and one write port, which is the
   * shape every three-operand instruction set needs. The write port is a
   * decoder ANDed with the write enable; each read port is a multiplexer tree
   * over the registers, and its depth is what the decoder-versus-mux
   * comparison in the memory section measures.
   */
  function registerFile(options) {
    const settings = options || {};
    const width = settings.width || 4;
    const count = settings.count || 4;
    const bits = Math.log2(count);
    const net = Sim.create(count + ' x ' + width + '-bit register file');
    const ports = filePorts(net, width, bits);
    const rows = [];

    for (let index = 0; index < count; index += 1) {
      const selected = decodeMatch(net, ports.writeAddress, index, bits);
      const enable = Sim.addGate(net, 'and', [selected, ports.writeEnable]);

      rows.push(registerBits(net, ports.data, ports.clock, enable, width));
    }
    readPort(net, rows, ports.readA, bits, width, 'x');
    readPort(net, rows, ports.readB, bits, width, 'y');
    return net;
  }

  function filePorts(net, width, bits) {
    const data = [];
    const readA = [];
    const readB = [];
    const writeAddress = [];

    for (let at = 0; at < width; at += 1) data.push(Sim.addInput(net, 'd' + at));
    for (let at = 0; at < bits; at += 1) readA.push(Sim.addInput(net, 'ra' + at));
    for (let at = 0; at < bits; at += 1) readB.push(Sim.addInput(net, 'rb' + at));
    for (let at = 0; at < bits; at += 1) writeAddress.push(Sim.addInput(net, 'wa' + at));
    return { data: data, readA: readA, readB: readB, writeAddress: writeAddress,
      writeEnable: Sim.addInput(net, 'we'), clock: Sim.addInput(net, 'clk') };
  }

  /** One AND term per register: the decoder, unrolled. */
  function decodeMatch(net, address, index, bits) {
    let node = null;

    for (let at = 0; at < bits; at += 1) {
      const line = (index >> at) & 1 ? address[at] : Sim.addGate(net, 'not', [address[at]]);

      node = node === null ? line : Sim.addGate(net, 'and', [node, line]);
    }
    return node === null ? Sim.addNode(net, 'const1', []) : node;
  }

  function readPort(net, rows, address, bits, width, prefix) {
    for (let bit = 0; bit < width; bit += 1) {
      let level = rows.map(function (row) { return row[bit]; });

      for (let stage = 0; stage < bits; stage += 1) {
        const next = [];

        for (let pair = 0; pair < level.length; pair += 2) {
          next.push(Select.mux2(net, level[pair], level[pair + 1], address[stage]));
        }
        level = next;
      }
      Sim.addOutput(net, prefix + bit, level[0]);
    }
  }

  /* ---------------------------------------------------------- reference */

  /** The behavioural model of the register file: write on the edge, and a
   *  read in the same cycle returns the OLD value. */
  function fileReference(state, request) {
    const before = state.slice();
    const next = state.slice();

    if (request.writeEnable) next[request.writeAddress] = request.data;
    return { x: before[request.readA], y: before[request.readB], state: next };
  }

  return { srLatch: srLatch, dLatch: dLatch, dFlipFlop: dFlipFlop,
    latchCircuit: latchCircuit, register: register, registerBits: registerBits,
    registerFile: registerFile, fileReference: fileReference,
    decodeMatch: decodeMatch };
}));
