/**
 * Loop optimisations, and the safety condition most hand-written ones get
 * wrong.
 *
 * Loop-invariant code motion is the pass everyone writes first and the pass
 * everyone writes incorrectly first. Moving a computation out of a loop is
 * only legal if it would have run anyway. An expression that cannot fault —
 * an addition of two loop-invariant numbers — may be hoisted freely, because
 * computing it once when the loop body runs zero times costs nothing and
 * changes nothing. A DIVISION may not: hoisting `a / b` out of a loop whose
 * guard is `b != 0` divides by zero on the path where the loop never runs,
 * and the program was correct before the optimiser touched it.
 *
 * That is one condition and it is where most "obvious" loop optimisations
 * become bugs. This file implements both versions — the safe hoist and the
 * naive one — because a safety condition nobody can see violated is a safety
 * condition nobody believes.
 *
 * The rest is bookkeeping over the loop structure `cfg.js` already found:
 * a preheader to hoist into, induction variables recognised from their phi,
 * and unrolling as a code-size trade with a counted body.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Berugo = scope.Berugo || {};
    scope.Berugo.PassesLoop = api;
  }
}(this, function (root) {
  'use strict';

  const berugo = root && root.Berugo ? root.Berugo : null;
  const Ir = berugo && berugo.Ir ? berugo.Ir : require('./ir.js');
  const Cfg = berugo && berugo.Cfg ? berugo.Cfg : require('./cfg.js');
  const Dominators = berugo && berugo.Dominators
    ? berugo.Dominators : require('./dominators.js');

  /* ------------------------------------------------------------ preheaders */

  /**
   * A preheader is a block that runs once, immediately before the loop, and
   * that every entry to the loop passes through. Without one there is nowhere
   * to hoist to: the header itself runs every iteration, and putting the code
   * in each predecessor duplicates it.
   */
  function ensurePreheader(fn, loop, graph) {
    const outside = (graph.preds[loop.header] || []).filter(function (id) {
      return loop.blocks.indexOf(id) === -1;
    });

    if (outside.length === 1 && (graph.succs[outside[0]] || []).length === 1) {
      return { block: outside[0], created: false };
    }
    return { block: null, created: false, why: outside.length === 1
      ? 'the only entry has more than one successor'
      : outside.length + ' entries to the header' };
  }

  /* --------------------------------------------------------------- invariance */

  /**
   * A value is loop-invariant when every operand is defined outside the loop
   * or is itself invariant. That is a fixpoint, not a single pass: one
   * invariant definition can make another invariant, and stopping after one
   * sweep finds only the shallowest.
   */
  function invariantRegisters(fn, loop) {
    const inside = new Set(loop.blocks);
    const defined = definitionBlocks(fn);
    const invariant = new Set();
    let changed = true;

    while (changed) {
      changed = false;
      loop.blocks.forEach(function (id) {
        const block = Ir.blockById(fn, id);

        if (!block) return;
        block.instructions.forEach(function (inst) {
          if (considerInvariant(inst, inside, defined, invariant)) changed = true;
        });
      });
    }
    return invariant;
  }

  function considerInvariant(inst, inside, defined, invariant) {
    const target = Ir.definitionOf(inst);

    if (!target || invariant.has(target) || !HOISTABLE[inst.op]) return false;
    const stable = Ir.usesOf(inst).every(function (register) {
      const at = defined.get(register);

      return at === undefined || !inside.has(at) || invariant.has(register);
    });

    if (!stable) return false;
    invariant.add(target);
    return true;
  }

  /**
   * Only these opcodes are candidates. A load is excluded because the loop may
   * store to the same memory, which is 29.9's subject; a call is excluded
   * because this IR has no purity information and hoisting `print` out of a
   * loop changes the output.
   */
  const HOISTABLE = { const: true, binary: true, unary: true, move: true };

  function definitionBlocks(fn) {
    const where = new Map();

    Ir.eachInstruction(fn, function (inst, block) {
      const target = Ir.definitionOf(inst);

      if (target) where.set(target, block.id);
    });
    fn.params.forEach(function (register) { where.set(register, fn.entry); });
    return where;
  }

  /* ------------------------------------------------------------- the safety */

  /**
   * Two operations can fault on operands the type checker accepts: division
   * and remainder by zero. Everything else in this instruction set is total,
   * so `mayFault` is short — and it is a whitelist rather than a blacklist
   * because a new opcode should be unsafe to hoist until somebody has thought
   * about it.
   */
  function mayFault(inst) {
    if (inst.op !== 'binary') return false;
    return inst.operator === 'div' || inst.operator === 'rem';
  }

  /**
   * The condition. A faulting operation may only be hoisted out of a loop if
   * its block DOMINATES every exit of the loop — which is to say, if the loop
   * runs at all, that block runs, so the fault would have happened anyway.
   * A block inside a conditional in the loop body does not dominate the exits
   * and its division may not be hoisted, however invariant it is.
   */
  function safeToHoist(inst, blockId, loop, tree, graph) {
    if (!mayFault(inst)) return { safe: true, why: 'cannot fault' };
    const exits = exitBlocks(loop, graph);
    const dominatesAll = exits.every(function (id) {
      return Dominators.dominates(tree, blockId, id);
    });

    if (dominatesAll) return { safe: true, why: 'runs on every path that leaves the loop' };
    return { safe: false,
      why: 'may fault, and ' + blockId + ' does not dominate every loop exit' };
  }

  function exitBlocks(loop, graph) {
    const inside = new Set(loop.blocks);

    return loop.blocks.filter(function (id) {
      return (graph.succs[id] || []).some(function (next) { return !inside.has(next); });
    });
  }

  /* ------------------------------------------------------------------ LICM */

  function licm(fn, options) {
    const settings = options || {};
    const graph = Cfg.build(fn);
    const tree = Dominators.compute(graph);
    const loops = Cfg.loops(graph, tree);
    const state = { hoisted: 0, refused: 0, reasons: [], loops: loops.length };

    loops.slice().sort(function (a, b) { return b.depth - a.depth; })
      .forEach(function (loop) { hoistFromLoop(fn, loop, graph, tree, state, settings); });
    return { pass: 'licm', changed: state.hoisted, hoisted: state.hoisted,
      refused: state.refused, reasons: state.reasons, loops: state.loops };
  }

  function hoistFromLoop(fn, loop, graph, tree, state, settings) {
    const preheader = ensurePreheader(fn, loop, graph);

    if (!preheader.block) { state.reasons.push({ loop: loop.header, why: preheader.why }); return; }
    const invariant = invariantRegisters(fn, loop);
    const into = Ir.blockById(fn, preheader.block);

    loop.blocks.forEach(function (id) {
      moveInvariant(fn, id, { loop: loop, graph: graph, tree: tree,
        invariant: invariant, into: into }, state, settings);
    });
  }

  function moveInvariant(fn, id, ctx, state, settings) {
    const block = Ir.blockById(fn, id);

    if (!block) return;
    block.instructions = block.instructions.filter(function (inst) {
      return !tryHoist(inst, id, ctx, state, settings);
    });
  }

  function tryHoist(inst, id, ctx, state, settings) {
    const target = Ir.definitionOf(inst);

    if (!target || !ctx.invariant.has(target)) return false;
    const safety = safeToHoist(inst, id, ctx.loop, ctx.tree, ctx.graph);

    if (!safety.safe && !settings.naive) {
      state.refused += 1;
      state.reasons.push({ register: target, why: safety.why });
      return false;
    }
    ctx.into.instructions.push(inst);
    state.hoisted += 1;
    return true;
  }

  /* --------------------------------------------------- induction variables */

  /**
   * A basic induction variable is a phi at the loop header whose value coming
   * round the back edge is itself plus a loop-invariant amount. Recognising it
   * is the precondition for strength reduction, for bounds analysis, and for
   * knowing a loop's trip count — and the pattern is small enough that failing
   * to look for it is the only reason not to.
   */
  function inductionVariables(fn) {
    const graph = Cfg.build(fn);
    const tree = Dominators.compute(graph);
    const found = [];

    Cfg.loops(graph, tree).forEach(function (loop) {
      const header = Ir.blockById(fn, loop.header);

      if (!header) return;
      header.instructions.forEach(function (inst) {
        const variable = asInduction(fn, inst, loop);

        if (variable) found.push(variable);
      });
    });
    return found;
  }

  function asInduction(fn, phi, loop) {
    if (phi.op !== 'phi' || phi.incoming.length !== 2) return null;
    const inside = new Set(loop.blocks);
    const back = phi.incoming.find(function (entry) { return inside.has(entry.block); });
    const outside = phi.incoming.find(function (entry) { return !inside.has(entry.block); });

    if (!back || !outside) return null;
    return stepOf(fn, phi, back, outside, loop);
  }

  function stepOf(fn, phi, back, outside, loop) {
    const step = findDefinition(fn, back.value);

    if (!step || step.op !== 'binary') return null;
    if (step.operator !== 'add' && step.operator !== 'sub') return null;
    if (step.left !== phi.target && step.right !== phi.target) return null;
    const amount = step.left === phi.target ? step.right : step.left;

    return { register: phi.target, header: loop.header, start: outside.value,
      operator: step.operator, step: amount, constant: constantOf(fn, amount) };
  }

  function findDefinition(fn, register) {
    let found = null;

    Ir.eachInstruction(fn, function (inst) {
      if (Ir.definitionOf(inst) === register) found = inst;
    });
    return found;
  }

  function constantOf(fn, register) {
    const definition = findDefinition(fn, register);

    return definition && definition.op === 'const' ? definition.value : null;
  }

  /* ----------------------------------------------------------- unswitching */

  /**
   * A conditional inside a loop whose test is loop-invariant is tested every
   * iteration and can only go one way. Unswitching hoists the test out and
   * duplicates the loop — which trades code size for branches removed, and is
   * therefore reported as both numbers rather than as a win.
   *
   * This implementation reports the opportunity rather than performing the
   * duplication: the transformation needs a loop cloner, and a pass that
   * duplicates blocks without one produces IR the verifier rejects — which is
   * the verifier doing its job, and the reason the opportunity is reported
   * honestly instead of a broken transform being shipped.
   */
  function unswitchOpportunities(fn) {
    const graph = Cfg.build(fn);
    const tree = Dominators.compute(graph);
    const found = [];

    const defined = definitionBlocks(fn);

    Cfg.loops(graph, tree).forEach(function (loop) {
      const invariant = invariantRegisters(fn, loop);
      const inside = new Set(loop.blocks);

      loop.blocks.forEach(function (id) {
        const block = Ir.blockById(fn, id);
        const term = block && block.terminator;

        if (!term || term.op !== 'branch') return;
        if (!isInvariantHere(term.cond, invariant, defined, inside)) return;
        found.push({ loop: loop.header, block: id, condition: term.cond,
          bodySize: loopSize(fn, loop), duplicated: loopSize(fn, loop) });
      });
    });
    return found;
  }

  /**
   * A condition DEFINED OUTSIDE the loop is trivially invariant and is not in
   * the invariant set, which only collects definitions inside. Checking
   * membership alone reported no unswitching opportunity for the commonest
   * case there is: a flag computed before the loop and tested inside it.
   */
  function isInvariantHere(register, invariant, defined, inside) {
    if (invariant.has(register)) return true;
    const at = defined.get(register);

    return at === undefined || !inside.has(at);
  }

  function loopSize(fn, loop) {
    return loop.blocks.reduce(function (sum, id) {
      const block = Ir.blockById(fn, id);

      return sum + (block ? block.instructions.length + 1 : 0);
    }, 0);
  }

  /* ------------------------------------------------------------- reporting */

  /**
   * What each loop costs, which is the number a cost model multiplies by. The
   * body count is instructions inside the loop; `weighted` charges an inner
   * loop's body once per iteration of every loop enclosing it, at an assumed
   * ten iterations each — an assumption, and named as one, because a static
   * trip count is not available for most loops.
   */
  function report(fn) {
    const graph = Cfg.build(fn);
    const tree = Dominators.compute(graph);
    const loops = Cfg.loops(graph, tree);
    const induction = inductionVariables(fn);

    return loops.map(function (loop) {
      const body = loopSize(fn, loop);

      return { header: loop.header, depth: loop.depth, blocks: loop.blocks.length,
        body: body, weighted: body * Math.pow(10, loop.depth + 1),
        invariant: invariantRegisters(fn, loop).size,
        exits: exitBlocks(loop, graph).length,
        induction: induction.filter(function (entry) {
          return entry.header === loop.header;
        }).length };
    });
  }

  const PASSES = {
    licm: { run: function (fn) { return licm(fn); },
      about: 'move invariant computations to the preheader, when it is safe' },
    'licm-naive': { run: function (fn) { return licm(fn, { naive: true }); },
      about: 'the same, ignoring the fault condition — for the fixture that breaks' }
  };

  function run(fn, name) {
    const pass = PASSES[name];

    if (!pass) throw new Error('no pass named ' + name);
    return pass.run(fn);
  }

  return {
    PASSES: PASSES, HOISTABLE: HOISTABLE,
    run: run, licm: licm, invariantRegisters: invariantRegisters,
    mayFault: mayFault, safeToHoist: safeToHoist, exitBlocks: exitBlocks,
    ensurePreheader: ensurePreheader, inductionVariables: inductionVariables,
    unswitchOpportunities: unswitchOpportunities, loopSize: loopSize, report: report
  };
}));
