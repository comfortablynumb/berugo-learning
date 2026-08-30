/**
 * Brv32Datapath - the single-cycle CPU, as gates.
 *
 * Every element here is built from the blocks of M33: full adders from 33.4,
 * multiplexers and decoders from 33.3, an ALU in the shape of 33.5, and a
 * register file with the structure of 33.8. The netlist is executed by the
 * same event-driven simulator, so the numbers this milestone quotes — gate
 * count, critical path, cycles — are measurements of a thing that runs rather
 * than estimates of a thing that was drawn.
 *
 * Two boundaries are deliberate and worth stating rather than hiding.
 *
 * FLIP-FLOPS are the simulator's `dff` primitive rather than the eleven-gate
 * master-slave cell built in 33.6. They are the same component; one node
 * instead of eleven keeps a 1 024-bit register file interactive, and the cost
 * of the real cell is exactly what 33.6 measured.
 *
 * MEMORY is behavioural. Instruction fetch and data access happen outside the
 * netlist, which is what a real design does too: a memory is a compiled array
 * with its own timing, not a sea of gates. The interface — address out, data
 * in, read and write strobes — is the gate-level part, and it is the part the
 * memory-interface section is about.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Brv32 = scope.Brv32 || {};
    scope.Brv32.Datapath = api;
  }
}(this, function (root) {
  'use strict';

  const has = root && root.Blocks;
  const Sim = root && root.LogicSim ? root.LogicSim : require('../logic-sim.js');
  const Select = has && root.Blocks.Select ? root.Blocks.Select : require('../blocks/select.js');
  const Adder = has && root.Blocks.Adder ? root.Blocks.Adder : require('../blocks/adder.js');
  const Isa = root && root.Brv32 && root.Brv32.Isa ? root.Brv32.Isa : require('./isa.js');

  const WIDTH = 32;
  const ALU_SELECT = { addsub: 0, and: 1, or: 2, xor: 3, sll: 4, shr: 5, slt: 6, passB: 7 };
  const IMM_SELECT = { I: 0, S: 1, B: 2, U: 3, J: 4 };

  /* ------------------------------------------------------------ bus tools */

  function inputBus(net, prefix, width) {
    const bus = [];

    for (let at = 0; at < width; at += 1) bus.push(Sim.addInput(net, prefix + at));
    return bus;
  }

  function outputBus(net, prefix, bus) {
    bus.forEach(function (id, at) { Sim.addOutput(net, prefix + at, id); });
  }

  function constant(net, value) {
    return Sim.addNode(net, value ? 'const1' : 'const0', []);
  }

  function muxBus(net, low, high, select) {
    return low.map(function (id, at) { return Select.mux2(net, id, high[at], select); });
  }

  /** An n:1 multiplexer per bit, as a tree of 2:1 stages — the construction
   *  measured in 33.3, used here for the ALU result, the immediate format and
   *  the register read ports. */
  function muxTreeBus(net, buses, select) {
    const out = [];

    for (let bit = 0; bit < buses[0].length; bit += 1) {
      let level = buses.map(function (bus) { return bus[bit]; });

      for (let stage = 0; stage < select.length; stage += 1) {
        const next = [];

        for (let pair = 0; pair + 1 < level.length; pair += 2) {
          next.push(Select.mux2(net, level[pair], level[pair + 1], select[stage]));
        }
        level = next;
      }
      out.push(level[0]);
    }
    return out;
  }

  function busValue(outputs, prefix, width) {
    let value = 0;

    for (let at = 0; at < (width || WIDTH); at += 1) {
      value |= (outputs[prefix + at] ? 1 : 0) << at;
    }
    return value >>> 0;
  }

  function busInputs(values, prefix, value, width) {
    for (let at = 0; at < (width || WIDTH); at += 1) {
      values[prefix + at] = (value >>> at) & 1;
    }
    return values;
  }

  /* --------------------------------------------------------- the adders */

  /** A ripple of M33's full adder. The datapath contains three of these — the
   *  ALU, the PC increment and the branch target — which is why the section on
   *  adders came first. */
  function addBus(net, a, b, carryIn) {
    const sums = [];
    let carry = carryIn;

    a.forEach(function (id, at) {
      const stage = Adder.fullAdder(net, id, b[at], carry);

      sums.push(stage.sum);
      carry = stage.carry;
    });
    return { sums: sums, carry: carry };
  }

  function invertBus(net, bus, when) {
    return bus.map(function (id) { return Sim.addGate(net, 'xor', [id, when]); });
  }

  /* ------------------------------------------------------------- the ALU */

  function logicBuses(net, a, b) {
    return [
      a.map(function (id, at) { return Sim.addGate(net, 'and', [id, b[at]]); }),
      a.map(function (id, at) { return Sim.addGate(net, 'or', [id, b[at]]); }),
      a.map(function (id, at) { return Sim.addGate(net, 'xor', [id, b[at]]); })
    ];
  }

  /** One barrel-shifter stage per bit of the shift amount, exactly as 33.3
   *  built it — and the fill bit is what makes it arithmetic or logical. */
  function shiftBus(net, data, amount, options) {
    let level = data.slice();

    for (let stage = 0; stage < 5; stage += 1) {
      const distance = Math.pow(2, stage);
      const current = level;

      level = current.map(function (id, at) {
        const from = options.left ? at - distance : at + distance;
        const source = from >= 0 && from < data.length ? current[from] : options.fill;

        return Select.mux2(net, id, source, amount[stage]);
      });
    }
    return level;
  }

  /**
   * The flags, which are the ALU's second output and the branch unit's only
   * input. Signed less-than is the sign of the difference corrected for
   * differing operand signs; unsigned less-than is simply the absence of a
   * carry out, because a - b borrows exactly when a is smaller.
   */
  function flagsOf(net, sum, carry, a, b) {
    const differ = Sim.addGate(net, 'xor', [a[WIDTH - 1], b[WIDTH - 1]]);
    const signed = Select.mux2(net, sum[WIDTH - 1], a[WIDTH - 1], differ);
    const anyBit = Select.orTree(net, sum);

    return { zero: Sim.addGate(net, 'not', [anyBit]), less: signed,
      lessUnsigned: Sim.addGate(net, 'not', [carry]) };
  }

  function alu(net, a, b, control) {
    const operand = invertBus(net, b, control.sub);
    const sum = addBus(net, a, operand, control.sub);
    const flags = flagsOf(net, sum.sums, sum.carry, a, b);
    const zero = constant(net, 0);
    const fill = Sim.addGate(net, 'and', [a[WIDTH - 1], control.arith]);
    const less = Select.mux2(net, flags.less, flags.lessUnsigned, control.unsig);
    const lessBus = [less].concat(new Array(WIDTH - 1).fill(zero));
    const buses = [sum.sums].concat(logicBuses(net, a, b), [
      shiftBus(net, a, b.slice(0, 5), { left: true, fill: zero }),
      shiftBus(net, a, b.slice(0, 5), { left: false, fill: fill }),
      lessBus, b]);

    return { out: muxTreeBus(net, buses, control.select), flags: flags };
  }

  /* --------------------------------------------------- the register file */

  /**
   * Thirty-two registers of thirty-two bits: a write decoder, a recirculating
   * multiplexer per bit, and two read multiplexer trees. Register zero has no
   * write enable at all, which is how "x0 is hardwired to zero" is actually
   * implemented — not by checking, by not wiring it.
   */
  function registerFile(net, ports) {
    const rows = [];

    for (let index = 0; index < 32; index += 1) rows.push(registerRow(net, ports, index));
    return { rows: rows,
      readA: muxTreeBus(net, rows, ports.rs1),
      readB: muxTreeBus(net, rows, ports.rs2) };
  }

  function registerRow(net, ports, index) {
    const selected = matchAddress(net, ports.rd, index);
    const enable = index === 0 ? constant(net, 0)
      : Sim.addGate(net, 'and', [selected, ports.regWrite]);
    const row = [];

    for (let bit = 0; bit < WIDTH; bit += 1) {
      const chosen = Sim.addGate(net, 'mux', [null, null, enable]);
      const cell = Sim.addGate(net, 'dff', [chosen, ports.clock]);

      Sim.connect(net, chosen, 0, cell);
      row.push(cell);
      ports.pending.push({ mux: chosen, bit: bit });
    }
    return row;
  }

  function matchAddress(net, address, index) {
    let node = null;

    for (let at = 0; at < 5; at += 1) {
      const line = ((index >> at) & 1) ? address[at] : Sim.addGate(net, 'not', [address[at]]);

      node = node === null ? line : Sim.addGate(net, 'and', [node, line]);
    }
    return node;
  }

  /* ------------------------------------------------ the immediate generator */

  /** The immediate generator is pure wiring: every format's bits are gathered
   *  from the instruction word and a multiplexer picks the format. No gate
   *  computes anything here, which is what the scrambling bought. */
  function immediateFor(net, instr, format) {
    const zero = constant(net, 0);
    const bus = new Array(WIDTH).fill(zero);

    (Isa.IMMEDIATE_FIELDS[format] || []).forEach(function (field) {
      for (let at = 0; at <= field[0] - field[1]; at += 1) {
        bus[field[1] + at] = instr[field[3] + at];
      }
    });
    for (let at = Isa.IMMEDIATE_WIDTH[format]; at < WIDTH; at += 1) bus[at] = instr[31];
    return bus;
  }

  function immediateUnit(net, instr, select) {
    const order = ['I', 'S', 'B', 'U', 'J', 'I', 'I', 'I'];

    return muxTreeBus(net, order.map(function (format) {
      return immediateFor(net, instr, format);
    }), select);
  }

  /* ---------------------------------------------------------- the branch */

  /**
   * Six conditions from three flag bits, in three gates: funct3 bit 2 chooses
   * equality or magnitude, bit 1 chooses signed or unsigned, and bit 0 inverts
   * the answer. That regularity is a deliberate encoding choice, and it is why
   * the branch unit is this small.
   */
  function branchUnit(net, flags, funct3, control) {
    const magnitude = Select.mux2(net, flags.less, flags.lessUnsigned, funct3[1]);
    const base = Select.mux2(net, flags.zero, magnitude, funct3[2]);
    const condition = Sim.addGate(net, 'xor', [base, funct3[0]]);
    const taken = Sim.addGate(net, 'and', [condition, control.branch]);

    return { condition: condition, pcSrc: Sim.addGate(net, 'or', [taken, control.jump]) };
  }

  /* ------------------------------------------------------- the whole thing */

  function controlPorts(net) {
    return { regWrite: Sim.addInput(net, 'regWrite'), aluSrc: Sim.addInput(net, 'aluSrc'),
      usePc: Sim.addInput(net, 'usePc'), branch: Sim.addInput(net, 'branch'),
      jump: Sim.addInput(net, 'jump'), jalr: Sim.addInput(net, 'jalr'),
      sub: Sim.addInput(net, 'aluSub'), arith: Sim.addInput(net, 'aluArith'),
      unsig: Sim.addInput(net, 'aluUnsigned'),
      select: inputBus(net, 'aluSel', 3), immSel: inputBus(net, 'immSel', 3),
      writeBack: inputBus(net, 'writeBack', 2) };
  }

  function fourBus(net) {
    const zero = constant(net, 0);
    const one = constant(net, 1);

    return new Array(WIDTH).fill(zero).map(function (id, at) { return at === 2 ? one : id; });
  }

  function nextPc(net, pc, immediate, aluOut, control, pcSrc) {
    const plusFour = addBus(net, pc, fourBus(net), constant(net, 0)).sums;
    const target = addBus(net, pc, immediate, constant(net, 0)).sums;
    const register = [constant(net, 0)].concat(aluOut.slice(1));
    const jumpTarget = muxBus(net, target, register, control.jalr);

    return { plusFour: plusFour, next: muxBus(net, plusFour, jumpTarget, pcSrc) };
  }

  function writeBackMux(net, sources, select) {
    const first = muxBus(net, sources.alu, sources.memory, select[0]);
    const second = muxBus(net, sources.link, sources.immediate, select[0]);

    return muxBus(net, first, second, select[1]);
  }

  function build() {
    const net = Sim.create('BRV32 single-cycle datapath');
    const clock = Sim.addInput(net, 'clk');
    const instr = inputBus(net, 'instr', WIDTH);
    const memData = inputBus(net, 'memData', WIDTH);
    const control = controlPorts(net);
    const pending = [];
    const pc = programCounter(net, clock);
    const immediate = immediateUnit(net, instr, control.immSel);
    const files = registerFile(net, { rd: instr.slice(7, 12), rs1: instr.slice(15, 20),
      rs2: instr.slice(20, 25), regWrite: control.regWrite, clock: clock, pending: pending });

    return finish(net, { clock: clock, instr: instr, memData: memData, control: control,
      pc: pc, immediate: immediate, files: files, pending: pending });
  }

  function programCounter(net, clock) {
    const cells = [];

    for (let bit = 0; bit < WIDTH; bit += 1) cells.push(Sim.addGate(net, 'dff', [null, clock]));
    return cells;
  }

  /** The loop closes here: the register file's data input depends on the ALU,
   *  which depends on the register file. Building the cells first and wiring
   *  their inputs last is what a synthesised netlist does too. */
  function finish(net, parts) {
    const control = parts.control;
    const operandA = muxBus(net, parts.files.readA, parts.pc, control.usePc);
    const operandB = muxBus(net, parts.files.readB, parts.immediate, control.aluSrc);
    const result = alu(net, operandA, operandB, control);
    const branch = branchUnit(net, result.flags, parts.instr.slice(12, 15), control);
    const pcNext = nextPc(net, parts.pc, parts.immediate, result.out, control, branch.pcSrc);
    const writeData = writeBackMux(net, { alu: result.out, memory: parts.memData,
      link: pcNext.plusFour, immediate: parts.immediate }, control.writeBack);

    parts.pending.forEach(function (row) { Sim.connect(net, row.mux, 1, writeData[row.bit]); });
    parts.pc.forEach(function (cell, at) { Sim.connect(net, cell, 0, pcNext.next[at]); });
    return report(net, parts, result, branch, writeData);
  }

  function report(net, parts, result, branch, writeData) {
    outputBus(net, 'pc', parts.pc);
    outputBus(net, 'alu', result.out);
    outputBus(net, 'store', parts.files.readB);
    outputBus(net, 'write', writeData);
    Sim.addOutput(net, 'zero', result.flags.zero);
    Sim.addOutput(net, 'less', result.flags.less);
    Sim.addOutput(net, 'taken', branch.pcSrc);
    return { net: net, parts: parts, gates: Sim.gateCount(net) };
  }

  return { WIDTH: WIDTH, ALU_SELECT: ALU_SELECT, IMM_SELECT: IMM_SELECT,
    build: build, alu: alu, addBus: addBus, registerFile: registerFile,
    immediateFor: immediateFor, immediateUnit: immediateUnit, branchUnit: branchUnit,
    busValue: busValue, busInputs: busInputs, inputBus: inputBus, outputBus: outputBus,
    muxBus: muxBus, muxTreeBus: muxTreeBus };
}));
