/**
 * BFS, DFS, edge classification, connected components and bipartiteness.
 *
 * Two decisions here shape everything downstream.
 *
 * **Every DFS is iterative.** A path of 10⁶ nodes is a recursion 10⁶ deep,
 * and paths are legitimate inputs - the M13 generators produce them on
 * purpose. The iterative version is harder to write than the recursive one
 * for exactly one reason: the *finish* time. A recursive DFS gets it from the
 * return; an iterative one has to push a second "leave" record, and that
 * second record is what makes edge classification and Tarjan's algorithm
 * possible without the call stack.
 *
 * **Edges are classified by discovery and finish times, not by colour.** The
 * three-colour scheme (white / grey / black) is enough to separate tree, back
 * and "the other two", and it cannot tell a forward edge from a cross edge -
 * that needs the discovery order. Since the difference matters (a forward
 * edge is a shortcut within a subtree and a cross edge is not), the times are
 * recorded and the classification is derived from them.
 *
 * The edge *id* travels through every walk, because the parallel-edge case in
 * M13.4 needs the parent edge rather than the parent vertex, and adding it
 * later would mean rewriting all of this.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Traversal = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const TRACE_LIMIT = 4000;

  function emptyReport() {
    return { nodesVisited: 0, edgesExamined: 0, maxFrontier: 0, maxDepth: 0,
      components: 0, traceTruncated: false };
  }

  function record(trace, entry, report) {
    if (trace.length < TRACE_LIMIT) { trace.push(entry); return; }
    report.traceTruncated = true;
  }

  /* ------------------------------------------------------------------ BFS */

  /**
   * Breadth-first search from one or several sources. `distance` is in edges,
   * so on an unweighted graph this *is* the shortest path - which is why
   * M13.5 opens with it rather than with Dijkstra.
   */
  function bfs(adjacency, sources, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const n = adjacency.length;
    const distance = new Array(n).fill(-1);
    const parent = new Array(n).fill(-1);
    const parentEdge = new Array(n).fill(-1);
    const order = [];
    const trace = [];
    const queue = [];
    let head = 0;

    (Array.isArray(sources) ? sources : [sources]).forEach(function (source) {
      if (distance[source] !== -1) return;
      distance[source] = 0;
      queue.push(source);
    });

    while (head < queue.length) {
      const node = queue[head];
      head += 1;
      report.nodesVisited += 1;
      report.maxDepth = Math.max(report.maxDepth, distance[node]);
      report.maxFrontier = Math.max(report.maxFrontier, queue.length - head + 1);
      order.push(node);
      record(trace, { node: node, distance: distance[node], frontier: queue.length - head }, report);

      adjacency[node].forEach(function (edge) {
        report.edgesExamined += 1;

        if (distance[edge.to] !== -1) return;
        distance[edge.to] = distance[node] + 1;
        parent[edge.to] = node;
        parentEdge[edge.to] = edge.id;
        queue.push(edge.to);
      });
    }
    return { distance: distance, parent: parent, parentEdge: parentEdge, order: order,
      trace: trace, report: report };
  }

  /** Walk the parent array back from `target`. Returns null when unreachable,
   *  rather than an empty array that a caller might read as "already there". */
  function pathTo(parent, source, target) {
    if (source === target) return [source];

    if (parent[target] === -1) return null;
    const out = [];
    let at = target;

    while (at !== -1) { out.push(at); at = parent[at]; }
    out.reverse();
    return out[0] === source ? out : null;
  }

  /* ------------------------------------------------------------------ DFS */

  const TREE = 'tree';
  const BACK = 'back';
  const FORWARD = 'forward';
  const CROSS = 'cross';

  /**
   * Iterative depth-first search with discovery and finish times.
   *
   * The stack holds `{ node, cursor, edge }` frames rather than bare nodes,
   * because a frame has to be resumable: a node is left on the stack with its
   * neighbour cursor advanced, and only popped once the cursor runs out - at
   * which point its finish time is taken. That resumability is what replaces
   * the call stack, and it is why this is not simply "push all the
   * neighbours".
   */
  function dfs(adjacency, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const state = createDfsState(adjacency.length, settings);

    (settings.sources || allSources(adjacency.length)).forEach(function (source) {
      if (state.discovery[source] !== -1) return;
      report.components += 1;
      state.roots.push(source);
      walkFrom(adjacency, source, state, report);
    });
    return { discovery: state.discovery, finish: state.finish, parent: state.parent,
      parentEdge: state.parentEdge, order: state.order, finishOrder: state.finishOrder,
      classified: state.classified, roots: state.roots, report: report };
  }

  function allSources(n) {
    const out = [];

    for (let v = 0; v < n; v += 1) out.push(v);
    return out;
  }

  function createDfsState(n, settings) {
    return {
      discovery: new Array(n).fill(-1),
      finish: new Array(n).fill(-1),
      parent: new Array(n).fill(-1),
      parentEdge: new Array(n).fill(-1),
      order: [],
      finishOrder: [],
      classified: [],
      seenEdges: new Set(),
      roots: [],
      clock: 0,
      classify: settings.classify !== false,
      directed: Boolean(settings.directed)
    };
  }

  /** One connected component's walk, with the frame stack doing the work the
   *  call stack would otherwise do. */
  function walkFrom(adjacency, source, state, report) {
    const stack = [{ node: source, cursor: 0 }];

    state.discovery[source] = state.clock;
    state.clock += 1;
    state.order.push(source);
    report.nodesVisited += 1;

    while (stack.length) {
      report.maxDepth = Math.max(report.maxDepth, stack.length);
      const frame = stack[stack.length - 1];
      const neighbours = adjacency[frame.node];

      if (frame.cursor >= neighbours.length) {
        state.finish[frame.node] = state.clock;
        state.clock += 1;
        state.finishOrder.push(frame.node);
        stack.pop();
        continue;
      }
      const edge = neighbours[frame.cursor];
      frame.cursor += 1;
      report.edgesExamined += 1;
      stepEdge(adjacency, stack, frame, edge, state, report);
    }
  }

  /** One edge: either it discovers a new vertex, or it is classified. */
  function stepEdge(adjacency, stack, frame, edge, state, report) {
    if (state.discovery[edge.to] === -1) {
      state.parent[edge.to] = frame.node;
      state.parentEdge[edge.to] = edge.id;
      state.discovery[edge.to] = state.clock;
      state.clock += 1;
      state.order.push(edge.to);
      report.nodesVisited += 1;

      if (state.classify) {
        state.seenEdges.add(edge.id);
        state.classified.push({ from: frame.node, to: edge.to, id: edge.id, kind: TREE });
      }
      stack.push({ node: edge.to, cursor: 0 });
      return;
    }

    if (!state.classify) return;

    /* An undirected walk sees every edge twice, once from each end, and the
       two sightings would be classified differently - back from the
       descendant, forward from the ancestor. There are only two kinds in an
       undirected graph, tree and back, so the second sighting is dropped and
       every non-tree edge is a back edge.
       Dropping it by edge ID rather than by parent VERTEX matters: two
       parallel edges between the same pair are different edges, and one of
       them IS a genuine back edge closing a two-cycle. Skipping by vertex
       loses it, which is the classic bridge-finding bug M13.4 is about. */
    if (!state.directed) {
      if (state.seenEdges.has(edge.id)) return;
      state.seenEdges.add(edge.id);
      state.classified.push({ from: frame.node, to: edge.to, id: edge.id, kind: BACK });
      return;
    }
    state.classified.push({ from: frame.node, to: edge.to, id: edge.id,
      kind: classifyEdge(frame.node, edge.to, state) });
  }

  /**
   * Tree, back, forward or cross - from the times, because colour alone
   * cannot separate the last two.
   */
  function classifyEdge(from, to, state) {
    if (state.finish[to] === -1) return BACK;

    if (state.discovery[to] > state.discovery[from]) return FORWARD;
    return CROSS;
  }

  /** How many of each kind, which is what a demo shows. */
  function classificationCounts(classified) {
    const counts = { tree: 0, back: 0, forward: 0, cross: 0 };

    classified.forEach(function (edge) { counts[edge.kind] += 1; });
    return counts;
  }

  /* ------------------------------------------------------------ components */

  /** Connected components of an undirected graph, by repeated BFS. */
  function components(adjacency, options) {
    const report = (options || {}).report || emptyReport();
    const n = adjacency.length;
    const label = new Array(n).fill(-1);
    const sizes = [];

    for (let source = 0; source < n; source += 1) {
      if (label[source] !== -1) continue;
      const id = sizes.length;
      let size = 0;
      const queue = [source];
      let head = 0;
      label[source] = id;

      while (head < queue.length) {
        const node = queue[head];
        head += 1;
        size += 1;
        report.nodesVisited += 1;
        adjacency[node].forEach(function (edge) {
          report.edgesExamined += 1;

          if (label[edge.to] !== -1) return;
          label[edge.to] = id;
          queue.push(edge.to);
        });
      }
      sizes.push(size);
    }
    report.components = sizes.length;
    return { label: label, sizes: sizes, count: sizes.length, report: report };
  }

  /**
   * Two-colouring. A graph is bipartite exactly when it has no odd cycle, and
   * the witness matters: returning `false` tells a caller nothing, while
   * returning the offending edge and the odd cycle through it tells them
   * which constraint is unsatisfiable.
   */
  function bipartite(adjacency, options) {
    const report = (options || {}).report || emptyReport();
    const n = adjacency.length;
    const colour = new Array(n).fill(-1);
    const parent = new Array(n).fill(-1);

    for (let source = 0; source < n; source += 1) {
      if (colour[source] !== -1) continue;
      colour[source] = 0;
      const queue = [source];
      let head = 0;

      while (head < queue.length) {
        const node = queue[head];
        head += 1;
        report.nodesVisited += 1;
        const conflict = colourNeighbours(adjacency, node, colour, parent, queue, report);

        if (!conflict) continue;
        return { bipartite: false, colour: colour, conflict: conflict,
          oddCycle: oddCycleThrough(parent, conflict.from, conflict.to), report: report };
      }
    }
    return { bipartite: true, colour: colour, conflict: null, oddCycle: null, report: report };
  }

  function colourNeighbours(adjacency, node, colour, parent, queue, report) {
    let conflict = null;

    adjacency[node].forEach(function (edge) {
      if (conflict) return;
      report.edgesExamined += 1;

      if (colour[edge.to] === -1) {
        colour[edge.to] = 1 - colour[node];
        parent[edge.to] = node;
        queue.push(edge.to);
        return;
      }

      if (colour[edge.to] !== colour[node]) return;
      conflict = { from: node, to: edge.to, id: edge.id };
    });
    return conflict;
  }

  /** The odd cycle a same-colour edge closes: walk both endpoints up to their
   *  meeting point and join the two halves through the offending edge. */
  function oddCycleThrough(parent, from, to) {
    const ancestors = new Map();
    let at = from;
    let depth = 0;

    while (at !== -1) { ancestors.set(at, depth); at = parent[at]; depth += 1; }
    const right = [];
    at = to;

    while (at !== -1 && !ancestors.has(at)) { right.push(at); at = parent[at]; }

    if (at === -1) return null;
    const left = [];
    let walk = from;

    while (walk !== at) { left.push(walk); walk = parent[walk]; }
    left.push(at);
    return left.concat(right.reverse());
  }

  return {
    TREE: TREE, BACK: BACK, FORWARD: FORWARD, CROSS: CROSS,
    emptyReport: emptyReport, TRACE_LIMIT: TRACE_LIMIT,
    bfs: bfs, pathTo: pathTo, dfs: dfs, classifyEdge: classifyEdge,
    classificationCounts: classificationCounts,
    components: components, bipartite: bipartite, oddCycleThrough: oddCycleThrough
  };
}));
