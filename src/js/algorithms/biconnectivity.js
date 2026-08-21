/**
 * Bridges, articulation points, biconnected components and the block-cut
 * tree - and the one bug this whole family is famous for.
 *
 * **Track the parent EDGE, not the parent vertex.** A depth-first walk of an
 * undirected graph sees the edge it arrived on a second time, from the other
 * end, and that sighting must be ignored. Ignoring it by asking "is this
 * neighbour my parent?" also ignores every *parallel* edge to the parent -
 * and a parallel edge is exactly what stops the tree edge being a bridge. So
 * the vertex-based version reports a bridge that is not one, on any multigraph,
 * and reports it silently.
 *
 * That is why `bridges()` takes the edge id from the adjacency entry, why the
 * generators in `graph-core.js` include `withParallelEdges`, and why
 * `bridgesByRemoval` exists: removing each edge and recounting components is
 * O(m(n + m)) and unarguable, so it is the oracle every claim here is checked
 * against.
 *
 * The lowlink here is a different quantity from Tarjan's SCC lowlink, and
 * conflating them is the other classic error. For SCCs, lowlink may follow an
 * edge to any vertex still on the stack. Here it may follow only *back* edges
 * - edges to an already-discovered ancestor - because the question is whether
 * the subtree has another way out.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Biconnectivity = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { nodesVisited: 0, edgesExamined: 0, maxDepth: 0, components: 0, blocks: 0 };
  }

  function createState(n, report) {
    return {
      discovery: new Array(n).fill(-1),
      low: new Array(n).fill(-1),
      parentEdge: new Array(n).fill(-1),
      clock: 0,
      bridges: [],
      articulation: new Array(n).fill(false),
      edgeStack: [],
      blocks: [],
      report: report
    };
  }

  /**
   * One iterative walk producing bridges, articulation points and biconnected
   * components together, because all three come from the same lowlink and
   * computing them separately means walking three times.
   */
  function analyse(adjacency, options) {
    const report = (options || {}).report || emptyReport();
    const state = createState(adjacency.length, report);

    for (let source = 0; source < adjacency.length; source += 1) {
      if (state.discovery[source] !== -1) continue;
      report.components += 1;
      walk(adjacency, source, state);
    }
    report.blocks = state.blocks.length;
    const cuts = [];

    state.articulation.forEach(function (flag, v) { if (flag) cuts.push(v); });
    return { bridges: state.bridges, articulation: cuts, blocks: state.blocks,
      discovery: state.discovery, low: state.low, report: report };
  }

  /** The frame carries `child` so the parent can absorb the child's lowlink
   *  when control returns - the step a recursive version gets from the call. */
  function walk(adjacency, source, state) {
    const frames = [{ node: source, cursor: 0, child: -1, childEdge: -1, rootChildren: 0 }];

    open(source, state);

    while (frames.length) {
      state.report.maxDepth = Math.max(state.report.maxDepth, frames.length);
      const frame = frames[frames.length - 1];

      if (frame.child !== -1) {
        settleChild(frame, frames, source, state);
        frame.child = -1;
      }

      if (frame.cursor >= adjacency[frame.node].length) {
        closeRoot(frame, source, state);
        frames.pop();
        continue;
      }
      const edge = adjacency[frame.node][frame.cursor];
      frame.cursor += 1;
      state.report.edgesExamined += 1;
      step(frame, frames, edge, state);
    }
  }

  function open(node, state) {
    state.discovery[node] = state.clock;
    state.low[node] = state.clock;
    state.clock += 1;
    state.report.nodesVisited += 1;
  }

  /** One edge from the current frame. */
  function step(frame, frames, edge, state) {
    /* The edge we arrived on, ignored by ID rather than by vertex - which is
       the whole point of this module. A parallel edge to the same parent has
       a different id and is a genuine back edge. */
    if (edge.id === state.parentEdge[frame.node]) return;

    if (state.discovery[edge.to] !== -1) {
      if (state.discovery[edge.to] >= state.discovery[frame.node]) return;
      state.edgeStack.push(edge.id);
      state.low[frame.node] = Math.min(state.low[frame.node], state.discovery[edge.to]);
      return;
    }
    state.parentEdge[edge.to] = edge.id;
    state.edgeStack.push(edge.id);
    frame.child = edge.to;
    frame.childEdge = edge.id;
    frame.stackMark = state.edgeStack.length - 1;

    if (frames.length === 1) frame.rootChildren += 1;
    open(edge.to, state);
    frames.push({ node: edge.to, cursor: 0, child: -1, childEdge: -1, rootChildren: 0 });
  }

  /** Control has returned from a child: absorb its lowlink and decide whether
   *  the connecting edge is a bridge and this vertex a cut vertex. */
  function settleChild(frame, frames, source, state) {
    const child = frame.child;
    state.low[frame.node] = Math.min(state.low[frame.node], state.low[child]);

    if (state.low[child] > state.discovery[frame.node]) {
      state.bridges.push({ id: frame.childEdge, from: frame.node, to: child });
    }

    if (state.low[child] >= state.discovery[frame.node]) {
      popBlock(frame, state);

      if (frame.node !== source) state.articulation[frame.node] = true;
    }
  }

  /** The biconnected component sitting above this child on the edge stack. */
  function popBlock(frame, state) {
    const block = state.edgeStack.splice(frame.stackMark);

    if (block.length === 0) return;
    state.blocks.push(block);
  }

  /** A root is a cut vertex exactly when it has more than one DFS child. */
  function closeRoot(frame, source, state) {
    if (frame.node !== source) return;

    if (frame.rootChildren > 1) state.articulation[source] = true;

    if (state.edgeStack.length === 0) return;
    state.blocks.push(state.edgeStack.splice(0));
  }

  /* ------------------------------------------------------- the oracles */

  /**
   * Remove each edge, recount components, and see whether the count went up.
   * O(m(n + m)) and unarguable - which is exactly what an oracle should be,
   * and why it is only ever run on the small graphs the tests and demos use.
   */
  function bridgesByRemoval(graph) {
    const base = countComponents(graph, -1);
    const out = [];

    graph.edges.forEach(function (edge, id) {
      if (countComponents(graph, id) <= base) return;
      out.push({ id: id, from: edge.from, to: edge.to });
    });
    return out;
  }

  /**
   * Remove each vertex, recount components among the survivors. A vertex is a
   * cut vertex when removing it disconnects something that was connected.
   */
  function articulationByRemoval(graph) {
    const base = countComponents(graph, -1);
    const out = [];

    for (let v = 0; v < graph.n; v += 1) {
      const remaining = countComponentsWithout(graph, v);
      const expected = base - (isIsolated(graph, v) ? 1 : 0);

      if (remaining <= expected) continue;
      out.push(v);
    }
    return out;
  }

  function isIsolated(graph, vertex) {
    return !graph.edges.some(function (edge) {
      return edge.from === vertex || edge.to === vertex;
    });
  }

  function countComponents(graph, skipEdgeId) {
    const adjacency = [];

    for (let v = 0; v < graph.n; v += 1) adjacency.push([]);
    graph.edges.forEach(function (edge, id) {
      if (id === skipEdgeId) return;
      adjacency[edge.from].push(edge.to);
      adjacency[edge.to].push(edge.from);
    });
    return sweep(adjacency, graph.n, -1);
  }

  function countComponentsWithout(graph, vertex) {
    const adjacency = [];

    for (let v = 0; v < graph.n; v += 1) adjacency.push([]);
    graph.edges.forEach(function (edge) {
      if (edge.from === vertex || edge.to === vertex) return;
      adjacency[edge.from].push(edge.to);
      adjacency[edge.to].push(edge.from);
    });
    return sweep(adjacency, graph.n, vertex);
  }

  function sweep(adjacency, n, skipVertex) {
    const seen = new Array(n).fill(false);
    let count = 0;

    for (let source = 0; source < n; source += 1) {
      if (source === skipVertex || seen[source]) continue;
      count += 1;
      const stack = [source];
      seen[source] = true;

      while (stack.length) {
        const node = stack.pop();
        adjacency[node].forEach(function (to) {
          if (seen[to]) return;
          seen[to] = true;
          stack.push(to);
        });
      }
    }
    return count;
  }

  /* ---------------------------------------------------- the block-cut tree */

  /**
   * A tree whose nodes are the biconnected blocks and the cut vertices, with
   * an edge whenever a cut vertex belongs to a block. It is the structure
   * that answers "what breaks if this router dies", and it is always a tree -
   * `verifyTree` checks that rather than assuming it.
   */
  function blockCutTree(graph, analysis) {
    const cuts = new Set(analysis.articulation);
    const cutIndex = new Map();
    const nodes = [];

    analysis.blocks.forEach(function (block, i) {
      nodes.push({ kind: 'block', id: i, size: block.length });
    });
    cuts.forEach(function (vertex) {
      cutIndex.set(vertex, nodes.length);
      nodes.push({ kind: 'cut', vertex: vertex });
    });

    const edges = [];
    const seen = new Set();

    analysis.blocks.forEach(function (block, i) {
      block.forEach(function (edgeId) {
        [graph.edges[edgeId].from, graph.edges[edgeId].to].forEach(function (vertex) {
          if (!cuts.has(vertex)) return;
          const key = i + '-' + vertex;

          if (seen.has(key)) return;
          seen.add(key);
          edges.push({ from: i, to: cutIndex.get(vertex) });
        });
      });
    });
    return { nodes: nodes, edges: edges, blocks: analysis.blocks.length, cuts: cuts.size };
  }

  /** A forest has exactly nodes − components edges. Anything else means the
   *  blocks were not blocks. */
  function verifyTree(tree) {
    const adjacency = [];

    for (let v = 0; v < tree.nodes.length; v += 1) adjacency.push([]);
    tree.edges.forEach(function (edge) {
      adjacency[edge.from].push(edge.to);
      adjacency[edge.to].push(edge.from);
    });
    const components = sweep(adjacency, tree.nodes.length, -1);
    return { isForest: tree.edges.length === tree.nodes.length - components,
      nodes: tree.nodes.length, edges: tree.edges.length, components: components };
  }

  /** Do two bridge lists name the same edges? Order is not meaningful. */
  function sameEdges(left, right) {
    const a = new Set(left.map(function (edge) { return edge.id; }));
    const b = new Set(right.map(function (edge) { return edge.id; }));

    if (a.size !== b.size) return { same: false, only: [...a].filter(function (id) { return !b.has(id); }) };
    const missing = [...a].filter(function (id) { return !b.has(id); });
    return { same: missing.length === 0, only: missing };
  }

  return {
    emptyReport: emptyReport,
    analyse: analyse,
    bridgesByRemoval: bridgesByRemoval, articulationByRemoval: articulationByRemoval,
    blockCutTree: blockCutTree, verifyTree: verifyTree, sameEdges: sameEdges
  };
}));
