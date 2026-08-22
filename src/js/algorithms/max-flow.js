/**
 * Maximum flow: Ford-Fulkerson, Edmonds-Karp, Dinic, capacity scaling, and the
 * cut extraction that turns a flow value into a set of edges.
 *
 * **The back edge is the algorithm.** Every arc is stored with a twin at
 * `arc ^ 1`, and pushing f along an arc adds f to the twin's capacity. That
 * twin is what lets a later augmenting path route flow *back out* of a vertex
 * an earlier path filled badly - which is why greedy path-filling without
 * residuals is not a worse algorithm but a wrong one. All four algorithms here
 * share the same residual structure and differ only in how they choose the
 * next path.
 *
 * Every run returns counters rather than only a number, because "Dinic is
 * faster than Edmonds-Karp" is a claim about augmenting paths and phases, and
 * on a small network it is often false.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MaxFlow = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { augmentingPaths: 0, phases: 0, arcsExamined: 0, pushes: 0,
      bottleneckSum: 0, longestPath: 0, scalingRounds: 0 };
  }

  /* ------------------------------------------------------- the residual */

  /**
   * Two arcs per edge, twinned at `arc ^ 1`. The reverse arc starts at zero
   * capacity and grows as flow is pushed forward, which is exactly the
   * "undo" the algorithm needs.
   */
  function build(graph) {
    const adjacency = [];

    for (let v = 0; v < graph.n; v += 1) adjacency.push([]);
    const to = [];
    const cap = [];
    const owner = [];

    graph.edges.forEach(function (edge, id) {
      adjacency[edge.from].push(to.length);
      to.push(edge.to);
      cap.push(edge.capacity);
      owner.push(id);
      adjacency[edge.to].push(to.length);
      to.push(edge.from);
      cap.push(0);
      owner.push(id);
    });
    return { n: graph.n, graph: graph, adjacency: adjacency, to: to, cap: cap,
      owner: owner, initial: cap.slice() };
  }

  /** Flow on each original edge: what the forward arc has given away. */
  function flowOnEdges(network) {
    return network.graph.edges.map(function (edge, id) {
      return { from: edge.from, to: edge.to, capacity: edge.capacity,
        flow: network.initial[2 * id] - network.cap[2 * id] };
    });
  }

  /* ------------------------------------------------- augmenting the path */

  function augment(network, parentArc, target, report) {
    let bottleneck = Infinity;
    let at = target;
    let length = 0;

    while (parentArc[at] !== -1) {
      const arc = parentArc[at];

      bottleneck = Math.min(bottleneck, network.cap[arc]);
      at = network.to[arc ^ 1];
      length += 1;
    }
    at = target;

    while (parentArc[at] !== -1) {
      const arc = parentArc[at];

      network.cap[arc] -= bottleneck;
      network.cap[arc ^ 1] += bottleneck;
      report.pushes += 1;
      at = network.to[arc ^ 1];
    }
    report.augmentingPaths += 1;
    report.bottleneckSum += bottleneck;
    report.longestPath = Math.max(report.longestPath, length);
    return bottleneck;
  }

  /* --------------------------------------------------- Ford-Fulkerson */

  /** Any augmenting path, found depth-first. Correct, and its path count
   *  depends on the order the arcs happen to be in. */
  function fordFulkerson(graph, source, sink, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const network = build(graph);
    const limit = settings.pathLimit || 100000;
    let value = 0;

    for (;;) {
      const parentArc = new Array(network.n).fill(-1);
      const seen = new Array(network.n).fill(false);
      const stack = [source];

      seen[source] = true;

      while (stack.length && !seen[sink]) {
        const v = stack.pop();

        network.adjacency[v].forEach(function (arc) {
          report.arcsExamined += 1;

          if (network.cap[arc] <= 0 || seen[network.to[arc]]) return;
          seen[network.to[arc]] = true;
          parentArc[network.to[arc]] = arc;
          stack.push(network.to[arc]);
        });
      }

      if (!seen[sink] || report.augmentingPaths >= limit) break;
      value += augment(network, parentArc, sink, report);
    }
    return { value: value, network: network, report: report };
  }

  /* ----------------------------------------------------- Edmonds-Karp */

  function bfsPath(network, source, sink, report) {
    const parentArc = new Array(network.n).fill(-1);
    const seen = new Array(network.n).fill(false);
    const queue = [source];

    seen[source] = true;

    while (queue.length) {
      const v = queue.shift();

      for (let i = 0; i < network.adjacency[v].length; i += 1) {
        const arc = network.adjacency[v][i];

        report.arcsExamined += 1;

        if (network.cap[arc] <= 0 || seen[network.to[arc]]) continue;
        seen[network.to[arc]] = true;
        parentArc[network.to[arc]] = arc;

        if (network.to[arc] === sink) return parentArc;
        queue.push(network.to[arc]);
      }
    }
    return seen[sink] ? parentArc : null;
  }

  /** Always the *shortest* augmenting path. That single rule is what bounds
   *  the path count at O(VE) independently of the capacities. */
  function edmondsKarp(graph, source, sink, options) {
    const report = (options || {}).report || emptyReport();
    const network = build(graph);
    let value = 0;

    for (;;) {
      const parentArc = bfsPath(network, source, sink, report);

      if (!parentArc) break;
      value += augment(network, parentArc, sink, report);
    }
    return { value: value, network: network, report: report };
  }

  /* ------------------------------------------------------------ Dinic */

  function levelGraph(network, source, sink, report) {
    const level = new Array(network.n).fill(-1);
    const queue = [source];

    level[source] = 0;

    while (queue.length) {
      const v = queue.shift();

      network.adjacency[v].forEach(function (arc) {
        report.arcsExamined += 1;

        if (network.cap[arc] <= 0 || level[network.to[arc]] !== -1) return;
        level[network.to[arc]] = level[v] + 1;
        queue.push(network.to[arc]);
      });
    }
    return level[sink] === -1 ? null : level;
  }

  /**
   * One blocking-flow push, iteratively. `cursor` is the "iter" pointer that
   * makes the whole phase linear: an arc discarded because it leads nowhere is
   * never examined again in this phase.
   */
  function blockingFlow(network, context, limit) {
    const stack = [context.source];
    const arcs = [];

    while (stack.length) {
      const v = stack[stack.length - 1];

      if (v === context.sink) return pushBack(network, stack, arcs, limit, context.report);
      const arc = nextArc(network, context, v);

      if (arc === -1) {
        stack.pop();
        arcs.pop();

        if (stack.length) context.cursor[stack[stack.length - 1]] += 1;
        continue;
      }
      stack.push(network.to[arc]);
      arcs.push(arc);
    }
    return 0;
  }

  function nextArc(network, context, v) {
    while (context.cursor[v] < network.adjacency[v].length) {
      const arc = network.adjacency[v][context.cursor[v]];

      context.report.arcsExamined += 1;

      if (network.cap[arc] > 0 && context.level[network.to[arc]] === context.level[v] + 1) return arc;
      context.cursor[v] += 1;
    }
    return -1;
  }

  /** Push the bottleneck back along the path the stack holds, and rewind the
   *  cursor to the first arc that saturated. */
  function pushBack(network, stack, arcs, limit, report) {
    let bottleneck = limit;

    arcs.forEach(function (arc) { bottleneck = Math.min(bottleneck, network.cap[arc]); });
    arcs.forEach(function (arc) {
      network.cap[arc] -= bottleneck;
      network.cap[arc ^ 1] += bottleneck;
      report.pushes += 1;
    });
    report.augmentingPaths += 1;
    report.bottleneckSum += bottleneck;
    report.longestPath = Math.max(report.longestPath, arcs.length);
    stack.length = 1;
    arcs.length = 0;
    return bottleneck;
  }

  /** Level graph, then a blocking flow, then repeat. The level graph's depth
   *  strictly increases each phase, which is what bounds the phase count. */
  function dinic(graph, source, sink, options) {
    const report = (options || {}).report || emptyReport();
    const network = build(graph);
    let value = 0;

    for (;;) {
      const level = levelGraph(network, source, sink, report);

      if (!level) break;
      report.phases += 1;
      const context = { source: source, sink: sink, level: level, report: report,
        cursor: new Array(network.n).fill(0) };

      for (;;) {
        const pushed = blockingFlow(network, context, Infinity);

        if (pushed === 0) break;
        value += pushed;
      }
    }
    return { value: value, network: network, report: report };
  }

  /* -------------------------------------------------- capacity scaling */

  function scalingBfs(network, source, sink, delta, report) {
    const parentArc = new Array(network.n).fill(-1);
    const seen = new Array(network.n).fill(false);
    const queue = [source];

    seen[source] = true;

    while (queue.length) {
      const v = queue.shift();

      for (let i = 0; i < network.adjacency[v].length; i += 1) {
        const arc = network.adjacency[v][i];

        report.arcsExamined += 1;

        if (network.cap[arc] < delta || seen[network.to[arc]]) continue;
        seen[network.to[arc]] = true;
        parentArc[network.to[arc]] = arc;
        queue.push(network.to[arc]);
      }
    }
    return seen[sink] ? parentArc : null;
  }

  /**
   * Only arcs with at least delta residual capacity are considered, and delta
   * halves each round. Every path found is therefore *fat*, which is what
   * removes the dependence on the capacity magnitudes.
   */
  function capacityScaling(graph, source, sink, options) {
    const report = (options || {}).report || emptyReport();
    const network = build(graph);
    let largest = 1;

    graph.edges.forEach(function (edge) { largest = Math.max(largest, edge.capacity); });
    let delta = Math.pow(2, Math.floor(Math.log2(largest)));
    let value = 0;

    while (delta >= 1) {
      report.scalingRounds += 1;

      for (;;) {
        const parentArc = scalingBfs(network, source, sink, delta, report);

        if (!parentArc) break;
        value += augment(network, parentArc, sink, report);
      }
      delta = Math.floor(delta / 2);
    }
    return { value: value, network: network, report: report };
  }

  /* ------------------------------------------------ the broken variant */

  /**
   * Path filling with no back edge, shipped on purpose.
   *
   * It finds a path, subtracts the bottleneck, and moves on - which is what
   * everybody writes first and is not a slower algorithm but a wrong one.
   * Without the residual twin, an early path that routes flow through the
   * wrong vertex can never be undone, and the run stops below the maximum
   * with nothing to indicate it. The section needs to be able to select it and
   * watch the value fall short.
   */
  function greedyNoResidual(graph, source, sink, options) {
    const report = (options || {}).report || emptyReport();
    const remaining = graph.edges.map(function (edge) { return edge.capacity; });
    const adjacency = [];

    for (let v = 0; v < graph.n; v += 1) adjacency.push([]);
    graph.edges.forEach(function (edge, id) { adjacency[edge.from].push(id); });
    let value = 0;

    for (;;) {
      const path = greedyPath(graph, adjacency, remaining, { source: source, sink: sink,
        report: report });

      if (!path) break;
      let bottleneck = Infinity;

      path.forEach(function (id) { bottleneck = Math.min(bottleneck, remaining[id]); });
      path.forEach(function (id) { remaining[id] -= bottleneck; report.pushes += 1; });
      value += bottleneck;
      report.augmentingPaths += 1;
    }
    return { value: value, remaining: remaining, report: report };
  }

  /** A depth-first walk with real backtracking, marking a vertex when it is
   *  expanded rather than when it is queued - so a path through the middle of
   *  the graph is reachable, which is what the counter-example needs. */
  function greedyPath(graph, adjacency, remaining, context) {
    const seen = new Array(graph.n).fill(false);
    const cursor = new Array(graph.n).fill(0);
    const stack = [context.source];
    const arcs = [];

    seen[context.source] = true;

    while (stack.length) {
      const v = stack[stack.length - 1];

      if (v === context.sink) return arcs.slice();

      if (cursor[v] >= adjacency[v].length) {
        stack.pop();
        arcs.pop();
        continue;
      }
      const id = adjacency[v][cursor[v]];

      cursor[v] += 1;
      context.report.arcsExamined += 1;

      if (remaining[id] <= 0 || seen[graph.edges[id].to]) continue;
      seen[graph.edges[id].to] = true;
      stack.push(graph.edges[id].to);
      arcs.push(id);
    }
    return null;
  }

  /**
   * The textbook instance where path filling without residuals falls short.
   * The middle arc 1 -> 2 is worth one unit, and a search that takes it first
   * strands `big - 1` units on each side with no way to reroute.
   *
   * The edge ORDER matters and is the natural one: a depth-first walk takes
   * 0 -> 1 and then 1 -> 2, which is the bad first path. An instance that only
   * fails under one tie-break is an honest demonstration as long as it says
   * so - and the layered-network table beside it measures how often the same
   * failure happens without any arrangement at all.
   */
  function backEdgeExample(width) {
    const big = width || 1000;
    return { n: 4, source: 0, sink: 3, name: 'back-edge counter-example',
      edges: [
        { from: 0, to: 1, capacity: big },
        { from: 0, to: 2, capacity: big },
        { from: 1, to: 2, capacity: 1 },
        { from: 1, to: 3, capacity: big },
        { from: 2, to: 3, capacity: big }
      ] };
  }

  /* --------------------------------------------------------- the cut */

  /**
   * The min cut is a reachability question in the *final* residual graph, not
   * a search: everything still reachable from the source is on the source
   * side, and every original edge crossing outwards is saturated.
   */
  function minCut(network, source) {
    const seen = new Array(network.n).fill(false);
    const queue = [source];

    seen[source] = true;

    while (queue.length) {
      const v = queue.shift();

      network.adjacency[v].forEach(function (arc) {
        if (network.cap[arc] <= 0 || seen[network.to[arc]]) return;
        seen[network.to[arc]] = true;
        queue.push(network.to[arc]);
      });
    }
    const crossing = [];
    let capacity = 0;

    network.graph.edges.forEach(function (edge, id) {
      if (!seen[edge.from] || seen[edge.to]) return;
      crossing.push({ id: id, from: edge.from, to: edge.to, capacity: edge.capacity });
      capacity += edge.capacity;
    });
    return { side: seen, edges: crossing, capacity: capacity,
      sourceSide: seen.filter(Boolean).length };
  }

  /* --------------------------------------------------- the invariants */

  /**
   * Capacity and conservation, checked at every edge and every vertex. A flow
   * algorithm fails by producing a plausible number, and these two properties
   * are the only thing that separates a flow from an array of integers.
   */
  function checkFlow(network, source, sink) {
    const flows = flowOnEdges(network);
    const balance = new Array(network.n).fill(0);
    let overCapacity = 0;
    let negative = 0;

    flows.forEach(function (entry) {
      if (entry.flow > entry.capacity + 1e-9) overCapacity += 1;

      if (entry.flow < -1e-9) negative += 1;
      balance[entry.from] -= entry.flow;
      balance[entry.to] += entry.flow;
    });
    let violations = 0;

    for (let v = 0; v < network.n; v += 1) {
      if (v === source || v === sink) continue;

      if (Math.abs(balance[v]) < 1e-9) continue;
      violations += 1;
    }
    return { overCapacity: overCapacity, negative: negative, imbalanced: violations,
      value: balance[sink], valid: overCapacity + negative + violations === 0 };
  }

  return {
    emptyReport: emptyReport, build: build, flowOnEdges: flowOnEdges,
    fordFulkerson: fordFulkerson, edmondsKarp: edmondsKarp, dinic: dinic,
    capacityScaling: capacityScaling, greedyNoResidual: greedyNoResidual,
    backEdgeExample: backEdgeExample, minCut: minCut, checkFlow: checkFlow
  };
}));
