/**
 * The scalar passes, and the thing they have in common: each is stated in
 * terms of "the definition of this value", which SSA made a pointer.
 *
 * Copy propagation, dead-code elimination and value numbering are a few dozen
 * lines each in SSA form and would each need a dataflow analysis without it.
 * That is the return on 29.4 and the reason the form is worth the trouble.
 *
 * SCCP is the one that is more than the sum of its parts. Constant
 * propagation alone cannot fold a value guarded by a condition it could prove
 * false, because it does not know the branch is dead; unreachable-code
 * elimination alone cannot prove the branch dead, because it does not know the
 * condition is constant. Running them to a joint fixpoint proves both, and the
 * demo shows a program where the separate passes get nothing and the combined
 * one folds it away.
 *
 * Every pass here returns a report rather than mutating silently: what it
 * changed, and how many. A pass that reports zero on a program it should have
 * changed is a bug, and one that reports a number nobody checks is a pass
 * nobody can tell is working.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Berugo = scope.Berugo || {};
    scope.Berugo.PassesScalar = api;
  }
}(this, function (root) {
  'use strict';

  const berugo = root && root.Berugo ? root.Berugo : null;
  const Ir = berugo && berugo.Ir ? berugo.Ir : require('./ir.js');
  const Cfg = berugo && berugo.Cfg ? berugo.Cfg : require('./cfg.js');
  const Interp = berugo && berugo.Interp ? berugo.Interp : require('./interp.js');

  /* ------------------------------------------------------ copy propagation */

  /**
   * A `move` makes two registers the same value, so every later read of the
   * target can read the source instead. SSA renaming leaves a great many of
   * them — every load of a promoted slot became one — so this is the pass that
   * makes the SSA output readable as well as the one that helps everything
   * after it.
   */
  function copyPropagation(fn) {
    const map = {};
    let resolved = 0;

    Ir.eachInstruction(fn, function (inst) {
      if (inst.op !== 'move') return;
      map[inst.target] = follow(map, inst.from);
    });
    Ir.eachInstruction(fn, function (inst) {
      const before = Ir.usesOf(inst).join(',');

      Ir.rewriteUses(inst, map);
      if (Ir.usesOf(inst).join(',') !== before) resolved += 1;
    });
    rewriteResults(fn, map);
    return { pass: 'copy-propagation', changed: resolved,
      copies: Object.keys(map).length };
  }

  /**
   * The exit map names registers too, and it is not an instruction so no walk
   * reaches it. Leaving it behind keeps a redundant move alive as a root
   * forever — the pass is correct either way, and the program stops shrinking.
   */
  function rewriteResults(fn, map) {
    Object.keys(fn.exitSlots || {}).forEach(function (block) {
      const values = fn.exitSlots[block];

      Object.keys(values).forEach(function (slot) {
        if (map[values[slot]] === undefined) return;
        values[slot] = follow(map, values[slot]);
      });
    });
  }

  function follow(map, register) {
    let here = register;
    let guard = 0;

    while (map[here] !== undefined && guard < 1000) { here = map[here]; guard += 1; }
    return here;
  }

  /* ------------------------------------------------------- dead code */

  /**
   * Mark and sweep over uses, not a liveness analysis. Start from the
   * instructions that must run — terminators, stores, calls — and keep
   * everything they transitively read. Anything unmarked computes a value
   * nobody reads.
   *
   * A call is kept whatever its result, because this IR has no purity
   * information and `print` is a call. That is a real precision loss and the
   * honest one: without an effect analysis, removing a call is removing an
   * effect you cannot see.
   */
  function deadCode(fn) {
    const live = new Set();
    const byTarget = definitionMap(fn);
    const stack = [];

    seedRoots(fn, live, stack);
    while (stack.length) {
      const inst = stack.pop();

      Ir.usesOf(inst).forEach(function (register) {
        const definition = byTarget.get(register);

        if (!definition || live.has(definition)) return;
        live.add(definition);
        stack.push(definition);
      });
    }
    return sweep(fn, live);
  }

  function definitionMap(fn) {
    const map = new Map();

    Ir.eachInstruction(fn, function (inst) {
      const target = Ir.definitionOf(inst);

      if (target) map.set(target, inst);
    });
    return map;
  }

  const EFFECTFUL = ['storeLocal', 'storeField', 'storeIndex', 'call'];

  /**
   * The roots are the instructions that must run whatever else is removed:
   * terminators, stores, calls — and the definitions of any register the
   * function's RESULTS name.
   *
   * That last clause is not a special case, it is the boundary. A program's
   * observable bindings are values that outlive the function, and nothing
   * inside the function reads them, so without it dead-code elimination
   * correctly proves them dead and deletes the whole program. Every real
   * compiler has the same rule under a different name — the return value and
   * anything that escapes are live by definition.
   */
  function seedRoots(fn, live, stack) {
    const results = resultRegisters(fn);
    const byTarget = definitionMap(fn);

    Ir.eachInstruction(fn, function (inst) {
      if (EFFECTFUL.indexOf(inst.op) === -1 && !isTerminator(inst)) return;
      live.add(inst);
      stack.push(inst);
    });
    results.forEach(function (register) {
      const definition = byTarget.get(register);

      if (!definition || live.has(definition)) return;
      live.add(definition);
      stack.push(definition);
    });
  }

  function resultRegisters(fn) {
    const found = new Set();

    Object.keys(fn.exitSlots || {}).forEach(function (block) {
      Object.keys(fn.exitSlots[block]).forEach(function (slot) {
        found.add(fn.exitSlots[block][slot]);
      });
    });
    return Array.from(found);
  }

  function isTerminator(inst) {
    return Boolean(Ir.OPCODES[inst.op] && Ir.OPCODES[inst.op].terminator);
  }

  function sweep(fn, live) {
    let removed = 0;

    fn.blocks.forEach(function (block) {
      const before = block.instructions.length;

      block.instructions = block.instructions.filter(function (inst) {
        return live.has(inst);
      });
      removed += before - block.instructions.length;
    });
    return { pass: 'dead-code', changed: removed, kept: live.size };
  }

  /* ----------------------------------------------- value numbering and CSE */

  /**
   * Global value numbering over the dominator tree: two instructions computing
   * the same operation on the same registers compute the same value, so the
   * second is replaced by the first — but only where the first DOMINATES the
   * second, or the replacement reads a register that may not have been
   * defined on this path.
   *
   * Commutative operations are keyed with their operands sorted, which is what
   * makes `add %1, %2` and `add %2, %1` one value rather than two.
   */
  const COMMUTATIVE = ['add', 'mul', 'eq', 'ne', 'and', 'or'];

  function valueNumbering(fn) {
    const Dominators = require0('./dominators.js');
    const graph = Cfg.build(fn);
    const tree = Dominators.compute(graph);
    const state = { map: {}, replaced: 0, numbers: 0 };

    walkDominatorTree(fn, tree, state, Dominators);
    if (state.replaced) { applyMap(fn, state.map); rewriteResults(fn, state.map); }
    return { pass: 'value-numbering', changed: state.replaced, values: state.numbers };
  }

  function require0(name) {
    const berugoScope = root && root.Berugo ? root.Berugo : null;

    if (berugoScope && berugoScope.Dominators) return berugoScope.Dominators;
    return require(name);
  }

  function walkDominatorTree(fn, tree, state, Dominators) {
    const kids = Dominators.children(tree);

    const go = function (id, table) {
      const block = Ir.blockById(fn, id);
      const inner = Object.assign({}, table);

      if (block) numberBlock(block, inner, state);
      (kids[id] || []).forEach(function (child) { go(child, inner); });
    };

    go(tree.entry, {});
  }

  function numberBlock(block, table, state) {
    block.instructions.forEach(function (inst) {
      const key = valueKey(inst);

      if (!key) return;
      if (table[key] !== undefined) {
        state.map[inst.target] = table[key];
        state.replaced += 1;
        return;
      }
      table[key] = inst.target;
      state.numbers += 1;
    });
  }

  function valueKey(inst) {
    if (inst.op === 'binary') return binaryKey(inst);
    if (inst.op === 'unary') return 'u:' + inst.operator + ':' + inst.operand;
    if (inst.op === 'const') return 'c:' + JSON.stringify(inst.value);
    return null;
  }

  function binaryKey(inst) {
    const operands = COMMUTATIVE.indexOf(inst.operator) === -1
      ? [inst.left, inst.right] : [inst.left, inst.right].slice().sort();

    return 'b:' + inst.operator + ':' + operands.join(':');
  }

  function applyMap(fn, map) {
    Ir.eachInstruction(fn, function (inst) { Ir.rewriteUses(inst, map); });
  }

  /* --------------------------------------------------------------- SCCP */

  /**
   * Sparse conditional constant propagation. Two lattices at once: a value per
   * register (top, a constant, or bottom) and a reachability flag per block.
   * They feed each other — a constant condition proves an edge unreachable,
   * and an unreachable edge stops its values reaching a phi — which is why the
   * combination folds programs neither half can.
   */
  const TOP = { lattice: 'top' };
  const BOTTOM = { lattice: 'bottom' };

  function sccp(fn) {
    const graph = Cfg.build(fn);
    const state = makeSccpState(graph);

    state.reachable.add(graph.entry);
    state.blockList.push(graph.entry);
    driveSccp(fn, graph, state);
    return rewriteFromSccp(fn, graph, state);
  }

  function makeSccpState(graph) {
    return { values: {}, reachable: new Set(), executed: new Set(),
      blockList: [], graph: graph, rounds: 0 };
  }

  function driveSccp(fn, graph, state) {
    while (state.blockList.length) {
      const id = state.blockList.shift();

      state.rounds += 1;
      if (state.rounds > 20000) break;
      visitBlock(fn, graph, state, id);
    }
  }

  function visitBlock(fn, graph, state, id) {
    const block = Ir.blockById(fn, id);

    if (!block) return;
    block.instructions.forEach(function (inst) { evaluate(inst, state); });
    edgesFrom(block, state).forEach(function (target) {
      if (state.reachable.has(target)) { revisit(state, target); return; }
      state.reachable.add(target);
      state.blockList.push(target);
    });
  }

  function revisit(state, target) {
    if (state.blockList.indexOf(target) === -1) state.blockList.push(target);
  }

  function edgesFrom(block, state) {
    const term = block.terminator;

    if (!term) return [];
    if (term.op === 'jump') return [term.target];
    if (term.op !== 'branch') return [];
    const cond = valueOf(state, term.cond);

    if (cond === TOP) return [];
    if (cond === BOTTOM) return [term.then, term.other];
    return [cond.value ? term.then : term.other];
  }

  function valueOf(state, register) {
    if (!Ir.isRegister(register)) return BOTTOM;
    return state.values[register] === undefined ? TOP : state.values[register];
  }

  function setValue(state, register, next) {
    const before = valueOf(state, register);

    if (before === BOTTOM || sameLattice(before, next)) return false;
    state.values[register] = next;
    return true;
  }

  function sameLattice(a, b) {
    if (a === b) return true;
    if (a === TOP || b === TOP || a === BOTTOM || b === BOTTOM) return false;
    return a.value === b.value;
  }

  const EVALUATORS = {
    const: function (inst) {
      return typeof inst.value === 'string' && inst.value.charAt(0) === '!'
        ? BOTTOM : { value: inst.value };
    },
    move: function (inst, state) { return valueOf(state, inst.from); },
    binary: evaluateBinary,
    unary: evaluateUnary,
    phi: evaluatePhi
  };

  function evaluate(inst, state) {
    const target = Ir.definitionOf(inst);
    const rule = EVALUATORS[inst.op];

    if (!target) return false;
    return setValue(state, target, rule ? rule(inst, state) : BOTTOM);
  }

  function evaluateBinary(inst, state) {
    const left = valueOf(state, inst.left);
    const right = valueOf(state, inst.right);

    if (left === TOP || right === TOP) return TOP;
    if (left === BOTTOM || right === BOTTOM) return BOTTOM;
    return foldBinary(inst.operator, left.value, right.value);
  }

  /**
   * A fold that could fault must not be folded. Dividing by zero at compile
   * time either crashes the compiler or silently produces an infinity, and
   * both are wrong: the program is entitled to fault at run time, and the
   * optimiser is not entitled to decide it does not.
   */
  function foldBinary(operator, left, right) {
    const fn = Interp.ARITHMETIC[operator];

    if (!fn) return BOTTOM;
    if ((operator === 'div' || operator === 'rem') && right === 0) return BOTTOM;
    if (typeof left === 'object' || typeof right === 'object') return BOTTOM;
    try {
      return { value: fn(left, right) };
    } catch (error) {
      return BOTTOM;
    }
  }

  function evaluateUnary(inst, state) {
    const operand = valueOf(state, inst.operand);

    if (operand === TOP || operand === BOTTOM) return operand;
    if (inst.operator === '-' && typeof operand.value === 'number') {
      return { value: -operand.value };
    }
    if (inst.operator === '!' && typeof operand.value === 'boolean') {
      return { value: !operand.value };
    }
    return BOTTOM;
  }

  /**
   * A phi meets only the operands arriving on REACHABLE edges. That is the
   * whole of the combination: an operand on an edge SCCP has proved dead does
   * not force the phi to bottom, so a loop variable that is constant on every
   * live path stays constant.
   */
  function evaluatePhi(inst, state) {
    let result = TOP;

    inst.incoming.forEach(function (entry) {
      if (!state.reachable.has(entry.block)) return;
      const value = valueOf(state, entry.value);

      if (value === TOP) return;
      if (result === TOP) { result = value; return; }
      if (!sameLattice(result, value)) result = BOTTOM;
    });
    return result;
  }

  function rewriteFromSccp(fn, graph, state) {
    const folded = foldConstants(fn, state);
    const straightened = straightenBranches(fn, state);
    const removed = Cfg.removeUnreachable(fn);

    return { pass: 'sccp', changed: folded + straightened + removed.removed,
      folded: folded, branches: straightened, blocks: removed.removed,
      unreachable: graph.blocks.length - state.reachable.size };
  }

  function foldConstants(fn, state) {
    let folded = 0;

    fn.blocks.forEach(function (block) {
      if (!state.reachable.has(block.id)) return;
      block.instructions = block.instructions.map(function (inst) {
        const target = Ir.definitionOf(inst);
        const value = target ? valueOf(state, target) : BOTTOM;

        if (inst.op === 'const' || value === TOP || value === BOTTOM) return inst;
        folded += 1;
        return Ir.instruction('const', { target: target, value: value.value,
          span: inst.span, origin: 'sccp' });
      });
    });
    return folded;
  }

  function straightenBranches(fn, state) {
    let changed = 0;

    fn.blocks.forEach(function (block) {
      const term = block.terminator;

      if (!term || term.op !== 'branch' || !state.reachable.has(block.id)) return;
      const cond = valueOf(state, term.cond);

      if (cond === TOP || cond === BOTTOM) return;
      const taken = cond.value ? term.then : term.other;

      dropPhiEdge(fn, cond.value ? term.other : term.then, block.id);
      block.terminator = Ir.instruction('jump', { target: taken, origin: 'sccp' });
      changed += 1;
    });
    return changed;
  }

  /** The edge is gone, so the phi entry that named it must go too. */
  function dropPhiEdge(fn, target, from) {
    const block = Ir.blockById(fn, target);

    if (!block) return;
    block.instructions.forEach(function (inst) {
      if (inst.op !== 'phi') return;
      inst.incoming = inst.incoming.filter(function (entry) { return entry.block !== from; });
    });
  }

  /* ------------------------------------------------------------- peephole */

  /**
   * Algebraic identities, applied locally. Each rule is a pair — a pattern and
   * what it becomes — and each is only sound because the IR is typed: `x * 0`
   * is `0` for a number and is not for a string, and without the type the rule
   * would have to be dropped.
   */
  const RULES = [
    { id: 'add-zero', about: 'x + 0 becomes x', apply: identityRule('add', 0, 'left') },
    { id: 'mul-one', about: 'x * 1 becomes x', apply: identityRule('mul', 1, 'left') },
    { id: 'mul-zero', about: 'x * 0 becomes 0', apply: absorbRule('mul', 0) },
    { id: 'sub-self', about: 'x - x becomes 0', apply: selfRule('sub', 0) },
    { id: 'eq-self', about: 'x == x becomes true', apply: selfRule('eq', true) }
  ];

  function identityRule(operator, unit, keep) {
    return function (inst, constants) {
      if (inst.op !== 'binary' || inst.operator !== operator) return null;
      if (constants[inst.right] === unit) return { move: inst.left };
      if (constants[inst.left] === unit && keep === 'left') return { move: inst.right };
      return null;
    };
  }

  function absorbRule(operator, zero) {
    return function (inst, constants) {
      if (inst.op !== 'binary' || inst.operator !== operator) return null;
      if (constants[inst.left] === zero || constants[inst.right] === zero) {
        return { constant: zero };
      }
      return null;
    };
  }

  function selfRule(operator, result) {
    return function (inst) {
      if (inst.op !== 'binary' || inst.operator !== operator) return null;
      return inst.left === inst.right ? { constant: result } : null;
    };
  }

  function peephole(fn) {
    const constants = constantMap(fn);
    const counts = {};
    let changed = 0;

    fn.blocks.forEach(function (block) {
      block.instructions = block.instructions.map(function (inst) {
        const hit = firstRule(inst, constants);

        if (!hit) return inst;
        counts[hit.rule] = (counts[hit.rule] || 0) + 1;
        changed += 1;
        return rewritten(inst, hit.result);
      });
    });
    return { pass: 'peephole', changed: changed, rules: counts };
  }

  function firstRule(inst, constants) {
    for (let i = 0; i < RULES.length; i += 1) {
      const result = RULES[i].apply(inst, constants);

      if (result) return { rule: RULES[i].id, result: result };
    }
    return null;
  }

  function rewritten(inst, result) {
    if (result.move !== undefined) {
      return Ir.instruction('move', { target: inst.target, from: result.move,
        span: inst.span, origin: 'peephole' });
    }
    return Ir.instruction('const', { target: inst.target, value: result.constant,
      span: inst.span, origin: 'peephole' });
  }

  function constantMap(fn) {
    const map = {};

    Ir.eachInstruction(fn, function (inst) {
      if (inst.op !== 'const') return;
      map[inst.target] = inst.value;
    });
    return map;
  }

  /* --------------------------------------------------------------- the set */

  const PASSES = {
    'copy-propagation': { run: copyPropagation, about: 'a move makes two registers one value' },
    'dead-code': { run: deadCode, about: 'mark from the effects, sweep the rest' },
    'value-numbering': { run: valueNumbering, about: 'one value, computed once' },
    sccp: { run: sccp, about: 'constants and reachability, to a joint fixpoint' },
    peephole: { run: peephole, about: 'algebraic identities, applied locally' }
  };

  function run(fn, name) {
    const pass = PASSES[name];

    if (!pass) throw new Error('no pass named ' + name);
    return pass.run(fn);
  }

  return {
    PASSES: PASSES, RULES: RULES, COMMUTATIVE: COMMUTATIVE, TOP: TOP, BOTTOM: BOTTOM,
    run: run,
    copyPropagation: copyPropagation, deadCode: deadCode, valueNumbering: valueNumbering,
    sccp: sccp, peephole: peephole, valueKey: valueKey, foldBinary: foldBinary
  };
}));
