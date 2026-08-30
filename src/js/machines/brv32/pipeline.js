/**
 * Brv32Pipeline - the M34 machine, cut into five stages.
 *
 * This is a second implementation of execution, not a re-timing of the first.
 * It has its own register file, its own operand selection and its own memory
 * ordering, and it shares only the instruction table with the behavioural
 * simulator - so comparing their architectural state is evidence rather than a
 * tautology. That comparison is the acceptance criterion the whole milestone
 * rests on, and `differential` below is what runs it.
 *
 * Three modelling decisions are worth stating, because they are where a
 * pipeline simulator usually cheats:
 *
 *   - **The memory access happens in the memory stage.** The execute stage
 *     records what the instruction wants and returns nothing; the memory stage
 *     performs it. Doing the read in execute would be simpler and would delete
 *     the load-use hazard, which is one of the two things this milestone is
 *     about.
 *   - **An exception squashes younger instructions the moment it is detected
 *     and commits at write-back.** Waiting until write-back to squash would
 *     let a younger store reach memory first, which is exactly what "precise"
 *     forbids. Older instructions still drain, which is the other half of it.
 *   - **Interrupts are out of scope here.** The timer interrupt is a M34
 *     topic; a pipelined machine takes it at an instruction boundary and this
 *     model does not implement that. Saying so is better than implementing
 *     half of it.
 *
 * The cycle log is the other product. Every cycle records what was in each
 * stage and why anything did not move, and the totals reconcile exactly:
 * cycles = retired + fill + stalls + flushes.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Brv32 = scope.Brv32 || {};
    scope.Brv32.Pipeline = api;
  }
}(this, function (root) {
  'use strict';

  const has = root && root.Brv32;
  const Isa = has && root.Brv32.Isa ? root.Brv32.Isa : require('./isa.js');
  const Devices = has && root.Brv32.Devices ? root.Brv32.Devices : require('./devices.js');
  const Traps = has && root.Brv32.Traps ? root.Brv32.Traps : require('./traps.js');
  const Hazards = has && root.Brv32.Hazards ? root.Brv32.Hazards : require('./hazards.js');
  const Predictors = has && root.Brv32.Predictors ? root.Brv32.Predictors
    : require('./predictors.js');

  const STAGES = ['IF', 'ID', 'EX', 'MEM', 'WB'];
  const FILL = STAGES.length - 1;

  function create(options) {
    const settings = options || {};
    const memory = Devices.create(settings);

    if (settings.image) Devices.loadImage(memory, settings.base || 0, settings.image);
    const registers = new Array(32).fill(0);

    registers[2] = settings.stack === undefined ? 0x10000f00 : settings.stack;
    return {
      registers: registers, memory: memory, traps: Traps.create(settings),
      pc: settings.entry === undefined ? 0 : settings.entry >>> 0,
      latches: { ifId: null, idEx: null, exMem: null, memWb: null },
      config: configFor(settings),
      predictor: settings.predictor ? Predictors.create(settings.predictor, settings) : null,
      btb: Predictors.createBtb(settings), ras: Predictors.createRas(settings),
      cycle: 0, retired: 0, issued: 0, halted: false, reason: null, frozen: false,
      issueLimit: Infinity,
      counters: { stalls: 0, flushes: 0, structural: 0, loadUse: 0, dependency: 0,
        mispredicts: 0, predictions: 0, forwards: 0, squashed: 0, redirects: 0,
        empty: 0, traps: 0, causes: {} },
      log: [], timeline: []
    };
  }

  function configFor(settings) {
    return {
      forwarding: settings.forwarding !== false,
      naiveForwarding: settings.naiveForwarding === true,
      resolveIn: settings.resolveIn === 'ID' ? 'ID' : 'EX',
      unifiedMemory: settings.unifiedMemory === true,
      trace: settings.trace !== false
    };
  }

  /* ------------------------------------------------------------- one cycle */

  function step(machine) {
    const events = [];
    const next = { ifId: null, idEx: null, exMem: null, memWb: null };
    const retiring = machine.latches.memWb;

    writeback(machine, events);
    next.memWb = memoryStage(machine, events);
    const execute = executeStage(machine, events);

    next.exMem = execute.entry;
    const decode = decodeStage(machine, events, execute);
    const redirect = redirectFrom(execute, decode);

    next.idEx = decode.entry;
    next.ifId = fetchStage(machine, events, { decode: decode, redirect: redirect });
    applyLatches(machine, next, decode, redirect);
    record(machine, events, retiring);
    machine.cycle += 1;
    return { cycle: machine.cycle, events: events };
  }

  /** A redirect can come from either resolution point, and which one it is
   *  decides how much is thrown away: decode squashes one instruction,
   *  execute squashes two. */
  function redirectFrom(execute, decode) {
    if (decode.redirect !== undefined && decode.redirect !== null) {
      return { target: decode.redirect, from: 'ID' };
    }
    if (execute.redirect !== undefined && execute.redirect !== null) {
      return { target: execute.redirect, from: 'EX' };
    }
    return null;
  }

  /** The latches, written once at the end of the cycle so every stage read the
   *  state as it stood at the start of it - which is what a register between
   *  two stages actually does. */
  function applyLatches(machine, next, decode, redirect) {
    machine.latches.memWb = next.memWb;
    machine.latches.exMem = next.exMem;
    machine.latches.idEx = decode.stalled ? bubble('stall') : next.idEx;
    machine.latches.ifId = decode.stalled ? machine.latches.ifId : next.ifId;
    if (!redirect) return;
    machine.latches.ifId = bubble('flush');
    if (redirect.from === 'EX') machine.latches.idEx = bubble('flush');
    unfreezeIfSquashed(machine);
  }

  /**
   * A fault on the wrong path is not a fault.
   *
   * Fetch runs ahead of every unresolved branch, so it regularly reads past
   * the end of a program and decodes zeros as an illegal instruction. Freezing
   * on that and never unfreezing is a machine that stops dead the first time a
   * loop branch is mispredicted - which is exactly what this did before the
   * check below existed. Once a redirect has squashed the stages that could
   * hold the faulting instruction, there is no fault in flight and fetch
   * restarts.
   */
  function unfreezeIfSquashed(machine) {
    if (!machine.frozen) return;
    const alive = ['exMem', 'memWb'].some(function (name) {
      const entry = machine.latches[name];

      return entry && !entry.bubble && (entry.fault || entry.serialising);
    });

    if (!alive) machine.frozen = false;
  }

  function bubble(why) {
    return { bubble: true, why: why };
  }

  /* --------------------------------------------------------------- stage 5 */

  /** Write-back, and the only place architectural state changes. An
   *  instruction carrying a fault commits the trap here instead. */
  function writeback(machine, events) {
    const entry = machine.latches.memWb;

    if (!entry || entry.bubble) { chargeEmpty(machine, entry); return; }
    if (entry.fault) { commitTrap(machine, entry, events); return; }
    if (entry.decoded && Hazards.writesRegister(entry)) {
      machine.registers[entry.decoded.rd] = entry.value | 0;
    }
    if (entry.csrAccess) applyCsr(machine, entry);
    machine.registers[0] = 0;
    machine.retired += 1;
    entry.retiredAt = machine.cycle;
    if (entry.serialising) resume(machine, entry, events);
    events.push({ kind: 'retire', stage: 'WB', id: entry.id, pc: entry.pc });
  }

  /** A serialising instruction has committed, so fetch can start again - from
   *  the saved address if this was an mret, and from the next instruction
   *  otherwise. */
  function resume(machine, entry, events) {
    machine.pc = entry.mret ? Traps.exit(machine.traps) : ((entry.pc + 4) >>> 0);
    machine.latches.ifId = null;
    machine.latches.idEx = null;
    machine.frozen = false;
    events.push({ kind: 'resume', stage: 'WB', id: entry.id, pc: machine.pc,
      reason: entry.mret ? 'returning to the saved address'
        : 'the control register is written; fetch restarts' });
  }

  /**
   * A cycle in which nothing retired, charged to whatever made the hole.
   *
   * This is the only accounting in the model that is exact by construction:
   * every cycle either retires an instruction, commits a trap, or lands here,
   * so the three counts always sum to the cycle count. Deriving the same
   * numbers from the events instead was off by one on every program, because
   * a bubble that is created near the end of a run never reaches write-back
   * and a pipeline that refills after a trap pays the fill twice.
   */
  function chargeEmpty(machine, entry) {
    const why = entry && entry.why ? entry.why : 'filling the pipeline';

    machine.counters.empty += 1;
    machine.counters.causes[why] = (machine.counters.causes[why] || 0) + 1;
  }

  function commitTrap(machine, entry, events) {
    machine.counters.traps += 1;
    machine.pc = Traps.enter(machine.traps, entry.fault, entry.pc);
    machine.latches.ifId = null;
    machine.latches.idEx = null;
    machine.latches.exMem = null;
    machine.frozen = false;
    machine.registers[0] = 0;
    machine.traps.lastEntry = entry.id;
    events.push({ kind: 'trap', stage: 'WB', id: entry.id, pc: entry.pc,
      reason: entry.fault.name });
  }

  /**
   * A control register is READ in execute and WRITTEN at commit.
   *
   * Splitting it that way is not a detail: the read has to happen early enough
   * for the value to be forwarded to the next instruction, and the write has
   * to happen late enough that a squashed instruction cannot change
   * architectural state. Doing both at write-back leaves the destination
   * register holding zero for two stages, which makes the very next
   * instruction read a forwarded zero - and a trap handler that reads mcause
   * into a register and branches on it then takes the wrong path, returns to
   * the wrong address, and faults again forever.
   */
  function readCsr(machine, entry) {
    entry.csrBefore = Traps.read(machine.traps, entry.csrAccess.csr);
    entry.value = entry.decoded.rd === 0 ? 0 : entry.csrBefore | 0;
  }

  function applyCsr(machine, entry) {
    const access = entry.csrAccess;
    const before = entry.csrBefore | 0;
    const source = entry.decoded.rs1 === 0 ? 0 : entry.rs1v | 0;

    Traps.write(machine.traps, access.csr, access.op === 'w' ? source : (before | source));
  }

  /* --------------------------------------------------------------- stage 4 */

  /** The memory stage: perform what execute recorded. A load's value does not
   *  exist before this point, which is the whole of the load-use hazard. */
  function memoryStage(machine, events) {
    const entry = machine.latches.exMem;

    if (!entry || entry.bubble) return entry;
    if (entry.fault || !entry.access) return entry;
    const access = entry.access;

    if (access.kind === 'read') {
      const out = Devices.read(machine.memory, access.address, access.width, access.signed);

      if (out.fault) return faulted(machine, entry, out.fault, events, 'MEM');
      entry.value = out.value | 0;
    } else {
      const out = Devices.write(machine.memory, access.address, access.value, access.width);

      if (out.fault) return faulted(machine, entry, out.fault, events, 'MEM');
    }
    events.push({ kind: 'memory', stage: 'MEM', id: entry.id, pc: entry.pc,
      reason: access.kind + ' at 0x' + access.address.toString(16) });
    return entry;
  }

  /* --------------------------------------------------------------- stage 3 */

  function executeStage(machine, events) {
    const entry = machine.latches.idEx;

    if (!entry || entry.bubble) return { entry: entry, redirect: null };
    if (entry.fault) return { entry: freeze(machine, entry, events), redirect: null };
    const operands = selectOperands(machine, entry, events);
    const state = executeState(machine, entry, operands);

    entry.decoded.row.run(state, entry.decoded);
    entry.value = state.registers[entry.decoded.rd] | 0;
    entry.csrAccess = state.csrAccess || null;
    if (entry.csrAccess) readCsr(machine, entry);
    entry.mret = Boolean(state.mret);
    if (state.trap) return { entry: faulted(machine, entry, state.trap, events, 'EX'),
      redirect: null };
    if (serialising(entry)) return { entry: serialise(machine, entry, events), redirect: null };
    return resolveControl(machine, entry, state, events);
  }

  /** The register file this instruction sees: only the two source slots
   *  matter, and each is either forwarded or read from the file. */
  function executeState(machine, entry, operands) {
    const shadow = new Array(32).fill(0);

    shadow[entry.decoded.rs1] = operands.rs1;
    shadow[entry.decoded.rs2] = operands.rs2;
    shadow[0] = 0;
    entry.rs1v = operands.rs1;
    entry.rs2v = operands.rs2;
    entry.sources = operands.sources;
    entry.access = null;
    return { registers: shadow, pc: entry.pc, memory: deferredPort(entry),
      next: (entry.pc + 4) >>> 0 };
  }

  /** Records the access instead of performing it. The memory stage is where a
   *  memory access happens, and modelling that is the difference between a
   *  pipeline and a drawing of one. */
  function deferredPort(entry) {
    return {
      read: function (address, width, signed) {
        entry.access = { kind: 'read', address: address >>> 0, width: width, signed: signed };
        return 0;
      },
      write: function (address, value, width) {
        entry.access = { kind: 'write', address: address >>> 0, value: value | 0,
          width: width };
      }
    };
  }

  function selectOperands(machine, entry, events) {
    const reads = Hazards.readsRegisters(entry);
    const sources = {};
    const values = {};

    ['rs1', 'rs2'].forEach(function (which) {
      const register = entry.decoded[which];

      if (!reads[which]) { sources[which] = null; values[which] = 0; return; }
      const found = Hazards.forwardFor(register, machine.latches, machine.config);

      sources[which] = found.source;
      values[which] = found.value === null ? (machine.registers[register] | 0) : found.value;
      if (found.source === Hazards.SOURCE.ex || found.source === Hazards.SOURCE.mem) {
        machine.counters.forwards += 1;
        events.push({ kind: 'forward', stage: 'EX', id: entry.id, pc: entry.pc,
          reason: Hazards.name(register) + ' from ' + found.source });
      }
    });
    return { rs1: values.rs1, rs2: values.rs2, sources: sources };
  }

  /* --------------------------------------------- control flow and redirects */

  function resolveControl(machine, entry, state, events) {
    const target = state.next >>> 0;

    entry.taken = target !== ((entry.pc + 4) >>> 0);
    entry.target = target;
    if (!entry.predictionUpdated) updatePrediction(machine, entry);
    if (target === entry.predictedNext) return { entry: entry, redirect: null };
    machine.counters.flushes += flushCost(machine);
    machine.counters.redirects += 1;
    if (entry.predicted) machine.counters.mispredicts += 1;
    events.push({ kind: 'flush', stage: 'EX', id: entry.id, pc: entry.pc,
      reason: reasonFor(entry), cost: flushCost(machine) });
    return { entry: entry, redirect: target >>> 0 };
  }

  function reasonFor(entry) {
    if (entry.mret) return 'mret redirects to the saved address';
    if (!isBranchLike(entry)) return 'the next address was not what fetch assumed';
    return entry.taken ? 'branch taken, predicted not taken'
      : 'branch not taken, predicted taken';
  }

  /** How many instructions a redirect throws away. Resolving in decode costs
   *  one; resolving in execute costs two, and the number grows with every
   *  stage between fetch and the resolution point. */
  function flushCost(machine) {
    return machine.config.resolveIn === 'ID' ? 1 : 2;
  }

  function isBranchLike(entry) {
    if (!entry.decoded || !entry.decoded.ok) return false;
    const format = entry.decoded.row.format;

    return format === 'B' || format === 'J' || entry.decoded.row.opcode === 0x67;
  }

  /**
   * Tell the predictors what happened. The direction predictor only hears
   * about conditional branches - an unconditional jump has no direction to
   * predict - but the target buffer hears about every taken transfer, because
   * a target is exactly what fetch could not compute for itself.
   */
  function updatePrediction(machine, entry) {
    entry.predictionUpdated = true;
    if (!machine.predictor || !entry.decoded || !entry.decoded.ok) return;
    if (entry.decoded.row.format === 'B') {
      machine.predictor.update(entry.pc, { taken: entry.taken, offset: entry.decoded.imm });
    }
    if (entry.taken || isUnconditional(entry)) machine.btb.update(entry.pc, entry.target);
  }

  function isUnconditional(entry) {
    if (!entry.decoded || !entry.decoded.ok) return false;
    return entry.decoded.row.format === 'J' || entry.decoded.row.opcode === 0x67;
  }

  function isCall(entry) {
    return entry.decoded.row.format === 'J' && entry.decoded.rd === 1;
  }

  function isReturn(entry) {
    return entry.decoded.row.opcode === 0x67 && entry.decoded.rs1 === 1 &&
      entry.decoded.rd === 0;
  }

  /* --------------------------------------------------------------- stage 2 */

  function decodeStage(machine, events, execute) {
    const entry = machine.latches.ifId;

    if (!entry || entry.bubble) return { entry: entry, stalled: false };
    if (execute.redirect !== null && execute.redirect !== undefined) {
      return { entry: bubble('flush'), stalled: false };
    }
    if (entry.fault) return { entry: entry, stalled: false };
    const stall = Hazards.stallFor(entry, machine.latches, machine.config);

    if (stall) return stalling(machine, events, entry, stall);
    if (machine.config.resolveIn !== 'ID' || !isConditional(entry)) {
      return { entry: entry, stalled: false };
    }
    return earlyResolve(machine, events, entry);
  }

  function stalling(machine, events, entry, stall) {
    machine.counters.stalls += 1;
    machine.counters[stall.loadUse ? 'loadUse' : 'dependency'] += 1;
    events.push({ kind: 'stall', stage: 'ID', id: entry.id, pc: entry.pc,
      reason: stall.reason });
    return { entry: null, stalled: true };
  }

  function isConditional(entry) {
    return Boolean(entry.decoded && entry.decoded.ok && entry.decoded.row.format === 'B');
  }

  /**
   * Resolving a branch in decode costs one flushed instruction instead of two,
   * and it costs a comparator in the decode stage plus a stall whenever an
   * operand is still being computed by the instruction directly ahead - which
   * no amount of forwarding fixes, because the value does not exist yet. Both
   * halves of that trade are here.
   */
  function earlyResolve(machine, events, entry) {
    const blocked = pendingProducer(machine, entry);

    if (blocked) {
      return stalling(machine, events, entry,
        { reason: 'early resolution: ' + Hazards.name(blocked) +
          ' is still being computed one instruction ahead', distance: 1 });
    }
    const rs1 = operandAtDecode(machine, entry.decoded.rs1);
    const rs2 = operandAtDecode(machine, entry.decoded.rs2);
    const shadow = new Array(32).fill(0);

    shadow[entry.decoded.rs1] = rs1;
    shadow[entry.decoded.rs2] = rs2;
    shadow[0] = 0;
    const state = { registers: shadow, pc: entry.pc, next: (entry.pc + 4) >>> 0,
      memory: deferredPort({}) };

    entry.decoded.row.run(state, entry.decoded);
    return afterEarly(machine, entry, state.next >>> 0);
  }

  function afterEarly(machine, entry, target) {
    entry.taken = target !== ((entry.pc + 4) >>> 0);
    entry.target = target;
    updatePrediction(machine, entry);
    entry.resolvedEarly = true;
    if (target === entry.predictedNext) return { entry: entry, stalled: false };
    machine.counters.flushes += 1;
    machine.counters.redirects += 1;
    if (entry.predicted) machine.counters.mispredicts += 1;
    entry.predictedNext = target;
    return { entry: entry, stalled: false, redirect: target };
  }

  /** A register the instruction directly ahead is about to write. It is in
   *  execute this cycle, so its value does not exist yet. */
  function pendingProducer(machine, entry) {
    const ahead = machine.latches.idEx;

    if (!Hazards.writesRegister(ahead)) return null;
    if (ahead.decoded.rd === entry.decoded.rs1) return entry.decoded.rs1;
    if (ahead.decoded.rd === entry.decoded.rs2) return entry.decoded.rs2;
    return null;
  }

  function operandAtDecode(machine, register) {
    if (register === 0) return 0;
    const found = Hazards.forwardFor(register, machine.latches, machine.config);

    return found.value === null ? (machine.registers[register] | 0) : found.value;
  }

  /* --------------------------------------------------------------- stage 1 */

  function fetchStage(machine, events, gates) {
    if (gates.redirect) { machine.pc = gates.redirect.target >>> 0; return bubble('flush'); }
    if (machine.frozen || machine.halted) {
      machine.counters.squashed += 1;
      return bubble('squashed by an exception');
    }
    if (gates.decode.stalled) return machine.latches.ifId;
    if (machine.issued >= machine.issueLimit) return bubble('drained');
    const structural = Hazards.structuralStall(machine.latches.exMem, machine.config);

    if (structural) {
      machine.counters.stalls += 1;
      machine.counters.structural += 1;
      events.push({ kind: 'stall', stage: 'IF', id: null, pc: machine.pc,
        reason: structural.reason });
      return bubble('structural');
    }
    return fetchAt(machine, machine.pc, events);
  }

  function fetchAt(machine, address, events) {
    const entry = { id: machine.issued, pc: address >>> 0, fetchedAt: machine.cycle };

    machine.issued += 1;
    const fetched = readInstruction(machine, entry.pc);

    if (fetched.fault) {
      entry.fault = fetched.fault;
      machine.pc = entry.pc;
      machine.frozen = true;
      events.push({ kind: 'fault', stage: 'IF', id: entry.id, pc: entry.pc,
        reason: fetched.fault.name });
      return entry;
    }
    entry.word = fetched.word;
    entry.decoded = Isa.decode(fetched.word);
    if (!entry.decoded.ok) return illegal(machine, entry, events);
    machine.pc = predictNext(machine, entry);
    return entry;
  }

  function illegal(machine, entry, events) {
    entry.fault = { cause: 2, value: entry.word, name: 'illegal instruction' };
    machine.frozen = true;
    events.push({ kind: 'fault', stage: 'ID', id: entry.id, pc: entry.pc,
      reason: 'illegal instruction' });
    return entry;
  }

  function readInstruction(machine, address) {
    if (address % 4 !== 0) {
      return { fault: { cause: Devices.CAUSE.misalignedFetch, value: address,
        name: 'instruction address misaligned' } };
    }
    const out = Devices.read(machine.memory, address, 4, false);

    if (out.fault) {
      return { fault: { cause: 1, value: address, name: 'instruction access fault' } };
    }
    return { word: out.value >>> 0 };
  }

  /**
   * Where fetch goes next. Without a predictor it assumes the next address in
   * order, which is right for everything except a taken branch; with one it
   * asks, and the branch target buffer supplies the address a direction
   * predictor cannot compute.
   */
  function predictNext(machine, entry) {
    const sequential = (entry.pc + 4) >>> 0;

    entry.predictedNext = sequential;
    if (!machine.predictor || !entry.decoded.ok) return sequential;
    if (isCall(entry)) machine.ras.push(sequential);
    if (isReturn(entry)) return fromReturnStack(machine, entry, sequential);
    if (isUnconditional(entry)) return fromTargetBuffer(machine, entry, sequential);
    if (entry.decoded.row.format !== 'B') return sequential;
    entry.predicted = true;
    machine.counters.predictions += 1;
    if (!machine.predictor.predict(entry.pc, { offset: entry.decoded.imm })) return sequential;
    return fromTargetBuffer(machine, entry, sequential);
  }

  /** A return is predicted from where its call was, not from where this site
   *  went last time - which is why returns are almost free and an indirect
   *  call through a function pointer is not. */
  function fromReturnStack(machine, entry, sequential) {
    const guess = machine.ras.pop();

    if (guess === null) return fromTargetBuffer(machine, entry, sequential);
    entry.predicted = true;
    entry.predictedFrom = 'return-address stack';
    machine.counters.predictions += 1;
    entry.predictedNext = guess >>> 0;
    return entry.predictedNext;
  }

  function fromTargetBuffer(machine, entry, sequential) {
    const target = machine.btb.lookup(entry.pc);

    if (target === null) return sequential;
    entry.predicted = true;
    entry.predictedFrom = entry.predictedFrom || 'branch target buffer';
    if (!entry.predictedNextCounted) {
      machine.counters.predictions += entry.decoded.row.format === 'B' ? 0 : 1;
      entry.predictedNextCounted = true;
    }
    entry.predictedNext = target >>> 0;
    return entry.predictedNext;
  }

  /* ------------------------------------------------------------- exceptions */

  /** An exception squashes everything younger the moment it is detected and
   *  commits when it reaches write-back, so older instructions still finish
   *  and nothing younger has any effect. That is what "precise" means. */
  function faulted(machine, entry, fault, events, stage) {
    entry.fault = fault;
    entry.faultStage = stage;
    machine.frozen = true;
    machine.latches.ifId = bubble('squashed by an exception');
    machine.latches.idEx = bubble('squashed by an exception');
    events.push({ kind: 'fault', stage: stage, id: entry.id, pc: entry.pc,
      reason: fault.name });
    return entry;
  }

  function freeze(machine, entry, events) {
    machine.frozen = true;
    return entry;
  }

  /**
   * Serialising instructions: mret, and anything that writes a control
   * register.
   *
   * Both change state that a younger instruction may already have read.
   * `mret` reads mepc, which the instruction two ahead of it in a trap handler
   * has usually just written; a CSR write changes what a later read returns.
   * Forwarding cannot help - there is no path from a control register - so the
   * pipeline drains instead, which is what real machines do and why a trap
   * handler costs far more than its instruction count suggests.
   */
  function serialising(entry) {
    if (entry.mret) return true;
    if (!entry.csrAccess) return false;
    return entry.csrAccess.op === 'w' || entry.decoded.rs1 !== 0;
  }

  function serialise(machine, entry, events) {
    entry.serialising = true;
    machine.frozen = true;
    machine.latches.ifId = bubble('drained by a serialising instruction');
    machine.latches.idEx = bubble('drained by a serialising instruction');
    events.push({ kind: 'serialise', stage: 'EX', id: entry.id, pc: entry.pc,
      reason: entry.mret ? 'mret: the pipeline drains before the return'
        : 'a control-register write drains the pipeline' });
    return entry;
  }

  /* ------------------------------------------------------------ the log */

  function record(machine, events, retiring) {
    if (!machine.config.trace) return;
    const stages = {};

    stages.IF = describe(machine.latches.ifId);
    stages.ID = describe(machine.latches.idEx);
    stages.EX = describe(machine.latches.exMem);
    stages.MEM = describe(machine.latches.memWb);
    stages.WB = describe(retiring);
    machine.log.push({ cycle: machine.cycle, stages: stages, events: events });
  }

  function describe(entry) {
    if (!entry) return null;
    if (entry.bubble) return { bubble: true, why: entry.why };
    return { id: entry.id, pc: entry.pc,
      name: entry.decoded && entry.decoded.ok ? entry.decoded.name : 'illegal' };
  }

  /* --------------------------------------------------------------- running */

  /** Nothing real left in flight. A bubble is not an instruction, so a
   *  pipeline full of them is empty - which is what draining looks like. */
  function empty(machine) {
    return ['ifId', 'idEx', 'exMem', 'memWb'].every(function (name) {
      const entry = machine.latches[name];

      return !entry || entry.bubble;
    });
  }

  function run(machine, options) {
    const settings = options || {};
    const budget = settings.cycles || 4000;

    if (settings.instructions) machine.issueLimit = settings.instructions;
    while (machine.cycle < budget) {
      if (machine.issued >= machine.issueLimit && empty(machine)) break;
      if (machine.halted) break;
      step(machine);
      if (settings.stopOnTrap && machine.traps.taken.length) break;
    }
    return summary(machine);
  }

  /**
   * The accounting, and it has to reconcile: every cycle is either an
   * instruction retiring, a cycle spent filling the pipeline, a stall or a
   * flush. A model whose cycles do not add up is measuring something it has
   * not described.
   */
  function summary(machine) {
    const counters = machine.counters;
    const accounted = machine.retired + counters.traps + counters.empty;

    return { cycles: machine.cycle, retired: machine.retired,
      ipc: machine.cycle ? machine.retired / machine.cycle : 0,
      stalls: counters.stalls, flushes: counters.flushes,
      structural: counters.structural, loadUse: counters.loadUse,
      dependency: counters.dependency, forwards: counters.forwards,
      mispredicts: counters.mispredicts, predictions: counters.predictions,
      redirects: counters.redirects,
      accuracy: counters.predictions
        ? (counters.predictions - counters.mispredicts) / counters.predictions : null,
      squashed: counters.squashed, empty: counters.empty, traps: counters.traps,
      causes: Object.assign({}, counters.causes),
      accounted: accounted, fill: FILL, reconciles: accounted === machine.cycle };
  }

  function snapshot(machine) {
    return { pc: machine.pc >>> 0, registers: machine.registers.slice(),
      csrs: Object.assign({}, machine.traps.csrs) };
  }

  /** Instructions on rows, cycles on columns - the shape the visualiser
   *  draws, built from the log rather than from a second walk. */
  function timeline(machine, options) {
    const settings = options || {};
    const rows = new Map();

    machine.log.slice(0, settings.cycles || 40).forEach(function (row) {
      STAGES.forEach(function (stage) {
        const cell = row.stages[stage];

        if (!cell || cell.bubble) return;
        if (!rows.has(cell.id)) {
          rows.set(cell.id, { id: cell.id, pc: cell.pc, name: cell.name, cells: {} });
        }
        rows.get(cell.id).cells[row.cycle] = stage;
      });
    });
    return Array.from(rows.values()).sort(function (a, b) { return a.id - b.id; });
  }

  return { STAGES: STAGES, FILL: FILL, create: create, step: step, run: run,
    snapshot: snapshot, summary: summary, timeline: timeline, empty: empty };
}));
