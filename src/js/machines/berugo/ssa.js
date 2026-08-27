/**
 * SSA construction: promoting slots to registers, which is what a phi IS.
 *
 * The lowering gave every named local a slot, and every read and write of it a
 * load and a store. That is correct and slow, and it hides every def–use
 * relationship behind memory. This pass gives each slot back its registers,
 * and where two different values could reach the same read it inserts a phi —
 * an instruction whose value depends on which edge control arrived by.
 *
 * The phi is not a trick. It is the only way to write down "the value of `t`
 * here is 0 if we came from the entry and the sum if we came round the loop"
 * in a form where every value has exactly one definition. Getting to that form
 * is worth the trouble because nearly every modern optimisation is stated in
 * terms of "the definition of this value", which SSA makes a pointer rather
 * than a search.
 *
 * Placement is Cytron's: a phi for slot S goes at the ITERATED dominance
 * frontier of the blocks that write S. Renaming is a walk of the dominator
 * tree carrying a stack per slot. Both come straight out of `dominators.js`,
 * which is the usual shape — dominance answers the structural questions and
 * the passes consume it.
 *
 * Pruning matters and is cheap: a phi whose value nothing reads is dead, and
 * minimal-without-pruning SSA produces a great many of them in loops. The
 * demo reports both counts because the difference is the whole of "minimal
 * versus pruned".
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Berugo = scope.Berugo || {};
    scope.Berugo.Ssa = api;
  }
}(this, function (root) {
  'use strict';

  const berugo = root && root.Berugo ? root.Berugo : null;
  const Ir = berugo && berugo.Ir ? berugo.Ir : require('./ir.js');
  const Cfg = berugo && berugo.Cfg ? berugo.Cfg : require('./cfg.js');
  const Dominators = berugo && berugo.Dominators
    ? berugo.Dominators : require('./dominators.js');

  /* --------------------------------------------------------- what to promote */

  /**
   * A slot can be promoted when every access to it is a whole load or store.
   * In this IR that is every slot — Berugo has no way to take a reference to a
   * local — and the check is here anyway, because the moment a language grows
   * one, the promotion becomes unsound and this is where it has to stop.
   */
  function promotable(fn) {
    const escaping = new Set();

    Ir.eachInstruction(fn, function (inst) {
      if (inst.op === 'loadLocal' || inst.op === 'storeLocal') return;
      Ir.usesOf(inst).forEach(function () { return null; });
    });
    return (fn.slots || []).filter(function (slot) {
      return !escaping.has(slot.name);
    }).map(function (slot) { return slot.name; });
  }

  function writesOf(fn, slot) {
    const blocks = [];

    fn.blocks.forEach(function (block) {
      const writes = block.instructions.some(function (inst) {
        return inst.op === 'storeLocal' && inst.slot === slot;
      });

      if (writes) blocks.push(block.id);
    });
    return blocks;
  }

  /* -------------------------------------------------------------- placement */

  function placePhis(fn, tree, slots) {
    const placed = [];

    slots.forEach(function (slot) {
      const writes = writesOf(fn, slot);

      if (!writes.length) return;
      Dominators.iteratedFrontier(tree, writes).forEach(function (id) {
        placed.push({ slot: slot, block: id, writes: writes.slice() });
      });
    });
    return placed;
  }

  function insertPhis(fn, graph, placed) {
    const inserted = [];

    placed.forEach(function (entry) {
      const block = Ir.blockById(fn, entry.block);
      const preds = graph.preds[entry.block] || [];

      if (!block || !preds.length) return;
      const target = Ir.freshRegister(fn, 'unknown');
      const phi = Ir.instruction('phi', { target: target, slot: entry.slot,
        incoming: preds.map(function (id) { return { block: id, value: null }; }),
        origin: 'phi' });

      block.instructions.unshift(phi);
      inserted.push({ slot: entry.slot, block: entry.block, target: target });
    });
    return inserted;
  }

  /* --------------------------------------------------------------- renaming */

  /**
   * One stack per slot, pushed on a definition and popped when the walk leaves
   * the block. Because the walk is over the DOMINATOR tree rather than the
   * CFG, the top of the stack at any point is the definition that reaches
   * there — which is the whole reason renaming is a dominator-tree walk.
   */
  function rename(fn, graph, tree, slots) {
    const stacks = {};
    const state = { fn: fn, graph: graph, stacks: stacks, undefined: 0, exits: {} };

    slots.forEach(function (slot) { stacks[slot] = []; });
    renameBlock(fn.entry, state, Dominators.children(tree));
    return state;
  }

  function renameBlock(id, state, kids) {
    const block = Ir.blockById(state.fn, id);
    const pushed = [];

    if (!block) return;
    renameInstructions(block, state, pushed);
    fillSuccessorPhis(id, state);
    recordExit(block, state);
    (kids[id] || []).forEach(function (child) { renameBlock(child, state, kids); });
    pushed.forEach(function (slot) { state.stacks[slot].pop(); });
  }

  /**
   * At every `ret`, which register currently holds each slot.
   *
   * Promotion removes the slots, and with them the only record of what a
   * program's named bindings ended up as — which is the observable the
   * differential comparison is built on. Without this, every program compared
   * equal on its value and empty on its bindings, so the whole suite agreed
   * about nothing the moment SSA ran. The map is per exit block because
   * different paths can leave different values; `main` has one exit, and a
   * function with several would need each.
   */
  function recordExit(block, state) {
    if (!block.terminator || block.terminator.op !== 'ret') return;
    const values = {};

    Object.keys(state.stacks).forEach(function (slot) {
      const stack = state.stacks[slot];

      if (stack.length) values[slot] = stack[stack.length - 1];
    });
    state.exits[block.id] = values;
  }

  function renameInstructions(block, state, pushed) {
    const kept = [];

    block.instructions.forEach(function (inst) {
      if (inst.op === 'phi' && inst.slot) {
        state.stacks[inst.slot].push(inst.target);
        pushed.push(inst.slot);
        kept.push(inst);
        return;
      }
      if (inst.op === 'loadLocal') { rewriteLoad(inst, state, block, kept); return; }
      if (inst.op === 'storeLocal') {
        state.stacks[inst.slot].push(inst.value);
        pushed.push(inst.slot);
        return;
      }
      kept.push(inst);
    });
    block.instructions = kept;
  }

  /**
   * A load becomes a copy of whatever is on the stack. A load with an empty
   * stack is a read of a slot no path has written — the checker rejects those
   * programs, so it can only come from a lowering bug, and it becomes an
   * explicit undefined constant rather than a silent hole.
   */
  function rewriteLoad(inst, state, block, kept) {
    const stack = state.stacks[inst.slot] || [];

    if (!stack.length) {
      state.undefined += 1;
      kept.push(Ir.instruction('const', { target: inst.target, value: null,
        span: inst.span, origin: 'undefined-slot' }));
      return;
    }
    kept.push(Ir.instruction('move', { target: inst.target, from: stack[stack.length - 1],
      span: inst.span, origin: inst.origin }));
  }

  function fillSuccessorPhis(id, state) {
    const block = Ir.blockById(state.fn, id);

    Ir.successorsOf(block).forEach(function (target) {
      const next = Ir.blockById(state.fn, target);

      if (!next) return;
      next.instructions.forEach(function (inst) {
        if (inst.op !== 'phi' || !inst.slot) return;
        fillPhiEntry(inst, id, state);
      });
    });
  }

  function fillPhiEntry(inst, from, state) {
    const stack = state.stacks[inst.slot] || [];
    const entry = inst.incoming.find(function (row) { return row.block === from; });

    if (!entry) return;
    if (!stack.length) { entry.value = null; return; }
    entry.value = stack[stack.length - 1];
  }

  /* ---------------------------------------------------------------- pruning */

  /**
   * A phi nothing reads is dead, and removing one can make another dead —
   * which is why this is a fixpoint rather than a single sweep. The count
   * before and after is the difference between minimal and pruned SSA, and on
   * a loop it is most of them.
   */
  function prune(fn) {
    let removed = 0;
    let changed = true;

    while (changed) {
      changed = false;
      const used = usedRegisters(fn);

      fn.blocks.forEach(function (block) {
        const before = block.instructions.length;

        block.instructions = block.instructions.filter(function (inst) {
          return inst.op !== 'phi' || used.has(inst.target);
        });
        removed += before - block.instructions.length;
        if (before !== block.instructions.length) changed = true;
      });
    }
    return removed;
  }

  function usedRegisters(fn) {
    const used = new Set();

    Ir.eachInstruction(fn, function (inst) {
      Ir.usesOf(inst).forEach(function (register) { used.add(register); });
    });
    return used;
  }

  /* ------------------------------------------------------------- the entry */

  function construct(fn, options) {
    const settings = options || {};

    Cfg.removeUnreachable(fn);
    const graph = Cfg.build(fn);
    const tree = Dominators.compute(graph);
    const slots = promotable(fn);
    const placed = placePhis(fn, tree, slots);
    const inserted = insertPhis(fn, graph, placed);
    const renamed = rename(fn, graph, tree, slots);
    const pruned = settings.prune === false ? 0 : prune(fn);

    /* The slot TABLE is kept — it is the only record of which source name
       each promoted slot came from — while the slots themselves are gone from
       the instructions. `exitSlots` says which register holds each one where
       the function returns. */
    fn.promotedSlots = fn.slots;
    fn.slots = [];
    fn.exitSlots = renamed.exits;
    fn.ssa = true;
    return { slots: slots.length, placed: placed.length, inserted: inserted.length,
      pruned: pruned, phis: inserted.length - pruned,
      undefinedReads: renamed.undefined, rounds: tree.rounds };
  }

  function constructProgram(program, options) {
    const rows = program.functions.map(function (fn) {
      return Object.assign({ fn: fn.name }, construct(fn, options));
    });

    return { functions: rows,
      placed: rows.reduce(function (sum, row) { return sum + row.placed; }, 0),
      pruned: rows.reduce(function (sum, row) { return sum + row.pruned; }, 0),
      phis: rows.reduce(function (sum, row) { return sum + row.phis; }, 0) };
  }

  /* ------------------------------------------------------------ destruction */

  /**
   * Leaving SSA means putting the copies back. A phi entry becomes a move in
   * the predecessor that supplies it — which is only safe if that predecessor
   * has one successor, and is why critical edges must be split first.
   *
   * The swap problem is the reason the copies are collected per block and then
   * sequentialised: two phis that exchange values (`a = phi(b), b = phi(a)`)
   * become two moves that, done in order, both end up with the same value. A
   * temporary breaks the cycle, and the count of temporaries introduced is
   * reported because on ordinary code it is zero and on a swap it is not.
   */
  function destruct(fn) {
    Cfg.splitCriticalEdges(fn);
    const state = { moves: 0, temporaries: 0 };

    fn.blocks.forEach(function (block) { collectPhiCopies(fn, block, state); });
    fn.blocks.forEach(function (block) {
      block.instructions = block.instructions.filter(function (inst) {
        return inst.op !== 'phi';
      });
    });
    fn.ssa = false;
    return state;
  }

  function collectPhiCopies(fn, block, state) {
    const phis = block.instructions.filter(function (inst) { return inst.op === 'phi'; });

    if (!phis.length) return;
    const byPredecessor = new Map();

    phis.forEach(function (phi) {
      phi.incoming.forEach(function (entry) {
        if (!byPredecessor.has(entry.block)) byPredecessor.set(entry.block, []);
        byPredecessor.get(entry.block).push({ to: phi.target, from: entry.value });
      });
    });
    byPredecessor.forEach(function (pairs, id) { emitCopies(fn, id, pairs, state); });
  }

  function emitCopies(fn, id, pairs, state) {
    const source = Ir.blockById(fn, id);

    if (!source) return;
    sequentialise(pairs, fn, state).forEach(function (pair) {
      source.instructions.push(Ir.instruction('move',
        { target: pair.to, from: pair.from, origin: 'phi-copy' }));
      state.moves += 1;
    });
  }

  /**
   * Order the copies so no copy overwrites a value another still needs. Any
   * pair whose destination is nobody's source can go first; when none can, the
   * rest form a cycle and one of them is broken with a temporary.
   */
  function sequentialise(pairs, fn, state) {
    const pending = pairs.filter(function (pair) { return pair.to !== pair.from; });
    const ordered = [];

    while (pending.length) {
      const at = pending.findIndex(function (pair) {
        return !pending.some(function (other) { return other.from === pair.to; });
      });

      if (at !== -1) { ordered.push(pending.splice(at, 1)[0]); continue; }
      breakCycle(pending, ordered, fn, state);
    }
    return ordered;
  }

  /**
   * The value that has to be saved is the one the chosen copy is about to
   * DESTROY — its destination, not its source. Saving the source and
   * redirecting everybody who reads the source leaves the cycle intact and
   * both registers holding the same value, which is the very failure the
   * temporary exists to prevent: `a = b; b = a` becomes `t = b; a = t; b = a`,
   * so `b` ends up as `b` rather than as `a`. Saving the destination gives
   * `t = a; a = b; b = t`, which is the swap.
   */
  function breakCycle(pending, ordered, fn, state) {
    const pair = pending[0];
    const temporary = Ir.freshRegister(fn, fn.types[pair.to] || 'unknown');

    ordered.push({ to: temporary, from: pair.to });
    pending.forEach(function (other) {
      if (other.from === pair.to) other.from = temporary;
    });
    state.temporaries += 1;
    ordered.push(pending.shift());
  }

  /* -------------------------------------------------------------- checking */

  /**
   * The SSA property, checked rather than assumed: every register defined once,
   * and every use dominated by its definition. A phi's operands are the
   * exception — they are used on the EDGE, so the definition must dominate the
   * predecessor rather than the phi's own block, and forgetting that produces a
   * verifier that rejects correct SSA.
   */
  function check(fn) {
    const graph = Cfg.build(fn);
    const tree = Dominators.compute(graph);
    const where = definitionBlocks(fn);
    const problems = [];

    Ir.eachInstruction(fn, function (inst, block) {
      if (inst.op === 'phi') { checkPhiOperands(inst, block, tree, where, problems); return; }
      Ir.usesOf(inst).forEach(function (register) {
        const at = where.get(register);

        if (at === undefined) return;
        if (Dominators.dominates(tree, at, block.id)) return;
        problems.push({ invariant: 'dominance', where: block.id,
          why: register + ' is used here and defined in ' + at + ', which does not dominate it' });
      });
    });
    return { ok: problems.length === 0, problems: problems, checked: where.size };
  }

  function definitionBlocks(fn) {
    const where = new Map();

    Ir.eachInstruction(fn, function (inst, block) {
      const target = Ir.definitionOf(inst);

      if (target) where.set(target, block.id);
    });
    fn.params.forEach(function (register) { where.set(register, fn.entry); });
    return where;
  }

  function checkPhiOperands(inst, block, tree, where, problems) {
    inst.incoming.forEach(function (entry) {
      const at = where.get(entry.value);

      if (at === undefined || Dominators.dominates(tree, at, entry.block)) return;
      problems.push({ invariant: 'dominance', where: block.id,
        why: entry.value + ' reaches a phi on the edge from ' + entry.block +
          ' but is defined in ' + at });
    });
  }

  return {
    promotable: promotable, writesOf: writesOf, placePhis: placePhis,
    construct: construct, constructProgram: constructProgram,
    destruct: destruct, sequentialise: sequentialise,
    prune: prune, check: check
  };
}));
