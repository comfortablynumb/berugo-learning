/**
 * Push-relabel: preflows, heights, and the two heuristics without which the
 * textbook version is slower than Dinic.
 *
 * The idea is the opposite of augmenting paths. Instead of moving flow along a
 * whole source-to-sink path at once, it floods the source's arcs, leaves
 * *excess* sitting at vertices, and then moves that excess downhill one arc at
 * a time - where "downhill" means a height function with h(u) = h(v) + 1 on
 * the arc being used. Excess that cannot reach the sink drains back to the
 * source when the vertex is lifted above n.
 *
 * **The heuristics are not extras.** `gap` notices that when no vertex sits at
 * height h, every vertex above h is cut off from the sink and can be lifted
 * straight to n + 1; `globalRelabel` periodically recomputes exact heights by
 * a backward breadth-first search. Both are selectable here so the relabel
 * count can be measured rather than asserted.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PushRelabel = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function maxFlow() {
    if (typeof module !== 'undefined' && module.exports) return require('./max-flow.js');
    return scope.MaxFlow;
  }

  function emptyReport() {
    return { pushes: 0, saturating: 0, nonSaturating: 0, relabels: 0, gapLifts: 0,
      globalRelabels: 0, arcsExamined: 0, discharges: 0 };
  }

  /* ------------------------------------------------------- the preflow */

  /** Source at height n, every source arc saturated. Everything downstream is
   *  now holding excess it has to get rid of. */
  function createState(graph, source, options) {
    const network = maxFlow().build(graph);
    const report = options.report || emptyReport();
    const state = { network: network, report: report,
      height: new Array(network.n).fill(0),
      excess: new Array(network.n).fill(0),
      cursor: new Array(network.n).fill(0),
      countAtHeight: new Array(2 * network.n + 1).fill(0) };

    state.height[source] = network.n;
    state.countAtHeight[0] = network.n - 1;
    state.countAtHeight[network.n] = 1;
    network.adjacency[source].forEach(function (arc) {
      const amount = network.cap[arc];

      if (amount <= 0) return;
      network.cap[arc] -= amount;
      network.cap[arc ^ 1] += amount;
      state.excess[network.to[arc]] += amount;
      state.excess[source] -= amount;
      report.pushes += 1;
      report.saturating += 1;
    });
    return state;
  }

  function pushAlong(state, arc, from) {
    const network = state.network;
    const amount = Math.min(state.excess[from], network.cap[arc]);

    network.cap[arc] -= amount;
    network.cap[arc ^ 1] += amount;
    state.excess[from] -= amount;
    state.excess[network.to[arc]] += amount;
    state.report.pushes += 1;

    if (network.cap[arc] === 0) state.report.saturating += 1;
    else state.report.nonSaturating += 1;
    return amount;
  }

  /** Lift a vertex to one above the lowest residual neighbour. */
  function relabel(state, v) {
    const network = state.network;
    let best = Infinity;

    network.adjacency[v].forEach(function (arc) {
      state.report.arcsExamined += 1;

      if (network.cap[arc] <= 0) return;
      best = Math.min(best, state.height[network.to[arc]]);
    });
    const previous = state.height[v];

    state.countAtHeight[previous] -= 1;
    state.height[v] = best === Infinity ? 2 * network.n : best + 1;
    state.countAtHeight[Math.min(state.height[v], 2 * network.n)] += 1;
    state.cursor[v] = 0;
    state.report.relabels += 1;
    return previous;
  }

  /* ------------------------------------------------------ the heuristics */

  /**
   * If no vertex is left at height `gap`, nothing above it can reach the sink
   * any more, so every such vertex is lifted straight past n. Without this the
   * algorithm walks each one up a unit at a time.
   */
  function applyGap(state, gap) {
    if (state.countAtHeight[gap] !== 0) return;
    const n = state.network.n;

    for (let v = 0; v < n; v += 1) {
      if (state.height[v] <= gap || state.height[v] >= n + 1) continue;
      state.countAtHeight[state.height[v]] -= 1;
      state.height[v] = n + 1;
      state.countAtHeight[n + 1] += 1;
      state.report.gapLifts += 1;
    }
  }

  /** Shortest residual distances *to* `roots`, by walking predecessors: the
   *  arc v -> to is followed when its twin to -> v still has capacity. */
  function backwardBfs(state, roots) {
    const network = state.network;
    const distance = new Array(network.n).fill(-1);
    const queue = roots.slice();

    roots.forEach(function (v) { distance[v] = 0; });

    while (queue.length) {
      const v = queue.shift();

      network.adjacency[v].forEach(function (arc) {
        state.report.arcsExamined += 1;

        if (network.cap[arc ^ 1] <= 0 || distance[network.to[arc]] !== -1) return;
        distance[network.to[arc]] = distance[v] + 1;
        queue.push(network.to[arc]);
      });
    }
    return distance;
  }

  /**
   * Exact heights, in three groups, and all three are needed.
   *
   * A vertex that can still reach the SINK gets its exact residual distance to
   * it. A vertex that cannot but can still reach the SOURCE gets n plus its
   * distance to the source - which is what lets its excess drain back, and
   * omitting this group is the bug that leaves flow stranded at vertices while
   * the reported value happens to come out right. Anything in neither group
   * has residual arcs only into that same group, so one common height keeps
   * the labelling valid.
   */
  function globalRelabel(state, source, sink) {
    const network = state.network;
    const toSink = backwardBfs(state, [sink]);
    const toSource = backwardBfs(state, [source]);
    const height = new Array(network.n);

    for (let v = 0; v < network.n; v += 1) {
      if (toSink[v] !== -1) height[v] = toSink[v];
      else if (toSource[v] !== -1) height[v] = network.n + toSource[v];
      else height[v] = 2 * network.n;
    }
    height[source] = network.n;
    height[sink] = 0;
    state.height = height;
    state.cursor = new Array(network.n).fill(0);
    state.countAtHeight = new Array(2 * network.n + 1).fill(0);
    height.forEach(function (h) { state.countAtHeight[Math.min(h, 2 * network.n)] += 1; });
    state.report.globalRelabels += 1;
  }

  /* -------------------------------------------------------- discharging */

  /** Move a vertex's whole excess, lifting it whenever it runs out of
   *  admissible arcs. Returns the vertices that became active. */
  function discharge(state, v, context) {
    const network = state.network;
    const woken = [];

    state.report.discharges += 1;

    while (state.excess[v] > 0) {
      if (state.cursor[v] >= network.adjacency[v].length) {
        const previous = relabel(state, v);

        if (context.gap) applyGap(state, previous);

        if (state.height[v] >= 2 * network.n) break;
        continue;
      }
      const arc = network.adjacency[v][state.cursor[v]];

      state.report.arcsExamined += 1;

      if (network.cap[arc] > 0 && state.height[v] === state.height[network.to[arc]] + 1) {
        const before = state.excess[network.to[arc]];

        pushAlong(state, arc, v);

        if (before === 0) woken.push(network.to[arc]);
        continue;
      }
      state.cursor[v] += 1;
    }
    return woken;
  }

  function activeAfterInit(state, source, sink) {
    const out = [];

    for (let v = 0; v < state.network.n; v += 1) {
      if (v === source || v === sink || state.excess[v] <= 0) continue;
      out.push(v);
    }
    return out;
  }

  /* ------------------------------------------------------------- the run */

  /**
   * `rule` is `fifo` (a queue of active vertices) or `highest` (always
   * discharge the highest active vertex). `gap` and `globalRelabel` switch the
   * two heuristics, which is the only way to measure what they are worth.
   */
  function pushRelabel(graph, source, sink, options) {
    const settings = options || {};
    const state = createState(graph, source, settings);
    const context = { gap: settings.gap !== false, source: source, sink: sink };
    const period = settings.globalRelabel === false ? Infinity : graph.n;
    let active = activeAfterInit(state, source, sink);
    let sinceRelabel = 0;

    while (active.length) {
      const v = settings.rule === 'highest' ? takeHighest(state, active) : active.shift();

      if (v === source || v === sink) continue;
      discharge(state, v, context).forEach(function (w) {
        if (w === source || w === sink) return;
        active.push(w);
      });

      if (state.excess[v] > 0 && state.height[v] < 2 * state.network.n) active.push(v);
      sinceRelabel += 1;

      if (sinceRelabel < period) continue;
      sinceRelabel = 0;
      globalRelabel(state, source, sink);
      active = activeAfterInit(state, source, sink);
    }
    return { value: state.excess[sink], network: state.network, state: state,
      report: state.report };
  }

  function takeHighest(state, active) {
    let best = 0;

    for (let i = 1; i < active.length; i += 1) {
      if (state.height[active[i]] <= state.height[active[best]]) continue;
      best = i;
    }
    const v = active[best];

    active.splice(best, 1);
    return v;
  }

  /* --------------------------------------------------------- invariants */

  /**
   * The height function is valid when h(u) <= h(v) + 1 on every residual arc.
   * That is the property that licenses every push, and a broken relabel breaks
   * it silently rather than loudly.
   */
  function checkHeights(state, source, sink) {
    const network = state.network;
    let violations = 0;
    let stillActive = 0;

    for (let v = 0; v < network.n; v += 1) {
      if (v !== source && v !== sink && state.excess[v] > 0) stillActive += 1;

      /* h(s) = n is a boundary condition rather than a constraint, so arcs
         out of the source are excluded exactly as the standard formulation
         excludes them. */
      if (v === source) continue;
      network.adjacency[v].forEach(function (arc) {
        if (network.cap[arc] <= 0) return;

        if (state.height[v] <= state.height[network.to[arc]] + 1) return;
        violations += 1;
      });
    }
    return { violations: violations, stillActive: stillActive,
      valid: violations === 0 && stillActive === 0 };
  }

  return {
    emptyReport: emptyReport, createState: createState, discharge: discharge,
    globalRelabel: globalRelabel, pushRelabel: pushRelabel, checkHeights: checkHeights
  };
}));
