/**
 * OooCore - the modern core: many instructions in flight, executed in whatever
 * order their operands allow, committed in the order the program wrote them.
 *
 * It is the M35 pipeline with the ordering broken and then rebuilt out of three
 * structures. Renaming (`ooo/rename.js`) removes the two dependence kinds that
 * were about register names rather than values. The reorder buffer
 * (`ooo/rob.js`) commits in order, which is the only reason precise exceptions
 * still exist. The load/store queue (`ooo/lsq.js`) keeps memory ordering while
 * letting loads run ahead of stores whose addresses are not known yet.
 *
 * Everything the milestone claims is measured from the per-cycle event log this
 * produces, and the architectural state is compared against M34's behavioural
 * simulator - which shares nothing with this file but the instruction table.
 *
 * Two things are deliberately out of scope and said rather than half-built:
 * asynchronous interrupts, as in M35, and a real memory hierarchy. The cache
 * here is one small set-associative level, enough to make misses and their
 * overlap measurable, and M37 is where it gets a milestone.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.OooCore = api;
    scope.Ooo = scope.Ooo || {};
    scope.Ooo.Core = api;
  }
}(this, function (root) {
  'use strict';

  const has = root && root.Brv32;
  const Isa = has && root.Brv32.Isa ? root.Brv32.Isa : require('./brv32/isa.js');
  const Devices = has && root.Brv32.Devices ? root.Brv32.Devices : require('./brv32/devices.js');
  const Traps = has && root.Brv32.Traps ? root.Brv32.Traps : require('./brv32/traps.js');
  const Predictors = has && root.Brv32.Predictors ? root.Brv32.Predictors
    : require('./brv32/predictors.js');
  const shared = root && root.Ooo ? root.Ooo : null;
  const Rename = shared && shared.Rename ? shared.Rename : require('./ooo/rename.js');
  const Rob = shared && shared.Rob ? shared.Rob : require('./ooo/rob.js');
  const Scheduler = shared && shared.Scheduler ? shared.Scheduler
    : require('./ooo/scheduler.js');
  const Lsq = shared && shared.Lsq ? shared.Lsq : require('./ooo/lsq.js');
  const Cache = shared && shared.Cache ? shared.Cache : require('./ooo/cache.js');

  function create(options) {
    const settings = options || {};
    const memory = Devices.create(settings);

    if (settings.image) Devices.loadImage(memory, settings.base || 0, settings.image);
    const registers = new Array(Rename.ARCH).fill(0);

    registers[2] = settings.stack === undefined ? 0x10000f00 : settings.stack;
    return {
      memory: memory, traps: Traps.create(settings),
      pc: settings.entry === undefined ? 0 : settings.entry >>> 0,
      rename: Rename.create(Object.assign({ registers: registers }, settings)),
      rob: Rob.create(settings),
      scheduler: Scheduler.create(settings), lsq: Lsq.create(settings),
      cache: Cache.create(settings),
      predictor: Predictors.create(settings.predictor || 'bimodal', settings),
      btb: Predictors.createBtb(settings), ras: Predictors.createRas(settings),
      cycle: 0, issued: 0, retired: 0, frozen: false, halted: false,
      log: [], history: [],
      counters: { fetched: 0, mispredicts: 0, predictions: 0, redirects: 0,
        squashed: 0, fetchStalls: 0, dispatchStalls: 0, commitEmpty: 0, traps: 0,
        fastRecoveries: 0, unwound: 0, memoryMisspeculations: 0 },
      config: { width: settings.width || 4, trace: settings.trace !== false,
        commitWidth: settings.commitWidth || settings.width || 4 }
    };
  }

  /* ------------------------------------------------------------- one cycle */

  function step(core) {
    const events = [];

    Lsq.retire(core.lsq, core.cycle);
    commitStage(core, events);
    completeStage(core, events);
    issueStage(core, events);
    dispatchStage(core, events);
    fetchStage(core, events);
    record(core, events);
    core.cycle += 1;
    return events;
  }

  /* --------------------------------------------------------------- commit */

  /** In order, and the only place anything architectural happens. */
  function commitStage(core, events) {
    let taken = 0;

    while (taken < core.config.commitWidth && Rob.canCommit(core.rob)) {
      const entry = Rob.head(core.rob);

      if (entry.fault) { commitTrap(core, entry, events); return; }
      Rob.commit(core.rob);
      finish(core, entry, events);
      taken += 1;
      if (entry.serialising) { resume(core, entry, events); return; }
    }
    if (!taken) core.counters.commitEmpty += 1;
  }

  function finish(core, entry, events) {
    if (entry.kind === 'store') storeToMemory(core, entry);
    if (entry.csrAccess) applyCsr(core, entry);
    if (entry.dest && entry.dest.renamed) Rename.release(core.rename, entry.dest.old);
    Rename.drop(core.rename, entry.id);
    Lsq.release(core.lsq, entry.id);
    core.retired += 1;
    entry.committedAt = core.cycle;
    events.push({ kind: 'commit', id: entry.id, pc: entry.pc, name: entry.name });
  }

  function storeToMemory(core, entry) {
    const record = Lsq.entryFor(core.lsq, entry.id);

    if (!record || !record.resolved) return;
    Devices.write(core.memory, record.address, record.value, entry.width || 4);
  }

  function applyCsr(core, entry) {
    const access = entry.csrAccess;
    const before = entry.csrBefore | 0;
    const source = entry.decoded.rs1 === 0 ? 0 : entry.rs1v | 0;

    Traps.write(core.traps, access.csr, access.op === 'w' ? source : (before | source));
  }

  function commitTrap(core, entry, events) {
    core.counters.traps += 1;
    squashFrom(core, entry.id, events, 'exception');
    Rob.commit(core.rob);
    core.pc = Traps.enter(core.traps, entry.fault, entry.pc);
    core.frozen = false;
    events.push({ kind: 'trap', id: entry.id, pc: entry.pc, reason: entry.fault.name });
  }

  function resume(core, entry, events) {
    core.pc = entry.mret ? Traps.exit(core.traps) : ((entry.pc + 4) >>> 0);
    core.frozen = false;
    events.push({ kind: 'resume', id: entry.id, pc: core.pc,
      reason: entry.mret ? 'mret' : 'a control-register write drained the machine' });
  }

  /* ------------------------------------------------------------- complete */

  /** A result arrives: write the physical register, which wakes everything
   *  waiting on it. */
  function completeStage(core, events) {
    const done = Scheduler.completed(core.scheduler, core.cycle);

    done.forEach(function (entry) {
      Scheduler.remove(core.scheduler, [entry]);
      if (entry.dest && entry.dest.renamed) {
        Rename.write(core.rename, entry.dest.phys, entry.value);
      }
      entry.state = 'completed';
      entry.completedAt = core.cycle;
      Lsq.complete(core.lsq, entry.id, entry.value);
      events.push({ kind: 'complete', id: entry.id, pc: entry.pc, name: entry.name });
    });
    recoverOldest(core, done, events);
  }

  /**
   * Recover from the OLDEST misprediction that completed, and only that one.
   *
   * Several branches can resolve in the same cycle, and a younger one may
   * resolve first. Acting on the younger one redirects fetch to a path the
   * older branch has already invalidated - so the machine has to pick the
   * oldest, and everything younger is about to be squashed by it anyway.
   */
  function recoverOldest(core, done, events) {
    const wrong = done.filter(function (entry) {
      return entry.redirect !== undefined && entry.redirect !== null;
    }).sort(function (left, right) { return left.id - right.id; });

    if (!wrong.length) return;
    recover(core, wrong[0], events);
  }

  /**
   * A branch resolved differently from the guess. Everything younger is
   * squashed, the alias table is restored from the checkpoint taken when the
   * branch was renamed, and fetch is redirected - which is a copy rather than
   * an unwind, and that difference is most of the misprediction penalty.
   */
  function recover(core, entry, events) {
    squashFrom(core, entry.id, events, 'misprediction');
    Rename.restore(core.rename, entry.id);
    core.counters.fastRecoveries += 1;
    core.pc = entry.redirect >>> 0;
    core.frozen = false;
    core.counters.redirects += 1;
    if (entry.predicted) core.counters.mispredicts += 1;
    events.push({ kind: 'recover', id: entry.id, pc: entry.pc, target: entry.redirect,
      reason: entry.taken ? 'taken, predicted not taken' : 'not taken, predicted taken' });
  }

  /**
   * Everything younger than an entry, wherever it happens to be.
   *
   * That last part is the whole of it. Squashing the reorder buffer, the issue
   * queue and the load/store queue leaves the instructions that were FETCHED
   * and not yet dispatched sitting in the fetch buffer - and they are just as
   * speculative as the rest. Missing them let a mispredicted path commit here:
   * the machine squashed twenty-eight in-flight entries, kept eight fetched
   * ones, and dispatched them into the recovered path a few cycles later.
   */
  function squashFrom(core, id, events, why) {
    return applySquash(core, Rob.squashAfter(core.rob, id),
      { id: id, why: why, unwind: why !== 'misprediction' }, events);
  }

  /**
   * Squash the named instruction as well as everything after it.
   *
   * Only a memory misspeculation needs this. A mispredicted branch still
   * commits and an exception still commits; a load that read an address an
   * older store then wrote did not happen at all and has to be fetched again.
   */
  function squashIncluding(core, id, events, why) {
    return applySquash(core, Rob.squashInclusive(core.rob, id),
      { id: id, why: why, unwind: true }, events);
  }

  function applySquash(core, removed, about, events) {
    const ids = removed.map(function (row) { return row.id; });
    const pending = core.history.length;

    core.history.length = 0;
    Scheduler.squash(core.scheduler, ids);
    Lsq.squash(core.lsq, ids);
    removed.forEach(function (row) { Rename.drop(core.rename, row.id); });
    if (about.unwind) unwindRenames(core, removed);
    core.counters.squashed += removed.length + pending;
    if (removed.length) {
      events.push({ kind: 'squash', id: about.id, count: removed.length, reason: about.why });
    }
    unfreezeIfSquashed(core);
    return removed;
  }

  /**
   * Give back the physical registers of squashed instructions, youngest first.
   *
   * A branch recovers through its checkpoint and does not come here. Everything
   * else does, and it has to: without this, every trap and every memory
   * misspeculation leaks one physical register per squashed instruction, and
   * the machine eventually stalls at dispatch forever with an empty pipeline -
   * the third appearance in this file of the same symptom.
   */
  function unwindRenames(core, removed) {
    core.counters.unwound += removed.length;
    Rename.unwind(core.rename, removed.slice().reverse().filter(function (entry) {
      return entry.dest && entry.dest.renamed;
    }).map(function (entry) {
      return { arch: entry.decoded.rd, phys: entry.dest.phys, old: entry.dest.old };
    }));
  }

  /**
   * A fault on the wrong path is not a fault.
   *
   * Fetch runs far ahead of every unresolved branch on this machine - much
   * further than on the in-order pipeline - so it reads past the end of
   * programs constantly and decodes zeros as illegal instructions. Freezing on
   * one and not unfreezing when the redirect squashes it stops the machine
   * dead, which is the same bug M35 had and a great deal easier to hit here.
   */
  function unfreezeIfSquashed(core) {
    if (!core.frozen) return;
    const alive = core.rob.entries.some(function (entry) {
      return entry.fault || entry.serialising;
    }) || core.history.some(function (entry) {
      return entry.fault || entry.serialising;
    });

    if (!alive) core.frozen = false;
  }

  /* ---------------------------------------------------------------- issue */

  function issueStage(core, events) {
    Scheduler.wakeup(core.scheduler, function (phys) {
      return phys === 0 || core.rename.ready[phys];
    });
    const chosen = Scheduler.select(core.scheduler, core.cycle);

    chosen.forEach(function (entry) {
      entry.state = 'executing';
      execute(core, entry, events);
      events.push({ kind: 'issue', id: entry.id, pc: entry.pc, name: entry.name,
        port: entry.port });
    });
    if (!chosen.length && core.scheduler.queue.length) {
      events.push({ kind: 'noIssue', reason: Scheduler.reasonFor(core.scheduler, core.cycle) });
    }
  }

  /**
   * Run the instruction's semantics with a register file built from the
   * physical registers its sources were renamed to.
   *
   * Only two slots matter, so the shadow array is cheap - and building it from
   * the renamed sources rather than from an architectural file is what makes
   * this an out-of-order machine rather than an in-order one wearing a hat.
   */
  function execute(core, entry, events) {
    const shadow = new Array(32).fill(0);

    shadow[entry.decoded.rs1] = readSource(core, entry, 'rs1');
    shadow[entry.decoded.rs2] = readSource(core, entry, 'rs2');
    shadow[0] = 0;
    entry.rs1v = shadow[entry.decoded.rs1];
    entry.rs2v = shadow[entry.decoded.rs2];

    const state = { registers: shadow, pc: entry.pc, next: (entry.pc + 4) >>> 0,
      memory: deferredPort(entry) };

    entry.access = null;
    entry.decoded.row.run(state, entry.decoded);
    entry.value = shadow[entry.decoded.rd] | 0;
    entry.csrAccess = state.csrAccess || null;
    entry.mret = Boolean(state.mret);
    if (entry.csrAccess) entry.csrBefore = Traps.read(core.traps, entry.csrAccess.csr);
    if (entry.csrAccess && entry.decoded.rd !== 0) entry.value = entry.csrBefore | 0;
    if (state.trap) { entry.fault = state.trap; return; }
    afterExecute(core, entry, state, events);
  }

  function readSource(core, entry, which) {
    const arch = entry.decoded[which];

    if (arch === 0) return 0;
    const phys = entry.map[which];

    return phys === undefined ? 0 : core.rename.values[phys] | 0;
  }

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

  function afterExecute(core, entry, state, events) {
    if (entry.access) { memoryAccess(core, entry, events); return; }
    if (!entry.decoded.ok) return;
    const target = state.next >>> 0;

    entry.taken = target !== ((entry.pc + 4) >>> 0);
    entry.target = target;
    updatePrediction(core, entry);
    entry.redirect = target === entry.predictedNext ? null : target;
  }

  /* --------------------------------------------------------------- memory */

  /**
   * An address has been computed. Before anything else, find out whether the
   * access is legal.
   *
   * A store never reaches memory until it commits, so the only way it can
   * raise a precise exception is for the fault to be detected here and carried
   * with the instruction - and this check is not optional bookkeeping. Without
   * it a misaligned or unmapped store simply did not fault on this machine
   * while the in-order reference trapped on the same instruction, which is a
   * disagreement no amount of register comparison at a matching retire count
   * will show: the machine that skipped the trap has retired MORE
   * instructions, and both of them still hold the right values.
   *
   * The load is checked here as well rather than only inside the memory read,
   * because a load that finds its value in the store queue never performs a
   * memory read at all and would otherwise skip the check entirely.
   */
  function memoryAccess(core, entry, events) {
    const access = entry.access;
    const checked = Devices.checkAccess(core.memory, access.address, access.width,
      access.kind === 'write');

    entry.width = access.width;
    if (checked.fault) { entry.fault = checked.fault; return; }
    if (access.kind === 'write') { resolveStore(core, entry, access, events); return; }
    resolveLoad(core, entry, access, events);
  }

  /**
   * A store resolves its address, and any younger load that already read it
   * was reading a value the store was about to overwrite.
   *
   * The load itself is squashed, not merely everything after it, because the
   * load is the instruction that was wrong. Recovery is an unwind rather than
   * a checkpoint restore: nobody took a checkpoint here, because nobody knew
   * this was a place where the machine might be wrong.
   */
  function resolveStore(core, entry, access, events) {
    const offenders = Lsq.resolveStore(core.lsq, entry.id, access.address, access.value);

    if (!offenders.length) return;
    core.counters.memoryMisspeculations += 1;
    squashIncluding(core, offenders[0].id, events, 'memory misspeculation');
    core.pc = offenders[0].pc >>> 0;
    core.frozen = false;
    events.push({ kind: 'memoryMisspeculation', id: entry.id, pc: entry.pc,
      reason: 'a younger load had already read 0x' + access.address.toString(16) });
  }

  /**
   * A load: check whether it is allowed to go, then try the store queue, then
   * memory. A forwarded load never touches the cache at all, which is worth
   * seeing - it is the reason a store followed immediately by a load of the
   * same address is nearly free.
   */
  function resolveLoad(core, entry, access, events) {
    const allowed = Lsq.loadMayIssue(core.lsq, entry.id);

    if (!allowed.ok) { defer(core, entry, allowed.reason, events); return; }
    Lsq.resolveLoad(core.lsq, entry.id, access.address);
    const forwarded = Lsq.forwardFor(core.lsq, entry.id, access.address);

    if (forwarded) {
      entry.value = Devices.extend(forwarded.value, access.width, access.signed);
      Lsq.entryFor(core.lsq, entry.id).forwarded = true;
      events.push({ kind: 'forward', id: entry.id, pc: entry.pc,
        reason: 'from the store at 0x' + access.address.toString(16) });
      return;
    }
    fromMemory(core, entry, access, events);
  }

  function fromMemory(core, entry, access, events) {
    const started = Lsq.begin(core.lsq, core.cache, access.address, core.cycle);

    if (!started.ok) { defer(core, entry, started.reason, events); return; }
    const out = Devices.read(core.memory, access.address, access.width, access.signed);

    if (out.fault) { entry.fault = out.fault; return; }
    entry.value = out.value | 0;
    entry.completesAt = core.cycle + started.cycles;
    if (!started.hit) {
      events.push({ kind: 'miss', id: entry.id, pc: entry.pc,
        reason: 'cache miss at 0x' + access.address.toString(16) +
          ', ' + started.cycles + ' cycles' });
    }
  }

  /** Put an instruction back in the queue: it issued, could not proceed, and
   *  will be selected again. */
  function defer(core, entry, reason, events) {
    entry.issuedAt = undefined;
    entry.completesAt = undefined;
    entry.state = 'waiting';
    events.push({ kind: 'defer', id: entry.id, pc: entry.pc, reason: reason });
  }

  /* -------------------------------------------------------------- dispatch */

  function dispatchStage(core, events) {
    let taken = 0;

    while (taken < core.config.width && core.history.length) {
      if (!canDispatch(core, events)) return;
      const entry = core.history[0];

      if (isMemory(entry) && Lsq.isFull(core.lsq)) {
        core.counters.dispatchStalls += 1;
        events.push({ kind: 'dispatchStall', reason: 'the load/store queue is full' });
        return;
      }
      core.history.shift();
      if (!renameEntry(core, entry, events)) { core.history.unshift(entry); return; }
      Rob.dispatch(core.rob, entry);
      if (isMemory(entry)) Lsq.allocate(core.lsq, entry);
      Scheduler.enqueue(core.scheduler, entry);
      events.push({ kind: 'dispatch', id: entry.id, pc: entry.pc, name: entry.name });
      taken += 1;
      if (entry.serialising) { core.frozen = true; return; }
    }
  }

  function isMemory(entry) {
    return entry.kind === 'load' || entry.kind === 'store';
  }

  function canDispatch(core, events) {
    if (Rob.isFull(core.rob)) {
      core.counters.dispatchStalls += 1;
      events.push({ kind: 'dispatchStall', reason: 'the reorder buffer is full' });
      return false;
    }
    if (Scheduler.isFull(core.scheduler)) {
      core.counters.dispatchStalls += 1;
      events.push({ kind: 'dispatchStall', reason: 'the issue queue is full' });
      return false;
    }
    return true;
  }

  function renameEntry(core, entry, events) {
    entry.map = { rs1: Rename.lookup(core.rename, entry.decoded.rs1).phys,
      rs2: Rename.lookup(core.rename, entry.decoded.rs2).phys };
    entry.sources = sourcesOf(core, entry);
    entry.ready = entry.sources.every(function (phys) {
      return phys === 0 || core.rename.ready[phys];
    });
    if (writesRegister(entry.decoded)) {
      const dest = Rename.allocate(core.rename, entry.decoded.rd);

      if (!dest) {
        core.counters.dispatchStalls += 1;
        events.push({ kind: 'dispatchStall', reason: 'no free physical register' });
        return false;
      }
      entry.dest = dest;
    } else {
      entry.dest = { renamed: false };
    }
    /* Every control transfer gets a checkpoint, including the conditional
       branches that write no register at all. Taking it only where a
       destination was allocated leaves exactly the instructions most likely to
       mispredict with nothing to restore from - and the machine then runs on
       with an alias table describing a path it did not take. */
    if (entry.kind === 'branch' || entry.kind === 'jump') {
      Rename.checkpoint(core.rename, entry.id);
    }
    return true;
  }

  function sourcesOf(core, entry) {
    const reads = readsRegisters(entry.decoded);
    const out = [];

    if (reads.rs1) out.push(entry.map.rs1);
    if (reads.rs2) out.push(entry.map.rs2);
    return out;
  }

  function writesRegister(decoded) {
    const row = decoded.row;

    if (row.format === 'S' || row.format === 'B') return false;
    if (row.fixed !== undefined) return false;
    return decoded.rd !== 0;
  }

  function readsRegisters(decoded) {
    const format = decoded.row.format;

    return { rs1: format !== 'U' && format !== 'J',
      rs2: format === 'R' || format === 'S' || format === 'B' };
  }

  /* ----------------------------------------------------------------- fetch */

  function fetchStage(core, events) {
    if (core.frozen || core.halted) { core.counters.fetchStalls += 1; return; }
    if (core.issued >= (core.issueLimit || Infinity)) return;
    for (let at = 0; at < core.config.width; at += 1) {
      if (core.history.length >= core.config.width * 2) return;
      if (!fetchOne(core, events)) return;
    }
  }

  function fetchOne(core, events) {
    const pc = core.pc >>> 0;
    const word = readInstruction(core, pc);
    const entry = { id: core.issued, pc: pc, fetchedAt: core.cycle, state: 'fetched',
      speculative: core.rob.entries.length > 0 };

    core.issued += 1;
    core.counters.fetched += 1;
    if (word.fault) {
      entry.fault = word.fault;
      entry.decoded = illegalDecode();
      entry.name = 'fault';
      entry.kind = 'alu';
      entry.latency = 1;
      entry.predictedNext = (entry.pc + 4) >>> 0;
      core.frozen = true;
      core.history.push(entry);
      return false;
    }
    entry.decoded = Isa.decode(word.word);
    if (!entry.decoded.ok) {
      entry.fault = { cause: 2, value: word.word, name: 'illegal instruction' };
      entry.decoded = illegalDecode();
      entry.name = 'illegal';
      entry.kind = 'alu';
      entry.latency = 1;
      entry.predictedNext = (entry.pc + 4) >>> 0;
      core.frozen = true;
      core.history.push(entry);
      return false;
    }
    return classify(core, entry, events);
  }

  function illegalDecode() {
    return { ok: false, rs1: 0, rs2: 0, rd: 0,
      row: { format: 'I', run: function () {} } };
  }

  function classify(core, entry, events) {
    const row = entry.decoded.row;

    entry.name = entry.decoded.name;
    entry.kind = kindOf(entry.decoded);
    entry.latency = Scheduler.LATENCY[entry.kind] || 1;
    entry.serialising = isSerialising(entry.decoded);
    core.pc = predictNext(core, entry);
    core.history.push(entry);
    events.push({ kind: 'fetch', id: entry.id, pc: entry.pc, name: entry.name });
    return !entry.serialising;
  }

  function kindOf(decoded) {
    const row = decoded.row;

    if (row.opcode === 0x03) return 'load';
    if (row.format === 'S') return 'store';
    if (row.format === 'B') return 'branch';
    if (row.format === 'J' || row.opcode === 0x67) return 'jump';
    if (row.opcode === 0x73) return 'system';
    return 'alu';
  }

  function isSerialising(decoded) {
    if (decoded.row.opcode !== 0x73) return false;
    if (decoded.row.csr) return decoded.row.csr === true;
    return decoded.name === 'mret';
  }

  function readInstruction(core, address) {
    if (address % 4 !== 0) {
      return { fault: { cause: Devices.CAUSE.misalignedFetch, value: address,
        name: 'instruction address misaligned' } };
    }
    const out = Devices.read(core.memory, address, 4, false);

    if (out.fault) {
      return { fault: { cause: 1, value: address, name: 'instruction access fault' } };
    }
    return { word: out.value >>> 0 };
  }

  function predictNext(core, entry) {
    const sequential = (entry.pc + 4) >>> 0;

    entry.predictedNext = sequential;
    if (entry.kind === 'jump') return fromBuffer(core, entry, sequential);
    if (entry.kind !== 'branch') return sequential;
    entry.predicted = true;
    core.counters.predictions += 1;
    if (!core.predictor.predict(entry.pc, { offset: entry.decoded.imm })) return sequential;
    return fromBuffer(core, entry, sequential);
  }

  function fromBuffer(core, entry, sequential) {
    const target = core.btb.lookup(entry.pc);

    if (target === null) return sequential;
    entry.predicted = true;
    entry.predictedNext = target >>> 0;
    return entry.predictedNext;
  }

  function updatePrediction(core, entry) {
    if (entry.kind === 'branch') {
      core.predictor.update(entry.pc, { taken: entry.taken, offset: entry.decoded.imm });
    }
    if (entry.taken || entry.kind === 'jump') core.btb.update(entry.pc, entry.target);
  }

  /* ------------------------------------------------------------------ run */

  /**
   * The per-cycle log, which every measurement in M36 is derived from.
   *
   * `outstanding` is the number of cache misses in flight, and it is recorded
   * rather than reconstructed because reconstructing it means knowing the miss
   * latency - which would make the memory-level-parallelism measurement in
   * 36.6 a restatement of the configuration instead of an observation of the
   * run.
   */
  function record(core, events) {
    if (!core.config.trace) return;
    core.log.push({ cycle: core.cycle, events: events,
      window: Rob.window(core.rob),
      outstanding: core.lsq.outstanding.length,
      committed: events.filter(function (row) { return row.kind === 'commit'; }).length });
  }

  function empty(core) {
    return !core.rob.entries.length && !core.history.length;
  }

  function run(core, options) {
    const settings = options || {};
    const budget = settings.cycles || 4000;

    if (settings.instructions) core.issueLimit = settings.instructions;
    while (core.cycle < budget) {
      if (core.issueLimit && core.issued >= core.issueLimit && empty(core)) break;
      if (core.halted) break;
      step(core);
      if (settings.stopOnTrap && core.traps.taken.length) break;
    }
    return summary(core);
  }

  function snapshot(core) {
    return { pc: core.pc >>> 0, registers: Rename.architectural(core.rename),
      csrs: Object.assign({}, core.traps.csrs) };
  }

  function summary(core) {
    const counters = core.counters;

    return { cycles: core.cycle, retired: core.retired,
      ipc: core.cycle ? core.retired / core.cycle : 0,
      fetched: counters.fetched, squashed: counters.squashed,
      mispredicts: counters.mispredicts, predictions: counters.predictions,
      redirects: counters.redirects, traps: counters.traps,
      dispatchStalls: counters.dispatchStalls, commitEmpty: counters.commitEmpty,
      fastRecoveries: counters.fastRecoveries, unwound: counters.unwound,
      memoryMisspeculations: counters.memoryMisspeculations,
      rob: Rob.summary(core.rob), rename: Rename.summary(core.rename),
      scheduler: Scheduler.summary(core.scheduler),
      lsq: Lsq.summary(core.lsq, core.cycle), cache: Cache.summary(core.cache),
      width: core.config.width };
  }

  return { create: create, step: step, run: run, snapshot: snapshot, summary: summary,
    empty: empty, kindOf: kindOf, readsRegisters: readsRegisters,
    writesRegister: writesRegister };
}));
