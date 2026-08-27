/**
 * Control-flow graphs: edges, loops, and the two simplifications every
 * optimiser needs before it can start.
 *
 * The IR is already in blocks, so building the graph is bookkeeping. What is
 * not bookkeeping is what the graph makes askable. "Does this run before
 * that", "is this value available here", "can this be hoisted" are all
 * questions about paths, and a tree has no paths — which is the whole argument
 * for lowering out of the AST before optimising.
 *
 * Two operations here look like tidying and are not:
 *
 * - **Critical-edge splitting.** An edge from a block with several successors
 *   to a block with several predecessors has nowhere to put code that must run
 *   on exactly that path. SSA destruction needs somewhere; so does any pass
 *   that inserts a copy on one edge. Skipping it produces bugs that appear only
 *   when two paths merge, which is the hardest kind to reproduce.
 * - **Unreachable-block elimination.** An unreachable block has no
 *   predecessors, so a phi in a block it targets has an entry for an edge that
 *   cannot be taken — and every dataflow analysis will happily compute facts
 *   for code that never runs and merge them into code that does.
 *
 * Natural loops are found from back edges, and a back edge is an edge whose
 * target dominates its source. That makes loop detection a consumer of the
 * dominator tree rather than a separate traversal, which is the usual shape:
 * dominance answers most structural questions in an optimiser.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Berugo = scope.Berugo || {};
    scope.Berugo.Cfg = api;
  }
}(this, function (root) {
  'use strict';

  const berugo = root && root.Berugo ? root.Berugo : null;
  const Ir = berugo && berugo.Ir ? berugo.Ir : require('./ir.js');
  const Dominators = berugo && berugo.Dominators
    ? berugo.Dominators : require('./dominators.js');

  /* ------------------------------------------------------------- the graph */

  function build(fn) {
    const preds = Ir.predecessors(fn);
    const succs = {};

    fn.blocks.forEach(function (block) { succs[block.id] = Ir.successorsOf(block); });
    return { fn: fn, entry: fn.entry, blocks: fn.blocks.map(function (b) { return b.id; }),
      preds: preds, succs: succs, edges: edgeList(succs) };
  }

  function edgeList(succs) {
    const edges = [];

    Object.keys(succs).forEach(function (from) {
      succs[from].forEach(function (to) { edges.push({ from: from, to: to }); });
    });
    return edges;
  }

  /** Depth-first order from the entry, which several algorithms want. */
  function order(graph) {
    const seen = new Set();
    const out = [];

    const walk = function (id) {
      if (seen.has(id)) return;
      seen.add(id);
      (graph.succs[id] || []).forEach(walk);
      out.push(id);
    };

    walk(graph.entry);
    return { postorder: out, reverse: out.slice().reverse(), reached: seen };
  }

  /* -------------------------------------------------------------- the loops */

  /**
   * A back edge is an edge whose target dominates its source; the natural loop
   * of that edge is the target plus everything that can reach the source
   * without leaving through the target. Both halves matter: without the
   * dominance test, any edge to an earlier block looks like a loop, and
   * irreducible flow graphs are exactly the ones where that difference bites.
   */
  function backEdges(graph, dom) {
    const tree = dom || Dominators.compute(graph);

    return graph.edges.filter(function (edge) {
      return Dominators.dominates(tree, edge.to, edge.from);
    });
  }

  function naturalLoop(graph, edge) {
    const body = new Set([edge.to]);
    const stack = [edge.from];

    while (stack.length) {
      const id = stack.pop();

      if (body.has(id)) continue;
      body.add(id);
      (graph.preds[id] || []).forEach(function (pred) { stack.push(pred); });
    }
    return { header: edge.to, latch: edge.from, blocks: Array.from(body).sort(),
      size: body.size };
  }

  /**
   * Two back edges to the same header are one loop with two latches, not two
   * loops — merging them is what makes the nesting forest a forest rather than
   * a multigraph, and it is the case a `continue` in a loop produces.
   */
  function loops(graph, dom) {
    const tree = dom || Dominators.compute(graph);
    const byHeader = new Map();

    backEdges(graph, tree).forEach(function (edge) {
      const found = naturalLoop(graph, edge);

      if (!byHeader.has(found.header)) { byHeader.set(found.header, found); return; }
      mergeLoop(byHeader.get(found.header), found);
    });
    return nest(Array.from(byHeader.values()));
  }

  function mergeLoop(into, extra) {
    const merged = new Set(into.blocks.concat(extra.blocks));

    into.blocks = Array.from(merged).sort();
    into.size = merged.size;
    into.latches = (into.latches || [into.latch]).concat([extra.latch]);
  }

  /**
   * A loop is nested inside another when its header is in the other's body.
   * Depth is the count of enclosing loops, which is the number the demo shades
   * by and the number a cost model multiplies a loop body's instructions by.
   */
  function nest(found) {
    found.forEach(function (loop) {
      loop.parent = null;
      loop.depth = 0;
    });
    found.forEach(function (loop) {
      found.forEach(function (other) {
        if (other === loop || other.blocks.indexOf(loop.header) === -1) return;
        if (!loop.parent || other.size < loop.parent.size) loop.parent = other;
      });
    });
    found.forEach(function (loop) {
      let here = loop.parent;

      while (here) { loop.depth += 1; here = here.parent; }
    });
    return found.sort(function (a, b) { return a.depth - b.depth || compare(a, b); });
  }

  function compare(a, b) { return a.header < b.header ? -1 : 1; }

  /** Which loops each block is inside, innermost last. */
  function depthOf(found, id) {
    return found.filter(function (loop) {
      return loop.blocks.indexOf(id) !== -1;
    }).length;
  }

  /* --------------------------------------------------------- simplification */

  /**
   * An edge is critical when its source has several successors AND its target
   * several predecessors. There is then no block that runs on exactly that
   * edge, so no pass can place a copy there — which is the first thing SSA
   * destruction needs and the reason this is a correctness requirement rather
   * than tidying.
   */
  function criticalEdges(graph) {
    return graph.edges.filter(function (edge) {
      return (graph.succs[edge.from] || []).length > 1
        && (graph.preds[edge.to] || []).length > 1;
    });
  }

  function splitCriticalEdges(fn) {
    const graph = build(fn);
    const critical = criticalEdges(graph);

    critical.forEach(function (edge) { splitEdge(fn, edge); });
    return { split: critical.length, edges: critical };
  }

  function splitEdge(fn, edge) {
    const source = Ir.blockById(fn, edge.from);
    const block = Ir.makeBlock(fn, 'split');

    Ir.terminate(block, 'jump', { target: edge.to, origin: 'split' });
    retarget(source.terminator, edge.to, block.id);
    retargetPhis(fn, edge.to, edge.from, block.id);
    return block;
  }

  function retarget(term, from, to) {
    if (term.op === 'jump' && term.target === from) { term.target = to; return; }
    if (term.op !== 'branch') return;
    if (term.then === from) term.then = to;
    else if (term.other === from) term.other = to;
  }

  /** A phi names the block control came from, and that block just changed. */
  function retargetPhis(fn, target, from, to) {
    const block = Ir.blockById(fn, target);

    if (!block) return;
    block.instructions.forEach(function (inst) {
      if (inst.op !== 'phi') return;
      inst.incoming.forEach(function (entry) {
        if (entry.block === from) entry.block = to;
      });
    });
  }

  function removeUnreachable(fn) {
    const live = Ir.reachable(fn);
    const dropped = fn.blocks.filter(function (block) { return !live.has(block.id); });

    fn.blocks = fn.blocks.filter(function (block) { return live.has(block.id); });
    dropped.forEach(function (block) { dropPhiEntries(fn, block.id); });
    return { removed: dropped.length,
      blocks: dropped.map(function (block) { return block.id; }) };
  }

  function dropPhiEntries(fn, gone) {
    fn.blocks.forEach(function (block) {
      block.instructions.forEach(function (inst) {
        if (inst.op !== 'phi') return;
        inst.incoming = inst.incoming.filter(function (entry) { return entry.block !== gone; });
      });
    });
  }

  /* ---------------------------------------------------------- reducibility */

  /**
   * A graph is reducible when removing every back edge leaves an acyclic
   * graph. Irreducible flow comes from `goto` into the middle of a loop, and
   * from some code generators; the demo's fixture is built by hand because
   * Berugo's structured control flow cannot produce one, which is itself the
   * point — a language without arbitrary jumps gets reducibility for free.
   */
  function isReducible(graph, dom) {
    const back = new Set(backEdges(graph, dom).map(function (edge) {
      return edge.from + '->' + edge.to;
    }));
    const forward = {};

    graph.blocks.forEach(function (id) {
      forward[id] = (graph.succs[id] || []).filter(function (to) {
        return !back.has(id + '->' + to);
      });
    });
    return !hasCycle(graph, forward);
  }

  function hasCycle(graph, succs) {
    const state = {};
    let found = false;

    const walk = function (id) {
      if (state[id] === 'open') { found = true; return; }
      if (state[id] === 'done') return;
      state[id] = 'open';
      (succs[id] || []).forEach(walk);
      state[id] = 'done';
    };

    graph.blocks.forEach(function (id) { if (!state[id]) walk(id); });
    return found;
  }

  /* ------------------------------------------------------------- reporting */

  function summary(fn) {
    const graph = build(fn);
    const dom = Dominators.compute(graph);
    const found = loops(graph, dom);

    return { blocks: graph.blocks.length, edges: graph.edges.length,
      loops: found.length,
      maxDepth: found.reduce(function (best, loop) {
        return Math.max(best, loop.depth + 1);
      }, 0),
      backEdges: backEdges(graph, dom).length,
      critical: criticalEdges(graph).length,
      reducible: isReducible(graph, dom),
      unreachable: graph.blocks.length - Ir.reachable(fn).size };
  }

  /** One row per block, which is what the CFG table renders. */
  function rows(fn) {
    const graph = build(fn);
    const dom = Dominators.compute(graph);
    const found = loops(graph, dom);

    return fn.blocks.map(function (block) {
      return { id: block.id, label: block.label,
        instructions: block.instructions.length,
        preds: graph.preds[block.id] || [], succs: graph.succs[block.id] || [],
        depth: depthOf(found, block.id),
        header: found.some(function (loop) { return loop.header === block.id; }),
        idom: Dominators.immediate(dom, block.id) };
    });
  }

  return {
    build: build, order: order,
    backEdges: backEdges, naturalLoop: naturalLoop, loops: loops, depthOf: depthOf,
    criticalEdges: criticalEdges, splitCriticalEdges: splitCriticalEdges,
    removeUnreachable: removeUnreachable, isReducible: isReducible,
    summary: summary, rows: rows
  };
}));
