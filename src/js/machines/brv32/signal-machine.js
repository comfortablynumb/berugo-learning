/**
 * Brv32SignalMachine - a processor driven by control signals rather than by
 * instruction names.
 *
 * The behavioural simulator executes `add` because the instruction table says
 * what `add` does. This machine does not know what `add` is: it reads the
 * control vector — write the register file, take the second operand from the
 * immediate, apply ALU function 0 — and does that. It is the datapath's
 * semantics written as a function, which makes it exactly the right place to
 * ask "what happens if this signal is wrong".
 *
 * Forcing a signal here produces the same failure the hardware would, at a
 * millionth of the cost of simulating six thousand gates, and the model earns
 * that trust by being checked against the behavioural simulator on every
 * instruction it runs with the correct signals.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Brv32 = scope.Brv32 || {};
    scope.Brv32.SignalMachine = api;
  }
}(this, function (root) {
  'use strict';

  const has = root && root.Brv32;
  const Isa = has && root.Brv32.Isa ? root.Brv32.Isa : require('./isa.js');
  const Control = has && root.Brv32.Control ? root.Brv32.Control : require('./control.js');
  const Devices = has && root.Brv32.Devices ? root.Brv32.Devices : require('./devices.js');

  function create(options) {
    const settings = options || {};
    const memory = Devices.create(settings);

    if (settings.image) Devices.loadImage(memory, settings.base || 0, settings.image);
    return { registers: new Array(32).fill(0), pc: settings.entry || 0, memory: memory,
      retired: 0, halted: false };
  }

  /** The ALU, as the datapath's own function codes rather than the
   *  instruction's mnemonics. */
  function alu(select, sub, arith, unsig, a, b) {
    const shift = b & 31;

    if (select === 0) return sub ? (a - b) | 0 : (a + b) | 0;
    if (select === 1) return a & b;
    if (select === 2) return a | b;
    if (select === 3) return a ^ b;
    if (select === 4) return a << shift;
    if (select === 5) return arith ? (a >> shift) : (a >>> shift);
    if (select === 6) return less(a, b, unsig);
    return b;
  }

  function less(a, b, unsig) {
    if (unsig) return (a >>> 0) < (b >>> 0) ? 1 : 0;
    return a < b ? 1 : 0;
  }

  function branchTaken(funct3, a, b) {
    const magnitude = (funct3 & 2) ? ((a >>> 0) < (b >>> 0)) : (a < b);
    const base = (funct3 & 4) ? magnitude : (a === b);

    return (funct3 & 1) ? !base : base;
  }

  function readRegister(machine, index) {
    return index === 0 ? 0 : machine.registers[index] | 0;
  }

  /**
   * One instruction, from the signal vector. Every branch in this function is
   * a multiplexer in the datapath, which is the point of writing it this way.
   */
  function step(machine, override) {
    const fetched = Devices.read(machine.memory, machine.pc, 4, false);

    if (fetched.fault) { machine.halted = true; return { ok: false, fault: fetched.fault }; }
    const decoded = Isa.decode(fetched.value >>> 0);
    const signals = Object.assign(Control.signalsFor(decoded), override || {});

    if (!decoded.ok) { machine.halted = true; return { ok: false, illegal: true }; }
    return run(machine, decoded, signals);
  }

  function run(machine, decoded, signals) {
    const aluControl = Control.aluControlFor(signals);
    const a = signals.usePc ? machine.pc : readRegister(machine, decoded.rs1);
    const b = signals.aluSrc ? decoded.imm : readRegister(machine, decoded.rs2);
    const result = alu(aluControl.select, aluControl.sub, aluControl.arith, aluControl.unsig,
      a, b);
    const access = memoryStep(machine, decoded, signals, result);

    if (access.fault) { machine.halted = true; return { ok: false, fault: access.fault }; }
    writeBack(machine, decoded, signals, { result: result, loaded: access.value });
    machine.pc = nextPc(machine, decoded, signals, result);
    machine.retired += 1;
    return { ok: true, decoded: decoded, signals: signals, result: result,
      loaded: access.value };
  }

  function memoryStep(machine, decoded, signals, address) {
    const row = decoded.row;

    if (signals.memRead) return Devices.read(machine.memory, address, row.width, row.signed);
    if (signals.memWrite) {
      return Devices.write(machine.memory, address, readRegister(machine, decoded.rs2),
        row.width);
    }
    return {};
  }

  const SOURCES = ['result', 'loaded', 'link', 'immediate'];

  function writeBack(machine, decoded, signals, values) {
    if (!signals.regWrite || decoded.rd === 0) return;
    const source = SOURCES[signals.writeBack || 0];
    const chosen = { result: values.result, loaded: values.loaded | 0,
      link: (machine.pc + 4) | 0, immediate: decoded.imm | 0 }[source];

    machine.registers[decoded.rd] = chosen | 0;
  }

  function nextPc(machine, decoded, signals, result) {
    const a = readRegister(machine, decoded.rs1);
    const b = readRegister(machine, decoded.rs2);
    const taken = signals.branch && branchTaken(decoded.funct3, a, b);

    if (signals.jump && signals.jalr) return (result & ~1) >>> 0;
    if (signals.jump || taken) return (machine.pc + decoded.imm) >>> 0;
    return (machine.pc + 4) >>> 0;
  }

  function snapshot(machine) {
    return { pc: machine.pc >>> 0, registers: machine.registers.slice(), csrs: {} };
  }

  /** Run until the budget or an ecall, with one signal forced everywhere. The
   *  comparison between this and an unforced run is what makes a control
   *  signal's job concrete. */
  function runWith(image, override, options) {
    const settings = options || {};
    const budget = settings.budget || 60;
    const machine = create({ image: image, entry: settings.entry || 0 });
    let finished = false;
    let steps = 0;

    for (let at = 0; at < budget && !finished; at += 1) {
      const out = step(machine, override);

      steps += 1;
      if (!out.ok) { finished = true; break; }
      if (out.decoded && out.decoded.row.opcode === Isa.OPCODES.system) finished = true;
    }
    /* A run that used its whole budget did not finish, and saying so matters:
       a broken control signal usually produces a program that never ends
       rather than one that ends wrongly. */
    return { machine: machine, state: snapshot(machine), steps: steps,
      finished: finished, halted: machine.halted };
  }

  return { create: create, step: step, snapshot: snapshot, runWith: runWith,
    alu: alu, branchTaken: branchTaken, SOURCES: SOURCES };
}));
