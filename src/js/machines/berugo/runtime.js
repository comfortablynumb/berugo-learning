/**
 * Runtime support: stack maps, safepoints, source-level stack traces from
 * compiled frames, and the calling convention that ties them together.
 *
 * The claim this section is built on is that **precise garbage collection and
 * a readable stack trace are the same metadata read two ways**. Both need to
 * answer "at this exact instruction, which locations hold live values, and
 * where did this instruction come from" — the collector to find roots without
 * guessing, the debugger to name a source line. A runtime that skips the
 * metadata ends up with conservative collection and traces full of frame
 * addresses, and both of those are consequences rather than choices.
 *
 * The stack map is computed statically from the bytecode and then **checked
 * against what the program goes on to read**, not against what the frame
 * happens to hold. That distinction is the whole of precision: a register
 * still holding an object nobody will read again is exactly what a precise
 * collector is entitled to ignore, so its absence from the map is the feature
 * rather than the bug. The bug is the other direction — a register the
 * program does read, missing from the map — and finding it needs the program
 * run, because it is a question about the future.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Berugo = scope.Berugo || {};
    scope.Berugo.Runtime = api;
  }
}(this, function (root) {
  'use strict';

  const berugo = root && root.Berugo ? root.Berugo : null;
  const Interp = berugo && berugo.Interp ? berugo.Interp : require('./interp.js');
  const Vm = berugo && berugo.Vm ? berugo.Vm : require('./vm.js');
  const Bytecode = berugo && berugo.Bytecode ? berugo.Bytecode : require('./bytecode.js');

  /**
   * The boundary between compiled code and the runtime, written down. Every
   * row is a decision a real back end has to make and then honour everywhere,
   * and the reason to state them as a table is that a convention nobody wrote
   * down is a convention two parts of the compiler will disagree about.
   */
  const CONVENTION = [
    { rule: 'Arguments are captures then parameters, in order',
      why: 'a closure\'s captured values are ordinary leading parameters, so one call path serves both',
      breaks: 'a closure called with its captures in the wrong place reads a parameter as a capture' },
    { rule: 'The callee allocates its own frame',
      why: 'the caller does not know how many registers or slots the callee needs',
      breaks: 'a caller-allocated frame has to be resized on every recompilation' },
    { rule: 'The return value goes where the caller reserved it',
      why: 'the register set names a destination register and the stack set pushes',
      breaks: 'a returned value on the wrong stack leaves the caller reading its own operand' },
    { rule: 'A safepoint is a call or an allocation',
      why: 'those are the only instructions that can trigger a collection',
      breaks: 'a collection at an unmapped point scans a frame the map does not describe' },
    { rule: 'Every instruction keeps the span it came from',
      why: 'the stack trace and the source map are the same field read twice',
      breaks: 'a trace that names a bytecode offset is a trace nobody can act on' }
  ];

  /** Instructions after which a collection may run, and therefore need a map. */
  const SAFEPOINTS = ['CALL', 'CALL_R', 'MAKE_ARRAY', 'MAKE_ARRAY_R', 'MAKE_RECORD',
    'MAKE_RECORD_R', 'MAKE_CLOSURE', 'MAKE_CLOSURE_R'];

  function isSafepoint(inst) {
    return SAFEPOINTS.indexOf(inst.op) !== -1;
  }

  /* --------------------------------------------------------- bytecode liveness */

  function usesOf(inst, set) {
    const spec = set[inst.op];
    const out = [];

    if (!spec) return out;
    ['a', 'b', 'c'].forEach(function (name) {
      if (spec.operands.indexOf(name) !== -1 && typeof inst[name] === 'number') out.push(inst[name]);
    });
    if (spec.operands.indexOf('base') !== -1) {
      for (let at = 0; at < (inst.count || 0); at += 1) out.push(inst.base + at);
    }
    return out;
  }

  function definitionOf(inst, set) {
    const spec = set[inst.op];

    if (!spec || spec.operands.indexOf('d') === -1) return null;
    return inst.d;
  }

  /**
   * Backwards over the linear code, treating a jump as an edge. Iterated to a
   * fixpoint because a loop's back edge makes a value live at instructions
   * before its own definition — the same reason M29's dataflow needed a
   * worklist, one representation down.
   */
  function liveness(chunk) {
    const set = chunk.set || Bytecode.setFor(chunk.mode);
    const live = chunk.code.map(function () { return new Set(); });

    for (let round = 0; round < 12; round += 1) {
      let changed = false;

      for (let pc = chunk.code.length - 1; pc >= 0; pc -= 1) {
        if (updateAt(chunk, set, live, pc)) changed = true;
      }
      if (!changed) break;
    }
    return live;
  }

  function updateAt(chunk, set, live, pc) {
    const inst = chunk.code[pc];
    const after = new Set();

    successorsOf(chunk, pc).forEach(function (next) {
      live[next].forEach(function (register) { after.add(register); });
    });
    const target = definitionOf(inst, set);

    if (target !== null) after.delete(target);
    usesOf(inst, set).forEach(function (register) { after.add(register); });
    if (sameSet(after, live[pc])) return false;
    live[pc] = after;
    return true;
  }

  function successorsOf(chunk, pc) {
    const inst = chunk.code[pc];

    if (inst.op === 'RET' || inst.op === 'RET_R') return [];
    if (inst.op === 'JUMP' || inst.op === 'JUMP_R') return [inst.target];
    if (inst.op === 'JUMP_FALSE' || inst.op === 'JUMP_FALSE_R') {
      return [inst.target, pc + 1].filter(function (at) { return at < chunk.code.length; });
    }
    return pc + 1 < chunk.code.length ? [pc + 1] : [];
  }

  function sameSet(a, b) {
    if (a.size !== b.size) return false;
    let equal = true;

    a.forEach(function (value) { if (!b.has(value)) equal = false; });
    return equal;
  }

  /* ------------------------------------------------------------- stack maps */

  /**
   * One row per safepoint: the registers live across it and the slots the
   * function declares. A slot is always in the map because the frame owns it
   * for its whole lifetime; a register is only in it if something after this
   * point reads it, which is exactly the set liveness computes.
   */
  function stackMap(chunk) {
    const live = liveness(chunk);
    const depths = chunk.mode === 'stack' ? stackDepths(chunk) : null;

    return chunk.code.map(function (inst, pc) {
      if (!isSafepoint(inst)) return null;
      return { pc: pc, op: inst.op, origin: inst.origin || '', span: inst.span || null,
        registers: Array.from(live[pc]).sort(function (a, b) { return a - b; }),
        slots: chunk.slots.map(function (name, at) { return at; }),
        stackDepth: depths ? depths[pc] : 0 };
    }).filter(Boolean);
  }

  /** How deep the operand stack is at each instruction of a stack chunk. */
  function stackDepths(chunk) {
    const set = chunk.set || Bytecode.setFor(chunk.mode);
    const depth = new Array(chunk.code.length).fill(0);

    for (let pc = 0; pc < chunk.code.length; pc += 1) {
      const inst = chunk.code[pc];
      const spec = set[inst.op];
      const here = depth[pc];
      const next = here - popsOf(inst, spec) + (spec ? spec.push || 0 : (inst.op === 'LOAD_TEMP' ? 1 : 0));

      successorsOf(chunk, pc).forEach(function (at) { depth[at] = Math.max(depth[at], next); });
    }
    return depth;
  }

  function popsOf(inst, spec) {
    if (!spec) return inst.op === 'STORE_TEMP' ? 1 : 0;
    if (spec.pop !== null) return spec.pop;
    if (inst.op === 'CALL') return inst.count + 1;
    if (inst.op === 'RET') return inst.k === null ? 0 : 1;
    return inst.count || 0;
  }

  /* ------------------------------------------------------- checking the map */

  function isReference(value) {
    return Boolean(value) && typeof value === 'object' && typeof value.v === 'string';
  }

  /**
   * The check, and the acceptance criterion — run against a DYNAMIC liveness
   * oracle rather than against what the frame happens to hold.
   *
   * The direction matters and is easy to get backwards. A register still
   * physically holding an object it will never be read from again is not a
   * bug; leaving it out of the map is the whole point of a PRECISE collector,
   * and a first version of this check reported fifteen of those as failures.
   * The real question is the other one: of the registers the program actually
   * READS after this safepoint, before writing them, is every one in the map?
   * A miss there is a root the collector never scans, and the object under it
   * is freed while something still needs it.
   *
   * So each safepoint opens an observation on its own frame, every subsequent
   * read on that frame is recorded until the frame returns, and the recorded
   * set has to be a subset of what the map promised. Registers the map lists
   * that the run never read are precision slack and are reported apart.
   */
  function checkSafepoints(compiled, options) {
    const settings = options || {};
    const maps = mapsFor(compiled);
    const state = Vm.makeState(compiled, settings);
    const chunk = state.chunks[state.main];
    const found = { safepoints: 0, missed: [], slack: 0, observed: 0, checked: 0 };
    const open = new Map();

    Vm.startFrame(state, chunk, [], []);
    try {
      while (!state.done) observeStep(state, maps, found, open);
    } catch (problem) {
      found.error = String(problem.message || problem);
    }
    open.forEach(function (rows) { rows.forEach(function (row) { settle(row, found); }); });
    return Object.assign(found, { ok: found.missed.length === 0 });
  }

  function mapsFor(compiled) {
    const maps = {};

    Object.keys(compiled.chunks).forEach(function (name) {
      maps[name] = {};
      stackMap(compiled.chunks[name]).forEach(function (row) { maps[name][row.pc] = row; });
    });
    return maps;
  }

  function observeStep(state, maps, found, open) {
    const frame = state.frames[state.frames.length - 1];
    const before = state.frames.length;
    const row = maps[frame.chunk.name][frame.pc];
    const set = frame.chunk.set || Bytecode.setFor(frame.chunk.mode);
    const inst = frame.chunk.code[frame.pc];

    if (row) openObservation(open, frame, row, found);
    recordAccess(open.get(frame) || [], inst, set);
    Vm.step(state);
    if (state.frames.length < before) closeFrame(open, frame, found);
  }

  function openObservation(open, frame, row, found) {
    if (!open.has(frame)) open.set(frame, []);
    found.safepoints += 1;
    open.get(frame).push({ pc: row.pc, fn: frame.chunk.name,
      promised: new Set(row.registers), read: new Set(), written: new Set() });
  }

  function recordAccess(rows, inst, set) {
    if (!rows.length || !inst) return;
    const reads = usesOf(inst, set);
    const target = definitionOf(inst, set);

    rows.forEach(function (row) {
      reads.forEach(function (at) { if (!row.written.has(at)) row.read.add(at); });
      if (target !== null) row.written.add(target);
    });
  }

  function closeFrame(open, frame, found) {
    (open.get(frame) || []).forEach(function (row) { settle(row, found); });
    open.delete(frame);
  }

  function settle(row, found) {
    found.checked += 1;
    row.read.forEach(function (at) {
      found.observed += 1;
      if (!row.promised.has(at)) found.missed.push({ fn: row.fn, pc: row.pc, register: at });
    });
    row.promised.forEach(function (at) { if (!row.read.has(at)) found.slack += 1; });
  }

  function isReference(value) {
    return Boolean(value) && typeof value === 'object' && typeof value.v === 'string';
  }

  function liveReferences(frame) {
    const registers = [];

    (frame.registers || []).forEach(function (value, at) {
      if (isReference(value)) registers.push(at);
    });
    return { registers: registers,
      slots: Array.from(frame.slots.keys()).filter(function (key) {
        return isReference(frame.slots.get(key));
      }) };
  }

  /* --------------------------------------------------------- source mapping */

  function lineOf(source, offset) {
    if (!source || offset === undefined || offset === null) return { line: 0, column: 0 };
    const before = source.slice(0, offset);
    const lines = before.split('\n');

    return { line: lines.length, column: lines[lines.length - 1].length + 1 };
  }

  /** pc → the construct and the source line it came from. */
  function sourceMap(chunk, source) {
    return chunk.code.map(function (inst, pc) {
      const at = lineOf(source, inst.span ? inst.span.start : null);

      return { pc: pc, op: inst.op, origin: inst.origin || '—', line: at.line,
        column: at.column,
        text: inst.span ? source.slice(inst.span.start, inst.span.end) : '' };
    });
  }

  /**
   * A stack trace from live frames, named in source terms. Each row is a
   * function, the construct it is executing and the line that construct came
   * from — and the chain of frames is the inlining chain a real optimising
   * runtime would have to reconstruct from deoptimisation metadata rather
   * than read directly, which is the point of the section.
   */
  function trace(state, source) {
    return state.frames.slice().reverse().map(function (frame, depth) {
      const inst = frame.chunk.code[frame.pc] || { op: 'end' };
      const at = lineOf(source, inst.span ? inst.span.start : null);

      return { depth: depth, fn: frame.chunk.name, pc: frame.pc, op: inst.op,
        origin: inst.origin || '—', line: at.line, column: at.column,
        locals: describeLocals(frame) };
    });
  }

  function describeLocals(frame) {
    const rows = [];

    (frame.chunk.slotMeta || []).forEach(function (slot, at) {
      if (!slot.source || slot.source.charAt(0) === '$') return;
      if (!frame.slots.has(at)) return;
      rows.push(slot.source + ' = ' + Interp.show(frame.slots.get(at)));
    });
    return rows;
  }

  /**
   * The trace at the moment a program faults, which is what a user actually
   * sees. Running to the fault and capturing the frames before they unwind is
   * the whole difference between a stack trace and an error message.
   */
  function traceAtFault(compiled, source, options) {
    const state = Vm.makeState(compiled, options || {});
    const chunk = state.chunks[state.main];
    let captured = [];

    Vm.startFrame(state, chunk, [], []);
    try {
      while (!state.done) {
        captured = state.frames.slice();
        Vm.step(state);
      }
      return { faulted: false, rows: [], error: '' };
    } catch (problem) {
      return { faulted: true, error: String(problem.message || problem),
        rows: trace({ frames: captured }, source) };
    }
  }

  /* --------------------------------------------------------------- reporting */

  function summary(compiled, source) {
    const names = Object.keys(compiled.chunks);
    const maps = names.map(function (name) { return stackMap(compiled.chunks[name]); });

    return { functions: names.length,
      safepoints: maps.reduce(function (sum, rows) { return sum + rows.length; }, 0),
      mapped: maps.reduce(function (sum, rows) {
        return sum + rows.reduce(function (inner, row) { return inner + row.registers.length; }, 0);
      }, 0),
      instructions: names.reduce(function (sum, name) {
        return sum + compiled.chunks[name].code.length;
      }, 0),
      withSpans: names.reduce(function (sum, name) {
        return sum + compiled.chunks[name].code.filter(function (inst) {
          return Boolean(inst.span);
        }).length;
      }, 0),
      lines: source ? source.split('\n').length : 0 };
  }

  return {
    CONVENTION: CONVENTION, SAFEPOINTS: SAFEPOINTS, isSafepoint: isSafepoint,
    liveness: liveness, stackMap: stackMap, stackDepths: stackDepths,
    checkSafepoints: checkSafepoints, liveReferences: liveReferences,
    sourceMap: sourceMap, trace: trace, traceAtFault: traceAtFault,
    lineOf: lineOf, summary: summary
  };
}));
