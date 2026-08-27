/**
 * The Berugo bytecode VM: one dispatch loop, two instruction sets, and an
 * explicit frame stack.
 *
 * The machine is written as a **resumable step function** rather than as a
 * recursive interpreter, and that one decision pays for three later sections.
 * A debugger needs to stop between instructions (30.2). On-stack replacement
 * needs to lift a running frame out of the interpreter and put it back
 * (30.7). A stack trace and a stack map need to walk the frames that exist
 * right now (30.9). A recursive interpreter has all of that on the JavaScript
 * stack, where none of it can be reached.
 *
 * The observable is deliberately identical to `ir-interp.js`'s — value,
 * output, outcome and every binding — so `IrInterp.compare` gates the VM
 * against the reference interpreter without a second comparison being
 * written. A back end is correct exactly when it computes what the front end
 * computed, which is the same rule M29 gated its passes on.
 *
 * Closures capture BY VALUE, because that is what the IR's `makeClosure`
 * does. The VM can also run them by reference — an open upvalue closed when
 * the defining frame returns, which is Lua's mechanism — and 30.2 exists to
 * show that the loop-capture question every language answers differently is
 * decided by exactly that switch and nothing else.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Berugo = scope.Berugo || {};
    scope.Berugo.Vm = api;
  }
}(this, function (root) {
  'use strict';

  const berugo = root && root.Berugo ? root.Berugo : null;
  const Interp = berugo && berugo.Interp ? berugo.Interp : require('./interp.js');
  const IrInterp = berugo && berugo.IrInterp ? berugo.IrInterp : require('./ir-interp.js');

  const DEFAULT_BUDGET = 200000;
  const MAX_DEPTH = 400;

  function Fault(reason, message) {
    this.reason = reason;
    this.message = message;
  }
  Fault.prototype = Object.create(Error.prototype);

  function fail(message) { throw new Fault('runtime', message); }

  /* ------------------------------------------------------------- the frames */

  function makeFrame(chunk, args, upvalues) {
    return { chunk: chunk, pc: 0, stack: [], temps: new Map(), slots: new Map(),
      args: args, registers: new Array(Math.max(chunk.registers, args.length)).fill(null),
      upvalues: upvalues || [], into: null, open: [] };
  }

  function startFrame(state, chunk, args, upvalues) {
    const frame = makeFrame(chunk, args, upvalues);

    args.forEach(function (value, at) { frame.registers[at] = value; });
    if (state.frames.length >= MAX_DEPTH) throw new Fault('budget', 'call depth exceeded');
    state.frames.push(frame);
    return frame;
  }

  function top(state) { return state.frames[state.frames.length - 1]; }

  /* ------------------------------------------------------------ reading values */

  function readTemp(frame, register) {
    if (!frame.temps.has(register)) return fail(register + ' is read before it is defined');
    return frame.temps.get(register);
  }

  function readSlot(frame, index) {
    if (!frame.slots.has(index)) {
      return fail((frame.chunk.slots[index] || '@?') + ' is read before it is written');
    }
    return frame.slots.get(index);
  }

  function constant(frame, k) { return frame.chunk.constants[k]; }

  /**
   * A `!name` constant is a builtin or a runtime primitive, resolved through
   * the reference interpreter's own table so the two agree by construction
   * rather than by two implementations that happen to match.
   */
  function materialise(state, value) {
    if (typeof value === 'string' && value.charAt(0) === '!') {
      return IrInterp.globalValue(state, value);
    }
    return value === null ? Interp.UNIT : value;
  }

  /* --------------------------------------------------------------- calling */

  function callValue(state, callee, args, into) {
    if (callee && callee.v === 'native') {
      if (!callee.call) return fail(callee.name + ' has no implementation');
      state.natives += 1;
      return { value: callee.call.apply(null, args) };
    }
    if (callee && callee.v === 'irclosure') return enterClosure(state, callee, args, into);
    return fail(Interp.show(callee) + ' is not a function');
  }

  function enterClosure(state, callee, args, into) {
    const chunk = state.chunks[callee.func];

    if (!chunk) return fail('no function named ' + callee.func);
    const captures = callee.captures.map(function (entry) {
      return entry && entry.cell ? entry.value : entry;
    });
    const frame = startFrame(state, chunk, captures.concat(args), callee.captures);

    frame.into = into;
    return { entered: true, frame: frame };
  }

  /** A frame that returns hands its value to whatever the caller reserved. */
  function leaveFrame(state, value) {
    const frame = state.frames.pop();

    closeUpvalues(frame);
    if (!state.frames.length) { state.done = true; state.result = value; return; }
    const caller = top(state);

    if (frame.into === null || frame.into === undefined) caller.stack.push(value);
    else caller.registers[frame.into] = value;
  }

  /**
   * Lua's mechanism, and the whole of the loop-capture question. An upvalue
   * captured by reference points at the defining frame's slot while that
   * frame is alive; when it returns, the value is copied into the cell and
   * the cell stops tracking. Capturing by value copies immediately, so two
   * closures made in two iterations see two values — and capturing by
   * reference makes them see one. Berugo's IR captures by value.
   */
  function closeUpvalues(frame) {
    frame.open.forEach(function (cell) {
      cell.value = frame.slots.has(cell.slot) ? frame.slots.get(cell.slot) : cell.value;
      cell.frame = null;
    });
  }

  function captureOf(state, frame, value, register) {
    if (!state.byReference) return value;
    const slot = frame.chunk.slotForRegister ? frame.chunk.slotForRegister[register] : undefined;

    if (slot === undefined) return value;
    const cell = { cell: true, value: value, slot: slot, frame: frame };

    frame.open.push(cell);
    return cell;
  }

  /* ---------------------------------------------------- the stack instruction set */

  const STACK_EXEC = {
    CONST: function (state, frame, inst) {
      frame.stack.push(materialise(state, constant(frame, inst.k)));
    },
    LOAD_LOCAL: function (state, frame, inst) { frame.stack.push(readSlot(frame, inst.slot)); },
    STORE_LOCAL: function (state, frame, inst) { frame.slots.set(inst.slot, frame.stack.pop()); },
    LOAD_ARG: function (state, frame, inst) {
      frame.stack.push(inst.index < frame.args.length ? frame.args[inst.index] : Interp.UNIT);
    },
    LOAD_TEMP: function (state, frame, inst) {
      frame.stack.push(readTemp(frame, inst.register));
    },
    STORE_TEMP: function (state, frame, inst) {
      frame.temps.set(inst.register, frame.stack.pop());
    },
    POP: function (state, frame) { frame.stack.pop(); },
    UNARY: function (state, frame, inst) {
      frame.stack.push(applyUnary(constant(frame, inst.k), frame.stack.pop()));
    },
    BINARY: function (state, frame, inst) {
      const right = frame.stack.pop();
      const left = frame.stack.pop();

      frame.stack.push(applyBinary(constant(frame, inst.k), left, right));
    },
    MAKE_ARRAY: function (state, frame, inst) {
      frame.stack.push(Interp.array(frame.stack.splice(frame.stack.length - inst.count)));
    },
    MAKE_RECORD: function (state, frame, inst) {
      const names = constant(frame, inst.k);
      const values = frame.stack.splice(frame.stack.length - names.length);
      const fields = {};

      names.forEach(function (name, at) { fields[name] = values[at]; });
      frame.stack.push(Interp.record(fields));
    },
    MAKE_CLOSURE: function (state, frame, inst) {
      const spec = constant(frame, inst.k);

      frame.stack.push({ v: 'irclosure', func: spec.func, name: spec.sourceName,
        captures: frame.stack.splice(frame.stack.length - spec.count) });
    },
    LOAD_FIELD: function (state, frame, inst) {
      frame.stack.push(fieldOf(frame.stack.pop(), constant(frame, inst.k)));
    },
    STORE_FIELD: function (state, frame, inst) {
      const value = frame.stack.pop();

      storeField(frame.stack.pop(), constant(frame, inst.k), value);
    },
    LOAD_INDEX: function (state, frame) {
      const index = frame.stack.pop();

      frame.stack.push(elementOf(frame.stack.pop(), index));
    },
    STORE_INDEX: function (state, frame) {
      const value = frame.stack.pop();
      const index = frame.stack.pop();

      storeIndex(frame.stack.pop(), index, value);
    },
    JUMP: function (state, frame, inst) { frame.pc = inst.target; },
    JUMP_FALSE: function (state, frame, inst) {
      if (!truth(frame.stack.pop())) frame.pc = inst.target;
    },
    CALL: function (state, frame, inst) {
      const args = frame.stack.splice(frame.stack.length - inst.count);
      const out = callValue(state, frame.stack.pop(), args, null);

      if (!out.entered) frame.stack.push(out.value);
    },
    RET: function (state, frame, inst) {
      leaveFrame(state, inst.k === null ? Interp.UNIT : frame.stack.pop());
    }
  };

  /* ------------------------------------------------- the register instruction set */

  const REGISTER_EXEC = {
    CONST_R: function (state, frame, inst) {
      frame.registers[inst.d] = materialise(state, constant(frame, inst.k));
    },
    MOVE_R: function (state, frame, inst) { frame.registers[inst.d] = frame.registers[inst.a]; },
    LOAD_LOCAL_R: function (state, frame, inst) {
      frame.registers[inst.d] = readSlot(frame, inst.slot);
    },
    STORE_LOCAL_R: function (state, frame, inst) {
      frame.slots.set(inst.slot, frame.registers[inst.a]);
    },
    UNARY_R: function (state, frame, inst) {
      frame.registers[inst.d] = applyUnary(constant(frame, inst.k), frame.registers[inst.a]);
    },
    BINARY_R: function (state, frame, inst) {
      frame.registers[inst.d] = applyBinary(constant(frame, inst.k),
        frame.registers[inst.a], frame.registers[inst.b]);
    },
    MAKE_ARRAY_R: function (state, frame, inst) {
      frame.registers[inst.d] = Interp.array(
        frame.registers.slice(inst.base, inst.base + inst.count));
    },
    MAKE_RECORD_R: function (state, frame, inst) {
      const names = constant(frame, inst.k);
      const fields = {};

      names.forEach(function (name, at) { fields[name] = frame.registers[inst.base + at]; });
      frame.registers[inst.d] = Interp.record(fields);
    },
    MAKE_CLOSURE_R: function (state, frame, inst) {
      const spec = constant(frame, inst.k);

      frame.registers[inst.d] = { v: 'irclosure', func: spec.func, name: spec.sourceName,
        captures: frame.registers.slice(inst.base, inst.base + spec.count) };
    },
    LOAD_FIELD_R: function (state, frame, inst) {
      frame.registers[inst.d] = fieldOf(frame.registers[inst.a], constant(frame, inst.k));
    },
    STORE_FIELD_R: function (state, frame, inst) {
      storeField(frame.registers[inst.a], constant(frame, inst.k), frame.registers[inst.b]);
    },
    LOAD_INDEX_R: function (state, frame, inst) {
      frame.registers[inst.d] = elementOf(frame.registers[inst.a], frame.registers[inst.b]);
    },
    STORE_INDEX_R: function (state, frame, inst) {
      storeIndex(frame.registers[inst.a], frame.registers[inst.b], frame.registers[inst.c]);
    },
    JUMP_R: function (state, frame, inst) { frame.pc = inst.target; },
    JUMP_FALSE_R: function (state, frame, inst) {
      if (!truth(frame.registers[inst.a])) frame.pc = inst.target;
    },
    CALL_R: function (state, frame, inst) {
      const args = frame.registers.slice(inst.base, inst.base + inst.count);
      const out = callValue(state, frame.registers[inst.a], args, inst.d);

      if (!out.entered) frame.registers[inst.d] = out.value;
    },
    RET_R: function (state, frame, inst) {
      leaveFrame(state, inst.a === null ? Interp.UNIT : frame.registers[inst.a]);
    }
  };

  const EXEC = Object.assign({}, STACK_EXEC, REGISTER_EXEC);

  /* -------------------------------------------------------------- primitives */

  function truth(value) {
    if (typeof value === 'boolean') return value;
    return fail('a condition must be a Bool, not ' + Interp.show(value));
  }

  function applyUnary(operator, operand) {
    if (operator === '-') {
      if (typeof operand !== 'number') return fail('arithmetic on ' + Interp.show(operand));
      return -operand;
    }
    if (operator === '!') return !truth(operand);
    return fail('unknown unary operator ' + operator);
  }

  function applyBinary(operator, left, right) {
    const fn = Interp.ARITHMETIC[operator];

    if (!fn) return fail('unknown operator ' + operator);
    if (operator === 'add' && typeof left === 'string') return left + String(right);
    return fn(left, right);
  }

  function fieldOf(object, name) {
    if (!object || object.v !== 'record') {
      if (object && object.v === 'module') return object.fields[name];
      return fail(Interp.show(object) + ' has no fields');
    }
    if (!Object.prototype.hasOwnProperty.call(object.fields, name)) {
      return fail(Interp.show(object) + ' has no field named ' + name);
    }
    return object.fields[name];
  }

  function storeField(object, name, value) {
    if (!object || object.v !== 'record') return fail('cannot store a field of a non-record');
    object.fields[name] = value;
    return null;
  }

  function elementOf(object, index) {
    if (!object || object.v !== 'array') return fail(Interp.show(object) + ' is not indexable');
    if (typeof index !== 'number' || index < 0 || index >= object.items.length) {
      return fail('index ' + Interp.show(index) + ' is outside an array of '
        + object.items.length);
    }
    return object.items[index];
  }

  function storeIndex(object, index, value) {
    if (!object || object.v !== 'array') return fail('cannot store into a non-array');
    if (typeof index !== 'number' || index < 0 || index >= object.items.length) {
      return fail('index ' + Interp.show(index) + ' is outside the array');
    }
    object.items[index] = value;
    return null;
  }

  /* ------------------------------------------------------------- the machine */

  function makeState(compiled, options) {
    const settings = options || {};

    return { chunks: compiled.chunks, main: compiled.main, mode: compiled.mode,
      frames: [], output: [], dispatches: 0, natives: 0, steps: 0, calls: 0,
      budget: settings.budget || DEFAULT_BUDGET, byReference: Boolean(settings.byReference),
      done: false, result: null, byOpcode: {}, trace: settings.trace ? [] : null };
  }

  /**
   * One instruction. Everything else in this file is a table; this is the
   * loop, and the count it keeps is the number the stack-versus-register
   * argument turns on — a dispatch is the switch, the operand decode and the
   * branch back, and it is what a register set has fewer of.
   */
  function step(state) {
    const frame = top(state);
    const inst = frame.chunk.code[frame.pc];

    if (!inst) return fail('ran off the end of ' + frame.chunk.name);
    frame.pc += 1;
    state.dispatches += 1;
    state.byOpcode[inst.op] = (state.byOpcode[inst.op] || 0) + 1;
    if (state.dispatches > state.budget) throw new Fault('budget', 'step budget exhausted');
    if (state.trace) state.trace.push({ fn: frame.chunk.name, at: frame.pc - 1, op: inst.op });
    const rule = EXEC[inst.op];

    if (!rule) return fail('no rule for ' + inst.op);
    if (inst.op === 'CALL' || inst.op === 'CALL_R') state.calls += 1;
    rule(state, frame, inst);
    return inst;
  }

  function drive(state, limit) {
    let taken = 0;

    while (!state.done && (limit === undefined || taken < limit)) {
      step(state);
      taken += 1;
    }
    return taken;
  }

  /* ------------------------------------------------------------- observables */

  /**
   * The same bindings the reference interpreter reports, read from `main`'s
   * slot table: each slot records the source name it came from, a slot never
   * written is a `let` that never ran, and the lowering's invented slots are
   * excluded exactly as M28 excludes `$`-prefixed names.
   */
  function bindingsOf(frame) {
    if (!frame) return [];
    const rows = [];

    (frame.chunk.slotMeta || []).forEach(function (slot, index) {
      if (!slot.source || slot.source === 'if' || slot.source.charAt(0) === '$') return;
      if (slot.depth || !frame.slots.has(index)) return;
      rows.push(slot.source + ' = ' + Interp.show(frame.slots.get(index)));
    });
    return dedupeByName(rows).sort();
  }

  function dedupeByName(rows) {
    const byName = new Map();

    rows.forEach(function (row) { byName.set(row.split(' = ')[0], row); });
    return Array.from(byName.values());
  }

  function observable(state, mainFrame, problem) {
    if (!problem) {
      return { ok: true, outcome: 'ok', value: Interp.show(state.result),
        output: state.output, bindings: bindingsOf(mainFrame),
        steps: state.dispatches, error: '',
        dispatches: state.dispatches, natives: state.natives, calls: state.calls,
        byOpcode: state.byOpcode };
    }
    const reason = problem instanceof Fault ? problem.reason
      : (problem instanceof RangeError ? 'budget' : 'runtime');

    return { ok: false, outcome: reason, value: '', output: state.output,
      bindings: bindingsOf(mainFrame), steps: state.dispatches,
      error: problem instanceof Fault ? problem.message : String(problem.message || problem),
      dispatches: state.dispatches, natives: state.natives, calls: state.calls,
      byOpcode: state.byOpcode };
  }

  function run(compiled, options) {
    const state = makeState(compiled, options);
    const chunk = state.chunks[state.main];

    if (!chunk) return observable(state, null, new Fault('runtime', 'no main function'));
    const mainFrame = startFrame(state, chunk, [], []);

    try {
      drive(state);
      return observable(state, mainFrame, null);
    } catch (problem) {
      return observable(state, mainFrame, problem);
    }
  }

  /* -------------------------------------------------------------- the debugger */

  /**
   * A session is the same machine with the loop taken out, so a learner can
   * hold it between instructions. `where()` is the stack trace, and it is the
   * same walk 30.9 turns into a stack map — a debugger and a garbage
   * collector are asking one question about the frames that exist right now.
   */
  function session(compiled, options) {
    const state = makeState(compiled, options);
    const chunk = state.chunks[state.main];
    const settings = options || {};
    const breakpoints = new Set((settings.breakpoints || []).map(keyOf));

    if (chunk) startFrame(state, chunk, [], []);
    const mainFrame = state.frames[0] || null;
    const api = { state: state, problem: null };

    api.done = function () { return state.done || Boolean(api.problem); };
    api.step = function () { return guarded(api, state, function () { step(state); }); };
    api.runTo = function (limit) {
      return guarded(api, state, function () { untilBreak(state, breakpoints, limit); });
    };
    api.where = function () { return where(state); };
    api.snapshot = function () { return snapshot(state); };
    api.result = function () { return observable(state, mainFrame, api.problem); };
    return api;
  }

  function keyOf(point) { return point.fn + ':' + point.at; }

  function guarded(api, state, work) {
    if (api.done()) return api;
    try {
      work();
    } catch (problem) {
      api.problem = problem;
    }
    return api;
  }

  function untilBreak(state, breakpoints, limit) {
    let taken = 0;

    while (!state.done && taken < (limit || 100000)) {
      step(state);
      taken += 1;
      const frame = state.frames.length ? top(state) : null;

      if (frame && breakpoints.has(keyOf({ fn: frame.chunk.name, at: frame.pc }))) return;
    }
  }

  /** The stack trace: innermost first, each with the instruction it is at. */
  function where(state) {
    return state.frames.slice().reverse().map(function (frame) {
      const inst = frame.chunk.code[frame.pc] || { op: 'end' };

      return { fn: frame.chunk.name, at: frame.pc, op: inst.op,
        locals: frame.slots.size, depth: state.frames.length };
    });
  }

  function snapshot(state) {
    const frame = state.frames.length ? top(state) : null;

    if (!frame) return { fn: '', at: 0, op: '', stack: [], locals: [], upvalues: [],
      dispatches: state.dispatches, output: state.output.slice() };
    return { fn: frame.chunk.name, at: frame.pc,
      op: (frame.chunk.code[frame.pc] || { op: 'end' }).op,
      stack: frame.stack.map(Interp.show),
      locals: localsOf(frame), upvalues: upvaluesOf(frame),
      registers: frame.chunk.mode === 'register' ? frame.registers.map(showOrEmpty) : [],
      dispatches: state.dispatches, output: state.output.slice() };
  }

  function showOrEmpty(value) { return value === null ? '—' : Interp.show(value); }

  function localsOf(frame) {
    return (frame.chunk.slots || []).map(function (name, index) {
      return { name: (frame.chunk.slotMeta[index] || {}).source || name,
        slot: name, value: frame.slots.has(index) ? Interp.show(frame.slots.get(index)) : '—' };
    });
  }

  function upvaluesOf(frame) {
    return frame.upvalues.map(function (entry, at) {
      const open = Boolean(entry && entry.cell && entry.frame);

      return { at: at, open: open,
        value: Interp.show(entry && entry.cell ? entry.value : entry) };
    });
  }

  return {
    DEFAULT_BUDGET: DEFAULT_BUDGET, STACK_EXEC: STACK_EXEC, REGISTER_EXEC: REGISTER_EXEC,
    run: run, session: session, step: step, drive: drive,
    makeState: makeState, startFrame: startFrame, where: where, snapshot: snapshot,
    bindingsOf: bindingsOf, observable: observable, captureOf: captureOf
  };
}));
