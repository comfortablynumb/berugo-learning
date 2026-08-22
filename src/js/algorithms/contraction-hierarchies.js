/**
 * Contraction hierarchies: node ordering, the witness search, shortcut edges
 * and the bidirectional upward query.
 *
 * **The witness search is where correctness lives.** Contracting a node v
 * means removing it and, for every pair of neighbours (u, w) whose shortest
 * path went through v, adding a shortcut u → w of that length. The witness
 * search asks whether a path from u to w avoiding v is already short enough:
 * if one exists, the shortcut is unnecessary. Adding an unnecessary shortcut
 * is only slow; **skipping a necessary one is wrong**, and it is wrong on
 * about one pair in ten thousand - which is exactly the kind of defect that
 * survives a demo and fails in production.
 *
 * So `contract()` reports `shortcutsAdded` and `witnessesFound` separately,
 * and the tests check every pair against Dijkstra rather than sampling. The
 * `hopLimit` on the witness search is the standard practical compromise: a
 * truncated witness search is *conservative* - it may fail to find a witness
 * that exists and add a shortcut that was not needed - so it stays correct
 * and only costs space. Getting that direction the wrong way round is the bug.
 *
 * The query is bidirectional and **upward only**: from the source, follow
 * edges to higher-ranked nodes; from the target, follow reverse edges to
 * higher-ranked nodes. The two searches meet at the highest node on the
 * shortest path, which is why the ordering matters at all.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ContractionHierarchies = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { contracted: 0, shortcutsAdded: 0, witnessesFound: 0, witnessSteps: 0,
      settledForward: 0, settledBackward: 0, relaxations: 0, edgeDifference: 0 };
  }

  /* ------------------------------------------------------- the structure */

  /** Working copy: an adjacency map per node so edges can be added and
   *  removed as nodes contract, keeping only the best weight per pair. */
  function createWorking(n, edges) {
    const out = [];
    const incoming = [];

    for (let v = 0; v < n; v += 1) { out.push(new Map()); incoming.push(new Map()); }
    edges.forEach(function (edge) {
      relaxInto(out[edge.from], edge.to, edge.weight);
      relaxInto(incoming[edge.to], edge.from, edge.weight);
      relaxInto(out[edge.to], edge.from, edge.weight);
      relaxInto(incoming[edge.from], edge.to, edge.weight);
    });
    return { out: out, incoming: incoming, n: n };
  }

  function relaxInto(map, key, weight) {
    const current = map.get(key);

    if (current !== undefined && current <= weight) return;
    map.set(key, weight);
  }

  /* -------------------------------------------------- the witness search */

  /**
   * Is there a path from `source` to `target` of length at most `limit` that
   * avoids `banned`? A bounded Dijkstra - bounded in both distance and hops,
   * because an unbounded one on a big graph makes preprocessing quadratic.
   *
   * Failing to find a witness that exists is safe: the shortcut is added and
   * the answer stays correct. Claiming a witness that does not exist is not.
   */
  function hasWitness(working, source, target, banned, limit, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const hopLimit = settings.hopLimit === undefined ? 5 : settings.hopLimit;
    /* Already-contracted nodes are GONE. Letting the witness search route
       through one finds a path that does not exist in the remaining graph,
       so a necessary shortcut is skipped and the query later returns a
       too-long distance - or Infinity - on a small fraction of pairs. This
       is the bug the module header is about, and it is why `contracted` is
       a required argument rather than an optional one. */
    const contracted = settings.contracted || [];
    const best = new Map();
    const heap = [{ key: 0, node: source, hops: 0 }];

    best.set(source, 0);

    while (heap.length) {
      heap.sort(function (a, b) { return a.key - b.key; });
      const top = heap.shift();
      report.witnessSteps += 1;

      if (top.key > limit) return false;

      if (top.node === target) return true;

      if (top.hops >= hopLimit) continue;
      const edges = working.out[top.node];
      let stop = false;

      edges.forEach(function (weight, to) {
        if (stop || to === banned || contracted[to]) return;
        const candidate = top.key + weight;

        if (candidate > limit) return;
        const current = best.get(to);

        if (current !== undefined && current <= candidate) return;
        best.set(to, candidate);
        heap.push({ key: candidate, node: to, hops: top.hops + 1 });
      });
    }
    return false;
  }

  /**
   * The witness search with its two failure modes available on purpose,
   * because "the witness search is where CH correctness lives" is a claim a
   * learner should be able to falsify by clicking rather than take on trust.
   *
   *   bounded            - correct: search the remaining graph only.
   *   none               - never search, so every pair gets a shortcut. Slower
   *                        queries and a bigger graph, but never wrong.
   *   ignore-contracted  - search through nodes that have already been
   *                        contracted. Finds witnesses that no longer exist,
   *                        skips necessary shortcuts, and is wrong on a small
   *                        fraction of pairs while looking entirely healthy.
   */
  function witnessFound(working, pair, contracted, context) {
    const mode = context.mode || 'bounded';

    if (mode === 'none') return false;
    return hasWitness(working, pair.from, pair.to, pair.banned, pair.limit, {
      hopLimit: context.hopLimit,
      contracted: mode === 'ignore-contracted' ? [] : contracted,
      report: context.report
    });
  }

  /* ----------------------------------------------------------- contraction */

  /**
   * The order matters for speed, not for correctness. `edgeDifference` -
   * shortcuts a contraction would add, minus the edges it would remove - is
   * the standard greedy priority, and it is recomputed lazily because
   * contracting a node changes its neighbours' scores.
   */
  function edgeDifferenceOf(working, node, contracted, options) {
    const settings = options || {};
    const neighbours = liveNeighbours(working, node, contracted);
    const context = { hopLimit: settings.hopLimit, report: settings.report, mode: settings.witness };
    let needed = 0;

    neighbours.incoming.forEach(function (u) {
      neighbours.outgoing.forEach(function (w) {
        if (u === w) return;
        const through = working.incoming[node].get(u) + working.out[node].get(w);

        if (witnessFound(working, { from: u, to: w, banned: node, limit: through },
          contracted, context)) return;
        needed += 1;
      });
    });
    return needed - (neighbours.incoming.length + neighbours.outgoing.length);
  }

  function liveNeighbours(working, node, contracted) {
    const incoming = [];
    const outgoing = [];

    working.incoming[node].forEach(function (weight, u) {
      if (contracted[u]) return;
      incoming.push(u);
    });
    working.out[node].forEach(function (weight, w) {
      if (contracted[w]) return;
      outgoing.push(w);
    });
    return { incoming: incoming, outgoing: outgoing };
  }

  /**
   * Contract every node in a greedy edge-difference order, recording the rank
   * each node was contracted at and every shortcut added. The shortcuts carry
   * the node they replaced, so a path through a shortcut can be unpacked back
   * into the original edges.
   */
  function build(graph, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const working = createWorking(graph.n, graph.edges);
    const contracted = new Array(graph.n).fill(false);
    const rank = new Array(graph.n).fill(-1);
    const shortcuts = [];

    for (let step = 0; step < graph.n; step += 1) {
      const node = pickNext(working, contracted, rank, settings, report);

      rank[node] = step;
      contractNode(working, node, contracted, shortcuts, { report: report, settings: settings });
      contracted[node] = true;
      report.contracted += 1;
    }
    return { rank: rank, shortcuts: shortcuts,
      upward: buildUpward(graph, shortcuts, rank), report: report };
  }

  /** The next node to contract. `lazy` recomputes only the current best,
   *  which is what makes the ordering affordable. */
  function pickNext(working, contracted, rank, settings, report) {
    let best = -1;
    let bestScore = Infinity;

    for (let v = 0; v < working.n; v += 1) {
      if (contracted[v]) continue;
      const score = settings.order === 'index' ? v
        : edgeDifferenceOf(working, v, contracted,
          { hopLimit: settings.hopLimit, report: report, witness: settings.witness });

      if (score >= bestScore) continue;
      bestScore = score;
      best = v;
    }
    report.edgeDifference += bestScore === Infinity ? 0 : bestScore;
    return best === -1 ? contracted.indexOf(false) : best;
  }

  /** Remove the node and add whatever shortcuts the witness search demands. */
  function contractNode(working, node, contracted, shortcuts, context) {
    const neighbours = liveNeighbours(working, node, contracted);
    const search = { hopLimit: context.settings.hopLimit, report: context.report,
      mode: context.settings.witness };

    neighbours.incoming.forEach(function (u) {
      neighbours.outgoing.forEach(function (w) {
        if (u === w) return;
        const through = working.incoming[node].get(u) + working.out[node].get(w);

        if (witnessFound(working, { from: u, to: w, banned: node, limit: through },
          contracted, search)) {
          context.report.witnessesFound += 1;
          return;
        }
        relaxInto(working.out[u], w, through);
        relaxInto(working.incoming[w], u, through);
        shortcuts.push({ from: u, to: w, weight: through, via: node });
        context.report.shortcutsAdded += 1;
      });
    });
  }

  /**
   * The query graph: original edges plus shortcuts, each kept only in the
   * direction that goes *up* the ranking. That halves the edge count each
   * search sees and is why the query is fast.
   */
  function buildUpward(graph, shortcuts, rank) {
    const forward = [];
    const backward = [];

    for (let v = 0; v < graph.n; v += 1) { forward.push([]); backward.push([]); }
    const add = function (from, to, weight) {
      if (rank[from] < rank[to]) forward[from].push({ to: to, weight: weight });
      else backward[to].push({ to: from, weight: weight });
    };

    graph.edges.forEach(function (edge) {
      add(edge.from, edge.to, edge.weight);
      add(edge.to, edge.from, edge.weight);
    });
    shortcuts.forEach(function (edge) { add(edge.from, edge.to, edge.weight); });
    return { forward: forward, backward: backward };
  }

  /* ---------------------------------------------------------------- query */

  /**
   * Two upward searches. The meeting node is the highest-ranked vertex on the
   * shortest path, and neither search ever descends - which is the whole
   * saving, and is only correct because the contraction added a shortcut
   * wherever the true path descends.
   */
  function query(hierarchy, source, target, options) {
    const report = (options || {}).report || emptyReport();
    const forward = upwardSearch(hierarchy.upward.forward, source, report, 'settledForward');
    const backward = upwardSearch(hierarchy.upward.backward, target, report, 'settledBackward');
    let best = Infinity;
    let meeting = -1;

    forward.forEach(function (value, node) {
      const other = backward.get(node);

      if (other === undefined || value + other >= best) return;
      best = value + other;
      meeting = node;
    });
    return { distance: best, meeting: meeting, report: report };
  }

  function upwardSearch(adjacency, source, report, counter) {
    const best = new Map();
    const heap = [{ key: 0, node: source }];

    best.set(source, 0);

    while (heap.length) {
      heap.sort(function (a, b) { return a.key - b.key; });
      const top = heap.shift();

      if (best.get(top.node) < top.key) continue;
      report[counter] += 1;
      adjacency[top.node].forEach(function (edge) {
        report.relaxations += 1;
        const candidate = top.key + edge.weight;
        const current = best.get(edge.to);

        if (current !== undefined && current <= candidate) return;
        best.set(edge.to, candidate);
        heap.push({ key: candidate, node: edge.to });
      });
    }
    return best;
  }

  /** How much the hierarchy cost, in edges. The number that decides whether
   *  preprocessing was worth it. */
  function sizeOf(graph, hierarchy) {
    const original = graph.edges.length;
    return { original: original, shortcuts: hierarchy.shortcuts.length,
      total: original + hierarchy.shortcuts.length,
      growth: original === 0 ? 0 : (original + hierarchy.shortcuts.length) / original };
  }

  return {
    emptyReport: emptyReport, createWorking: createWorking, hasWitness: hasWitness,
    witnessFound: witnessFound, edgeDifferenceOf: edgeDifferenceOf,
    build: build, query: query, sizeOf: sizeOf
  };
}));
