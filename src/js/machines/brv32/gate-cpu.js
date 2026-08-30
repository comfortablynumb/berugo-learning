/**
 * Brv32GateCpu - the gate-level datapath, wired to memory and stepped.
 *
 * This is where the netlist becomes a machine: fetch the instruction at the
 * program counter, decode it into control signals, settle the combinational
 * logic with the clock low, perform the memory access the address lines are
 * asking for, and then let the clock edge capture the results into the program
 * counter and the register file.
 *
 * The order of those steps is the single-cycle contract, and it is worth
 * reading twice. Everything a load needs — address computation, the memory
 * access itself, and the write back — happens between two clock edges, which
 * is why the clock period of a single-cycle machine is set by its slowest
 * instruction and why every other instruction wastes the difference.
 *
 * `Reference` is the judge. `differential` runs both machines instruction for
 * instruction and compares architectural state after each one, so a
 * disagreement is reported at the instruction that caused it rather than at
 * the end of the program.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Brv32 = scope.Brv32 || {};
    scope.Brv32.GateCpu = api;
  }
}(this, function (root) {
  'use strict';

  const has = root && root.Brv32;
  const Sim = root && root.LogicSim ? root.LogicSim : require('../logic-sim.js');
  const Isa = has && root.Brv32.Isa ? root.Brv32.Isa : require('./isa.js');
  const Control = has && root.Brv32.Control ? root.Brv32.Control : require('./control.js');
  const Datapath = has && root.Brv32.Datapath ? root.Brv32.Datapath : require('./datapath.js');
  const Devices = has && root.Brv32.Devices ? root.Brv32.Devices : require('./devices.js');
  const Reference = has && root.Brv32.Reference ? root.Brv32.Reference
    : require('./reference-sim.js');

  /**
   * The event budget for one settling. A 32-bit datapath is about six thousand
   * gates and settles in a little over five thousand events, which is just
   * past the simulator's default — and a run that hits the budget returns
   * whatever it had reached, which looks exactly like a wrong answer. The
   * budget is raised here and `settled` is checked, because a quiet
   * not-settled is the worst failure this machine can have.
   */
  const HORIZON = 200000;

  function settle(machine, values, state) {
    const run = Sim.simulate(machine.net, values, { state: state, record: false,
      horizon: HORIZON });

    if (!run.settled) machine.unsettled = (machine.unsettled || 0) + 1;
    return run;
  }

  function create(options) {
    const settings = options || {};
    const built = Datapath.build();
    const memory = Devices.create(settings);

    if (settings.image) Devices.loadImage(memory, settings.base || 0, settings.image);
    return { built: built, net: built.net, memory: memory, state: null, cycles: 0,
      entry: settings.entry === undefined ? 0 : settings.entry, started: false,
      last: null };
  }

  /** The control inputs for one instruction, from the same table the
   *  behavioural machine reads. */
  function inputsFor(word, options) {
    const decoded = Isa.decode(word);
    const signals = Control.signalsFor(decoded);
    const aluControl = Control.aluControlFor(signals);
    const values = { clk: 0, regWrite: signals.regWrite, aluSrc: signals.aluSrc,
      usePc: signals.usePc ? 1 : 0, branch: signals.branch, jump: signals.jump,
      jalr: signals.jalr, aluSub: aluControl.sub, aluArith: aluControl.arith,
      aluUnsigned: aluControl.unsig };

    setBits(values, 'aluSel', aluControl.select, 3);
    setBits(values, 'immSel', Control.immediateSelect(decoded), 3);
    setBits(values, 'writeBack', signals.writeBack, 2);
    Datapath.busInputs(values, 'instr', word);
    Datapath.busInputs(values, 'memData', (options && options.memData) || 0);
    return { values: values, decoded: decoded, signals: signals };
  }

  function setBits(values, prefix, value, width) {
    for (let at = 0; at < width; at += 1) values[prefix + at] = (value >>> at) & 1;
  }

  /** The program counter is a register, so it has to be driven to the entry
   *  address before the first fetch — which is what a reset vector is. */
  function reset(machine) {
    const boot = inputsFor(Isa.encode('jal', { rd: 0, imm: 0 }), {});

    Datapath.busInputs(boot.values, 'instr', Isa.encode('jal', { rd: 0, imm: machine.entry }));
    const settled = settle(machine, boot.values, null);
    const rising = settle(machine, Object.assign({}, boot.values, { clk: 1 }), settled.state);

    machine.state = settle(machine, boot.values, rising.state).state;
    machine.started = true;
    return pcOf(machine);
  }

  function pcOf(machine) {
    return Datapath.busValue(settle(machine, currentInputs(machine), machine.state).outputs,
      'pc');
  }

  function currentInputs(machine) {
    return machine.last ? machine.last.values : inputsFor(0, {}).values;
  }

  /**
   * One instruction. Three settlings: the combinational phase that produces
   * the address, the clock edge that captures, and the phase after it that
   * makes the new program counter visible.
   */
  function step(machine) {
    if (!machine.started) reset(machine);
    const pc = pcOf(machine);
    const fetched = Devices.read(machine.memory, pc, 4, false);

    if (fetched.fault) return { ok: false, fault: fetched.fault, pc: pc };
    const prepared = inputsFor(fetched.value >>> 0, {});

    return commit(machine, prepared, settle(machine, prepared.values, machine.state), pc);
  }

  function commit(machine, prepared, low, pc) {
    const address = Datapath.busValue(low.outputs, 'alu');
    const storeData = Datapath.busValue(low.outputs, 'store');
    const access = memoryAccess(machine, prepared, address, storeData);

    if (access.fault) return { ok: false, fault: access.fault, pc: pc };
    /* The loaded word has to be on the write-back path BEFORE the clock rises:
       a flip-flop captures what was already at its data input, not what
       arrives with the edge. Skipping this settling makes every load write
       zero — which is a perfect miniature of a setup-time violation. */
    Datapath.busInputs(prepared.values, 'memData', access.value || 0);
    const ready = settle(machine, prepared.values, low.state);
    const rising = settle(machine, Object.assign({}, prepared.values, { clk: 1 }), ready.state);

    machine.state = settle(machine, prepared.values, rising.state).state;
    machine.cycles += 1;
    machine.settleTime = low.settleTime;
    machine.last = prepared;
    Devices.tick(machine.memory);
    return { ok: true, pc: pc, decoded: prepared.decoded, signals: prepared.signals,
      address: address, access: access, next: pcOf(machine) };
  }

  function memoryAccess(machine, prepared, address, storeData) {
    const row = prepared.decoded.ok ? prepared.decoded.row : null;

    if (!row) return {};
    if (prepared.signals.memRead) {
      return Devices.read(machine.memory, address, row.width, row.signed);
    }
    if (prepared.signals.memWrite) {
      return Devices.write(machine.memory, address, storeData, row.width);
    }
    return {};
  }

  /* ------------------------------------------------- reading the machine */

  /**
   * Every register, read from the flip-flops themselves rather than through a
   * read port. Both give the same values; going through the port costs a full
   * settling per register — thirty-two of them per snapshot — and a debugger
   * reading a machine over a scan chain does exactly this instead, for exactly
   * this reason.
   */
  function registersOf(machine) {
    const rows = machine.built.parts.files.rows;
    const state = machine.state || {};

    return rows.map(function (row) {
      let value = 0;

      row.forEach(function (cell, bit) {
        value |= (state[cell] ? 1 : 0) << bit;
      });
      return value | 0;
    });
  }

  /** Reading a register means driving its number onto a read port and letting
   *  the multiplexer tree settle — there is no other way to see it, which is
   *  itself worth knowing about hardware. */
  function readRegister(machine, index) {
    const values = Object.assign({}, currentInputs(machine));
    const word = Isa.encode('add', { rd: 0, rs1: 0, rs2: index });

    Datapath.busInputs(values, 'instr', word);
    values.regWrite = 0;
    values.clk = 0;
    return Datapath.busValue(settle(machine, values, machine.state).outputs, 'store') | 0;
  }

  function snapshot(machine) {
    return { pc: pcOf(machine) >>> 0, registers: registersOf(machine), csrs: {} };
  }

  /* ----------------------------------------------------- the differential */

  /**
   * Run both machines and compare after every instruction. The budget is
   * small on purpose: a gate-level step costs about six thousand gate
   * evaluations, so this is a check that runs in seconds rather than a
   * benchmark. What it buys is the strongest statement in the milestone —
   * two implementations that share no code agreeing on architectural state.
   */
  function differential(image, options) {
    const settings = options || {};
    const steps = settings.steps || 24;
    const gate = create({ image: image, entry: settings.entry || 0 });
    /* The gate machine powers up with every register at zero, so the
       behavioural one must too — a differential that starts from different
       state reports a difference on the first instruction and tells you
       nothing about either machine. */
    const model = Reference.create({ image: image, entry: settings.entry || 0, stack: 0 });
    const rows = [];

    for (let at = 0; at < steps; at += 1) {
      const before = Reference.snapshot(model);
      const taken = step(gate);

      Reference.step(model);
      rows.push(compare(gate, model, taken, before));
      if (rows[rows.length - 1].differences.length) break;
    }
    return { rows: rows, steps: rows.length,
      agreed: rows.filter(function (row) { return row.differences.length === 0; }).length,
      gate: gate, model: model };
  }

  function compare(gate, model, taken, before) {
    const left = snapshot(gate);
    const right = Reference.snapshot(model);

    return { pc: before.pc, instruction: taken.decoded ? taken.decoded.name : 'illegal',
      differences: Reference.differences(left, right), gate: left, model: right };
  }

  return { create: create, reset: reset, step: step, snapshot: snapshot,
    registersOf: registersOf, readRegister: readRegister, pcOf: pcOf,
    inputsFor: inputsFor, differential: differential };
}));
