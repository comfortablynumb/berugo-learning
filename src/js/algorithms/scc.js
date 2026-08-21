/**
 * Strongly connected components: Tarjan, Kosaraju, and the condensation.
 *
 * Both algorithms are here because they are each other's oracle. They share
 * no code and almost no idea - Kosaraju runs two depth-first passes, one on
 * the graph and one on its reverse; Tarjan runs one pass and maintains a
 * lowlink and a stack - so a bug in one is very unlikely to be present in the
 * other. `agree()` compares them as *partitions* rather than as labellings,
 * because the component ids are arbitrary and only the grouping is the answer.
 *
 * Tarjan is iterative, for the reason every walk in M13 is: a path of a
 * million nodes is one strongly connected component per node and a recursion
 * a million deep. The iterative version is genuinely harder here than
 * elsewhere, because the lowlink update happens *on the way back up* - the
 * frame has to remember which child it was visiting so the parent can absorb
 * that child's lowlink when the child finishes.
 *
 * The condensation is the point of all of it. Collapsing each component to a
 * single node always produces a DAG, and that DAG is what 2-SAT, deadlock
 * detection and module-cycle analysis actually work on.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Scc = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { nodesVisited: 0, edgesExamined: 0, components: 0, maxDepth: 0,
      maxStack: 0, passes: 0 };
  }

  /* ---------------------------------------------------------- Tarjan */

  /**
   * One pass, with `index` (discovery order) and `lowlink` (the smallest
   * index reachable from this subtree, including through one back edge).
   * A vertex whose lowlink equals its own index is the root of a component,
   * and everything above it on the stack belongs to that component.
   */
  function tarjan(adjacency, options) {
    const report = (options || {}).report || emptyReport();
    const n = adjacency.length;
    const state = {
      index: new Array(n).fill(-1),
      lowlink: new Array(n).fill(-1),
      onStack: new Array(n).fill(false),
      stack: [],
      component: new Array(n).fill(-1),
      components: [],
      counter: 0,
      report: report
    };

    for (let source = 0; source < n; source += 1) {
      if (state.index[source] !== -1) continue;
      tarjanFrom(adjacency, source, state);
    }
    report.components = state.components.length;
    return { component: state.component, components: state.components, report: report };
  }

  /**
   * One iterative walk. The frame carries `cursor` so the vertex can be
   * resumed, and `child` so that when control returns to a frame it knows
   * whose lowlink to absorb - which is the step a recursive version gets for
   * free from the return.
   */
  function tarjanFrom(adjacency, source, state) {
    const frames = [{ node: source, cursor: 0, child: -1 }];

    openVertex(source, state);

    while (frames.length) {
      state.report.maxDepth = Math.max(state.report.maxDepth, frames.length);
      const frame = frames[frames.length - 1];

      if (frame.child !== -1) {
        state.lowlink[frame.node] = Math.min(state.lowlink[frame.node], state.lowlink[frame.child]);
        frame.child = -1;
      }

      if (frame.cursor >= adjacency[frame.node].length) {
        closeVertex(frame.node, state);
        frames.pop();
        continue;
      }
      const edge = adjacency[frame.node][frame.cursor];
      frame.cursor += 1;
      state.report.edgesExamined += 1;

      if (state.index[edge.to] === -1) {
        frame.child = edge.to;
        openVertex(edge.to, state);
        frames.push({ node: edge.to, cursor: 0, child: -1 });
        continue;
      }

      if (!state.onStack[edge.to]) continue;
      state.lowlink[frame.node] = Math.min(state.lowlink[frame.node], state.index[edge.to]);
    }
  }

  function openVertex(node, state) {
    state.index[node] = state.counter;
    state.lowlink[node] = state.counter;
    state.counter += 1;
    state.stack.push(node);
    state.onStack[node] = true;
    state.report.nodesVisited += 1;
    state.report.maxStack = Math.max(state.report.maxStack, state.stack.length);
  }

  /** A root pops its whole component off the stack. */
  function closeVertex(node, state) {
    if (state.lowlink[node] !== state.index[node]) return;
    const members = [];

    while (true) {
      const popped = state.stack.pop();
      state.onStack[popped] = false;
      state.component[popped] = state.components.length;
      members.push(popped);

      if (popped === node) break;
    }
    state.components.push(members);
  }

  /* --------------------------------------------------------- Kosaraju */

  /**
   * Two passes: finish times on the graph, then components on its reverse in
   * decreasing finish order. Slower than Tarjan by a constant and far easier
   * to convince yourself of, which is exactly what an oracle needs to be.
   */
  function kosaraju(adjacency, reverseAdjacency, options) {
    const report = (options || {}).report || emptyReport();
    const n = adjacency.length;
    const finished = [];
    const seen = new Array(n).fill(false);

    report.passes = 2;

    for (let source = 0; source < n; source += 1) {
      if (seen[source]) continue;
      pushFinishOrder(adjacency, source, seen, finished, report);
    }

    const component = new Array(n).fill(-1);
    const components = [];

    for (let i = finished.length - 1; i >= 0; i -= 1) {
      const source = finished[i];

      if (component[source] !== -1) continue;
      const members = collect(reverseAdjacency, source, component, components.length, report);
      components.push(members);
    }
    report.components = components.length;
    return { component: component, components: components, report: report };
  }

  function pushFinishOrder(adjacency, source, seen, finished, report) {
    const stack = [{ node: source, cursor: 0 }];

    seen[source] = true;
    report.nodesVisited += 1;

    while (stack.length) {
      report.maxDepth = Math.max(report.maxDepth, stack.length);
      const frame = stack[stack.length - 1];

      if (frame.cursor >= adjacency[frame.node].length) {
        finished.push(frame.node);
        stack.pop();
        continue;
      }
      const edge = adjacency[frame.node][frame.cursor];
      frame.cursor += 1;
      report.edgesExamined += 1;

      if (seen[edge.to]) continue;
      seen[edge.to] = true;
      report.nodesVisited += 1;
      stack.push({ node: edge.to, cursor: 0 });
    }
  }

  function collect(adjacency, source, component, id, report) {
    const members = [];
    const stack = [source];

    component[source] = id;

    while (stack.length) {
      const node = stack.pop();
      members.push(node);
      adjacency[node].forEach(function (edge) {
        report.edgesExamined += 1;

        if (component[edge.to] !== -1) return;
        component[edge.to] = id;
        stack.push(edge.to);
      });
    }
    return members;
  }

  /* ------------------------------------------------------ the condensation */

  /**
   * Collapse each component to one node. The result is always a DAG - that
   * is the theorem, and `verifyAcyclic` checks it rather than assuming it,
   * because a broken SCC computation produces a condensation with a cycle in
   * it and nothing else notices.
   */
  function condensation(adjacency, component, componentCount) {
    const seen = new Set();
    const edges = [];

    adjacency.forEach(function (neighbours, from) {
      neighbours.forEach(function (edge) {
        const a = component[from];
        const b = component[edge.to];

        if (a === b) return;
        const key = a + '>' + b;

        if (seen.has(key)) return;
        seen.add(key);
        edges.push({ from: a, to: b, weight: 1 });
      });
    });
    return { n: componentCount, edges: edges, directed: true, name: 'condensation' };
  }

  /** The theorem, checked. A cycle here means the components were wrong. */
  function verifyAcyclic(condensed) {
    const degree = new Array(condensed.n).fill(0);
    const out = [];

    for (let v = 0; v < condensed.n; v += 1) out.push([]);
    condensed.edges.forEach(function (edge) {
      out[edge.from].push(edge.to);
      degree[edge.to] += 1;
    });
    const ready = [];

    for (let v = 0; v < condensed.n; v += 1) {
      if (degree[v] === 0) ready.push(v);
    }
    let placed = 0;

    while (ready.length) {
      const node = ready.shift();
      placed += 1;
      out[node].forEach(function (to) {
        degree[to] -= 1;

        if (degree[to] !== 0) return;
        ready.push(to);
      });
    }
    return { acyclic: placed === condensed.n, placed: placed };
  }

  /* --------------------------------------------------------- agreement */

  /**
   * Do two labellings describe the same partition? Component ids are
   * arbitrary, so comparing them directly is meaningless; what matters is
   * whether two vertices share a component under one exactly when they share
   * one under the other.
   */
  function agree(left, right) {
    if (left.length !== right.length) return { agree: false, witness: 'different lengths' };
    const map = new Map();
    const back = new Map();

    for (let v = 0; v < left.length; v += 1) {
      const a = left[v];
      const b = right[v];

      if (map.has(a) && map.get(a) !== b) {
        return { agree: false, witness: 'node ' + v + ' splits component ' + a };
      }

      if (back.has(b) && back.get(b) !== a) {
        return { agree: false, witness: 'node ' + v + ' merges component ' + b };
      }
      map.set(a, b);
      back.set(b, a);
    }
    return { agree: true, witness: null };
  }

  /** Component sizes, largest first - the shape of the answer a demo shows. */
  function sizeProfile(components) {
    const sizes = components.map(function (members) { return members.length; })
      .sort(function (a, b) { return b - a; });
    return { count: sizes.length, largest: sizes[0] || 0,
      singletons: sizes.filter(function (s) { return s === 1; }).length, sizes: sizes.slice(0, 10) };
  }

  return {
    emptyReport: emptyReport,
    tarjan: tarjan, kosaraju: kosaraju,
    condensation: condensation, verifyAcyclic: verifyAcyclic,
    agree: agree, sizeProfile: sizeProfile
  };
}));
