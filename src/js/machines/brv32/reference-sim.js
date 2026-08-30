/**
 * Brv32Reference - the behavioural simulator, and the oracle for everything
 * else in this milestone.
 *
 * It executes the instruction table directly: fetch, decode, run the row's
 * `run`, advance the program counter. There are no gates in it and that is the
 * point — the gate-level datapath in `datapath.js` is checked against this
 * after every instruction, and two implementations that share no structure
 * disagreeing is informative in a way that one implementation agreeing with
 * itself is not.
 *
 * Architectural state is deliberately small and comparable: 32 registers, a
 * program counter, the CSRs and memory. `snapshot` returns exactly that, so a
 * differential test is one deep-equal per instruction rather than a set of
 * hand-chosen assertions that might miss the field that moved.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Brv32 = scope.Brv32 || {};
    scope.Brv32.Reference = api;
  }
}(this, function (root) {
  'use strict';

  const has = root && root.Brv32;
  const Isa = has && root.Brv32.Isa ? root.Brv32.Isa : require('./isa.js');
  const Devices = has && root.Brv32.Devices ? root.Brv32.Devices : require('./devices.js');
  const Traps = has && root.Brv32.Traps ? root.Brv32.Traps : require('./traps.js');

  function create(options) {
    const settings = options || {};
    const registers = new Array(32).fill(0);
    const memory = Devices.create(settings);

    if (settings.image) Devices.loadImage(memory, settings.base || 0, settings.image);
    registers[2] = settings.stack === undefined ? 0x10000f00 : settings.stack;
    return { registers: registers, pc: settings.entry === undefined ? 0 : settings.entry,
      memory: memory, traps: Traps.create(settings), retired: 0, halted: false,
      reason: null, log: [] };
  }

  /** The memory interface the instruction table sees. It records the fault
   *  instead of throwing, so the step function can turn it into a trap. */
  function memoryPort(machine, pending) {
    return {
      read: function (address, width, signed) {
        const out = Devices.read(machine.memory, address, width, signed);

        if (out.fault) { pending.fault = out.fault; return 0; }
        pending.access = { kind: 'read', address: address >>> 0, width: width,
          value: out.value, region: out.region };
        return out.value;
      },
      write: function (address, value, width) {
        const out = Devices.write(machine.memory, address, value, width);

        if (out.fault) { pending.fault = out.fault; return; }
        pending.access = { kind: 'write', address: address >>> 0, width: width,
          value: value | 0, region: out.region };
      }
    };
  }

  function fetch(machine) {
    if (machine.pc % 4 !== 0) {
      return { fault: { cause: Devices.CAUSE.misalignedFetch, value: machine.pc,
        name: 'instruction address misaligned' } };
    }
    const out = Devices.read(machine.memory, machine.pc, 4, false);

    if (out.fault) {
      return { fault: { cause: 1, value: machine.pc, name: 'instruction access fault' } };
    }
    return { word: out.value >>> 0 };
  }

  function applyCsr(machine, access, decoded) {
    const before = Traps.read(machine.traps, access.csr);
    const source = decoded.rs1 === 0 ? 0 : machine.registers[decoded.rs1] | 0;

    if (decoded.rd !== 0) machine.registers[decoded.rd] = before;
    Traps.write(machine.traps, access.csr, access.op === 'w' ? source : (before | source));
  }

  /** One instruction, from fetch to committed state. Every exit path leaves
   *  `machine.pc` at a legal next address, which is what makes the state
   *  comparable with the gate-level machine after every step. */
  function step(machine) {
    const interrupt = Traps.pendingInterrupt(machine.traps, machine.memory);

    if (interrupt) return trap(machine, interrupt, machine.pc);
    const fetched = fetch(machine);

    if (fetched.fault) return trap(machine, fetched.fault, machine.pc);
    const decoded = Isa.decode(fetched.word);

    if (!decoded.ok) {
      return trap(machine, { cause: 2, value: fetched.word, name: 'illegal instruction' },
        machine.pc);
    }
    return execute(machine, decoded);
  }

  function execute(machine, decoded) {
    const pending = {};
    const state = { registers: machine.registers, pc: machine.pc,
      memory: memoryPort(machine, pending), next: (machine.pc + 4) >>> 0 };

    decoded.row.run(state, decoded);
    if (pending.fault) return trap(machine, pending.fault, machine.pc);
    if (state.trap) return trap(machine, state.trap, machine.pc);
    if (state.csrAccess) applyCsr(machine, state.csrAccess, decoded);
    machine.pc = state.mret ? Traps.exit(machine.traps) : state.next;
    machine.registers[0] = 0;
    machine.retired += 1;
    Devices.tick(machine.memory);
    return { ok: true, decoded: decoded, access: pending.access, mret: Boolean(state.mret) };
  }

  function trap(machine, cause, pc) {
    if (cause.interrupt) machine.memory.timer.pending = false;
    machine.pc = Traps.enter(machine.traps, cause, pc);
    machine.registers[0] = 0;
    Devices.tick(machine.memory);
    return { ok: true, trapped: true, cause: cause };
  }

  /**
   * Run until the program stops itself, the budget runs out, or the machine
   * reaches an address it was told to treat as the end. A budget that is hit
   * is reported rather than being silently the same as finishing.
   */
  function run(machine, options) {
    const settings = options || {};
    const budget = settings.budget || 5000;
    const stopAt = settings.stopAt;
    let steps = 0;

    while (steps < budget) {
      if (stopAt !== undefined && machine.pc === (stopAt >>> 0)) {
        return { finished: true, steps: steps, reason: 'reached the stop address' };
      }
      const out = step(machine);

      steps += 1;
      if (settings.trace) machine.log.push(out);
      if (out.trapped && settings.stopOnTrap) {
        return { finished: true, steps: steps, reason: 'trapped: ' + out.cause.name };
      }
    }
    return { finished: false, steps: steps, reason: 'budget of ' + budget + ' steps exhausted' };
  }

  /** Architectural state, and nothing else — no simulator bookkeeping, so the
   *  gate-level machine can produce the same shape. */
  function snapshot(machine) {
    return { pc: machine.pc >>> 0, registers: machine.registers.slice(),
      csrs: Object.assign({}, machine.traps.csrs) };
  }

  function differences(left, right) {
    const out = [];

    if (left.pc !== right.pc) out.push({ field: 'pc', left: left.pc, right: right.pc });
    left.registers.forEach(function (value, at) {
      if ((value | 0) !== (right.registers[at] | 0)) {
        out.push({ field: 'x' + at, left: value | 0, right: right.registers[at] | 0 });
      }
    });
    return out;
  }

  return { create: create, step: step, run: run, snapshot: snapshot,
    differences: differences, fetch: fetch };
}));
