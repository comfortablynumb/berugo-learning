/**
 * Across function boundaries: the call graph, inlining, and escape analysis.
 *
 * Inlining is the optimisation that unlocks the others. A call is a wall: the
 * optimiser cannot see that an argument is constant, cannot value-number
 * across it, cannot prove a record does not escape. Removing the wall lets
 * every scalar pass work on a body it could not previously reach — which is
 * why compilers spend so much of their budget on the heuristic, and why a
 * refactor that moves code across a function boundary can change performance
 * by a factor.
 *
 * The heuristic is the whole difficulty, and it is a budget rather than a
 * rule: inlining is unboundedly profitable and unboundedly expensive, so
 * something has to say stop. This one costs a call site by the callee's size
 * and spends from a fixed budget, which is the shape every real heuristic
 * has under the tuning.
 *
 * Escape analysis is the other half. An allocation that no path lets outlive
 * its frame can live on the stack, and in a language with closures the
 * question is exactly "is this captured or returned". M28's resolver already
 * recorded captures per function; this recomputes the same fact over the IR,
 * because after inlining the tree it recorded them from no longer exists.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Berugo = scope.Berugo || {};
    scope.Berugo.Interproc = api;
  }
}(this, function (root) {
  'use strict';

  const berugo = root && root.Berugo ? root.Berugo : null;
  const Ir = berugo && berugo.Ir ? berugo.Ir : require('./ir.js');

  /* ------------------------------------------------------------ call graph */

  /**
   * An edge is only recorded where the callee is a closure whose function is
   * known at this point. A call through a value the optimiser cannot trace is
   * an INDIRECT edge, and reporting the two together would let a whole-program
   * pass assume it had seen every caller — which is exactly the assumption
   * that makes devirtualisation unsound.
   */
  function callGraph(program) {
    const nodes = program.functions.map(function (fn) { return fn.name; });
    const known = new Set(nodes);
    const edges = [];
    const indirect = [];

    program.functions.forEach(function (fn) {
      const closures = closureMap(fn, known);

      Ir.eachInstruction(fn, function (inst, block) {
        if (inst.op !== 'call') return;
        const target = closures[inst.callee];

        if (target) edges.push({ from: fn.name, to: target, block: block.id, at: inst.target });
        else indirect.push({ from: fn.name, block: block.id, callee: inst.callee });
      });
    });
    return { nodes: nodes, edges: edges, indirect: indirect,
      recursive: recursiveEdges(edges) };
  }

  /**
   * SSA renaming turns every read of a local into a move, so the register a
   * call names is almost never the one the closure was built into. Following
   * the move chain is what makes a direct call look direct — without it every
   * call in an SSA program is reported as indirect, which is a call graph with
   * no edges and an inliner with nothing to do.
   */
  function closureMap(fn, known) {
    const copies = {};
    const map = {};

    Ir.eachInstruction(fn, function (inst) {
      if (inst.op === 'move') copies[inst.target] = inst.from;
    });
    Ir.eachInstruction(fn, function (inst) {
      if (inst.op === 'makeClosure') { map[inst.target] = inst.func; return; }
      const named = globalFunction(inst, known);

      if (named) map[inst.target] = named;
    });
    Object.keys(copies).forEach(function (target) {
      const source = followCopies(copies, target);

      if (map[source] !== undefined) map[target] = map[source];
    });
    return map;
  }

  /**
   * A function referred to by name rather than through a closure value —
   * `const "!down"` — is a callee the optimiser can identify, so it is a
   * DIRECT edge. Leaving it out made every self-call indirect, which meant
   * the recursive set was always empty and the rule that excludes recursion
   * from inlining was never once exercised. A `!name` that is not a function
   * of this program is a runtime native and stays indirect.
   */
  function globalFunction(inst, known) {
    if (inst.op !== 'const' || typeof inst.value !== 'string') return null;
    if (inst.value.charAt(0) !== '!') return null;
    const name = inst.value.slice(1);

    return known && known.has(name) ? name : null;
  }

  function followCopies(copies, register) {
    let here = register;
    let guard = 0;

    while (copies[here] !== undefined && guard < 1000) { here = copies[here]; guard += 1; }
    return here;
  }

  /** Which registers are copies of an allocation, for the escape walk. */
  function aliasesOf(fn, register) {
    const copies = {};

    Ir.eachInstruction(fn, function (inst) {
      if (inst.op === 'move') copies[inst.target] = inst.from;
    });
    return new Set([register].concat(Object.keys(copies).filter(function (target) {
      return followCopies(copies, target) === register;
    })));
  }

  /** An edge on a cycle: inlining one of these without a depth limit diverges. */
  function recursiveEdges(edges) {
    const succs = {};

    edges.forEach(function (edge) {
      if (!succs[edge.from]) succs[edge.from] = [];
      succs[edge.from].push(edge.to);
    });
    return edges.filter(function (edge) { return reaches(succs, edge.to, edge.from); });
  }

  function reaches(succs, from, target) {
    const seen = new Set();
    const stack = [from];

    while (stack.length) {
      const id = stack.pop();

      if (id === target) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      (succs[id] || []).forEach(function (next) { stack.push(next); });
    }
    return false;
  }

  /* ----------------------------------------------------------- the estimate */

  function sizeOf(fn) { return Ir.instructionCount(fn); }

  /**
   * Cost is the callee's size; benefit is the call overhead saved plus a bonus
   * for each argument that is a known constant, because those unlock folding in
   * the body. Both numbers are made up — every real heuristic's are — and the
   * point of reporting them per edge is that the budget's decisions can then be
   * read rather than guessed at.
   */
  function estimate(program, edge) {
    const callee = byName(program, edge.to);

    if (!callee) return null;
    const size = sizeOf(callee);

    return { from: edge.from, to: edge.to, block: edge.block, size: size,
      cost: size, benefit: 3 + constantArguments(program, edge) * 2,
      ratio: size ? (3 + constantArguments(program, edge) * 2) / size : Infinity };
  }

  function constantArguments(program, edge) {
    const caller = byName(program, edge.from);
    const constants = new Set();

    if (!caller) return 0;
    Ir.eachInstruction(caller, function (inst) {
      if (inst.op === 'const') constants.add(inst.target);
    });
    return countConstantArgs(caller, edge, constants);
  }

  function countConstantArgs(caller, edge, constants) {
    let found = 0;

    Ir.eachInstruction(caller, function (inst) {
      if (inst.op !== 'call' || inst.target !== edge.at) return;
      found = inst.args.filter(function (arg) { return constants.has(arg); }).length;
    });
    return found;
  }

  function byName(program, name) {
    return program.functions.find(function (fn) { return fn.name === name; }) || null;
  }

  /**
   * Spend the budget on the best ratio first. Recursive edges are excluded
   * outright rather than depth-limited, because a depth limit is a second
   * number to tune and this milestone has enough of those; the exclusion is
   * reported so the omission is visible.
   */
  function plan(program, options) {
    const settings = options || {};
    const budget = settings.budget === undefined ? 40 : settings.budget;
    const graph = callGraph(program);
    const recursive = new Set(graph.recursive.map(edgeKey));
    const candidates = graph.edges.filter(function (edge) {
      return !recursive.has(edgeKey(edge));
    }).map(function (edge) { return estimate(program, edge); }).filter(Boolean);

    return choose(candidates, budget, graph);
  }

  function edgeKey(edge) { return edge.from + '->' + edge.to + '@' + edge.block; }

  function choose(candidates, budget, graph) {
    const chosen = [];
    let spent = 0;

    candidates.slice().sort(function (a, b) { return b.ratio - a.ratio; })
      .forEach(function (row) {
        if (spent + row.cost > budget) { row.skipped = 'over budget'; return; }
        spent += row.cost;
        chosen.push(row);
      });
    return { chosen: chosen, candidates: candidates, spent: spent, budget: budget,
      recursive: graph.recursive.length, indirect: graph.indirect.length };
  }

  /* --------------------------------------------------------- escape analysis */

  /**
   * An allocation escapes when its value can outlive the frame that made it:
   * returned, stored into something else, captured by a closure, or passed to
   * a call this analysis cannot see into. Anything else can be stack
   * allocated.
   *
   * The rule for "passed to a call" is the conservative one and it costs
   * precision: a record passed to a function that only reads it does not
   * escape, and proving that needs the interprocedural summary 29.9 builds.
   * Reporting the reason per allocation is what makes the imprecision visible
   * rather than a number nobody can explain.
   */
  const ALLOCATIONS = ['makeRecord', 'makeArray', 'makeClosure'];

  function escapeAnalysis(fn) {
    const rows = [];

    Ir.eachInstruction(fn, function (inst, block) {
      if (ALLOCATIONS.indexOf(inst.op) === -1) return;
      rows.push(Object.assign({ op: inst.op, register: inst.target, block: block.id },
        escapeReason(fn, inst.target)));
    });
    return { allocations: rows,
      escaping: rows.filter(function (row) { return row.escapes; }).length,
      stack: rows.filter(function (row) { return !row.escapes; }).length };
  }

  /**
   * The allocation escapes if ANY register that is a copy of it escapes. A
   * value passed on through three moves is the same value, and an analysis
   * that only watches the original register reports every allocation as
   * stack-bound in an SSA program — which is unsound, and the direction that
   * matters, because a pass would then put a closure on a frame that returns.
   */
  function escapeReason(fn, register) {
    const family = aliasesOf(fn, register);
    let reason = null;

    Ir.eachInstruction(fn, function (inst) {
      if (reason) return;
      reason = escapeThrough(inst, family);
    });
    return reason ? { escapes: true, why: reason }
      : { escapes: false, why: 'never leaves this frame' };
  }

  function escapeThrough(inst, family) {
    if (inst.op === 'ret' && family.has(inst.value)) return 'returned';
    if (inst.op === 'call' && inst.args.some(function (a) { return family.has(a); })) {
      return 'passed to a call, which this analysis cannot see into';
    }
    if (inst.op === 'makeClosure' && inst.args.some(function (a) { return family.has(a); })) {
      return 'captured by a closure';
    }
    if ((inst.op === 'storeField' || inst.op === 'storeIndex') && family.has(inst.value)) {
      return 'stored into another object';
    }
    return null;
  }

  function escapeProgram(program) {
    const rows = program.functions.map(function (fn) {
      return Object.assign({ fn: fn.name }, escapeAnalysis(fn));
    });

    return { functions: rows,
      allocations: rows.reduce(function (sum, row) { return sum + row.allocations.length; }, 0),
      escaping: rows.reduce(function (sum, row) { return sum + row.escaping; }, 0),
      stack: rows.reduce(function (sum, row) { return sum + row.stack; }, 0) };
  }

  /* ---------------------------------------------------------- tail calls */

  /**
   * A call whose result is returned immediately is a tail call, and it can
   * reuse the frame rather than growing the stack. Recognising it is a
   * two-instruction pattern; performing it needs the calling convention M30
   * defines, so this reports the sites and says so.
   */
  function tailCalls(fn) {
    const found = [];

    fn.blocks.forEach(function (block) {
      const term = block.terminator;
      const last = block.instructions[block.instructions.length - 1];

      if (!term || term.op !== 'ret' || !last || last.op !== 'call') return;
      if (term.value !== last.target) return;
      found.push({ block: block.id, callee: last.callee, register: last.target });
    });
    return found;
  }

  /* --------------------------------------------------------------- summary */

  function summary(program, options) {
    const graph = callGraph(program);
    const inlining = plan(program, options);
    const escapes = escapeProgram(program);

    return { functions: graph.nodes.length, calls: graph.edges.length,
      indirect: graph.indirect.length, recursive: graph.recursive.length,
      chosen: inlining.chosen.length, spent: inlining.spent, budget: inlining.budget,
      allocations: escapes.allocations, stack: escapes.stack, escaping: escapes.escaping,
      tailCalls: program.functions.reduce(function (sum, fn) {
        return sum + tailCalls(fn).length;
      }, 0) };
  }

  return {
    callGraph: callGraph, sizeOf: sizeOf, estimate: estimate, plan: plan,
    escapeAnalysis: escapeAnalysis, escapeProgram: escapeProgram,
    tailCalls: tailCalls, summary: summary, ALLOCATIONS: ALLOCATIONS
  };
}));
