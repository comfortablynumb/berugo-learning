/**
 * Shortest paths: BFS, 0-1 BFS, Dijkstra, Bellman-Ford, SPFA,
 * Floyd-Warshall and Johnson.
 *
 * The claim this module exists to make concrete: **Dijkstra with a negative
 * edge does not error.** It returns a plausible wrong distance, because its
 * invariant - once a vertex is settled its distance is final - is false the
 * moment an edge can reduce a path after the fact. `negativeExample()` is a
 * four-vertex graph where Dijkstra and Bellman-Ford disagree, and the
 * disagreement is a *reported field* rather than an exception, because that
 * is exactly how it behaves in production: refunds, rebates and deltas are
 * negative weights, and the wrong number looks like a right one.
 *
 * Building that counter-example took more care than expected, and the reason
 * is worth recording. A lazy Dijkstra updates the distance array even for a
 * settled vertex, so an instance where the negative edge merely lowers a
 * settled vertex's own distance comes out right by accident. The error has to
 * *propagate* past the settled vertex, and the tell is that the vertex the
 * negative edge points at ends up correct while its successor does not.
 *
 * Every path returned is checked by `pathCost`, which re-walks it edge by
 * edge. A distance is a number with nothing to compare it against; a path can
 * be verified against the graph, and a parent array that has been corrupted
 * by a lazy-deletion bug produces a path whose cost is not the reported
 * distance.
 *
 * Negative-cycle *extraction* is the other thing here worth more than
 * detection. "Your graph has a negative cycle" is unactionable; the cycle
 * itself, with its total weight, is the arbitrage opportunity or the broken
 * constraint.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ShortestPaths = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { settled: 0, relaxations: 0, improvements: 0, pushes: 0, pops: 0,
      rounds: 0, staleSkipped: 0, negativeCycle: false };
  }

  /* ------------------------------------------------------ a binary heap */

  /** A lazy heap: no decrease-key, so a vertex may appear several times and
   *  stale entries are skipped on pop. `staleSkipped` reports how many, which
   *  is the number that decides whether an indexed heap is worth the code. */
  function createHeap() {
    const items = [];
    const swap = function (a, b) { const t = items[a]; items[a] = items[b]; items[b] = t; };

    function up(at) {
      let i = at;

      while (i > 0) {
        const parent = (i - 1) >> 1;

        if (items[parent].key <= items[i].key) break;
        swap(parent, i);
        i = parent;
      }
    }

    function down(at) {
      let i = at;

      while (true) {
        const left = 2 * i + 1;
        let best = i;

        if (left < items.length && items[left].key < items[best].key) best = left;

        if (left + 1 < items.length && items[left + 1].key < items[best].key) best = left + 1;

        if (best === i) break;
        swap(best, i);
        i = best;
      }
    }
    return {
      push: function (key, value) { items.push({ key: key, value: value }); up(items.length - 1); },
      pop: function () {
        const top = items[0];
        const last = items.pop();

        if (items.length) { items[0] = last; down(0); }
        return top;
      },
      size: function () { return items.length; }
    };
  }

  /* ------------------------------------------------------------ 0-1 BFS */

  /**
   * A deque instead of a heap, for graphs whose weights are only 0 and 1.
   * A zero edge goes to the front and a one edge to the back, which keeps the
   * deque sorted without any comparisons at all - O(n + m) rather than
   * O(m log n), and it is exact rather than approximate.
   */
  function zeroOneBfs(adjacency, source, options) {
    const report = (options || {}).report || emptyReport();
    const n = adjacency.length;
    const distance = new Array(n).fill(Infinity);
    const parent = new Array(n).fill(-1);
    const deque = [source];

    distance[source] = 0;

    while (deque.length) {
      const node = deque.shift();
      report.settled += 1;

      adjacency[node].forEach(function (edge) {
        report.relaxations += 1;

        if (edge.weight !== 0 && edge.weight !== 1) {
          throw new Error('zero-one-bfs: weight ' + edge.weight + ' is neither 0 nor 1');
        }

        if (distance[node] + edge.weight >= distance[edge.to]) return;
        distance[edge.to] = distance[node] + edge.weight;
        parent[edge.to] = node;
        report.improvements += 1;

        if (edge.weight === 0) deque.unshift(edge.to); else deque.push(edge.to);
      });
    }
    return { distance: distance, parent: parent, report: report };
  }

  /* ----------------------------------------------------------- Dijkstra */

  /**
   * The greedy invariant: the unsettled vertex with the smallest tentative
   * distance is final, because every remaining path to it must leave the
   * settled set through some frontier vertex whose distance is at least as
   * large - and adding a non-negative edge cannot make it smaller.
   *
   * That last clause is the whole thing, and it is exactly what a negative
   * edge breaks.
   */
  function dijkstra(adjacency, source, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const n = adjacency.length;
    const distance = new Array(n).fill(Infinity);
    const parent = new Array(n).fill(-1);
    const settled = new Array(n).fill(false);
    const heap = createHeap();
    const target = settings.target === undefined ? -1 : settings.target;

    distance[source] = 0;
    heap.push(0, source);
    report.pushes += 1;

    while (heap.size()) {
      const top = heap.pop();
      report.pops += 1;

      if (settled[top.value]) { report.staleSkipped += 1; continue; }
      settled[top.value] = true;
      report.settled += 1;

      if (top.value === target) break;
      relaxFrom(adjacency, top.value, { distance: distance, parent: parent, heap: heap,
        report: report });
    }
    return { distance: distance, parent: parent, settled: settled, report: report };
  }

  function relaxFrom(adjacency, node, context) {
    adjacency[node].forEach(function (edge) {
      context.report.relaxations += 1;

      if (context.distance[node] + edge.weight >= context.distance[edge.to]) return;
      context.distance[edge.to] = context.distance[node] + edge.weight;
      context.parent[edge.to] = node;
      context.report.improvements += 1;
      context.heap.push(context.distance[edge.to], edge.to);
      context.report.pushes += 1;
    });
  }

  /* -------------------------------------------------------- Bellman-Ford */

  /**
   * n − 1 rounds of relaxing every edge, with an early exit when a round
   * changes nothing. An n-th round that still improves something proves a
   * negative cycle, and the parent array is where the cycle is extracted from.
   */
  function bellmanFord(edges, n, source, options) {
    const report = (options || {}).report || emptyReport();
    const distance = new Array(n).fill(Infinity);
    const parent = new Array(n).fill(-1);

    distance[source] = 0;

    for (let round = 0; round < n; round += 1) {
      report.rounds += 1;
      let changed = -1;

      edges.forEach(function (edge) {
        report.relaxations += 1;

        if (distance[edge.from] === Infinity) return;

        if (distance[edge.from] + edge.weight >= distance[edge.to]) return;
        distance[edge.to] = distance[edge.from] + edge.weight;
        parent[edge.to] = edge.from;
        report.improvements += 1;
        changed = edge.to;
      });

      if (changed === -1) {
        return { distance: distance, parent: parent, negativeCycle: null, report: report };
      }

      if (round !== n - 1) continue;
      report.negativeCycle = true;
      return { distance: distance, parent: parent,
        negativeCycle: extractNegativeCycle(parent, changed, n), report: report };
    }
    return { distance: distance, parent: parent, negativeCycle: null, report: report };
  }

  /**
   * Walk the parent pointers back n times to land inside the cycle - the
   * vertex that improved on the last round may be downstream of it rather
   * than on it - then walk once more to close the loop.
   */
  function extractNegativeCycle(parent, from, n) {
    let at = from;

    for (let i = 0; i < n; i += 1) at = parent[at];

    if (at === -1) return null;
    const cycle = [];
    let walk = at;

    while (true) {
      cycle.push(walk);
      walk = parent[walk];

      if (walk === at || walk === -1) break;
    }
    return walk === -1 ? null : cycle.reverse();
  }

  /** Does this cycle exist and does it total a negative weight? The check a
   *  caller can make against the graph, rather than trusting the extraction. */
  function verifyNegativeCycle(edges, cycle) {
    if (!cycle || cycle.length === 0) return { valid: false, weight: null };
    let total = 0;

    for (let i = 0; i < cycle.length; i += 1) {
      const from = cycle[i];
      const to = cycle[(i + 1) % cycle.length];
      let best = null;

      edges.forEach(function (edge) {
        if (edge.from !== from || edge.to !== to) return;

        if (best === null || edge.weight < best) best = edge.weight;
      });

      if (best === null) return { valid: false, weight: null, missing: from + '->' + to };
      total += best;
    }
    return { valid: total < 0, weight: total };
  }

  /**
   * SPFA: Bellman-Ford with a queue of vertices whose distance changed. Fast
   * on most graphs and Θ(nm) in the worst case, which is why it is here with
   * its relaxation count reported rather than recommended.
   */
  function spfa(adjacency, source, options) {
    const report = (options || {}).report || emptyReport();
    const n = adjacency.length;
    const distance = new Array(n).fill(Infinity);
    const parent = new Array(n).fill(-1);
    const inQueue = new Array(n).fill(false);
    const enqueued = new Array(n).fill(0);
    const queue = [source];

    distance[source] = 0;
    inQueue[source] = true;

    while (queue.length) {
      const node = queue.shift();
      inQueue[node] = false;
      report.settled += 1;
      const cycle = relaxQueue(adjacency, node, { distance: distance, parent: parent,
        inQueue: inQueue, enqueued: enqueued, queue: queue, n: n, report: report });

      if (cycle) return { distance: distance, parent: parent, negativeCycle: cycle, report: report };
    }
    return { distance: distance, parent: parent, negativeCycle: null, report: report };
  }

  function relaxQueue(adjacency, node, context) {
    let cycle = null;

    adjacency[node].forEach(function (edge) {
      if (cycle) return;
      context.report.relaxations += 1;

      if (context.distance[node] + edge.weight >= context.distance[edge.to]) return;
      context.distance[edge.to] = context.distance[node] + edge.weight;
      context.parent[edge.to] = node;
      context.report.improvements += 1;

      if (context.inQueue[edge.to]) return;
      context.enqueued[edge.to] += 1;

      if (context.enqueued[edge.to] > context.n) {
        context.report.negativeCycle = true;
        cycle = extractNegativeCycle(context.parent, edge.to, context.n);
        return;
      }
      context.inQueue[edge.to] = true;
      context.queue.push(edge.to);
    });
    return cycle;
  }

  /* ----------------------------------------------------- Floyd-Warshall */

  /**
   * All pairs, in a triple loop whose *order matters*. `k` must be outermost,
   * because dist[i][j] through intermediates {0..k} is built from the same
   * quantity at k − 1. Swap the loops and the algorithm computes something
   * that is not the shortest path, silently - `wrongOrder: true` runs the
   * i-outermost version so a section can show the two answers side by side.
   */
  function floydWarshall(matrix, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const n = matrix.length;
    const distance = matrix.map(function (row) { return row.slice(); });
    const next = [];

    for (let i = 0; i < n; i += 1) {
      next.push(new Array(n).fill(-1));

      for (let j = 0; j < n; j += 1) {
        if (i === j || distance[i][j] === Infinity) continue;
        next[i][j] = j;
      }
    }

    if (settings.wrongOrder) runWrongOrder(distance, next, n, report);
    else runFloyd(distance, next, n, report);
    let negative = false;

    for (let i = 0; i < n; i += 1) {
      if (distance[i][i] >= 0) continue;
      negative = true;
    }
    report.negativeCycle = negative;
    return { distance: distance, next: next, negativeCycle: negative, report: report };
  }

  function runFloyd(distance, next, n, report) {
    for (let k = 0; k < n; k += 1) {
      for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
          report.relaxations += 1;

          if (distance[i][k] + distance[k][j] >= distance[i][j]) continue;
          distance[i][j] = distance[i][k] + distance[k][j];
          next[i][j] = next[i][k];
          report.improvements += 1;
        }
      }
    }
  }

  /** The same three loops with i outermost. It terminates, it produces a
   *  matrix, and the matrix is not the shortest-path matrix. */
  function runWrongOrder(distance, next, n, report) {
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        for (let k = 0; k < n; k += 1) {
          report.relaxations += 1;

          if (distance[i][k] + distance[k][j] >= distance[i][j]) continue;
          distance[i][j] = distance[i][k] + distance[k][j];
          next[i][j] = next[i][k];
          report.improvements += 1;
        }
      }
    }
  }

  /** The path Floyd-Warshall's `next` matrix encodes. */
  function floydPath(next, from, to) {
    if (next[from][to] === -1) return null;
    const out = [from];
    let at = from;

    while (at !== to) {
      at = next[at][to];

      if (at === -1) return null;
      out.push(at);
    }
    return out;
  }

  /* -------------------------------------------------------------- Johnson */

  /**
   * All pairs on a sparse graph with negative edges: add a super-source at
   * zero cost to everything, run Bellman-Ford once to get a potential h, and
   * reweight w'(u, v) = w(u, v) + h(u) − h(v). Every reweighted edge is
   * non-negative and every path's cost shifts by the same h(source) − h(target),
   * so Dijkstra from each vertex now gives the right answer.
   */
  function johnson(graph, options) {
    const report = (options || {}).report || emptyReport();
    const n = graph.n;
    const augmented = graph.edges.slice();

    for (let v = 0; v < n; v += 1) augmented.push({ from: n, to: v, weight: 0 });
    const potentials = bellmanFord(augmented, n + 1, n, { report: report });

    if (potentials.negativeCycle) {
      return { distance: null, negativeCycle: potentials.negativeCycle, report: report };
    }
    const h = potentials.distance;
    const reweighted = [];

    for (let v = 0; v < n; v += 1) reweighted.push([]);
    graph.edges.forEach(function (edge, id) {
      const weight = edge.weight + h[edge.from] - h[edge.to];

      if (weight < 0) throw new Error('johnson: reweighting produced a negative edge');
      reweighted[edge.from].push({ to: edge.to, weight: weight, id: id });
    });

    const distance = [];

    for (let source = 0; source < n; source += 1) {
      const run = dijkstra(reweighted, source, { report: report });
      distance.push(run.distance.map(function (d, target) {
        return d === Infinity ? Infinity : d - h[source] + h[target];
      }));
    }
    return { distance: distance, potentials: h, negativeCycle: null, report: report };
  }

  /* ------------------------------------------------------------ checking */

  /** The cost of walking a path edge by edge. Returns null when the path uses
   *  an edge that does not exist, which is what a corrupted parent array
   *  produces. */
  function pathCost(adjacency, path) {
    if (!path || path.length === 0) return null;
    let total = 0;

    for (let i = 1; i < path.length; i += 1) {
      let best = null;

      adjacency[path[i - 1]].forEach(function (edge) {
        if (edge.to !== path[i]) return;

        if (best === null || edge.weight < best) best = edge.weight;
      });

      if (best === null) return null;
      total += best;
    }
    return total;
  }

  function pathTo(parent, source, target) {
    if (source === target) return [source];

    if (parent[target] === -1) return null;
    const out = [];
    let at = target;

    while (at !== -1) { out.push(at); at = parent[at]; }
    out.reverse();
    return out[0] === source ? out : null;
  }

  /**
   * The four-vertex graph where Dijkstra is wrong, and it takes some care to
   * build one that actually is.
   *
   * A lazy Dijkstra updates the distance array even for a settled vertex, so
   * an instance where the negative edge merely lowers a settled vertex's own
   * distance gets the right answer by accident. The error has to *propagate*:
   * vertex 1 is settled at 2 and relaxes 1 -> 3, giving d[3] = 3. Only then is
   * vertex 2 popped, and its -2 edge lowers d[1] to 1 - but 1 is already
   * settled, so its outgoing edge is never relaxed again and d[3] stays at 3.
   *
   * The true distance to 3 is 2. Nothing raises, d[1] is even correct, and
   * only the downstream vertex is wrong.
   */
  function negativeExample() {
    return {
      n: 4,
      directed: true,
      edges: [
        { from: 0, to: 1, weight: 2 },
        { from: 0, to: 2, weight: 3 },
        { from: 2, to: 1, weight: -2 },
        { from: 1, to: 3, weight: 1 }
      ],
      name: 'negative-edge counter-example'
    };
  }

  /** A rate graph transformed by −log, so a negative cycle is an arbitrage. */
  function arbitrageGraph(rates) {
    const edges = [];

    rates.forEach(function (row, from) {
      row.forEach(function (rate, to) {
        if (from === to || !rate) return;
        edges.push({ from: from, to: to, weight: -Math.log(rate), rate: rate });
      });
    });
    return { n: rates.length, edges: edges, directed: true, name: 'arbitrage' };
  }

  /** What a cycle in the rate graph is actually worth: the product of its
   *  rates. Above 1 is a profit, and it is the number that makes the negative
   *  cycle mean something. */
  function cycleProfit(rates, cycle) {
    if (!cycle || cycle.length === 0) return null;
    let product = 1;

    for (let i = 0; i < cycle.length; i += 1) {
      const rate = rates[cycle[i]][cycle[(i + 1) % cycle.length]];

      if (!rate) return null;
      product *= rate;
    }
    return product;
  }

  return {
    emptyReport: emptyReport, createHeap: createHeap,
    zeroOneBfs: zeroOneBfs, dijkstra: dijkstra,
    bellmanFord: bellmanFord, extractNegativeCycle: extractNegativeCycle,
    verifyNegativeCycle: verifyNegativeCycle, spfa: spfa,
    floydWarshall: floydWarshall, floydPath: floydPath, johnson: johnson,
    pathCost: pathCost, pathTo: pathTo,
    negativeExample: negativeExample, arbitrageGraph: arbitrageGraph, cycleProfit: cycleProfit
  };
}));
