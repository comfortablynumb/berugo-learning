/**
 * Berugo bytecode: two instruction sets over the same IR, and one encoder.
 *
 * The milestone's first question is stack versus register, and it is only
 * answerable with two real code generators rather than an argument. Both
 * consume the SAME IR — the one M29's lowering produces, before SSA, where
 * every value that crosses a block boundary is a slot — so the difference in
 * the table is the instruction set and nothing else.
 *
 * That "before SSA" clause is what makes the register generator tractable:
 * **every non-parameter register in the lowered IR is defined and used inside
 * one block**, because anything crossing a block goes through a named local.
 * So a virtual register can be freed at its last use in the block and reused,
 * and the allocator is twenty lines rather than M30.4's graph colouring.
 * `Bytecode.blockLocal(fn)` states the invariant and the tests assert it.
 *
 * The two sets differ in exactly the way the literature says they do: the
 * stack set has small instructions and many of them, the register set has
 * larger instructions and fewer. Which is faster depends on dispatch cost,
 * and dispatch is what the VM counts.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Berugo = scope.Berugo || {};
    scope.Berugo.Bytecode = api;
  }
}(this, function (root) {
  'use strict';

  const berugo = root && root.Berugo ? root.Berugo : null;
  const Ir = berugo && berugo.Ir ? berugo.Ir : require('./ir.js');

  /* ------------------------------------------------------- the instruction sets */

  /**
   * `operands` names the fields each instruction carries, and `stack` says
   * what it does to the operand stack. Both are read by the encoder, the
   * disassembler and the VM rather than each knowing the set — the same
   * one-table discipline `ir.js` uses, for the same reason.
   */
  const STACK_SET = {
    CONST: { operands: ['k'], push: 1, pop: 0, about: 'push a pooled constant' },
    LOAD_LOCAL: { operands: ['slot'], push: 1, pop: 0, about: 'push a named local' },
    STORE_LOCAL: { operands: ['slot'], push: 0, pop: 1, about: 'pop into a named local' },
    LOAD_ARG: { operands: ['index'], push: 1, pop: 0, about: 'push a parameter' },
    UNARY: { operands: ['k'], push: 1, pop: 1, about: 'negate or not' },
    BINARY: { operands: ['k'], push: 1, pop: 2, about: 'arithmetic and comparison' },
    CALL: { operands: ['count'], push: 1, pop: null, about: 'callee then args, then this' },
    MAKE_ARRAY: { operands: ['count'], push: 1, pop: null, about: 'allocate from the stack' },
    MAKE_RECORD: { operands: ['k'], push: 1, pop: null, about: 'field names from the pool' },
    MAKE_CLOSURE: { operands: ['k'], push: 1, pop: null, about: 'captures from the stack' },
    LOAD_FIELD: { operands: ['k'], push: 1, pop: 1, about: 'read a record field' },
    STORE_FIELD: { operands: ['k'], push: 0, pop: 2, about: 'write a record field' },
    LOAD_INDEX: { operands: [], push: 1, pop: 2, about: 'read an array element' },
    STORE_INDEX: { operands: [], push: 0, pop: 3, about: 'write an array element' },
    POP: { operands: [], push: 0, pop: 1, about: 'discard a value nobody reads' },
    JUMP: { operands: ['target'], push: 0, pop: 0, about: 'unconditional' },
    JUMP_FALSE: { operands: ['target'], push: 0, pop: 1, about: 'two-way, popping the test' },
    RET: { operands: ['k'], push: 0, pop: null, about: 'leave the function' }
  };

  const REGISTER_SET = {
    CONST_R: { operands: ['d', 'k'], about: 'a pooled constant into a register' },
    MOVE_R: { operands: ['d', 'a'], about: 'a copy between registers' },
    LOAD_LOCAL_R: { operands: ['d', 'slot'], about: 'a named local into a register' },
    STORE_LOCAL_R: { operands: ['slot', 'a'], about: 'a register into a named local' },
    UNARY_R: { operands: ['d', 'k', 'a'], about: 'negate or not' },
    BINARY_R: { operands: ['d', 'k', 'a', 'b'], about: 'arithmetic and comparison' },
    CALL_R: { operands: ['d', 'a', 'base', 'count'], about: 'args in consecutive registers' },
    MAKE_ARRAY_R: { operands: ['d', 'base', 'count'], about: 'from consecutive registers' },
    MAKE_RECORD_R: { operands: ['d', 'k', 'base'], about: 'field names from the pool' },
    MAKE_CLOSURE_R: { operands: ['d', 'k', 'base'], about: 'captures from consecutive registers' },
    LOAD_FIELD_R: { operands: ['d', 'k', 'a'], about: 'read a record field' },
    STORE_FIELD_R: { operands: ['a', 'k', 'b'], about: 'write a record field' },
    LOAD_INDEX_R: { operands: ['d', 'a', 'b'], about: 'read an array element' },
    STORE_INDEX_R: { operands: ['a', 'b', 'c'], about: 'write an array element' },
    JUMP_R: { operands: ['target'], about: 'unconditional' },
    JUMP_FALSE_R: { operands: ['a', 'target'], about: 'two-way, testing a register' },
    RET_R: { operands: ['a'], about: 'leave the function' }
  };

  const SETS = { stack: STACK_SET, register: REGISTER_SET };

  function setFor(mode) {
    const set = SETS[mode];

    if (!set) throw new Error('no instruction set named ' + mode);
    return set;
  }

  /* ------------------------------------------------------- the constant pool */

  /**
   * Deduplicated by printed form, because a pool that stores `1` three times
   * is three cache lines where one would do — and because the encoded size the
   * demo reports is only meaningful if the pool is the one a real VM would
   * build. Objects (field-name lists, closure descriptors) are keyed on JSON.
   */
  function makePool() {
    const values = [];
    const index = new Map();

    return { values: values, intern: function (value) {
      const key = typeof value === 'object' && value !== null
        ? 'o' + JSON.stringify(value) : typeof value + ':' + String(value);

      if (index.has(key)) return index.get(key);
      index.set(key, values.length);
      values.push(value);
      return values.length - 1;
    } };
  }

  /* --------------------------------------------------- the block-local invariant */

  /**
   * Which non-parameter registers are read outside the block that defined
   * them. In the lowered IR the answer is none, and the register allocator
   * below depends on it — so it is reported rather than assumed, and a future
   * lowering that breaks it fails a test instead of producing wrong code.
   */
  function blockLocal(fn) {
    const home = {};
    const escaping = [];

    fn.blocks.forEach(function (block) {
      eachOf(block).forEach(function (inst) {
        const target = Ir.definitionOf(inst);

        if (target) home[target] = block.id;
      });
    });
    fn.blocks.forEach(function (block) {
      eachOf(block).forEach(function (inst) {
        Ir.usesOf(inst).forEach(function (register) {
          if (fn.params.indexOf(register) !== -1) return;
          if (home[register] && home[register] !== block.id) escaping.push(register);
        });
      });
    });
    return { ok: escaping.length === 0, escaping: escaping, defined: Object.keys(home).length };
  }

  function eachOf(block) {
    return block.instructions.concat(block.terminator ? [block.terminator] : []);
  }

  /* ------------------------------------------------------ the stack generator */

  function compileFunction(fn, options) {
    const settings = options || {};
    const mode = settings.mode || 'stack';
    const state = startChunk(fn, mode);

    if (settings.keepOnStack === false) state.keepOnStack = false;
    fn.blocks.forEach(function (block) {
      state.labels[block.id] = state.code.length;
      (mode === 'stack' ? emitStackBlock : emitRegisterBlock)(state, block);
    });
    patchJumps(state);
    return finishChunk(state, fn);
  }

  function startChunk(fn, mode) {
    const slots = (fn.slots || []).map(function (slot) { return slot.name; });

    return { fn: fn, mode: mode, code: [], pool: makePool(), labels: {},
      slotIndex: indexOf(slots), slots: slots, params: fn.params.slice(),
      registers: 0, patches: [], keepOnStack: true, current: null };
  }

  function indexOf(names) {
    const out = {};

    names.forEach(function (name, at) { out[name] = at; });
    return out;
  }

  function finishChunk(state, fn) {
    return { name: fn.name, mode: state.mode, arity: fn.params.length,
      code: state.code, constants: state.pool.values, slots: state.slots,
      slotMeta: fn.slots || [], registers: state.registers, labels: state.labels,
      set: setFor(state.mode) };
  }

  function patchJumps(state) {
    state.code.forEach(function (inst) {
      if (inst.target === undefined || typeof inst.target === 'number') return;
      inst.target = state.labels[inst.target];
    });
  }

  /**
   * Every emitted instruction carries the origin and span of the IR
   * instruction it came from. M28 spent a milestone making spans survive
   * desugaring and M29 kept them through every pass; dropping them at the
   * bytecode boundary is where a stack trace stops naming a source line, and
   * 30.9's source map is built from exactly this field.
   */
  function emit(state, op, fields) {
    const from = state.current;

    state.code.push(Object.assign({ op: op }, fields,
      from ? { origin: from.origin, span: from.span } : {}));
    return state.code[state.code.length - 1];
  }

  /**
   * A stack block is a post-order walk of each instruction's operands. Because
   * the IR is three-address, "the operands" is a flat list — the tree the
   * source had is already gone, which is why the expansion is mechanical and
   * why the instruction count is so much higher than the IR's.
   */
  function emitStackBlock(state, block) {
    const start = state.code.length;

    block.instructions.forEach(function (inst) { emitStack(state, inst); });
    emitStackTerminator(state, block.terminator);
    if (state.keepOnStack) keepOnStack(state, start, block);
  }

  /**
   * The one peephole every stack code generator has, and the reason a fair
   * comparison needs it. Emitting a store and an immediate load for a value
   * whose only reader is the next instruction is what makes the naive
   * expansion look twice the size of the register one; leaving the value on
   * the stack is what a real generator does. A value nobody reads becomes a
   * `POP`, which is a different instruction and worth seeing separately.
   *
   * The demo can turn this off, because the gap between the two rows is the
   * honest measure of how much of the stack/register difference is the
   * instruction set and how much is one missing rewrite.
   */
  function keepOnStack(state, start, block) {
    const uses = useCounts(block);
    const out = state.code.slice(0, start);
    const body = state.code.slice(start);
    let at = 0;

    while (at < body.length) {
      const here = body[at];
      const next = body[at + 1];

      if (fusesWithLoad(here, next, uses)) { at += 2; continue; }
      if (here.op === 'STORE_TEMP' && !uses[here.register]) out.push({ op: 'POP' });
      else out.push(here);
      at += 1;
    }
    state.code = out;
  }

  function fusesWithLoad(here, next, uses) {
    return here.op === 'STORE_TEMP' && next && next.op === 'LOAD_TEMP'
      && next.register === here.register && uses[here.register] === 1;
  }

  function useCounts(block) {
    const counts = {};

    eachOf(block).forEach(function (inst) {
      Ir.usesOf(inst).forEach(function (register) {
        counts[register] = (counts[register] || 0) + 1;
      });
    });
    return counts;
  }

  function pushOperand(state, register) {
    const at = state.params.indexOf(register);

    if (at !== -1) return emit(state, 'LOAD_ARG', { index: at });
    if (!Ir.isRegister(register)) return emit(state, 'CONST', { k: state.pool.intern(register) });
    return emit(state, 'LOAD_TEMP', { register: register });
  }

  const STACK_EMIT = {
    const: function (state, inst) { emit(state, 'CONST', { k: state.pool.intern(inst.value) }); },
    move: function (state, inst) { pushOperand(state, inst.from); },
    loadLocal: function (state, inst) {
      emit(state, 'LOAD_LOCAL', { slot: state.slotIndex[inst.slot] });
    },
    storeLocal: function (state, inst) {
      pushOperand(state, inst.value);
      emit(state, 'STORE_LOCAL', { slot: state.slotIndex[inst.slot] });
    },
    unary: function (state, inst) {
      pushOperand(state, inst.operand);
      emit(state, 'UNARY', { k: state.pool.intern(inst.operator) });
    },
    binary: function (state, inst) {
      pushOperand(state, inst.left);
      pushOperand(state, inst.right);
      emit(state, 'BINARY', { k: state.pool.intern(inst.operator) });
    },
    call: function (state, inst) {
      pushOperand(state, inst.callee);
      inst.args.forEach(function (arg) { pushOperand(state, arg); });
      emit(state, 'CALL', { count: inst.args.length });
    },
    makeArray: function (state, inst) {
      inst.args.forEach(function (arg) { pushOperand(state, arg); });
      emit(state, 'MAKE_ARRAY', { count: inst.args.length });
    },
    makeRecord: function (state, inst) {
      inst.args.forEach(function (arg) { pushOperand(state, arg); });
      emit(state, 'MAKE_RECORD', { k: state.pool.intern(inst.fields.slice()) });
    },
    makeClosure: function (state, inst) {
      inst.args.forEach(function (arg) { pushOperand(state, arg); });
      emit(state, 'MAKE_CLOSURE', { k: state.pool.intern({ func: inst.func,
        sourceName: inst.sourceName || '', count: inst.args.length }) });
    },
    loadField: function (state, inst) {
      pushOperand(state, inst.object);
      emit(state, 'LOAD_FIELD', { k: state.pool.intern(inst.field) });
    },
    storeField: function (state, inst) {
      pushOperand(state, inst.object);
      pushOperand(state, inst.value);
      emit(state, 'STORE_FIELD', { k: state.pool.intern(inst.field) });
    },
    loadIndex: function (state, inst) {
      pushOperand(state, inst.object);
      pushOperand(state, inst.index);
      emit(state, 'LOAD_INDEX', {});
    },
    storeIndex: function (state, inst) {
      pushOperand(state, inst.object);
      pushOperand(state, inst.index);
      pushOperand(state, inst.value);
      emit(state, 'STORE_INDEX', {});
    }
  };

  /**
   * A stack machine has no names, so a value another instruction in the block
   * will read has to be kept somewhere. `LOAD_TEMP`/`STORE_TEMP` is that
   * somewhere: a per-frame scratch array indexed by the IR register, which is
   * what a real stack VM spends its local slots on. The alternative — keeping
   * everything on the stack and shuffling — needs a scheduler, and pretending
   * otherwise is how a stack compiler acquires a `DUP`-and-`SWAP` bug.
   */
  function emitStack(state, inst) {
    const rule = STACK_EMIT[inst.op];

    if (!rule) throw new Error('no stack rule for ' + inst.op);
    state.current = inst;
    rule(state, inst);
    const target = Ir.definitionOf(inst);

    if (target) emit(state, 'STORE_TEMP', { register: target });
  }

  function emitStackTerminator(state, term) {
    if (!term) return;
    state.current = term;
    if (term.op === 'jump') { emit(state, 'JUMP', { target: term.target }); return; }
    if (term.op === 'branch') {
      pushOperand(state, term.cond);
      emit(state, 'JUMP_FALSE', { target: term.other });
      emit(state, 'JUMP', { target: term.then });
      return;
    }
    if (term.value === null) emit(state, 'RET', { k: null });
    else { pushOperand(state, term.value); emit(state, 'RET', { k: 1 }); }
  }

  /* --------------------------------------------------- the register generator */

  /**
   * The virtual register allocator, and the whole of what `blockLocal` buys.
   * A register is live from its definition to its last use inside the block,
   * so a counter plus a free list assigns numbers correctly — parameters take
   * the low numbers and stay, everything else is recycled. Calls need their
   * arguments in consecutive registers, which is Lua's convention and the
   * reason the allocator has a `reserve` as well as an `alloc`.
   */
  function emitRegisterBlock(state, block) {
    const alloc = allocator(state, block);

    block.instructions.forEach(function (inst) {
      const rule = REGISTER_EMIT[inst.op];

      if (!rule) throw new Error('no register rule for ' + inst.op);
      state.current = inst;
      rule(state, inst, alloc);
      alloc.dropScratch();
      alloc.retire(inst);
    });
    emitRegisterTerminator(state, block.terminator, alloc);
  }

  /**
   * Two regions, and the split is what makes this correct rather than nearly
   * correct. The **permanent** region holds parameters and the registers IR
   * values live in, recycled at each value's last use in the block. The
   * **scratch** region sits strictly above it and holds the consecutive
   * argument runs a call needs; it is dropped after every IR instruction.
   *
   * Interleaving the two — releasing a scratch register as soon as its
   * operand was emitted — is the obvious version and is wrong: the callee
   * register is released before the arguments are laid out, the first
   * argument reuses it, and the call then invokes the argument. That is a
   * clobber, it produces "41 is not a function" rather than a wrong number,
   * and it survives every program with no direct calls.
   */
  function allocator(state, block) {
    const lastUse = lastUses(block);
    const map = {};
    const free = [];
    let permanent = state.params.length;
    let scratch = 0;
    const bump = function (n) { state.registers = Math.max(state.registers, n); return n; };

    state.params.forEach(function (register, at) { map[register] = at; });
    bump(permanent);
    return { of: function (register) {
      if (map[register] === undefined) {
        map[register] = free.length ? free.pop() : permanent++;
        bump(permanent);
      }
      return map[register];
    },
    /** Always above every permanent register allocated so far. */
    reserve: function (count) {
      const base = permanent + scratch;

      scratch += count;
      bump(base + count);
      return base;
    },
    dropScratch: function () { scratch = 0; },
    retire: function (inst) {
      Ir.usesOf(inst).forEach(function (register) {
        if (state.params.indexOf(register) !== -1) return;
        if (lastUse[register] === inst && map[register] !== undefined) free.push(map[register]);
      });
    } };
  }

  function lastUses(block) {
    const last = {};

    eachOf(block).forEach(function (inst) {
      Ir.usesOf(inst).forEach(function (register) { last[register] = inst; });
    });
    return last;
  }

  /** A constant operand has no register, so it is materialised into a scratch. */
  function operandRegister(state, alloc, value) {
    if (Ir.isRegister(value)) return alloc.of(value);
    const scratch = alloc.reserve(1);

    emit(state, 'CONST_R', { d: scratch, k: state.pool.intern(value) });
    return scratch;
  }

  /** Arguments land in consecutive registers, which is what `base` names. */
  function spread(state, alloc, values) {
    const base = alloc.reserve(values.length);

    values.forEach(function (value, at) {
      if (Ir.isRegister(value)) emit(state, 'MOVE_R', { d: base + at, a: alloc.of(value) });
      else emit(state, 'CONST_R', { d: base + at, k: state.pool.intern(value) });
    });
    return base;
  }

  const REGISTER_EMIT = {
    const: function (state, inst, alloc) {
      emit(state, 'CONST_R', { d: alloc.of(inst.target), k: state.pool.intern(inst.value) });
    },
    move: function (state, inst, alloc) {
      emit(state, 'MOVE_R', { d: alloc.of(inst.target), a: operandRegister(state, alloc, inst.from) });
    },
    loadLocal: function (state, inst, alloc) {
      emit(state, 'LOAD_LOCAL_R', { d: alloc.of(inst.target), slot: state.slotIndex[inst.slot] });
    },
    storeLocal: function (state, inst, alloc) {
      emit(state, 'STORE_LOCAL_R', { slot: state.slotIndex[inst.slot],
        a: operandRegister(state, alloc, inst.value) });
    },
    unary: function (state, inst, alloc) {
      emit(state, 'UNARY_R', { d: alloc.of(inst.target), k: state.pool.intern(inst.operator),
        a: operandRegister(state, alloc, inst.operand) });
    },
    /* The destination is allocated FIRST in every rule that has one, so the
       permanent region cannot grow into the scratch the operands are using. */
    binary: function (state, inst, alloc) {
      const target = alloc.of(inst.target);
      const left = operandRegister(state, alloc, inst.left);
      const right = operandRegister(state, alloc, inst.right);

      emit(state, 'BINARY_R', { d: target, k: state.pool.intern(inst.operator),
        a: left, b: right });
    },
    call: function (state, inst, alloc) {
      const target = alloc.of(inst.target);
      const callee = operandRegister(state, alloc, inst.callee);
      const base = spread(state, alloc, inst.args);

      emit(state, 'CALL_R', { d: target, a: callee, base: base, count: inst.args.length });
    },
    makeArray: function (state, inst, alloc) {
      const target = alloc.of(inst.target);

      emit(state, 'MAKE_ARRAY_R', { d: target, base: spread(state, alloc, inst.args),
        count: inst.args.length });
    },
    makeRecord: function (state, inst, alloc) {
      const target = alloc.of(inst.target);

      emit(state, 'MAKE_RECORD_R', { d: target, k: state.pool.intern(inst.fields.slice()),
        base: spread(state, alloc, inst.args) });
    },
    makeClosure: function (state, inst, alloc) {
      const target = alloc.of(inst.target);

      emit(state, 'MAKE_CLOSURE_R', { d: target,
        k: state.pool.intern({ func: inst.func, sourceName: inst.sourceName || '',
          count: inst.args.length }), base: spread(state, alloc, inst.args) });
    },
    loadField: function (state, inst, alloc) {
      emit(state, 'LOAD_FIELD_R', { d: alloc.of(inst.target), k: state.pool.intern(inst.field),
        a: operandRegister(state, alloc, inst.object) });
    },
    storeField: function (state, inst, alloc) {
      emit(state, 'STORE_FIELD_R', { a: operandRegister(state, alloc, inst.object),
        k: state.pool.intern(inst.field), b: operandRegister(state, alloc, inst.value) });
    },
    loadIndex: function (state, inst, alloc) {
      emit(state, 'LOAD_INDEX_R', { d: alloc.of(inst.target),
        a: operandRegister(state, alloc, inst.object),
        b: operandRegister(state, alloc, inst.index) });
    },
    storeIndex: function (state, inst, alloc) {
      emit(state, 'STORE_INDEX_R', { a: operandRegister(state, alloc, inst.object),
        b: operandRegister(state, alloc, inst.index),
        c: operandRegister(state, alloc, inst.value) });
    }
  };

  function emitRegisterTerminator(state, term, alloc) {
    if (!term) return;
    state.current = term;
    if (term.op === 'jump') { emit(state, 'JUMP_R', { target: term.target }); return; }
    if (term.op === 'branch') {
      emit(state, 'JUMP_FALSE_R', { a: operandRegister(state, alloc, term.cond),
        target: term.other });
      emit(state, 'JUMP_R', { target: term.then });
      return;
    }
    emit(state, 'RET_R', { a: term.value === null ? null
      : operandRegister(state, alloc, term.value) });
  }

  /* ---------------------------------------------------------------- encoding */

  /**
   * Two encodings over the same code. Fixed width pads every instruction to
   * the widest one and can be decoded by indexing; variable width spends one
   * byte on a small operand and two on a large one, and has to be decoded
   * sequentially. The bytes column is the whole of the trade, and it is only
   * honest with the pool counted — a register set with fewer instructions can
   * still be larger, and on this language it is.
   */
  function encode(chunk, options) {
    const settings = options || {};
    const width = settings.width || 'variable';
    const set = chunk.set || setFor(chunk.mode);
    const widest = widestOperandCount(set);
    const rows = chunk.code.map(function (inst) {
      return { op: inst.op, bytes: instructionBytes(inst, set, width, widest) };
    });

    return { width: width, rows: rows,
      code: rows.reduce(function (sum, row) { return sum + row.bytes; }, 0),
      pool: poolBytes(chunk.constants),
      instructions: rows.length,
      total: rows.reduce(function (sum, row) { return sum + row.bytes; }, 0)
        + poolBytes(chunk.constants) };
  }

  function widestOperandCount(set) {
    return Object.keys(set).reduce(function (most, name) {
      return Math.max(most, set[name].operands.length);
    }, 0);
  }

  function instructionBytes(inst, set, width, widest) {
    const spec = set[inst.op] || { operands: fallbackOperands(inst) };

    if (width === 'fixed') return 1 + widest * 2;
    return 1 + spec.operands.reduce(function (sum, name) {
      return sum + operandBytes(inst[name]);
    }, 0);
  }

  /** `LOAD_TEMP`/`STORE_TEMP` are stack-set instructions with one operand. */
  function fallbackOperands(inst) {
    return inst.register === undefined ? [] : ['register'];
  }

  function operandBytes(value) {
    const n = typeof value === 'number' ? Math.abs(value) : 0;

    return n < 128 ? 1 : 2;
  }

  /** A number is eight bytes, a string is its characters plus a length. */
  function poolBytes(constants) {
    return constants.reduce(function (sum, value) {
      if (typeof value === 'number') return sum + 8;
      if (typeof value === 'string') return sum + 1 + value.length;
      if (Array.isArray(value)) return sum + 1 + value.join('').length + value.length;
      if (value && typeof value === 'object') return sum + 2 + String(value.func || '').length;
      return sum + 1;
    }, 0);
  }

  /* ---------------------------------------------------------- superinstructions */

  /**
   * The cheapest speed-up a bytecode VM has: find the adjacent pairs that
   * occur most often and give them one opcode, so the dispatch happens once
   * instead of twice. It costs opcode space and a bigger switch, which is why
   * the count is a dial and the table reports what each one is worth rather
   * than a fixed set somebody chose once.
   */
  function pairFrequencies(chunk) {
    const counts = new Map();

    chunk.code.forEach(function (inst, at) {
      const next = chunk.code[at + 1];

      if (!next || isJumpTargetOf(chunk, at + 1) || isBranch(inst)) return;
      const key = inst.op + '+' + next.op;

      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries()).map(function (entry) {
      return { pair: entry[0], count: entry[1] };
    }).sort(function (a, b) { return b.count - a.count || a.pair.localeCompare(b.pair); });
  }

  function isJumpTargetOf(chunk, at) {
    return Object.keys(chunk.labels).some(function (id) { return chunk.labels[id] === at; });
  }

  function isBranch(inst) {
    return inst.target !== undefined;
  }

  /** Fusing does not change what runs; it changes how many dispatches it takes. */
  function fuse(chunk, count) {
    const chosen = pairFrequencies(chunk).slice(0, count)
      .map(function (row) { return row.pair; });

    return { chosen: chosen,
      saved: pairFrequencies(chunk).slice(0, count)
        .reduce(function (sum, row) { return sum + row.count; }, 0) };
  }

  /* ------------------------------------------------------------ disassembly */

  function disassemble(chunk) {
    const set = chunk.set || setFor(chunk.mode);
    const byOffset = {};

    Object.keys(chunk.labels).forEach(function (id) {
      byOffset[chunk.labels[id]] = id;
    });
    return chunk.code.map(function (inst, at) {
      return { at: at, label: byOffset[at] || '', op: inst.op,
        operands: showOperands(inst, set, chunk), origin: inst.register || '' };
    });
  }

  function showOperands(inst, set, chunk) {
    const spec = set[inst.op] || { operands: fallbackOperands(inst) };

    return spec.operands.map(function (name) {
      if (name === 'k') return showConstant(chunk.constants[inst[name]]);
      if (name === 'slot') return chunk.slots[inst[name]] || '@?';
      if (name === 'register') return inst.register;
      return String(inst[name]);
    }).join(', ');
  }

  function showConstant(value) {
    if (typeof value === 'string') return JSON.stringify(value);
    if (Array.isArray(value)) return '{' + value.join(', ') + '}';
    if (value && typeof value === 'object') return String(value.func);
    return String(value);
  }

  /* -------------------------------------------------------------- programs */

  function compile(program, options) {
    const settings = options || {};
    const chunks = {};

    program.functions.forEach(function (fn) {
      const local = blockLocal(fn);

      if (!local.ok) {
        throw new Error(fn.name + ' has a register crossing a block: ' + local.escaping[0]);
      }
      chunks[fn.name] = compileFunction(fn, settings);
    });
    return { chunks: chunks, main: program.main, mode: settings.mode || 'stack',
      globals: program.globals || [] };
  }

  /** Totals for the comparison table: the two sets on the same program. */
  function measure(program, options) {
    const settings = options || {};
    const built = compile(program, settings);
    const names = Object.keys(built.chunks);

    return { mode: built.mode, functions: names.length,
      instructions: names.reduce(function (sum, name) {
        return sum + built.chunks[name].code.length;
      }, 0),
      constants: names.reduce(function (sum, name) {
        return sum + built.chunks[name].constants.length;
      }, 0),
      bytes: names.reduce(function (sum, name) {
        return sum + encode(built.chunks[name], { width: settings.width }).total;
      }, 0),
      program: built };
  }

  return {
    STACK_SET: STACK_SET, REGISTER_SET: REGISTER_SET, SETS: SETS, setFor: setFor,
    blockLocal: blockLocal,
    compile: compile, compileFunction: compileFunction, measure: measure,
    encode: encode, disassemble: disassemble,
    pairFrequencies: pairFrequencies, fuse: fuse
  };
}));
