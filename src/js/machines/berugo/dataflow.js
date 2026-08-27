/**
 * Dataflow analysis: one algorithm, many lattices.
 *
 * Liveness, reaching definitions, available expressions and very busy
 * expressions look like four different analyses and are one worklist loop with
 * four different domains. Recognising that turns "write a new analysis" into
 * "define a lattice and a transfer function", which is a day rather than a
 * month — and it is the single most useful thing to know about this subject.
 *
 * A solver needs four things and they are all the caller's:
 *
 * - a **direction**, forward or backward;
 * - a **meet**, which combines the facts arriving from several edges — an
 *   intersection where a fact must hold on every path, a union where it need
 *   hold on one;
 * - a **transfer function**, which says how one block changes a fact; and
 * - an **initial value**, which for an intersection analysis must be the top of
 *   the lattice rather than the empty set, or the fixpoint converges to nothing.
 *
 * Termination is not an accident: the lattice has finite height and the
 * transfer functions are monotone, so a fact can only move one way and there
 * are finitely many moves. The solver reports its iteration count because that
 * count is the argument made visible — an analysis that does not converge in a
 * few passes over a reducible graph has a non-monotone transfer function, and
 * that is the bug to look for.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Berugo = scope.Berugo || {};
    scope.Berugo.Dataflow = api;
  }
}(this, function (root) {
  'use strict';

  const berugo = root && root.Berugo ? root.Berugo : null;
  const Ir = berugo && berugo.Ir ? berugo.Ir : require('./ir.js');
  const Cfg = berugo && berugo.Cfg ? berugo.Cfg : require('./cfg.js');

  /* ----------------------------------------------------------- set helpers */

  function union(a, b) {
    const out = new Set(a);

    b.forEach(function (item) { out.add(item); });
    return out;
  }

  function intersect(a, b) {
    const out = new Set();

    a.forEach(function (item) { if (b.has(item)) out.add(item); });
    return out;
  }

  function difference(a, b) {
    const out = new Set();

    a.forEach(function (item) { if (!b.has(item)) out.add(item); });
    return out;
  }

  function sameSet(a, b) {
    if (a.size !== b.size) return false;
    let equal = true;

    a.forEach(function (item) { if (!b.has(item)) equal = false; });
    return equal;
  }

  function show(set) { return Array.from(set).sort().join(', ') || '∅'; }

  /* ------------------------------------------------------------ the solver */

  /**
   * The worklist. A block is re-examined only when a neighbour's fact changed,
   * which is what makes this cheaper than sweeping until nothing moves — and
   * the two produce the same fixpoint, because the order in which monotone
   * transfer functions are applied cannot change where they converge.
   */
  function solve(fn, analysis) {
    const graph = Cfg.build(fn);
    const state = start(graph, analysis);
    const worklist = graph.blocks.slice();
    let rounds = 0;

    while (worklist.length) {
      const id = worklist.shift();

      rounds += 1;
      if (rounds > 100000) break;
      step(fn, graph, analysis, state, id).forEach(function (next) {
        if (worklist.indexOf(next) === -1) worklist.push(next);
      });
    }
    return finish(graph, analysis, state, rounds);
  }

  function start(graph, analysis) {
    const inSets = {};
    const outSets = {};
    const boundary = analysis.direction === 'forward' ? graph.entry : null;

    graph.blocks.forEach(function (id) {
      inSets[id] = new Set(analysis.initial ? analysis.initial(id, graph) : []);
      outSets[id] = new Set(analysis.initial ? analysis.initial(id, graph) : []);
    });
    if (boundary) inSets[boundary] = new Set(analysis.boundary ? analysis.boundary(graph) : []);
    return { in: inSets, out: outSets };
  }

  function step(fn, graph, analysis, state, id) {
    if (analysis.direction === 'forward') return forwardStep(fn, graph, analysis, state, id);
    return backwardStep(fn, graph, analysis, state, id);
  }

  function forwardStep(fn, graph, analysis, state, id) {
    const preds = graph.preds[id] || [];

    if (preds.length || id !== graph.entry) {
      state.in[id] = meetOver(analysis, preds.map(function (p) { return state.out[p]; }),
        state.in[id], id === graph.entry);
    }
    const next = analysis.transfer(Ir.blockById(fn, id), state.in[id], fn);

    if (sameSet(next, state.out[id])) return [];
    state.out[id] = next;
    return graph.succs[id] || [];
  }

  /**
   * A block with no successors is the backward boundary, and its OUT is the
   * analysis boundary value rather than whatever it was initialised to. For
   * an intersection analysis the initial value is the FULL set, so without
   * this the exit block reports every expression as very busy — computed on
   * every path from a point after which no path exists.
   */
  function backwardStep(fn, graph, analysis, state, id) {
    const succs = graph.succs[id] || [];

    if (!succs.length && analysis.boundary) {
      state.out[id] = new Set(analysis.boundary(graph));
    } else {
      state.out[id] = meetOver(analysis, succs.map(function (s) { return state.in[s]; }),
        state.out[id], succs.length === 0);
    }
    const next = analysis.transfer(Ir.blockById(fn, id), state.out[id], fn);

    if (sameSet(next, state.in[id])) return [];
    state.in[id] = next;
    return graph.preds[id] || [];
  }

  /**
   * With no incoming edges the boundary value stands. That is why an
   * intersection analysis initialises to the FULL set everywhere except the
   * entry: meeting over no edges must not produce the empty set, or every
   * block starts at the bottom and the fixpoint is trivially nothing.
   */
  function meetOver(analysis, sets, current, isBoundary) {
    if (!sets.length) return isBoundary ? current : new Set(current);
    return sets.reduce(function (acc, set) {
      return analysis.meet === 'intersect' ? intersect(acc, set) : union(acc, set);
    });
  }

  function finish(graph, analysis, state, rounds) {
    return { name: analysis.name, direction: analysis.direction, meet: analysis.meet,
      in: state.in, out: state.out, rounds: rounds, blocks: graph.blocks.length,
      rows: graph.blocks.map(function (id) {
        return { id: id, in: show(state.in[id]), out: show(state.out[id]),
          inSize: state.in[id].size, outSize: state.out[id].size };
      }) };
  }

  /* --------------------------------------------------------- the analyses */

  /**
   * Liveness: a register is live at a point when some path from there reads it
   * before writing it. Backward, union — a value is live if ANY successor
   * needs it, because the program only has to take one of those paths.
   */
  const LIVENESS = {
    name: 'liveness', direction: 'backward', meet: 'union',
    about: 'which registers still have a reader ahead of them',
    transfer: function (block, out) {
      const gen = new Set();
      const kill = new Set();

      blockEffects(block, gen, kill);
      return union(gen, difference(out, kill));
    }
  };

  /**
   * A phi's operands are used on the EDGE, not in the block holding the phi.
   * Charging them to the phi's own block makes a value look live along paths
   * it never travels, which is how a register allocator ends up with
   * interference that is not real.
   */
  function blockEffects(block, gen, kill) {
    const instructions = block.instructions.slice();

    if (block.terminator) instructions.push(block.terminator);
    for (let i = instructions.length - 1; i >= 0; i -= 1) {
      const inst = instructions[i];
      const target = Ir.definitionOf(inst);

      if (target) { kill.add(target); gen.delete(target); }
      if (inst.op === 'phi') continue;
      Ir.usesOf(inst).forEach(function (register) { gen.add(register); });
    }
  }

  /** Which definitions can reach a point. Forward, union. */
  const REACHING = {
    name: 'reaching definitions', direction: 'forward', meet: 'union',
    about: 'which definitions of each register could be the current one',
    transfer: function (block, incoming, fn) {
      const out = new Set(incoming);

      block.instructions.forEach(function (inst) {
        const target = Ir.definitionOf(inst);

        if (!target) return;
        killDefinitions(out, target, fn);
        out.add(block.id + ':' + target);
      });
      return out;
    }
  };

  function killDefinitions(set, target, fn) {
    Array.from(set).forEach(function (entry) {
      if (entry.split(':')[1] === target) set.delete(entry);
    });
    return fn;
  }

  /**
   * Available expressions: which computations are already done on EVERY path
   * here. Forward, intersect — and the initial value is the full set, which is
   * the detail that separates a working intersection analysis from one that
   * converges to nothing.
   */
  function availableExpressions(fn) {
    const all = allExpressions(fn);

    return {
      name: 'available expressions', direction: 'forward', meet: 'intersect',
      about: 'which computations are already done on every path to here',
      initial: function () { return all; },
      boundary: function () { return []; },
      transfer: function (block, incoming) {
        const out = new Set(incoming);

        block.instructions.forEach(function (inst) {
          const key = expressionKey(inst);

          killByOperand(out, Ir.definitionOf(inst));
          if (key) out.add(key);
        });
        return out;
      }
    };
  }

  function allExpressions(fn) {
    const keys = [];

    Ir.eachInstruction(fn, function (inst) {
      const key = expressionKey(inst);

      if (key) keys.push(key);
    });
    return keys;
  }

  function expressionKey(inst) {
    if (inst.op === 'binary') return inst.operator + '(' + inst.left + ', ' + inst.right + ')';
    if (inst.op === 'unary') return inst.operator + '(' + inst.operand + ')';
    return null;
  }

  function killByOperand(set, target) {
    if (!target) return;
    Array.from(set).forEach(function (key) {
      if (key.indexOf(target) !== -1) set.delete(key);
    });
  }

  /** Very busy: computed on every path AHEAD. Backward, intersect. */
  function veryBusy(fn) {
    const all = allExpressions(fn);

    return {
      name: 'very busy expressions', direction: 'backward', meet: 'intersect',
      about: 'which computations will happen on every path from here',
      initial: function () { return all; },
      boundary: function () { return []; },
      transfer: function (block, outgoing) {
        const out = new Set(outgoing);

        for (let i = block.instructions.length - 1; i >= 0; i -= 1) {
          killByOperand(out, Ir.definitionOf(block.instructions[i]));
          const key = expressionKey(block.instructions[i]);

          if (key) out.add(key);
        }
        return out;
      }
    };
  }

  const ANALYSES = {
    liveness: function () { return LIVENESS; },
    reaching: function () { return REACHING; },
    available: availableExpressions,
    busy: veryBusy
  };

  function run(fn, name) {
    const build = ANALYSES[name];

    if (!build) throw new Error('no analysis named ' + name);
    return solve(fn, build(fn));
  }

  /* ---------------------------------------------------------- the oracle */

  /**
   * Liveness by enumeration: a register is live out of a block when some path
   * from a successor reads it before any block on that path writes it. This is
   * exponential in the number of paths and only ever run on small graphs — the
   * point of an oracle is that the fast algorithm is the one that can be
   * subtly wrong.
   */
  function bruteLiveness(fn) {
    const graph = Cfg.build(fn);
    const registers = allRegisters(fn);
    const out = {};

    graph.blocks.forEach(function (id) {
      out[id] = new Set(registers.filter(function (register) {
        return liveOut(fn, graph, id, register, new Set());
      }));
    });
    return out;
  }

  function allRegisters(fn) {
    const found = new Set();

    Ir.eachInstruction(fn, function (inst) {
      const target = Ir.definitionOf(inst);

      if (target) found.add(target);
      Ir.usesOf(inst).forEach(function (register) { found.add(register); });
    });
    return Array.from(found);
  }

  function liveOut(fn, graph, id, register, seen) {
    return (graph.succs[id] || []).some(function (next) {
      return liveIn(fn, graph, next, register, seen);
    });
  }

  function liveIn(fn, graph, id, register, seen) {
    if (seen.has(id)) return false;
    const gen = new Set();
    const kill = new Set();

    blockEffects(Ir.blockById(fn, id), gen, kill);
    if (gen.has(register)) return true;
    if (kill.has(register)) return false;
    const marked = new Set(seen);

    marked.add(id);
    return liveOut(fn, graph, id, register, marked);
  }

  return {
    solve: solve, run: run, ANALYSES: ANALYSES,
    LIVENESS: LIVENESS, REACHING: REACHING,
    availableExpressions: availableExpressions, veryBusy: veryBusy,
    blockEffects: blockEffects, expressionKey: expressionKey,
    bruteLiveness: bruteLiveness, allRegisters: allRegisters,
    union: union, intersect: intersect, difference: difference, sameSet: sameSet, show: show
  };
}));
