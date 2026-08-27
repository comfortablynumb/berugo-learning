/**
 * An interpreter for the IR, and the reason the whole milestone can be checked.
 *
 * An optimisation pass is correct exactly when the optimised program computes
 * what the unoptimised one computed. That is not a property of the pass, it is
 * a property of two programs — so it can only be established by running both.
 * This interpreter is the other half of that comparison: M28's `interp.js`
 * runs the surface and the core, this one runs the IR, and every pass in M29
 * is gated on the three agreeing.
 *
 * It reports the same observables as M28's, deliberately: the value, the
 * printed output, the outcome, and the BINDINGS the program leaves behind.
 * The last is the one that makes the comparison mean anything — every
 * conformance program is a list of `let`s and returns `unit`, so comparing
 * values alone passes whatever the optimiser produced. In the IR a binding is
 * a slot, and the slot table records which source name each one came from.
 *
 * The three outcomes are `ok`, `runtime` and `budget`, kept apart for the same
 * reason as in M28: a program that did not finish is a different fact from one
 * that crashed, and an optimiser that turns a terminating program into a
 * non-terminating one has to be reported as such rather than as a crash.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Berugo = scope.Berugo || {};
    scope.Berugo.IrInterp = api;
  }
}(this, function (root) {
  'use strict';

  const berugo = root && root.Berugo ? root.Berugo : null;
  const Ir = berugo && berugo.Ir ? berugo.Ir : require('./ir.js');
  const Interp = berugo && berugo.Interp ? berugo.Interp : require('./interp.js');

  const DEFAULT_BUDGET = 400000;

  function Fault(reason, message) { this.reason = reason; this.message = message; }

  function fail(message) { throw new Fault('runtime', message); }

  /* ---------------------------------------------------------------- frames */

  function makeFrame(fn, args, closure) {
    const frame = { fn: fn, registers: new Map(), slots: new Map(),
      block: fn.entry, previous: null, closure: closure || null };

    fn.params.forEach(function (register, index) {
      frame.registers.set(register, index < args.length ? args[index] : Interp.UNIT);
    });
    return frame;
  }

  function readRegister(frame, name) {
    if (!Ir.isRegister(name)) return name;
    if (!frame.registers.has(name)) return fail(name + ' is read before it is defined');
    return frame.registers.get(name);
  }

  function readSlot(frame, slot) {
    if (!frame.slots.has(slot)) return fail(slot + ' is read before it is written');
    return frame.slots.get(slot);
  }

  /* ------------------------------------------------------------ the globals */

  /**
   * A name the lowering could not bind became a `const "!name"`. Those are the
   * builtins and the core's own runtime primitives, and they are resolved here
   * against M28's interpreter so the two agree by construction rather than by
   * two implementations that happen to match.
   */
  function globalValue(state, name) {
    const runtime = Interp.ARITHMETIC[name.slice(1)];

    if (runtime) return { v: 'native', name: name, arity: 2, call: runtime };
    return builtinValue(state, name.slice(1));
  }

  function builtinValue(state, name) {
    if (name === 'print') {
      return { v: 'native', name: 'print', arity: 1, call: function (value) {
        state.output.push(Interp.show(value));
        return Interp.UNIT;
      } };
    }
    if (BUILTINS[name]) return { v: 'native', name: name, arity: 1, call: BUILTINS[name] };
    if (Interp.MODULE_VALUES[name]) return moduleValue(name);
    if (name.indexOf('$is_') === 0) return isConstructor(name.slice(4));
    if (name.indexOf('$payload') === 0) return payloadReader(Number(name.slice(8)));
    if (name === '$unmatched') {
      return { v: 'native', name: name, arity: 0, call: function () {
        return fail('no arm of this match applied');
      } };
    }
    return { v: 'native', name: name, arity: 1, call: function () {
      return fail(name + ' has no implementation in the IR interpreter');
    } };
  }

  /**
   * A module is a record of natives. `list.map` has no direct implementation
   * in M28 — it needs to call back into the interpreter — so it is built here
   * against this interpreter's own `applyValue`.
   */
  function moduleValue(name) {
    const spec = Interp.MODULE_VALUES[name];
    const fields = {};

    Object.keys(spec).forEach(function (key) {
      const full = name + '.' + key;

      fields[key] = spec[key][1]
        ? { v: 'native', name: full, arity: spec[key][0], call: spec[key][1] }
        : { v: 'native', name: full, arity: spec[key][0], call: mapOver };
    });
    return { v: 'module', name: name, fields: fields };
  }

  function mapOver(source, fn) {
    if (!source || source.v !== 'array') return fail('list.map wants an array');
    return Interp.array(source.items.map(function (item) {
      return applyValue(fn, [item], null);
    }));
  }

  const BUILTINS = {
    len: lengthOf, '$len': lengthOf,
    some: function (value) { return Interp.ctor('some', [value]); }
  };

  function lengthOf(value) {
    if (value && value.v === 'array') return value.items.length;
    if (typeof value === 'string') return value.length;
    return fail('len wants an array or a string');
  }

  function isConstructor(name) {
    return { v: 'native', name: '$is_' + name, arity: 1, call: function (value) {
      return Boolean(value) && value.v === 'ctor' && value.name === name;
    } };
  }

  function payloadReader(index) {
    return { v: 'native', name: '$payload' + index, arity: 1, call: function (value) {
      if (!value || value.v !== 'ctor' || index >= value.args.length) {
        return fail('no payload at position ' + index);
      }
      return value.args[index];
    } };
  }

  /* ----------------------------------------------------------- instructions */

  const EXEC = {
    const: function (inst, frame, state) {
      const value = inst.value;

      if (typeof value === 'string' && value.charAt(0) === '!') {
        return globalValue(state, value);
      }
      return value === null ? Interp.UNIT : value;
    },
    move: function (inst, frame) { return readRegister(frame, inst.from); },
    loadLocal: function (inst, frame) { return readSlot(frame, inst.slot); },
    unary: execUnary,
    binary: execBinary,
    call: execCall,
    makeArray: function (inst, frame) {
      return Interp.array(inst.args.map(function (arg) { return readRegister(frame, arg); }));
    },
    makeRecord: execMakeRecord,
    makeClosure: execMakeClosure,
    loadField: execLoadField,
    loadIndex: execLoadIndex,
    phi: execPhi
  };

  const EFFECT = {
    storeLocal: function (inst, frame) {
      frame.slots.set(inst.slot, readRegister(frame, inst.value));
    },
    storeField: function (inst, frame) {
      const object = readRegister(frame, inst.object);

      if (!object || object.v !== 'record') return fail('cannot store a field of a non-record');
      object.fields[inst.field] = readRegister(frame, inst.value);
    },
    storeIndex: function (inst, frame) {
      const object = readRegister(frame, inst.object);
      const index = readRegister(frame, inst.index);

      if (!object || object.v !== 'array') return fail('cannot store into a non-array');
      if (typeof index !== 'number' || index < 0 || index >= object.items.length) {
        return fail('index ' + Interp.show(index) + ' is outside the array');
      }
      object.items[index] = readRegister(frame, inst.value);
    }
  };

  function execUnary(inst, frame) {
    const operand = readRegister(frame, inst.operand);

    if (inst.operator === '-') return -numeric(operand);
    if (inst.operator === '!') return !truth(operand);
    return fail('unknown unary operator ' + inst.operator);
  }

  function execBinary(inst, frame) {
    const fn = Interp.ARITHMETIC[inst.operator];
    const left = readRegister(frame, inst.left);
    const right = readRegister(frame, inst.right);

    if (!fn) return fail('unknown operator ' + inst.operator);
    if (inst.operator === 'add' && typeof left === 'string') return left + String(right);
    return fn(left, right);
  }

  function numeric(value) {
    if (typeof value === 'number') return value;
    return fail('arithmetic on ' + Interp.show(value));
  }

  function truth(value) {
    if (typeof value === 'boolean') return value;
    return fail('a condition must be a Bool, not ' + Interp.show(value));
  }

  function execMakeRecord(inst, frame) {
    const fields = {};

    inst.fields.forEach(function (name, at) {
      fields[name] = readRegister(frame, inst.args[at]);
    });
    return Interp.record(fields);
  }

  /**
   * `name` is the SOURCE name, not the IR function's. The comparison against
   * the core interpreter is on printed form, and the core prints a named
   * function as itself and a lambda as anonymous — printing the IR's internal
   * `lambda3` would report a difference that is not one.
   */
  function execMakeClosure(inst, frame) {
    return { v: 'irclosure', func: inst.func, name: inst.sourceName || '',
      captures: inst.args.map(function (arg) { return readRegister(frame, arg); }) };
  }

  function execLoadField(inst, frame) {
    const object = readRegister(frame, inst.object);

    if (!object || object.v !== 'record') {
      if (object && object.v === 'module') return object.fields[inst.field];
      return fail(Interp.show(object) + ' has no fields');
    }
    if (!Object.prototype.hasOwnProperty.call(object.fields, inst.field)) {
      return fail(Interp.show(object) + ' has no field named ' + inst.field);
    }
    return object.fields[inst.field];
  }

  function execLoadIndex(inst, frame) {
    const object = readRegister(frame, inst.object);
    const index = readRegister(frame, inst.index);

    if (!object || object.v !== 'array') return fail(Interp.show(object) + ' is not indexable');
    if (typeof index !== 'number' || index < 0 || index >= object.items.length) {
      return fail('index ' + Interp.show(index) + ' is outside an array of '
        + object.items.length);
    }
    return object.items[index];
  }

  /** A phi reads the entry for the block control actually came from. */
  function execPhi(inst, frame) {
    const entry = inst.incoming.find(function (row) { return row.block === frame.previous; });

    if (!entry) return fail('phi has no entry for the edge from ' + frame.previous);
    return readRegister(frame, entry.value);
  }

  function execCall(inst, frame, state) {
    const callee = readRegister(frame, inst.callee);
    const args = inst.args.map(function (arg) { return readRegister(frame, arg); });

    return applyValue(callee, args, state);
  }

  function applyValue(callee, args, state) {
    if (callee && callee.v === 'native') {
      if (!callee.call) return fail(callee.name + ' has no implementation');
      return callee.call.apply(null, args);
    }
    if (callee && callee.v === 'irclosure') return callClosure(callee, args, state);
    return fail(Interp.show(callee) + ' is not a function');
  }

  function callClosure(callee, args, state) {
    const fn = state.byName[callee.func];

    if (!fn) return fail('no function named ' + callee.func);
    state.depth += 1;
    if (state.depth > 400) { state.depth -= 1; throw new Fault('budget', 'call depth exceeded'); }
    const result = runFunction(fn, callee.captures.concat(args), state);

    state.depth -= 1;
    return result;
  }

  /* --------------------------------------------------------------- running */

  function step(state) {
    state.steps += 1;
    if (state.steps > state.budget) throw new Fault('budget', 'step budget exhausted');
  }

  function runFunction(fn, args, state) {
    const frame = makeFrame(fn, args, null);

    for (;;) {
      const block = Ir.blockById(fn, frame.block);

      if (!block) return fail('no block ' + frame.block + ' in ' + fn.name);
      runBlock(block, frame, state);
      const next = takeEdge(block, frame, state);

      if (next.done) return next.value;
      frame.previous = frame.block;
      frame.block = next.block;
    }
  }

  /**
   * The phis at the top of a block happen SIMULTANEOUSLY, all reading the
   * registers as the predecessor left them. Running them one at a time is the
   * swap problem inside the interpreter: `a = phi(b)` followed by
   * `b = phi(a)` assigns the new `a` and then reads it, so both registers end
   * up holding the same value and a correctly destructed program disagrees
   * with the SSA one it came from. Every value is read first, then committed.
   */
  function runPhis(block, frame, state) {
    const settled = [];

    block.instructions.forEach(function (inst) {
      if (inst.op !== 'phi') return;
      step(state);
      settled.push({ target: inst.target, value: execPhi(inst, frame) });
    });
    settled.forEach(function (row) { frame.registers.set(row.target, row.value); });
  }

  function runBlock(block, frame, state) {
    runPhis(block, frame, state);
    block.instructions.forEach(function (inst) {
      if (inst.op === 'phi') return null;
      step(state);
      if (EFFECT[inst.op]) return EFFECT[inst.op](inst, frame, state);
      const rule = EXEC[inst.op];

      if (!rule) return fail('no rule for ' + inst.op);
      frame.registers.set(inst.target, rule(inst, frame, state));
      return null;
    });
  }

  function takeEdge(block, frame, state) {
    const term = block.terminator;

    step(state);
    if (!term) return { done: true, value: Interp.UNIT };
    if (term.op === 'ret') {
      return { done: true,
        value: term.value === null ? Interp.UNIT : readRegister(frame, term.value) };
    }
    if (term.op === 'jump') return { done: false, block: term.target };
    return { done: false,
      block: truth(readRegister(frame, term.cond)) ? term.then : term.other };
  }

  /* --------------------------------------------------------------- the entry */

  /**
   * `bindings` is read from `main`'s slot table: each slot records the source
   * name it came from, and a slot never written is one whose `let` never ran.
   * Slots the lowering invented — the result of an `if` in expression position
   * — are named `if` and excluded, exactly as M28 excludes `$`-prefixed names.
   */
  function bindingsOf(frame) {
    if (frame.fn.exitSlots) return promotedBindings(frame);
    const rows = [];

    (frame.fn.slots || []).forEach(function (slot) {
      if (!slot.source || slot.source === 'if' || slot.source.charAt(0) === '$') return;
      /* Depth 0 is the top level of the function. A `let` inside a loop body
         or a match arm is a local, and the core interpreter scopes it away —
         reporting it here would be a difference that is not one. */
      if (slot.depth) return;
      if (!frame.slots.has(slot.name)) return;
      rows.push(slot.source + ' = ' + Interp.show(frame.slots.get(slot.name)));
    });
    return dedupeByName(rows).sort();
  }

  /**
   * After SSA the slots are registers, and `exitSlots` records which register
   * held each one at the block the function returned from. Reading the same
   * names out of it is what keeps the observable stable across the pass, so a
   * pass can be compared against the program before it.
   */
  function promotedBindings(frame) {
    const values = frame.fn.exitSlots[frame.block] || {};
    const rows = [];

    (frame.fn.promotedSlots || []).forEach(function (slot) {
      if (!slot.source || slot.source === 'if' || slot.source.charAt(0) === '$') return;
      if (slot.depth || !Object.prototype.hasOwnProperty.call(values, slot.name)) return;
      if (!frame.registers.has(values[slot.name])) return;
      rows.push(slot.source + ' = ' + Interp.show(frame.registers.get(values[slot.name])));
    });
    return dedupeByName(rows).sort();
  }

  /** A name rebound by a later `let` gets a second slot; the last one wins. */
  function dedupeByName(rows) {
    const byName = new Map();

    rows.forEach(function (row) { byName.set(row.split(' = ')[0], row); });
    return Array.from(byName.values());
  }

  function run(program, options) {
    const settings = options || {};
    const state = { steps: 0, output: [], depth: 0, byName: {},
      budget: settings.budget || DEFAULT_BUDGET };

    program.functions.forEach(function (fn) { state.byName[fn.name] = fn; });
    const main = state.byName[program.main];

    if (!main) return failed(new Fault('runtime', 'no main function'), state, null);
    return attempt(main, state);
  }

  function attempt(main, state) {
    const frame = makeFrame(main, [], null);

    try {
      return finish(main, frame, state);
    } catch (problem) {
      return failed(problem, state, frame);
    }
  }

  /**
   * `main` is run through the same loop as any function, but its frame is kept
   * so the slots can be read afterwards — that frame IS the program's set of
   * global bindings, which is the observable the comparison needs.
   */
  function finish(main, frame, state) {
    const value = driveFrame(main, frame, state);

    return { ok: true, outcome: 'ok', value: Interp.show(value), output: state.output,
      bindings: bindingsOf(frame), steps: state.steps, error: '' };
  }

  function driveFrame(fn, frame, state) {
    for (;;) {
      const block = Ir.blockById(fn, frame.block);

      if (!block) return fail('no block ' + frame.block + ' in ' + fn.name);
      runBlock(block, frame, state);
      const next = takeEdge(block, frame, state);

      if (next.done) return next.value;
      frame.previous = frame.block;
      frame.block = next.block;
    }
  }

  function failed(problem, state, frame) {
    const reason = problem instanceof Fault ? problem.reason
      : (problem instanceof RangeError ? 'budget' : 'runtime');

    return { ok: false, outcome: reason,
      value: '', output: state.output,
      bindings: frame ? bindingsOf(frame) : [], steps: state.steps,
      error: problem instanceof Fault ? problem.message : String(problem.message || problem) };
  }

  /**
   * The comparison the whole milestone is gated on. `why` names the first
   * observable that differs, because "they do not agree" sends you back to
   * printing both by hand.
   */
  function compare(left, right) {
    const difference = firstDifference(left, right);

    return { agree: difference === '', why: difference || describeAgreement(left),
      observed: left.bindings.length + left.output.length,
      left: left, right: right };
  }

  function firstDifference(left, right) {
    if (left.outcome !== right.outcome) {
      return 'one ' + left.outcome + ' and the other ' + right.outcome +
        (right.error ? ' (' + right.error + ')' : '');
    }
    if (left.value !== right.value) {
      return 'one gave ' + left.value + ' and the other ' + right.value;
    }
    if (left.output.join(' ') !== right.output.join(' ')) {
      return 'they printed different things';
    }
    if (left.bindings.join(' ') !== right.bindings.join(' ')) {
      return 'different bindings: ' + left.bindings.join(', ') + ' against '
        + right.bindings.join(', ');
    }
    return '';
  }

  function describeAgreement(left) {
    return 'the same value, output, outcome and all ' + left.bindings.length + ' bindings';
  }

  return {
    DEFAULT_BUDGET: DEFAULT_BUDGET,
    run: run, compare: compare, firstDifference: firstDifference,
    applyValue: applyValue, globalValue: globalValue
  };
}));
