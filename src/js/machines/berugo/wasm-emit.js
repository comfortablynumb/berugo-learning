/**
 * Targeting WebAssembly: a real module builder, a real stackifier, and a
 * subset that is stated rather than hidden.
 *
 * Two things make this section different from every other back end here.
 *
 * **wasm has no jumps.** Control flow is `block`, `loop`, `if` and a branch to
 * an enclosing label, so a control-flow graph has to be turned back into
 * structure before anything can be emitted. That is the stackifier, and it is
 * where M29's irreducible-graph footnote becomes an engineering problem: the
 * algorithm below is Ramsey's recursive translation, it is correct for
 * reducible graphs, and it REFUSES an irreducible one rather than emitting a
 * module that fails validation somewhere else.
 *
 * **wasm has no dynamic values.** Every local is a number, so the compiler
 * here handles the numeric subset of Berugo — numbers, Bools, locals,
 * arithmetic, comparisons, structured control flow and direct calls — and
 * `applicable()` says, per program and per reason, what is outside it.
 * Reporting the subset is the honest version of this section: a compiler that
 * silently skipped the programs it could not handle would show a column of
 * agreements that means nothing.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Berugo = scope.Berugo || {};
    scope.Berugo.WasmEmit = api;
  }
}(this, function (root) {
  'use strict';

  const berugo = root && root.Berugo ? root.Berugo : null;
  const Ir = berugo && berugo.Ir ? berugo.Ir : require('./ir.js');
  const Cfg = berugo && berugo.Cfg ? berugo.Cfg : require('./cfg.js');
  const Dominators = berugo && berugo.Dominators
    ? berugo.Dominators : require('./dominators.js');

  /* ------------------------------------------------------------- encoding */

  function uleb(value) {
    const out = [];
    let n = value;

    do {
      let byte = n & 0x7f;

      n >>>= 7;
      if (n !== 0) byte |= 0x80;
      out.push(byte);
    } while (n !== 0);
    return out;
  }

  function sleb(value) {
    const out = [];
    let n = value;
    let more = true;

    while (more) {
      let byte = n & 0x7f;

      n >>= 7;
      if ((n === 0 && (byte & 0x40) === 0) || (n === -1 && (byte & 0x40) !== 0)) more = false;
      else byte |= 0x80;
      out.push(byte);
    }
    return out;
  }

  function f64Bytes(value) {
    const buffer = new ArrayBuffer(8);

    new DataView(buffer).setFloat64(0, value, true);
    return Array.from(new Uint8Array(buffer));
  }

  function nameBytes(text) {
    const bytes = [];

    for (let at = 0; at < text.length; at += 1) bytes.push(text.charCodeAt(at) & 0x7f);
    return uleb(bytes.length).concat(bytes);
  }

  function section(id, payload) {
    return [id].concat(uleb(payload.length), payload);
  }

  function vector(items) {
    return uleb(items.length).concat.apply(uleb(items.length), items);
  }

  /* -------------------------------------------------------------- opcodes */

  const OP = {
    block: 0x02, loop: 0x03, if: 0x04, else: 0x05, end: 0x0b,
    br: 0x0c, brIf: 0x0d, return: 0x0f, call: 0x10,
    drop: 0x1a, localGet: 0x20, localSet: 0x21, localTee: 0x22,
    globalGet: 0x23, globalSet: 0x24,
    i32Const: 0x41, f64Const: 0x44,
    i32Eqz: 0x45, i32And: 0x71, i32Or: 0x72,
    f64Eq: 0x61, f64Ne: 0x62, f64Lt: 0x63, f64Gt: 0x64, f64Le: 0x65, f64Ge: 0x66,
    f64Add: 0xa0, f64Sub: 0xa1, f64Mul: 0xa2, f64Div: 0xa3,
    f64Neg: 0x9a, f64Trunc: 0x9d, f64ConvertI32U: 0xb8,
    unreachable: 0x00
  };

  const COMPARE = { lt: OP.f64Lt, le: OP.f64Le, gt: OP.f64Gt, ge: OP.f64Ge,
    eq: OP.f64Eq, ne: OP.f64Ne };
  const ARITH = { add: OP.f64Add, sub: OP.f64Sub, mul: OP.f64Mul };

  /* --------------------------------------------------------- the subset */

  const SUPPORTED = ['const', 'move', 'unary', 'binary', 'loadLocal', 'storeLocal',
    'jump', 'branch', 'ret', 'makeClosure', 'call'];

  /**
   * A top-level `fn` lowers to a `makeClosure` with no captures, and a call
   * through it is a call to a known function — so both are in the subset and
   * become a wasm `call` with no value to allocate. A closure that captures
   * anything is not: it needs a heap, and the heap is what this subset does
   * not have. Tracing the callee through the copies is the same walk M29.8's
   * call graph needed, and skipping it here would put every function in the
   * language outside the subset for no reason.
   */
  function directTargets(fn) {
    const named = {};
    const copies = {};
    const slots = {};

    Ir.eachInstruction(fn, function (inst) {
      if (inst.op === 'makeClosure' && !inst.args.length) named[inst.target] = inst.func;
      if (inst.op === 'move') copies[inst.target] = inst.from;
    });
    followCopies(named, copies);
    noteSlots(fn, named, slots);
    Ir.eachInstruction(fn, function (inst) {
      if (inst.op !== 'loadLocal' || !slots[inst.slot]) return;
      named[inst.target] = slots[inst.slot];
    });
    followCopies(named, copies);
    return named;
  }

  function followCopies(named, copies) {
    Object.keys(copies).forEach(function (target) {
      let here = target;
      let guard = 0;

      while (copies[here] !== undefined && guard < 1000) { here = copies[here]; guard += 1; }
      if (named[here]) named[target] = named[here];
    });
  }

  /**
   * A top-level `fn` is stored into a named local before it is called, so the
   * trace has to cross the slot. A slot written more than once, or written
   * with anything but the same function, is ambiguous and stays untraced —
   * assuming otherwise would devirtualise a call that has another target,
   * which is the exact unsoundness M29.8 warns about, one milestone on.
   */
  function noteSlots(fn, named, slots) {
    const seen = {};

    Ir.eachInstruction(fn, function (inst) {
      if (inst.op !== 'storeLocal') return;
      const target = named[inst.value];

      seen[inst.slot] = (seen[inst.slot] || 0) + 1;
      if (target && seen[inst.slot] === 1) slots[inst.slot] = target;
      else delete slots[inst.slot];
    });
  }

  /**
   * Every reason a program is outside the numeric subset, named per program
   * point. A column of "compiled: no" with no reason is a column nobody can
   * act on, and it is what makes a coverage number look like a failure rather
   * than a scope decision.
   */
  function applicable(program) {
    const reasons = [];
    const known = new Set(program.functions.map(function (fn) { return fn.name; }));

    program.functions.forEach(function (fn) {
      const targets = directTargets(fn);

      if (!Cfg.isReducible(Cfg.build(fn))) {
        reasons.push({ fn: fn.name, why: 'the graph is irreducible, and wasm has no jumps' });
      }
      Ir.eachInstruction(fn, function (inst) {
        checkInstruction(fn, inst, reasons, { targets: targets, known: known });
      });
    });
    checkObservables(program, reasons);
    return { ok: reasons.length === 0, reasons: reasons,
      functions: program.functions.length };
  }

  /**
   * Every reportable top-level binding has to have a type the f64 encoding
   * can print back. A binding whose type is unknown is the polymorphic case,
   * and it is the honest edge of this subset rather than a bug.
   */
  function checkObservables(program, reasons) {
    const main = program.functions.find(function (fn) { return fn.name === program.main; });

    if (!main) return;
    const types = slotTypes(program, main);

    (main.slots || []).forEach(function (slot) {
      if (!slot.source || slot.source === 'if' || slot.source.charAt(0) === '$') return;
      if (slot.depth) return;
      const found = types[slot.name];

      if (found && found.type !== 'unknown') return;
      reasons.push({ fn: main.name, why: 'the binding ' + slot.source
        + ' has no single numeric type, so its value cannot be read back' });
    });
  }

  function checkInstruction(fn, inst, reasons, ctx) {
    if (SUPPORTED.indexOf(inst.op) === -1) {
      reasons.push({ fn: fn.name, why: inst.op + ' has no numeric encoding' });
      return;
    }
    if (inst.op === 'const' && !numeric(inst.value)) {
      reasons.push({ fn: fn.name, why: 'the constant ' + String(inst.value) + ' is not a number' });
    }
    if (inst.op === 'makeClosure' && inst.args.length) {
      reasons.push({ fn: fn.name, why: 'a closure over ' + inst.args.length
        + ' captured value' + (inst.args.length === 1 ? '' : 's') + ' needs a heap' });
    }
    if (inst.op === 'call' && !ctx.known.has(ctx.targets[inst.callee])) {
      reasons.push({ fn: fn.name, why: 'the callee of a call is not a known function' });
    }
    checkOperator(fn, inst, reasons);
  }

  function checkOperator(fn, inst, reasons) {
    if (inst.op !== 'binary') return;
    if (ARITH[inst.operator] || COMPARE[inst.operator]) return;
    if (['div', 'rem', 'and', 'or'].indexOf(inst.operator) !== -1) return;
    reasons.push({ fn: fn.name, why: 'the operator ' + inst.operator + ' has no encoding' });
  }

  function numeric(value) {
    return typeof value === 'number' || typeof value === 'boolean' || value === null;
  }

  function asNumber(value) {
    if (typeof value === 'boolean') return value ? 1 : 0;
    return value === null ? 0 : value;
  }

  /* ---------------------------------------------------------- the stackifier */

  /**
   * Ramsey's recursive translation. Walk the dominator tree; a block that is
   * the target of a back edge becomes a `loop`, a block with several
   * predecessors becomes a `block` opened at its immediate dominator and
   * closed just before it, and every other edge is emitted inline because the
   * source dominates the target. A branch then becomes a `br` to the enclosing
   * label whose depth is its position in the context.
   *
   * The reason this is not "just emit a switch" is the reason wasm is fast: a
   * dispatch loop defeats the engine's own branch prediction and register
   * allocation, and the structured form is what lets it compile straight
   * through.
   */
  function structureOf(fn) {
    const graph = Cfg.build(fn);
    const tree = Dominators.compute(graph);
    const rpo = Dominators.reversePostorder(graph);
    const rank = {};

    rpo.forEach(function (id, at) { rank[id] = at; });
    return { fn: fn, graph: graph, tree: tree, rank: rank,
      loopHeaders: headerSet(graph, tree),
      merges: mergeSet(graph),
      children: childrenByBlock(graph, tree, rank) };
  }

  function headerSet(graph, tree) {
    const headers = new Set();

    Cfg.backEdges(graph, tree).forEach(function (edge) { headers.add(edge.to); });
    return headers;
  }

  function mergeSet(graph) {
    const merges = new Set();

    graph.blocks.forEach(function (id) {
      if ((graph.preds[id] || []).length > 1) merges.add(id);
    });
    return merges;
  }

  function childrenByBlock(graph, tree, rank) {
    const out = {};

    graph.blocks.forEach(function (id) { out[id] = []; });
    graph.blocks.forEach(function (id) {
      const parent = Dominators.immediate(tree, id);

      if (parent && parent !== id) out[parent].push(id);
    });
    Object.keys(out).forEach(function (id) {
      out[id].sort(function (a, b) { return rank[a] - rank[b]; });
    });
    return out;
  }

  /* --------------------------------------------------------- body emission */

  function emitBody(fn, ctx) {
    const shape = structureOf(fn);
    const state = { bytes: [], shape: shape, ctx: ctx, fn: fn,
      locals: ctx.localsOf(fn), scratch: ctx.scratchOf(fn), targets: directTargets(fn) };

    doTree(state, fn.entry, []);
    state.bytes.push(OP.f64Const);
    state.bytes.push.apply(state.bytes, f64Bytes(0));
    state.bytes.push(OP.end);
    return state.bytes;
  }

  function doTree(state, id, context) {
    if (!state.shape.loopHeaders.has(id)) { doNode(state, id, context); return; }
    state.bytes.push(OP.loop, 0x40);
    doNode(state, id, [{ kind: 'loop', label: id }].concat(context));
    state.bytes.push(OP.end);
  }

  function doNode(state, id, context) {
    const merges = state.shape.children[id].filter(function (child) {
      return state.shape.merges.has(child);
    });

    doBranches(state, merges, id, context);
  }

  function doBranches(state, merges, id, context) {
    if (!merges.length) { emitBlockBody(state, id, context); return; }
    const first = merges[0];

    state.bytes.push(OP.block, 0x40);
    doBranches(state, merges.slice(1), id, [{ kind: 'block', label: first }].concat(context));
    state.bytes.push(OP.end);
    doTree(state, first, context);
  }

  function emitBlockBody(state, id, context) {
    const block = Ir.blockById(state.fn, id);

    block.instructions.forEach(function (inst) { emitInstruction(state, inst); });
    emitTerminator(state, block.terminator, id, context);
  }

  function emitTerminator(state, term, id, context) {
    if (!term) return;
    if (term.op === 'ret') { emitReturn(state, term); return; }
    if (term.op === 'jump') { doBranch(state, term.target, context); return; }
    pushValue(state, term.cond);
    state.bytes.push(OP.f64Const);
    state.bytes.push.apply(state.bytes, f64Bytes(0));
    state.bytes.push(OP.f64Ne, OP.if, 0x40);
    doBranch(state, term.then, [{ kind: 'if' }].concat(context));
    state.bytes.push(OP.else);
    doBranch(state, term.other, [{ kind: 'if' }].concat(context));
    state.bytes.push(OP.end);
  }

  function emitReturn(state, term) {
    if (term.value === null) {
      state.bytes.push(OP.f64Const);
      state.bytes.push.apply(state.bytes, f64Bytes(0));
    } else pushValue(state, term.value);
    state.bytes.push(OP.return);
  }

  function doBranch(state, target, context) {
    const depth = context.findIndex(function (entry) { return entry.label === target; });

    if (depth === -1) { doTree(state, target, context); return; }
    state.bytes.push(OP.br);
    state.bytes.push.apply(state.bytes, uleb(depth));
  }

  /* ------------------------------------------------------ instruction emission */

  function pushValue(state, value) {
    if (!Ir.isRegister(value)) {
      state.bytes.push(OP.f64Const);
      state.bytes.push.apply(state.bytes, f64Bytes(asNumber(value)));
      return;
    }
    state.bytes.push(OP.localGet);
    state.bytes.push.apply(state.bytes, uleb(state.locals.index[value]));
  }

  function storeTo(state, register) {
    state.bytes.push(OP.localSet);
    state.bytes.push.apply(state.bytes, uleb(state.locals.index[register]));
  }

  const EMIT = {
    const: function (state, inst) {
      state.bytes.push(OP.f64Const);
      state.bytes.push.apply(state.bytes, f64Bytes(asNumber(inst.value)));
      storeTo(state, inst.target);
    },
    move: function (state, inst) { pushValue(state, inst.from); storeTo(state, inst.target); },
    loadLocal: function (state, inst) {
      const slot = state.ctx.slotIndex(state.fn, inst.slot);

      state.bytes.push(slot.global ? OP.globalGet : OP.localGet);
      state.bytes.push.apply(state.bytes, uleb(slot.at));
      storeTo(state, inst.target);
    },
    storeLocal: function (state, inst) {
      const slot = state.ctx.slotIndex(state.fn, inst.slot);

      pushValue(state, inst.value);
      state.bytes.push(slot.global ? OP.globalSet : OP.localSet);
      state.bytes.push.apply(state.bytes, uleb(slot.at));
    },
    unary: function (state, inst) { emitUnary(state, inst); },
    binary: function (state, inst) { emitBinary(state, inst); },
    /* A capture-free closure is a function index, and the index is all the
       call site needs — so the "allocation" is a constant. */
    makeClosure: function (state, inst) {
      state.bytes.push(OP.f64Const);
      state.bytes.push.apply(state.bytes, f64Bytes(state.ctx.functionIndex(inst.func)));
      storeTo(state, inst.target);
    },
    call: function (state, inst) {
      inst.args.forEach(function (arg) { pushValue(state, arg); });
      state.bytes.push(OP.call);
      state.bytes.push.apply(state.bytes,
        uleb(state.ctx.functionIndex(state.targets[inst.callee])));
      storeTo(state, inst.target);
    }
  };

  function emitInstruction(state, inst) {
    const rule = EMIT[inst.op];

    if (!rule) throw new Error(inst.op + ' is outside the numeric subset');
    rule(state, inst);
  }

  function emitUnary(state, inst) {
    pushValue(state, inst.operand);
    if (inst.operator === '-') state.bytes.push(OP.f64Neg);
    else {
      state.bytes.push(OP.f64Const);
      state.bytes.push.apply(state.bytes, f64Bytes(0));
      state.bytes.push(OP.f64Eq, OP.f64ConvertI32U);
    }
    storeTo(state, inst.target);
  }

  function emitBinary(state, inst) {
    if (ARITH[inst.operator]) { emitArith(state, inst); return; }
    if (COMPARE[inst.operator]) { emitCompare(state, inst); return; }
    if (inst.operator === 'div' || inst.operator === 'rem') { emitDivide(state, inst); return; }
    emitLogical(state, inst);
  }

  function emitArith(state, inst) {
    pushValue(state, inst.left);
    pushValue(state, inst.right);
    state.bytes.push(ARITH[inst.operator]);
    storeTo(state, inst.target);
  }

  function emitCompare(state, inst) {
    pushValue(state, inst.left);
    pushValue(state, inst.right);
    state.bytes.push(COMPARE[inst.operator], OP.f64ConvertI32U);
    storeTo(state, inst.target);
  }

  /**
   * Berugo faults on a division by zero and wasm produces an infinity, so the
   * guard is not optional — without it the two execution modes disagree on
   * exactly the program M29's LICM section is built around. `unreachable`
   * traps, and the harness reports a trap as the runtime fault it is.
   */
  function emitDivide(state, inst) {
    const scratch = state.scratch;

    pushValue(state, inst.left);
    state.bytes.push(OP.localSet);
    state.bytes.push.apply(state.bytes, uleb(scratch.left));
    pushValue(state, inst.right);
    state.bytes.push(OP.localTee);
    state.bytes.push.apply(state.bytes, uleb(scratch.right));
    state.bytes.push(OP.f64Const);
    state.bytes.push.apply(state.bytes, f64Bytes(0));
    state.bytes.push(OP.f64Eq, OP.if, 0x40, OP.unreachable, OP.end);
    emitDivideBody(state, inst, scratch);
    storeTo(state, inst.target);
  }

  function emitDivideBody(state, inst, scratch) {
    const get = function (at) {
      state.bytes.push(OP.localGet);
      state.bytes.push.apply(state.bytes, uleb(at));
    };

    if (inst.operator === 'div') { get(scratch.left); get(scratch.right); state.bytes.push(OP.f64Div); return; }
    get(scratch.left);
    get(scratch.left);
    get(scratch.right);
    state.bytes.push(OP.f64Div, OP.f64Trunc);
    get(scratch.right);
    state.bytes.push(OP.f64Mul, OP.f64Sub);
  }

  function emitLogical(state, inst) {
    const zero = function () {
      state.bytes.push(OP.f64Const);
      state.bytes.push.apply(state.bytes, f64Bytes(0));
      state.bytes.push(OP.f64Ne);
    };

    pushValue(state, inst.left);
    zero();
    pushValue(state, inst.right);
    zero();
    state.bytes.push(inst.operator === 'and' ? OP.i32And : OP.i32Or, OP.f64ConvertI32U);
    storeTo(state, inst.target);
  }

  /* ---------------------------------------------------------- the module */

  /**
   * `main`'s named locals become exported mutable globals, which is what
   * makes the result readable: after calling the exported `main`, every
   * top-level binding is a global the host can read, and the comparison
   * against the interpreter is on those values rather than on a return.
   */
  function layout(program) {
    const order = program.functions.map(function (fn) { return fn.name; });
    const index = {};
    const globals = [];

    order.forEach(function (name, at) { index[name] = at; });
    const main = program.functions.find(function (fn) { return fn.name === program.main; });

    const types = main ? slotTypes(program, main) : {};

    (main ? main.slots || [] : []).forEach(function (slot) {
      const found = types[slot.name] || { type: 'Number', fn: '' };

      globals.push({ name: slot.name, source: slot.source, depth: slot.depth,
        type: found.type, fn: found.fn, at: globals.length });
    });
    return { order: order, index: index, globals: globals, main: main };
  }

  /**
   * Everything in the module is an f64, so a Bool comes back as 1 and a
   * function comes back as its index. The checker already computed both types
   * and the IR kept them; dropping them here would report a difference
   * against the interpreter that is a formatting choice rather than a
   * disagreement about what the program computed.
   *
   * A call's result is `unknown` in the IR, so it is resolved from the
   * callee's own return type — and a callee whose return type is itself
   * unknown, which is what a polymorphic function has, leaves the binding
   * unrepresentable. That is not a gap to paper over: erasing every value
   * into one machine type is exactly what costs a dynamic language its
   * observables, and it is why a real wasm back end either boxes or
   * specialises per call site.
   */
  function slotTypes(program, main) {
    return inferTypes(program).slots[main.name] || {};
  }

  /**
   * A fixpoint over the whole program, because a type crosses two boundaries
   * the IR does not record. A `loadLocal` has the type of whatever was stored
   * into the slot, and a call has the type its callee returns — and a callee
   * may itself return a slot. One pass gets the straight-line cases and
   * leaves every function that returns a local unknown, which put four
   * conformance programs outside the subset for a reason that was the
   * inference rather than the encoding.
   */
  function inferTypes(program) {
    const state = { slots: {}, returns: {} };

    program.functions.forEach(function (fn) {
      state.slots[fn.name] = {};
      state.returns[fn.name] = 'unknown';
    });
    for (let round = 0; round < 8; round += 1) {
      let changed = false;

      program.functions.forEach(function (fn) {
        if (inferOne(fn, state)) changed = true;
      });
      if (!changed) break;
    }
    return state;
  }

  function inferOne(fn, state) {
    const targets = directTargets(fn);
    const types = {};
    let changed = false;

    Ir.eachInstruction(fn, function (inst) {
      const target = Ir.definitionOf(inst);

      if (target) types[target] = typeOfValue(fn, inst, state, targets);
      if (inst.op === 'storeLocal') {
        changed = record(state.slots[fn.name], inst.slot, typeOf(fn, types, inst.value)) || changed;
      }
      if (inst.op === 'ret') changed = recordReturn(fn, inst, types, state) || changed;
    });
    return changed;
  }

  function typeOfValue(fn, inst, state, targets) {
    if (inst.op === 'makeClosure') {
      return { type: 'Fn', fn: inst.sourceName || inst.func };
    }
    if (inst.op === 'loadLocal') {
      return state.slots[fn.name][inst.slot] || { type: 'unknown', fn: '' };
    }
    if (inst.op === 'call' && targets[inst.callee]) {
      return { type: state.returns[targets[inst.callee]] || 'unknown', fn: '' };
    }
    return { type: fn.types[Ir.definitionOf(inst)] || 'unknown', fn: '' };
  }

  function typeOf(fn, types, register) {
    if (types[register]) return types[register];
    return { type: fn.types[register] || 'unknown', fn: '' };
  }

  function record(into, key, found) {
    if (found.type === 'unknown') return false;
    if (into[key] && into[key].type === found.type && into[key].fn === found.fn) return false;
    into[key] = found;
    return true;
  }

  function recordReturn(fn, inst, types, state) {
    const found = inst.value === null ? { type: 'Unit', fn: '' } : typeOf(fn, types, inst.value);

    if (found.type === 'unknown' || state.returns[fn.name] === found.type) return false;
    state.returns[fn.name] = found.type;
    return true;
  }

  /* ------------------------------------------------------- the module builder */

  function localsOf(fn) {
    const names = [];
    const index = {};

    fn.params.forEach(function (register) {
      index[register] = names.length;
      names.push(register);
    });
    Ir.eachInstruction(fn, function (inst) {
      const target = Ir.definitionOf(inst);

      if (target && index[target] === undefined) {
        index[target] = names.length;
        names.push(target);
      }
    });
    return { names: names, index: index, params: fn.params.length };
  }

  function makeContext(program, plan) {
    const localsCache = new Map();
    const of = function (fn) {
      if (!localsCache.has(fn)) localsCache.set(fn, localsOf(fn));
      return localsCache.get(fn);
    };

    return { localsOf: of,
      functionIndex: function (name) { return plan.index[name]; },
      scratchOf: function (fn) {
        const locals = of(fn);

        return { left: locals.names.length, right: locals.names.length + 1 };
      },
      slotIndex: function (fn, name) {
        if (fn.name === program.main) {
          const found = plan.globals.find(function (row) { return row.name === name; });

          return { global: true, at: found ? found.at : 0 };
        }
        return { global: false, at: localSlotIndex(of(fn), fn, name) };
      } };
  }

  /** A non-main function's slots live after its registers and scratch pair. */
  function localSlotIndex(locals, fn, name) {
    const at = (fn.slots || []).findIndex(function (slot) { return slot.name === name; });

    return locals.names.length + 2 + (at === -1 ? 0 : at);
  }

  function functionBody(fn, ctx, plan) {
    const locals = ctx.localsOf(fn);
    const extra = locals.names.length - locals.params + 2
      + (fn.name === plan.main.name ? 0 : (fn.slots || []).length);
    const declared = extra > 0 ? [1].concat(uleb(extra), [0x7c]) : [0];
    const body = declared.concat(emitBody(fn, ctx));

    return uleb(body.length).concat(body);
  }

  function buildModule(program) {
    const plan = layout(program);
    const ctx = makeContext(program, plan);
    const types = program.functions.map(function (fn) {
      return [0x60].concat(uleb(fn.params.length),
        new Array(fn.params.length).fill(0x7c), [1, 0x7c]);
    });

    return new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]
      .concat(section(1, vector(types)))
      .concat(section(3, vector(program.functions.map(function (fn, at) { return uleb(at); }))))
      .concat(section(6, vector(plan.globals.map(globalEntry))))
      .concat(section(7, vector(exportRows(program, plan))))
      .concat(section(10, vector(program.functions.map(function (fn) {
        return functionBody(fn, ctx, plan);
      })))));
  }

  function globalEntry() {
    return [0x7c, 0x01, OP.f64Const].concat(f64Bytes(0), [OP.end]);
  }

  function exportRows(program, plan) {
    const rows = [nameBytes(program.main).concat([0x00], uleb(plan.index[program.main]))];

    plan.globals.forEach(function (row) {
      rows.push(nameBytes('g' + row.at).concat([0x03], uleb(row.at)));
    });
    return rows;
  }

  /* ---------------------------------------------------------------- running */

  function available() {
    return typeof WebAssembly !== 'undefined' && typeof WebAssembly.validate === 'function';
  }

  function validate(bytes) {
    if (!available()) return { ok: false, why: 'this host has no WebAssembly' };
    return { ok: WebAssembly.validate(bytes), why: '' };
  }

  /**
   * Instantiate, call the exported main, then read the globals back — which
   * is the whole observable, and it is deliberately the same set of names the
   * interpreter reports so the two can be compared without a translation
   * step.
   */
  function run(program, options) {
    const settings = options || {};
    const reasons = applicable(program);

    if (!reasons.ok) return { ok: false, outcome: 'unsupported', reasons: reasons.reasons };
    if (!available()) return { ok: false, outcome: 'unsupported', reasons: [{ why: 'no WebAssembly here' }] };
    const bytes = buildModule(program);

    return instantiate(bytes, program, settings);
  }

  /**
   * The globals are read back even when the call traps, because they hold
   * whatever was written before it — which is exactly what the interpreter
   * reports for a program that faults halfway. Returning an empty list on a
   * trap would make every faulting program disagree with the reference on the
   * bindings as well as on the outcome, and only one of those is real.
   */
  function instantiate(bytes, program, settings) {
    const plan = layout(program);
    let instance = null;

    try {
      instance = new WebAssembly.Instance(new WebAssembly.Module(bytes));
      instance.exports[program.main]();
      return { ok: true, outcome: 'ok', bytes: bytes.length,
        bindings: readBindings(instance, plan), value: 'unit', output: [],
        globals: plan.globals.length, settings: settings };
    } catch (problem) {
      return { ok: false, outcome: outcomeOf(problem), bytes: bytes.length,
        bindings: instance ? readBindings(instance, plan) : [], value: '', output: [],
        error: String(problem.message || problem) };
    }
  }

  function outcomeOf(problem) {
    return problem instanceof WebAssembly.RuntimeError ? 'runtime' : 'compile';
  }

  function readBindings(instance, plan) {
    const rows = [];

    plan.globals.forEach(function (row) {
      if (!row.source || row.source === 'if' || row.source.charAt(0) === '$') return;
      if (row.depth) return;
      rows.push(row.source + ' = ' + showValue(instance.exports['g' + row.at].value, row));
    });
    return rows.sort();
  }

  function showValue(value, row) {
    if (row.type === 'Bool') return value ? 'true' : 'false';
    if (row.type === 'Fn') return '<fn ' + row.fn + '>';
    return String(value);
  }

  /* --------------------------------------------------------------- reporting */

  function sectionSizes(bytes) {
    const rows = [];
    let at = 8;

    while (at < bytes.length) {
      const id = bytes[at];
      const read = readUleb(bytes, at + 1);

      rows.push({ id: id, name: SECTION_NAMES[id] || String(id), size: read.value });
      at = read.at + read.value;
    }
    return rows;
  }

  const SECTION_NAMES = { 1: 'type', 3: 'function', 6: 'global', 7: 'export', 10: 'code' };

  function readUleb(bytes, at) {
    let value = 0;
    let shift = 0;
    let cursor = at;

    for (;;) {
      const byte = bytes[cursor];

      cursor += 1;
      value |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) break;
      shift += 7;
    }
    return { value: value, at: cursor };
  }

  return {
    OP: OP, SUPPORTED: SUPPORTED,
    applicable: applicable, structureOf: structureOf, buildModule: buildModule,
    validate: validate, run: run, available: available,
    sectionSizes: sectionSizes, layout: layout, localsOf: localsOf,
    uleb: uleb, sleb: sleb, f64Bytes: f64Bytes
  };
}));
