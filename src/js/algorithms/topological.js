/**
 * Topological order, cycle extraction, and the DAG algorithms the order
 * unlocks.
 *
 * The design decision this module is built around: **"returns null on a
 * cycle" is a useless error.** A build tool that says "your dependencies are
 * circular" and stops has told you nothing you did not already suspect; one
 * that says "a → b → c → a" has told you where to look. Extracting the cycle
 * costs one parent map and a walk, and every function here that can fail on a
 * cycle returns the cycle rather than a boolean.
 *
 * Two orders are implemented because they are genuinely different objects.
 * Kahn's algorithm peels sources, so it can be made *lexicographically
 * smallest* by taking the minimum available source, and its partial output is
 * meaningful - the nodes it managed to place are exactly the ones not
 * downstream of the cycle. The DFS finish-time order is cheaper and produces
 * one arbitrary valid order, and its failure mode is a back edge rather than
 * a stall.
 *
 * `criticalPath` and `scheduleWith` are here because the reason anybody
 * topologically sorts a build graph is to run it: the longest path is the
 * makespan no number of workers can beat, and the k-worker simulation shows
 * how far from that bound a real schedule lands.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Topological = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { nodesVisited: 0, edgesExamined: 0, placed: 0, maxFrontier: 0, stalled: 0 };
  }

  function indegrees(adjacency) {
    const out = new Array(adjacency.length).fill(0);

    adjacency.forEach(function (edges) {
      edges.forEach(function (edge) { out[edge.to] += 1; });
    });
    return out;
  }

  /* -------------------------------------------------------------- Kahn */

  /**
   * Peel sources until none remain. `lexicographic` swaps the queue for a
   * scan of the smallest available source, which is O(n²) here and is what a
   * heap replaces in production - the point being that "smallest valid order"
   * is a different problem from "a valid order".
   */
  function kahn(adjacency, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const degree = indegrees(adjacency);
    const order = [];
    const ready = [];

    for (let v = 0; v < adjacency.length; v += 1) {
      if (degree[v] === 0) ready.push(v);
    }

    while (ready.length) {
      report.maxFrontier = Math.max(report.maxFrontier, ready.length);
      const node = settings.lexicographic ? takeSmallest(ready) : ready.shift();
      order.push(node);
      report.nodesVisited += 1;
      report.placed += 1;

      adjacency[node].forEach(function (edge) {
        report.edgesExamined += 1;
        degree[edge.to] -= 1;

        if (degree[edge.to] !== 0) return;
        ready.push(edge.to);
      });
    }

    if (order.length === adjacency.length) {
      return { order: order, cycle: null, acyclic: true, report: report };
    }
    report.stalled = adjacency.length - order.length;
    return { order: null, partial: order, acyclic: false,
      cycle: extractCycle(adjacency, degree), report: report };
  }

  function takeSmallest(ready) {
    let best = 0;

    for (let i = 1; i < ready.length; i += 1) {
      if (ready[i] >= ready[best]) continue;
      best = i;
    }
    return ready.splice(best, 1)[0];
  }

  /**
   * The cycle Kahn stalled on. Every remaining vertex has a surviving
   * incoming edge, so walking backwards from any of them must revisit a
   * vertex - and the segment between the two visits is a genuine cycle.
   */
  function extractCycle(adjacency, degree) {
    const incoming = [];

    for (let v = 0; v < adjacency.length; v += 1) incoming.push([]);
    adjacency.forEach(function (edges, from) {
      edges.forEach(function (edge) {
        if (degree[from] <= 0 && degree[edge.to] <= 0) return;
        incoming[edge.to].push(from);
      });
    });
    let start = -1;

    for (let v = 0; v < adjacency.length; v += 1) {
      if (degree[v] <= 0) continue;
      start = v;
      break;
    }

    if (start === -1) return null;
    return walkBackwards(incoming, degree, start);
  }

  function walkBackwards(incoming, degree, start) {
    const seenAt = new Map();
    const walk = [];
    let at = start;

    while (!seenAt.has(at)) {
      seenAt.set(at, walk.length);
      walk.push(at);
      const previous = incoming[at].filter(function (v) { return degree[v] > 0; });

      if (previous.length === 0) return null;
      at = previous[0];
    }
    return walk.slice(seenAt.get(at)).reverse();
  }

  /** Is this list a genuine cycle of the graph? Every consecutive pair, plus
   *  the wrap-around, must be an edge. The check a caller can actually make. */
  function verifyCycle(adjacency, cycle) {
    if (!cycle || cycle.length === 0) return false;
    const has = function (from, to) {
      return adjacency[from].some(function (edge) { return edge.to === to; });
    };

    for (let i = 0; i < cycle.length; i += 1) {
      if (has(cycle[i], cycle[(i + 1) % cycle.length])) continue;
      return false;
    }
    return true;
  }

  /* ------------------------------------------------------ DFS finish order */

  /**
   * Reverse finish order, which is a valid topological order on a DAG. The
   * failure mode is a back edge rather than a stall, and the cycle is read
   * straight off the DFS tree - which is cheaper than Kahn's reconstruction.
   */
  function dfsOrder(adjacency, options) {
    const report = (options || {}).report || emptyReport();
    const n = adjacency.length;
    const state = new Array(n).fill(0);
    const parent = new Array(n).fill(-1);
    const finished = [];
    let cycle = null;

    for (let source = 0; source < n && !cycle; source += 1) {
      if (state[source] !== 0) continue;
      cycle = walkForOrder(adjacency, source, { state: state, parent: parent,
        finished: finished, report: report });
    }

    if (cycle) return { order: null, cycle: cycle, acyclic: false, report: report };
    report.placed = finished.length;
    return { order: finished.reverse(), cycle: null, acyclic: true, report: report };
  }

  /** One iterative DFS component. Returns the cycle if a back edge is found. */
  function walkForOrder(adjacency, source, context) {
    const stack = [{ node: source, cursor: 0 }];

    context.state[source] = 1;
    context.report.nodesVisited += 1;

    while (stack.length) {
      const frame = stack[stack.length - 1];

      if (frame.cursor >= adjacency[frame.node].length) {
        context.state[frame.node] = 2;
        context.finished.push(frame.node);
        stack.pop();
        continue;
      }
      const edge = adjacency[frame.node][frame.cursor];
      frame.cursor += 1;
      context.report.edgesExamined += 1;

      if (context.state[edge.to] === 1) return cycleThrough(context.parent, frame.node, edge.to);

      if (context.state[edge.to] !== 0) continue;
      context.state[edge.to] = 1;
      context.parent[edge.to] = frame.node;
      context.report.nodesVisited += 1;
      stack.push({ node: edge.to, cursor: 0 });
    }
    return null;
  }

  /** The cycle a back edge from `from` to the grey `to` closes. */
  function cycleThrough(parent, from, to) {
    const out = [];
    let at = from;

    while (at !== -1 && at !== to) { out.push(at); at = parent[at]; }
    out.push(to);
    return out.reverse();
  }

  /* ------------------------------------------------------- DAG algorithms */

  /**
   * The longest path in a DAG, which is the critical path of a schedule: the
   * makespan no number of workers can beat. Node durations default to one,
   * so the plain longest path falls out of the same code.
   */
  function criticalPath(adjacency, durations, options) {
    const report = (options || {}).report || emptyReport();
    const sorted = kahn(adjacency, { report: report });

    if (!sorted.acyclic) return { length: null, path: [], cycle: sorted.cycle, report: report };
    const n = adjacency.length;
    const cost = function (v) { return durations ? durations[v] : 1; };
    const finish = new Array(n).fill(0);
    const parent = new Array(n).fill(-1);

    sorted.order.forEach(function (node) {
      finish[node] = Math.max(finish[node], 0) + cost(node);
      adjacency[node].forEach(function (edge) {
        report.edgesExamined += 1;

        if (finish[node] <= finish[edge.to]) return;
        finish[edge.to] = finish[node];
        parent[edge.to] = node;
      });
    });
    let end = 0;

    finish.forEach(function (value, v) { if (value > finish[end]) end = v; });
    const path = [];
    let at = end;

    while (at !== -1) { path.push(at); at = parent[at]; }
    return { length: finish[end], path: path.reverse(), finish: finish, cycle: null, report: report };
  }

  /**
   * A list schedule on k workers: at each instant start every ready task a
   * worker is free for. The makespan is compared against the critical path,
   * and the gap is the thing worth showing - more workers cannot beat the
   * longest chain, however many you buy.
   */
  function scheduleWith(adjacency, workers, durations, options) {
    const report = (options || {}).report || emptyReport();
    const sorted = kahn(adjacency, { report: report });

    if (!sorted.acyclic) return { makespan: null, cycle: sorted.cycle, report: report };
    const n = adjacency.length;
    const cost = function (v) { return durations ? durations[v] : 1; };
    const remaining = indegrees(adjacency);
    const ready = [];

    for (let v = 0; v < n; v += 1) {
      if (remaining[v] === 0) ready.push(v);
    }
    return runSchedule(adjacency, { workers: workers, cost: cost, remaining: remaining,
      ready: ready, n: n, report: report });
  }

  /** The event loop of the list schedule, kept separate so both stay small. */
  function runSchedule(adjacency, context) {
    const running = [];
    let now = 0;
    let done = 0;
    let busiest = 0;

    while (done < context.n) {
      while (running.length < context.workers && context.ready.length) {
        const node = context.ready.shift();
        running.push({ node: node, endsAt: now + context.cost(node) });
      }
      busiest = Math.max(busiest, running.length);

      if (running.length === 0) return { makespan: null, deadlocked: true, report: context.report };
      let next = running[0].endsAt;

      running.forEach(function (task) { next = Math.min(next, task.endsAt); });
      now = next;
      const finished = running.filter(function (task) { return task.endsAt === now; });

      finished.forEach(function (task) {
        done += 1;
        adjacency[task.node].forEach(function (edge) {
          context.remaining[edge.to] -= 1;

          if (context.remaining[edge.to] !== 0) return;
          context.ready.push(edge.to);
        });
      });
      running.splice(0, running.length,
        ...running.filter(function (task) { return task.endsAt > now; }));
    }
    return { makespan: now, deadlocked: false, peakWorkers: busiest, report: context.report };
  }

  /**
   * Shortest paths on a DAG in linear time - no priority queue, because the
   * topological order already settles every vertex before it is relaxed.
   * Negative weights are fine here, which is exactly what Dijkstra cannot do.
   */
  function dagShortestPaths(adjacency, source, options) {
    const report = (options || {}).report || emptyReport();
    const sorted = kahn(adjacency, { report: report });

    if (!sorted.acyclic) return { distance: null, cycle: sorted.cycle, report: report };
    const distance = new Array(adjacency.length).fill(Infinity);
    const parent = new Array(adjacency.length).fill(-1);

    distance[source] = 0;
    sorted.order.forEach(function (node) {
      if (distance[node] === Infinity) return;
      adjacency[node].forEach(function (edge) {
        report.edgesExamined += 1;

        if (distance[node] + edge.weight >= distance[edge.to]) return;
        distance[edge.to] = distance[node] + edge.weight;
        parent[edge.to] = node;
      });
    });
    return { distance: distance, parent: parent, cycle: null, report: report };
  }

  /**
   * How many distinct topological orders a DAG has. Exponential in general -
   * a graph with no edges at all has n! - so the count is capped and reports
   * whether it overflowed rather than returning a rounded double.
   */
  function countOrders(adjacency, options) {
    const settings = options || {};
    const limit = settings.limit || 1e15;
    const n = adjacency.length;

    if (n > 20) return { count: null, exact: false, reason: 'too many nodes to enumerate' };
    const degree = indegrees(adjacency);
    const memo = new Map();
    let overflowed = false;

    function go(mask, remaining) {
      if (mask === (1 << n) - 1) return 1;

      if (memo.has(mask)) return memo.get(mask);
      let total = 0;

      for (let v = 0; v < n; v += 1) {
        if ((mask & (1 << v)) || remaining[v] !== 0) continue;
        adjacency[v].forEach(function (edge) { remaining[edge.to] -= 1; });
        total += go(mask | (1 << v), remaining);
        adjacency[v].forEach(function (edge) { remaining[edge.to] += 1; });

        if (total > limit) overflowed = true;
      }
      memo.set(mask, total);
      return total;
    }
    const count = go(0, degree);
    return { count: count, exact: !overflowed && count <= Number.MAX_SAFE_INTEGER, reason: null };
  }

  return {
    emptyReport: emptyReport, indegrees: indegrees,
    kahn: kahn, extractCycle: extractCycle, verifyCycle: verifyCycle,
    dfsOrder: dfsOrder, cycleThrough: cycleThrough,
    criticalPath: criticalPath, scheduleWith: scheduleWith,
    dagShortestPaths: dagShortestPaths, countOrders: countOrders
  };
}));
