/**
 * Minimum-cost flow: successive shortest paths with potentials, and cycle
 * cancelling as the independent second opinion.
 *
 * **The potential is Johnson's reweighting from M13.6, unchanged.** A residual
 * graph has negative arcs by construction - the twin of a cost-c arc costs -c -
 * so Dijkstra is illegal on it. One Bellman-Ford pass produces a potential
 * making every reduced cost non-negative, and after each augmentation the
 * potential is updated by the distances Dijkstra just computed, so Bellman-Ford
 * is needed exactly once. Seeing that turns min-cost flow from a new algorithm
 * into Dijkstra in a loop.
 *
 * Cycle cancelling starts from *any* feasible flow and repeatedly cancels a
 * negative-cost cycle in the residual. It is slower and derived completely
 * differently, which is what makes it worth keeping: two independent routes to
 * the same cost is the only evidence available that either is right.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MinCostFlow = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { augmentations: 0, dijkstraRuns: 0, bellmanFordRuns: 0, relaxations: 0,
      cyclesCancelled: 0, negativeArcsAtStart: 0, pushes: 0 };
  }

  /* ------------------------------------------------------- the residual */

  /** Two arcs per edge, twinned at `arc ^ 1`; the twin carries the negated
   *  cost, which is what makes "undo this routing" cost the right amount. */
  function build(graph) {
    const adjacency = [];

    for (let v = 0; v < graph.n; v += 1) adjacency.push([]);
    const to = [];
    const cap = [];
    const cost = [];

    graph.edges.forEach(function (edge) {
      adjacency[edge.from].push(to.length);
      to.push(edge.to);
      cap.push(edge.capacity);
      cost.push(edge.cost);
      adjacency[edge.to].push(to.length);
      to.push(edge.from);
      cap.push(0);
      cost.push(-edge.cost);
    });
    return { n: graph.n, graph: graph, adjacency: adjacency, to: to, cap: cap,
      cost: cost, initial: cap.slice() };
  }

  function flowOnEdges(network) {
    return network.graph.edges.map(function (edge, id) {
      return { from: edge.from, to: edge.to, capacity: edge.capacity, cost: edge.cost,
        flow: network.initial[2 * id] - network.cap[2 * id] };
    });
  }

  function totalCost(network) {
    return flowOnEdges(network).reduce(function (sum, entry) {
      return sum + entry.flow * entry.cost;
    }, 0);
  }

  /* ------------------------------------------------------- the potential */

  /**
   * One Bellman-Ford over the initial residual, from a virtual source at
   * distance zero everywhere. Needed exactly once, and only when the input
   * itself has a negative cost.
   *
   * It also answers the question that makes the whole problem well posed: a
   * negative-cost CYCLE means there is no minimum, because flow can be routed
   * round it for ever. The caller must refuse rather than loop.
   */
  function initialPotential(network, report) {
    const potential = new Array(network.n).fill(0);

    report.bellmanFordRuns += 1;

    for (let round = 0; round <= network.n; round += 1) {
      let changed = false;

      for (let v = 0; v < network.n; v += 1) {
        network.adjacency[v].forEach(function (arc) {
          report.relaxations += 1;

          if (network.cap[arc] <= 0) return;

          if (potential[v] + network.cost[arc] >= potential[network.to[arc]] - 1e-9) return;
          potential[network.to[arc]] = potential[v] + network.cost[arc];
          changed = true;
        });
      }

      if (!changed) return { potential: potential, negativeCycle: false };
    }
    return { potential: potential, negativeCycle: true };
  }

  /** Dijkstra over reduced costs, which are non-negative by construction. */
  function reducedDijkstra(network, source, potential, report) {
    const distance = new Array(network.n).fill(Infinity);
    const parentArc = new Array(network.n).fill(-1);
    const done = new Array(network.n).fill(false);

    distance[source] = 0;
    report.dijkstraRuns += 1;

    for (;;) {
      let best = -1;

      for (let v = 0; v < network.n; v += 1) {
        if (done[v] || distance[v] === Infinity) continue;

        if (best === -1 || distance[v] < distance[best]) best = v;
      }

      if (best === -1) break;
      done[best] = true;
      network.adjacency[best].forEach(function (arc) {
        report.relaxations += 1;

        if (network.cap[arc] <= 0) return;
        const reduced = network.cost[arc] + potential[best] - potential[network.to[arc]];
        const candidate = distance[best] + reduced;

        if (candidate >= distance[network.to[arc]]) return;
        distance[network.to[arc]] = candidate;
        parentArc[network.to[arc]] = arc;
      });
    }
    return { distance: distance, parentArc: parentArc };
  }

  /* ------------------------------------------- successive shortest paths */

  function augmentAlong(network, parentArc, sink, limit) {
    let bottleneck = limit;
    let at = sink;

    while (parentArc[at] !== -1) {
      bottleneck = Math.min(bottleneck, network.cap[parentArc[at]]);
      at = network.to[parentArc[at] ^ 1];
    }
    at = sink;

    while (parentArc[at] !== -1) {
      const arc = parentArc[at];

      network.cap[arc] -= bottleneck;
      network.cap[arc ^ 1] += bottleneck;
      at = network.to[arc ^ 1];
    }
    return bottleneck;
  }

  /**
   * Augment along the cheapest path each time, until the sink is unreachable
   * or `flowLimit` is met. Each augmentation adds the Dijkstra distances to
   * the potential, which is what keeps the reduced costs non-negative.
   */
  function successiveShortestPaths(graph, source, sink, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const network = build(graph);
    const limit = settings.flowLimit === undefined ? Infinity : settings.flowLimit;

    graph.edges.forEach(function (edge) {
      if (edge.cost >= 0) return;
      report.negativeArcsAtStart += 1;
    });
    const start = report.negativeArcsAtStart > 0
      ? initialPotential(network, report)
      : { potential: new Array(network.n).fill(0), negativeCycle: false };

    if (start.negativeCycle) {
      return { flow: 0, cost: 0, network: network, potential: start.potential,
        refused: 'a negative-cost cycle exists, so there is no minimum', report: report };
    }
    const potential = start.potential;
    let flow = 0;

    while (flow < limit) {
      const run = reducedDijkstra(network, source, potential, report);

      if (run.distance[sink] === Infinity) break;

      for (let v = 0; v < network.n; v += 1) {
        if (run.distance[v] === Infinity) continue;
        potential[v] += run.distance[v];
      }
      const pushed = augmentAlong(network, run.parentArc, sink, limit - flow);

      flow += pushed;
      report.augmentations += 1;
      report.pushes += 1;
    }
    return { flow: flow, cost: totalCost(network), network: network,
      potential: potential, report: report };
  }

  /* ----------------------------------------------------- cycle cancelling */

  function findNegativeCycle(network, report) {
    const distance = new Array(network.n).fill(0);
    const parentArc = new Array(network.n).fill(-1);
    let improved = -1;

    report.bellmanFordRuns += 1;

    for (let round = 0; round < network.n; round += 1) {
      improved = -1;

      for (let v = 0; v < network.n; v += 1) {
        network.adjacency[v].forEach(function (arc) {
          report.relaxations += 1;

          if (network.cap[arc] <= 0) return;

          if (distance[v] + network.cost[arc] >= distance[network.to[arc]] - 1e-9) return;
          distance[network.to[arc]] = distance[v] + network.cost[arc];
          parentArc[network.to[arc]] = arc;
          improved = network.to[arc];
        });
      }

      if (improved === -1) return null;
    }
    return closeCycle(network, parentArc, improved);
  }

  /** n parent steps land inside the cycle; one more walk closes it. */
  function closeCycle(network, parentArc, improved) {
    let at = improved;

    for (let i = 0; i < network.n; i += 1) at = network.to[parentArc[at] ^ 1];
    const arcs = [];
    const seen = new Set();
    let cursor = at;

    while (!seen.has(cursor)) {
      seen.add(cursor);
      arcs.push(parentArc[cursor]);
      cursor = network.to[parentArc[cursor] ^ 1];
    }
    /* `arcs` was collected walking backwards, so the repeat marks the START of
       the cycle and everything before it is the tail leading into it. Slicing
       the other side returns a path with a loop on the end, which cancels
       arcs that are not on any cycle and corrupts the flow. */
    const start = arcs.findIndex(function (arc) { return network.to[arc] === cursor; });
    return arcs.slice(start);
  }

  /**
   * Start from a maximum flow of any cost, then cancel negative-cost cycles in
   * the residual until none is left. Slower than successive shortest paths and
   * derived from a different theorem, which is exactly why it is here.
   */
  function cycleCancelling(graph, source, sink, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const network = build(graph);
    const flow = saturateAnyFlow(network, source, sink, settings);
    const cap = settings.cancelLimit || 20000;

    while (report.cyclesCancelled < cap) {
      const cycle = findNegativeCycle(network, report);

      if (!cycle || cycle.length === 0) break;
      let bottleneck = Infinity;

      cycle.forEach(function (arc) { bottleneck = Math.min(bottleneck, network.cap[arc]); });
      cycle.forEach(function (arc) {
        network.cap[arc] -= bottleneck;
        network.cap[arc ^ 1] += bottleneck;
      });
      report.cyclesCancelled += 1;
    }
    return { flow: flow, cost: totalCost(network), network: network, report: report };
  }

  /** Any feasible flow of the requested value, found by ignoring cost. */
  function saturateAnyFlow(network, source, sink, settings) {
    const limit = settings.flowLimit === undefined ? Infinity : settings.flowLimit;
    let flow = 0;

    while (flow < limit) {
      const parentArc = new Array(network.n).fill(-1);
      const seen = new Array(network.n).fill(false);
      const queue = [source];

      seen[source] = true;

      while (queue.length) {
        const v = queue.shift();

        network.adjacency[v].forEach(function (arc) {
          if (network.cap[arc] <= 0 || seen[network.to[arc]]) return;
          seen[network.to[arc]] = true;
          parentArc[network.to[arc]] = arc;
          queue.push(network.to[arc]);
        });
      }

      if (!seen[sink]) break;
      flow += augmentAlong(network, parentArc, sink, limit - flow);
    }
    return flow;
  }

  /* -------------------------------------------------------- assignment */

  /**
   * A square cost matrix as a flow network: source to every worker at capacity
   * one, every worker to every job at the matrix cost, every job to the sink.
   * A maximum flow of n then *is* a perfect assignment, and the minimum-cost
   * one is the optimal assignment.
   */
  function assignmentNetwork(matrix) {
    const size = matrix.length;
    const source = 2 * size;
    const sink = 2 * size + 1;
    const edges = [];

    for (let worker = 0; worker < size; worker += 1) {
      edges.push({ from: source, to: worker, capacity: 1, cost: 0 });
      edges.push({ from: size + worker, to: sink, capacity: 1, cost: 0 });

      for (let job = 0; job < size; job += 1) {
        edges.push({ from: worker, to: size + job, capacity: 1, cost: matrix[worker][job] });
      }
    }
    return { n: 2 * size + 2, edges: edges, source: source, sink: sink, size: size };
  }

  /** Which job each worker took, read back off the flow. */
  function assignmentFrom(network, size) {
    const chosen = new Array(size).fill(-1);

    flowOnEdges(network).forEach(function (entry) {
      if (entry.flow <= 0 || entry.from >= size || entry.to < size || entry.to >= 2 * size) return;
      chosen[entry.from] = entry.to - size;
    });
    return chosen;
  }

  /* --------------------------------------------------------- invariants */

  /**
   * A flow is minimum-cost for its own value exactly when its residual graph
   * contains no negative-cost cycle.
   *
   * That is the theorem, it is independent of how the flow was found, and -
   * unlike a reduced-cost scan - it does not depend on a potential the
   * algorithm only ever maintained on the vertices it could reach. Checking
   * reduced costs instead reports violations on a perfectly optimal flow,
   * which is a check that fails on correct answers.
   */
  function checkOptimal(network) {
    const cycle = findNegativeCycle(network, emptyReport());
    return { negativeCycle: cycle && cycle.length > 0 ? cycle : null,
      optimal: !cycle || cycle.length === 0 };
  }

  return {
    emptyReport: emptyReport, build: build, flowOnEdges: flowOnEdges, totalCost: totalCost,
    successiveShortestPaths: successiveShortestPaths, cycleCancelling: cycleCancelling,
    assignmentNetwork: assignmentNetwork, assignmentFrom: assignmentFrom,
    checkOptimal: checkOptimal
  };
}));
