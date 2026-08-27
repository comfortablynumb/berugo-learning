/**
 * Dominance, the first analysis every compiler builds and caches.
 *
 * A block A dominates B when every path from the entry to B goes through A.
 * That one relation answers most of the legality questions an optimiser asks —
 * is this definition available here, can this be hoisted there, is this edge a
 * back edge — which is why it is computed once and consulted everywhere rather
 * than rederived per pass.
 *
 * The algorithm here is Cooper, Harvey and Kennedy's iterative one, not
 * Lengauer–Tarjan. LT is asymptotically better and is what a production
 * compiler uses at scale; CHK is twenty lines, is faster on the graphs real
 * functions actually have, and — the reason it is here — its fixpoint can be
 * watched round by round, which is the thing worth seeing.
 *
 * The dominance FRONTIER is the second export and the less obvious one. The
 * frontier of A is every block that A does not strictly dominate but whose
 * immediate predecessor A does dominate: the first places where a value
 * defined in A stops being the only possibility. That is exactly where a phi
 * function has to go, which is why 29.4 is a consumer of this file rather than
 * an independent construction.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Berugo = scope.Berugo || {};
    scope.Berugo.Dominators = api;
  }
}(this, function () {
  'use strict';

  /* ------------------------------------------------------- the iteration */

  /**
   * Blocks are processed in reverse postorder, which is what makes the
   * iteration converge in one or two passes on a reducible graph: every
   * predecessor except a back edge has already been given a value.
   */
  function reversePostorder(graph) {
    const seen = new Set();
    const post = [];

    const walk = function (id) {
      if (seen.has(id)) return;
      seen.add(id);
      (graph.succs[id] || []).forEach(walk);
      post.push(id);
    };

    walk(graph.entry);
    return post.reverse();
  }

  function compute(graph) {
    const rpo = reversePostorder(graph);
    const index = {};

    rpo.forEach(function (id, at) { index[id] = at; });
    const idom = { };

    idom[graph.entry] = graph.entry;
    const rounds = iterate(graph, rpo, index, idom);

    return { entry: graph.entry, idom: idom, order: rpo, index: index,
      rounds: rounds.rounds, changes: rounds.changes, graph: graph };
  }

  function iterate(graph, rpo, index, idom) {
    const trace = [];
    let changed = true;
    let rounds = 0;

    while (changed) {
      changed = false;
      rounds += 1;
      let changes = 0;

      rpo.forEach(function (id) {
        if (id === graph.entry) return;
        const next = newIdom(graph, index, idom, id);

        if (next === null || idom[id] === next) return;
        idom[id] = next;
        changes += 1;
        changed = true;
      });
      trace.push({ round: rounds, changes: changes });
    }
    return { rounds: rounds, changes: trace };
  }

  function newIdom(graph, index, idom, id) {
    const preds = (graph.preds[id] || []).filter(function (pred) {
      return idom[pred] !== undefined;
    });

    if (!preds.length) return null;
    return preds.reduce(function (best, pred) {
      return best === null ? pred : intersect(index, idom, best, pred);
    }, null);
  }

  /**
   * Walk both fingers up the tree until they meet, comparing by reverse
   * postorder number rather than by identity — a block earlier in the order is
   * closer to the entry, so the finger with the larger number is the one that
   * has to move.
   */
  function intersect(index, idom, a, b) {
    let left = a;
    let right = b;

    while (left !== right) {
      while (index[left] > index[right]) left = idom[left];
      while (index[right] > index[left]) right = idom[right];
    }
    return left;
  }

  /* --------------------------------------------------------------- queries */

  function immediate(tree, id) {
    if (id === tree.entry) return null;
    return tree.idom[id] === undefined ? null : tree.idom[id];
  }

  /** Every block dominates itself; strict dominance excludes that. */
  function dominates(tree, a, b) {
    let here = b;

    while (here !== undefined && here !== null) {
      if (here === a) return true;
      if (here === tree.entry) return a === tree.entry;
      here = tree.idom[here];
    }
    return false;
  }

  function strictlyDominates(tree, a, b) {
    return a !== b && dominates(tree, a, b);
  }

  function dominated(tree, a) {
    return Object.keys(tree.idom).filter(function (id) {
      return dominates(tree, a, id);
    }).sort();
  }

  /** The children of each block in the dominator tree, for a walk. */
  function children(tree) {
    const kids = {};

    Object.keys(tree.idom).forEach(function (id) { kids[id] = []; });
    Object.keys(tree.idom).forEach(function (id) {
      const parent = immediate(tree, id);

      if (parent === null || !kids[parent]) return;
      kids[parent].push(id);
    });
    Object.keys(kids).forEach(function (id) { kids[id].sort(); });
    return kids;
  }

  /** Depth-first over the dominator tree, which is how SSA renaming walks. */
  function walk(tree, visit) {
    const kids = children(tree);

    const go = function (id, depth) {
      visit(id, depth);
      (kids[id] || []).forEach(function (child) { go(child, depth + 1); });
    };

    go(tree.entry, 0);
  }

  /* ---------------------------------------------------------- the frontier */

  /**
   * Cytron's algorithm: for each block with more than one predecessor, walk up
   * from each predecessor to the immediate dominator of the block, adding the
   * block to every frontier on the way. The join is where a value stops being
   * the only one that could have arrived, and that is what a phi records.
   */
  function frontiers(tree) {
    const graph = tree.graph;
    const out = {};

    graph.blocks.forEach(function (id) { out[id] = []; });
    graph.blocks.forEach(function (id) {
      const preds = graph.preds[id] || [];

      if (preds.length < 2) return;
      preds.forEach(function (pred) { climb(tree, out, pred, id); });
    });
    Object.keys(out).forEach(function (id) {
      out[id] = Array.from(new Set(out[id])).sort();
    });
    return out;
  }

  function climb(tree, out, from, join) {
    let here = from;

    while (here && here !== tree.idom[join] && here !== undefined) {
      if (!out[here]) out[here] = [];
      out[here].push(join);
      if (here === tree.entry) break;
      here = tree.idom[here];
    }
  }

  /** The frontier of a SET of blocks, iterated to a fixpoint — phi placement. */
  function iteratedFrontier(tree, blocks) {
    const front = frontiers(tree);
    const result = new Set();
    const stack = blocks.slice();

    while (stack.length) {
      const id = stack.pop();

      (front[id] || []).forEach(function (join) {
        if (result.has(join)) return;
        result.add(join);
        stack.push(join);
      });
    }
    return Array.from(result).sort();
  }

  /* -------------------------------------------------------- post-dominance */

  /**
   * Post-dominance is dominance on the reversed graph: B post-dominates A when
   * every path from A to an exit goes through B. It answers "will this
   * definitely run", which is the safety condition for speculating a
   * computation — and 29.7's LICM is exactly that question about a loop exit.
   *
   * A function with several `ret` blocks has several exits, so a virtual exit
   * is added with an edge from each; without it the reversed graph has no
   * single entry and the algorithm has nothing to start from.
   */
  function postDominators(graph) {
    const exits = graph.blocks.filter(function (id) {
      return (graph.succs[id] || []).length === 0;
    });
    const reversed = reverseGraph(graph, exits);

    return compute(reversed);
  }

  function reverseGraph(graph, exits) {
    const succs = {};
    const preds = {};
    const blocks = graph.blocks.concat(['exit']);

    blocks.forEach(function (id) { succs[id] = []; preds[id] = []; });
    graph.edges.forEach(function (edge) {
      succs[edge.to].push(edge.from);
      preds[edge.from].push(edge.to);
    });
    exits.forEach(function (id) { succs.exit.push(id); preds[id].push('exit'); });
    return { entry: 'exit', blocks: blocks, succs: succs, preds: preds,
      edges: edgesFrom(succs) };
  }

  function edgesFrom(succs) {
    const edges = [];

    Object.keys(succs).forEach(function (from) {
      succs[from].forEach(function (to) { edges.push({ from: from, to: to }); });
    });
    return edges;
  }

  /* --------------------------------------------------------- the oracle */

  /**
   * A brute-force dominance check by path enumeration, used to validate the
   * iterative result on randomised graphs. It is exponential and is only ever
   * run on small graphs, which is exactly what an oracle is for: the fast
   * algorithm is the one that can be subtly wrong.
   */
  function bruteForce(graph) {
    const result = {};

    graph.blocks.forEach(function (id) {
      result[id] = graph.blocks.filter(function (candidate) {
        return everyPathThrough(graph, candidate, id);
      }).sort();
    });
    return result;
  }

  function everyPathThrough(graph, candidate, target) {
    if (candidate === target) return true;
    return !reachesAvoiding(graph, graph.entry, target, candidate);
  }

  function reachesAvoiding(graph, from, target, avoid) {
    const seen = new Set();
    const stack = [from];

    while (stack.length) {
      const id = stack.pop();

      if (id === avoid || seen.has(id)) continue;
      if (id === target) return true;
      seen.add(id);
      (graph.succs[id] || []).forEach(function (next) { stack.push(next); });
    }
    return false;
  }

  /** The dominator sets the iterative result implies, for comparison. */
  function setsFrom(tree) {
    const out = {};

    tree.graph.blocks.forEach(function (id) {
      out[id] = tree.graph.blocks.filter(function (candidate) {
        return dominates(tree, candidate, id);
      }).sort();
    });
    return out;
  }

  return {
    compute: compute, reversePostorder: reversePostorder,
    immediate: immediate, dominates: dominates, strictlyDominates: strictlyDominates,
    dominated: dominated, children: children, walk: walk,
    frontiers: frontiers, iteratedFrontier: iteratedFrontier,
    postDominators: postDominators,
    bruteForce: bruteForce, setsFrom: setsFrom
  };
}));
