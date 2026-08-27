/**
 * The Berugo intermediate representation: three-address, typed, in blocks.
 *
 * Why not optimise the AST? Because an AST is a tree and control flow is a
 * graph. "Is this value available here" is a question about paths, and a tree
 * has no paths — every analysis in M29 would have to reconstruct the graph
 * first, from a structure that deliberately hides it. Lowering to blocks and
 * jumps once, and answering the question against the graph, is the whole
 * argument for a middle end.
 *
 * Three decisions, all of which are easy to regret later:
 *
 * - **Registers, not a stack.** A stack IR is smaller and is what M30 will
 *   emit, but every optimisation is stated in terms of "the definition of this
 *   value", and on a stack the definition is a position rather than a name.
 *   Virtual registers give every value a name, which is what makes SSA
 *   possible at all.
 * - **Typed.** Every register carries a type, because the checker already
 *   computed one and throwing it away means the optimiser has to guess what an
 *   addition adds. The verifier checks the types agree, which turns a whole
 *   class of pass bug into an immediate failure at the pass that caused it.
 * - **A verifier, run after every pass.** This is the highest-value piece of a
 *   middle end. Without it, a broken pass shows up as wrong output from a
 *   program compiled through eleven passes, and the bisect is manual. With it,
 *   the failure names the pass and the invariant it violated.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Berugo = scope.Berugo || {};
    scope.Berugo.Ir = api;
  }
}(this, function () {
  'use strict';

  /**
   * The instruction set. `defines` says whether the instruction produces a
   * value, `terminator` whether it ends a block, and `uses` names the fields
   * holding operand registers — one table, so every walker, the verifier and
   * every pass read the same description rather than each knowing the set.
   */
  const OPCODES = {
    const: { defines: true, uses: [], about: 'a literal into a register' },
    move: { defines: true, uses: ['from'], about: 'a copy, which copy propagation removes' },
    unary: { defines: true, uses: ['operand'], about: 'negation or not' },
    binary: { defines: true, uses: ['left', 'right'], about: 'arithmetic and comparison' },
    call: { defines: true, uses: ['callee', 'args'], about: 'a call, direct or through a value' },
    makeArray: { defines: true, uses: ['args'], about: 'allocate an array' },
    makeRecord: { defines: true, uses: ['args'], about: 'allocate a record' },
    makeClosure: { defines: true, uses: ['args'], about: 'allocate a closure over its captures' },
    /*
     * A named local is a SLOT, not a register, until SSA construction promotes
     * it. It has to be: `let t = 0; while … { t = t + 1; }` gives `t` a value
     * that depends on which path ran, and a compile-time map from name to
     * register cannot express that — it names the register from the last
     * assignment the lowering happened to walk, which on a loop that never
     * runs was never defined. Promoting slots to registers with phi functions
     * is what 29.4 is for, and this is the memory the SSA property excludes.
     */
    loadLocal: { defines: true, uses: [], about: 'read a named local' },
    storeLocal: { defines: false, uses: ['value'], about: 'write a named local' },
    loadField: { defines: true, uses: ['object'], about: 'read a record field' },
    storeField: { defines: false, uses: ['object', 'value'], about: 'write a record field' },
    loadIndex: { defines: true, uses: ['object', 'index'], about: 'read an array element' },
    storeIndex: { defines: false, uses: ['object', 'index', 'value'], about: 'write an element' },
    phi: { defines: true, uses: ['incoming'], about: 'the value depends on which edge arrived' },
    jump: { defines: false, uses: [], terminator: true, about: 'unconditional' },
    branch: { defines: false, uses: ['cond'], terminator: true, about: 'two-way' },
    ret: { defines: false, uses: ['value'], terminator: true, about: 'leave the function' }
  };

  const BINARY_OPS = ['add', 'sub', 'mul', 'div', 'rem', 'lt', 'le', 'gt', 'ge',
    'eq', 'ne', 'and', 'or'];

  /** Which core-language runtime name each binary opcode came from. */
  const FROM_RUNTIME = {};
  BINARY_OPS.forEach(function (op) { FROM_RUNTIME['$' + op] = op; });

  /* ------------------------------------------------------------ construction */

  function makeFunction(name, params) {
    return { name: name, params: params || [], blocks: [], entry: null,
      nextRegister: 0, nextBlock: 0, nextSlot: 0, types: {}, slots: [] };
  }

  /**
   * A named local. `source` is what the developer called it and `depth` how
   * far inside the function it was declared — a top-level `let` in `main` is a
   * global binding and one inside a loop body is not, and without the depth
   * the two are indistinguishable once the tree is gone.
   */
  function freshSlot(fn, source, depth) {
    const name = '@' + fn.nextSlot;

    fn.nextSlot += 1;
    fn.slots.push({ name: name, source: source, depth: depth || 0 });
    return name;
  }

  function freshRegister(fn, type) {
    const name = '%' + fn.nextRegister;

    fn.nextRegister += 1;
    fn.types[name] = type || 'unknown';
    return name;
  }

  function makeBlock(fn, label) {
    const block = { id: 'b' + fn.nextBlock, label: label || ('b' + fn.nextBlock),
      instructions: [], terminator: null };

    fn.nextBlock += 1;
    fn.blocks.push(block);
    if (!fn.entry) fn.entry = block.id;
    return block;
  }

  function blockById(fn, id) {
    return fn.blocks.find(function (block) { return block.id === id; }) || null;
  }

  /**
   * Every instruction goes through here, so `op` is always a known opcode and
   * a typo is a failure at the pass that made it rather than a silently
   * ignored instruction three passes later.
   */
  function instruction(op, fields) {
    if (!OPCODES[op]) throw new Error('unknown opcode ' + op);
    return Object.assign({ op: op }, fields);
  }

  /**
   * Emitting into a block that already has a terminator is dropped, not
   * appended. A `return` in the middle of a block ends it, and everything the
   * lowering would emit afterwards is unreachable by construction — appending
   * it produces a block with an instruction after its terminator, which is one
   * of the invariants, and the alternative is for every caller to track
   * whether the block is still open.
   */
  function emit(block, op, fields) {
    if (block.terminator) return null;
    const built = instruction(op, fields);

    block.instructions.push(built);
    return built;
  }

  function terminate(block, op, fields) {
    if (block.terminator) return block.terminator;
    block.terminator = instruction(op, fields);
    return block.terminator;
  }

  /* -------------------------------------------------------------- traversal */

  /** Every register an instruction reads, in operand order. */
  function usesOf(inst) {
    const spec = OPCODES[inst.op];
    const out = [];

    if (!spec) return out;
    spec.uses.forEach(function (field) {
      const value = inst[field];

      if (value === undefined || value === null) return;
      if (field === 'incoming') {
        value.forEach(function (entry) { out.push(entry.value); });
        return;
      }
      if (Array.isArray(value)) { value.forEach(function (item) { out.push(item); }); return; }
      out.push(value);
    });
    return out.filter(isRegister);
  }

  function definitionOf(inst) {
    return OPCODES[inst.op] && OPCODES[inst.op].defines ? inst.target : null;
  }

  function isRegister(value) {
    return typeof value === 'string' && value.charAt(0) === '%';
  }

  /** Rewrite every operand through `map`, which is what most passes do. */
  function rewriteUses(inst, map) {
    const spec = OPCODES[inst.op];

    if (!spec) return inst;
    spec.uses.forEach(function (field) {
      const value = inst[field];

      if (value === undefined || value === null) return;
      if (field === 'incoming') {
        inst[field] = value.map(function (entry) {
          return { block: entry.block, value: mapped(map, entry.value) };
        });
        return;
      }
      if (Array.isArray(value)) {
        inst[field] = value.map(function (item) { return mapped(map, item); });
        return;
      }
      inst[field] = mapped(map, value);
    });
    return inst;
  }

  function mapped(map, value) {
    if (!isRegister(value)) return value;
    return Object.prototype.hasOwnProperty.call(map, value) ? map[value] : value;
  }

  function successorsOf(block) {
    const term = block.terminator;

    if (!term) return [];
    if (term.op === 'jump') return [term.target];
    if (term.op === 'branch') return [term.then, term.other];
    return [];
  }

  /** Every instruction of a function in block order, terminators included. */
  function eachInstruction(fn, visit) {
    fn.blocks.forEach(function (block) {
      block.instructions.forEach(function (inst, index) { visit(inst, block, index); });
      if (block.terminator) visit(block.terminator, block, -1);
    });
  }

  function instructionCount(fn) {
    return fn.blocks.reduce(function (sum, block) {
      return sum + block.instructions.length + (block.terminator ? 1 : 0);
    }, 0);
  }

  /* --------------------------------------------------------------- printing */

  function showInstruction(inst) {
    const printer = PRINTERS[inst.op];

    return printer ? printer(inst) : inst.op;
  }

  const PRINTERS = {
    const: function (i) { return i.target + ' = const ' + JSON.stringify(i.value); },
    move: function (i) { return i.target + ' = ' + i.from; },
    unary: function (i) { return i.target + ' = ' + i.operator + ' ' + i.operand; },
    binary: function (i) {
      return i.target + ' = ' + i.operator + ' ' + i.left + ', ' + i.right;
    },
    call: function (i) { return i.target + ' = call ' + i.callee + '(' + i.args.join(', ') + ')'; },
    makeArray: function (i) { return i.target + ' = array [' + i.args.join(', ') + ']'; },
    makeRecord: function (i) {
      return i.target + ' = record { ' + i.fields.map(function (name, at) {
        return name + ': ' + i.args[at];
      }).join(', ') + ' }';
    },
    makeClosure: function (i) {
      return i.target + ' = closure ' + i.func + '[' + i.args.join(', ') + ']';
    },
    loadLocal: function (i) { return i.target + ' = load ' + i.slot; },
    storeLocal: function (i) { return 'store ' + i.slot + ', ' + i.value; },
    loadField: function (i) { return i.target + ' = ' + i.object + '.' + i.field; },
    storeField: function (i) { return i.object + '.' + i.field + ' = ' + i.value; },
    loadIndex: function (i) { return i.target + ' = ' + i.object + '[' + i.index + ']'; },
    storeIndex: function (i) { return i.object + '[' + i.index + '] = ' + i.value; },
    phi: function (i) {
      return i.target + ' = phi ' + i.incoming.map(function (entry) {
        return '[' + entry.block + ': ' + entry.value + ']';
      }).join(' ');
    },
    jump: function (i) { return 'jump ' + i.target; },
    branch: function (i) { return 'branch ' + i.cond + ' ? ' + i.then + ' : ' + i.other; },
    ret: function (i) { return 'ret ' + (i.value === null ? 'unit' : i.value); }
  };

  function showFunction(fn) {
    const head = 'fn ' + fn.name + '(' + fn.params.join(', ') + ')';

    return [head].concat(fn.blocks.map(function (block) {
      return showBlock(block);
    })).join('\n');
  }

  function showBlock(block) {
    return ['  ' + block.id + ':'].concat(
      block.instructions.map(function (inst) { return '    ' + showInstruction(inst); }),
      block.terminator ? ['    ' + showInstruction(block.terminator)] : ['    (no terminator)']
    ).join('\n');
  }

  function showProgram(program) {
    return program.functions.map(showFunction).join('\n\n');
  }

  /* ------------------------------------------------------------- the verifier */

  /**
   * Every invariant is named, because a verifier that says "invalid IR" is a
   * verifier that sends you back to bisecting by hand. `ssa` is a separate
   * flag: the invariants are true before SSA construction as well, except the
   * two that are the definition of SSA form.
   */
  const INVARIANTS = [
    { id: 'terminator', about: 'every block ends in exactly one terminator' },
    { id: 'target', about: 'every jump target names a block in this function' },
    { id: 'defined', about: 'every register read is defined somewhere in the function' },
    { id: 'phi-position', about: 'phi instructions come first in their block' },
    { id: 'phi-edges', about: 'a phi has exactly one entry per predecessor' },
    { id: 'entry', about: 'the entry block has no predecessors' },
    { id: 'reachable', about: 'every block is reachable from the entry' },
    { id: 'slot', about: 'every local read or written is declared on the function' },
    { id: 'single-def', about: 'SSA: every register is defined exactly once' },
    { id: 'dominance', about: 'SSA: every use is dominated by its definition' }
  ];

  function verify(fn, options) {
    const settings = options || {};
    const problems = [];
    const known = new Set(fn.blocks.map(function (block) { return block.id; }));

    checkStructure(fn, known, problems);
    checkRegisters(fn, problems, settings);
    checkPhis(fn, problems);
    checkReachability(fn, problems);
    checkSlots(fn, problems);
    return { ok: problems.length === 0, problems: problems,
      checked: INVARIANTS.length, blocks: fn.blocks.length,
      instructions: instructionCount(fn) };
  }

  function fail(problems, invariant, where, why) {
    problems.push({ invariant: invariant, where: where, why: why });
  }

  function checkStructure(fn, known, problems) {
    fn.blocks.forEach(function (block) {
      if (!block.terminator) fail(problems, 'terminator', block.id, 'no terminator');
      block.instructions.forEach(function (inst) {
        if (OPCODES[inst.op] && OPCODES[inst.op].terminator) {
          fail(problems, 'terminator', block.id, inst.op + ' is a terminator but is not last');
        }
      });
      successorsOf(block).forEach(function (target) {
        if (known.has(target)) return;
        fail(problems, 'target', block.id, 'jumps to ' + target + ', which does not exist');
      });
    });
  }

  function checkRegisters(fn, problems, settings) {
    const defined = new Map();
    const params = new Set(fn.params);

    eachInstruction(fn, function (inst, block) {
      const target = definitionOf(inst);

      if (!target) return;
      if (settings.ssa && defined.has(target)) {
        fail(problems, 'single-def', block.id, target + ' is defined more than once');
      }
      if (!defined.has(target)) defined.set(target, block.id);
    });
    eachInstruction(fn, function (inst, block) {
      usesOf(inst).forEach(function (register) {
        if (defined.has(register) || params.has(register)) return;
        fail(problems, 'defined', block.id, register + ' is read and never defined');
      });
    });
    return defined;
  }

  function checkPhis(fn, problems) {
    const preds = predecessors(fn);

    fn.blocks.forEach(function (block) {
      let seenNonPhi = false;

      block.instructions.forEach(function (inst) {
        if (inst.op !== 'phi') { seenNonPhi = true; return; }
        if (seenNonPhi) {
          fail(problems, 'phi-position', block.id, inst.target + ' is a phi after other work');
        }
        checkPhiEdges(inst, block, preds[block.id] || [], problems);
      });
    });
  }

  function checkPhiEdges(inst, block, incoming, problems) {
    const named = inst.incoming.map(function (entry) { return entry.block; });

    if (named.length !== incoming.length) {
      fail(problems, 'phi-edges', block.id, inst.target + ' has ' + named.length +
        ' entries for ' + incoming.length + ' predecessors');
      return;
    }
    incoming.forEach(function (id) {
      if (named.indexOf(id) !== -1) return;
      fail(problems, 'phi-edges', block.id, inst.target + ' has no entry for ' + id);
    });
  }

  function predecessors(fn) {
    const preds = {};

    fn.blocks.forEach(function (block) { preds[block.id] = []; });
    fn.blocks.forEach(function (block) {
      successorsOf(block).forEach(function (target) {
        if (preds[target] && preds[target].indexOf(block.id) === -1) preds[target].push(block.id);
      });
    });
    return preds;
  }

  function checkReachability(fn, problems) {
    const seen = reachable(fn);

    if (predecessors(fn)[fn.entry] && predecessors(fn)[fn.entry].length) {
      fail(problems, 'entry', fn.entry, 'the entry block has predecessors');
    }
    fn.blocks.forEach(function (block) {
      if (seen.has(block.id)) return;
      fail(problems, 'reachable', block.id, 'is not reachable from the entry');
    });
  }

  function checkSlots(fn, problems) {
    const declared = new Set((fn.slots || []).map(function (slot) { return slot.name; }));

    eachInstruction(fn, function (inst, block) {
      if (inst.op !== 'loadLocal' && inst.op !== 'storeLocal') return;
      if (declared.has(inst.slot)) return;
      fail(problems, 'slot', block.id, inst.slot + ' is not declared on this function');
    });
  }

  function reachable(fn) {
    const seen = new Set();
    const stack = [fn.entry];

    while (stack.length) {
      const id = stack.pop();

      if (!id || seen.has(id)) continue;
      seen.add(id);
      const block = blockById(fn, id);

      if (block) successorsOf(block).forEach(function (next) { stack.push(next); });
    }
    return seen;
  }

  /* ------------------------------------------------------------------ copying */

  /**
   * A deep copy, so a pass can be run on a program without destroying the one
   * before it. Every stage-comparison view in this milestone needs the two to
   * exist at once, which is the same reason M28's rewriting is immutable.
   */
  function cloneFunction(fn) {
    return { name: fn.name, params: fn.params.slice(), entry: fn.entry,
      nextRegister: fn.nextRegister, nextBlock: fn.nextBlock, nextSlot: fn.nextSlot,
      types: Object.assign({}, fn.types),
      slots: (fn.slots || []).map(function (slot) {
        return { name: slot.name, source: slot.source, depth: slot.depth };
      }),
      paramNames: (fn.paramNames || []).slice(),
      blocks: fn.blocks.map(cloneBlock) };
  }

  function cloneBlock(block) {
    return { id: block.id, label: block.label,
      instructions: block.instructions.map(cloneInstruction),
      terminator: block.terminator ? cloneInstruction(block.terminator) : null };
  }

  function cloneInstruction(inst) {
    const copy = Object.assign({}, inst);

    if (inst.args) copy.args = inst.args.slice();
    if (inst.fields) copy.fields = inst.fields.slice();
    if (inst.incoming) {
      copy.incoming = inst.incoming.map(function (entry) {
        return { block: entry.block, value: entry.value };
      });
    }
    return copy;
  }

  function cloneProgram(program) {
    return { functions: program.functions.map(cloneFunction),
      main: program.main, sources: program.sources };
  }

  function verifyProgram(program, options) {
    const results = program.functions.map(function (fn) {
      return Object.assign({ fn: fn.name }, verify(fn, options));
    });

    return { ok: results.every(function (row) { return row.ok; }), functions: results,
      problems: results.reduce(function (all, row) {
        return all.concat(row.problems.map(function (problem) {
          return Object.assign({ fn: row.fn }, problem);
        }));
      }, []),
      instructions: results.reduce(function (sum, row) { return sum + row.instructions; }, 0),
      blocks: results.reduce(function (sum, row) { return sum + row.blocks; }, 0) };
  }

  return {
    OPCODES: OPCODES, BINARY_OPS: BINARY_OPS, FROM_RUNTIME: FROM_RUNTIME,
    INVARIANTS: INVARIANTS,
    makeFunction: makeFunction, freshRegister: freshRegister, freshSlot: freshSlot,
    makeBlock: makeBlock,
    blockById: blockById, instruction: instruction, emit: emit, terminate: terminate,
    usesOf: usesOf, definitionOf: definitionOf, isRegister: isRegister,
    rewriteUses: rewriteUses, successorsOf: successorsOf, predecessors: predecessors,
    eachInstruction: eachInstruction, instructionCount: instructionCount,
    reachable: reachable,
    showInstruction: showInstruction, showBlock: showBlock, showFunction: showFunction,
    showProgram: showProgram,
    verify: verify, verifyProgram: verifyProgram,
    cloneFunction: cloneFunction, cloneBlock: cloneBlock, cloneInstruction: cloneInstruction,
    cloneProgram: cloneProgram
  };
}));
