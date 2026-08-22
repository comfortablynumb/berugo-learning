/**
 * Bipartite matching: Kuhn's augmenting paths, Hopcroft-Karp's phases,
 * Koenig's vertex cover, Hall's condition, and Gale-Shapley - which answers a
 * different question and is constantly mistaken for this one.
 *
 * Kuhn and Hopcroft-Karp both find a *maximum* matching and must agree on its
 * size on every input; they differ only in how many augmenting paths they find
 * per pass, and the phase count is the claim worth measuring rather than
 * quoting. Gale-Shapley finds a *stable* matching, which is a different
 * optimum entirely: it is perfect by construction on complete preferences, it
 * is not maximum-weight, and it is optimal for the proposing side and
 * pessimal for the other. Every "matching platform" design argument turns on
 * those two sentences.
 *
 * A graph here is `{ left, right, edges: [{ from, to }] }` where `from` indexes
 * the left side and `to` the right.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Matching = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { augmentingPaths: 0, phases: 0, edgesExamined: 0, dfsCalls: 0,
      proposals: 0, rejections: 0, longestPath: 0 };
  }

  function adjacencyOf(graph) {
    const out = [];

    for (let v = 0; v < graph.left; v += 1) out.push([]);
    graph.edges.forEach(function (edge) { out[edge.from].push(edge.to); });
    return out;
  }

  /* ------------------------------------------------------------- Kuhn */

  /**
   * One augmenting path at a time, found depth-first. `seen` is reset per
   * left vertex, which is what keeps each search linear and the whole thing
   * O(VE).
   */
  function kuhn(graph, options) {
    const report = (options || {}).report || emptyReport();
    const adjacency = adjacencyOf(graph);
    const matchLeft = new Array(graph.left).fill(-1);
    const matchRight = new Array(graph.right).fill(-1);

    for (let v = 0; v < graph.left; v += 1) {
      const seen = new Array(graph.right).fill(false);

      if (!tryKuhn(adjacency, v, { seen: seen, matchLeft: matchLeft,
        matchRight: matchRight, report: report })) continue;
      report.augmentingPaths += 1;
    }
    return { matchLeft: matchLeft, matchRight: matchRight,
      size: matchLeft.filter(function (r) { return r !== -1; }).length, report: report };
  }

  function tryKuhn(adjacency, v, state) {
    state.report.dfsCalls += 1;

    for (let i = 0; i < adjacency[v].length; i += 1) {
      const r = adjacency[v][i];

      state.report.edgesExamined += 1;

      if (state.seen[r]) continue;
      state.seen[r] = true;

      if (state.matchRight[r] === -1 || tryKuhn(adjacency, state.matchRight[r], state)) {
        state.matchRight[r] = v;
        state.matchLeft[v] = r;
        return true;
      }
    }
    return false;
  }

  /* ----------------------------------------------------- Hopcroft-Karp */

  /** Layer the free left vertices by breadth-first search over alternating
   *  edges. The layer depth is the shortest augmenting-path length, and it
   *  strictly increases every phase - which is the sqrt(V) argument. */
  function hopcroftKarpLayers(adjacency, state) {
    const distance = new Array(state.matchLeft.length).fill(Infinity);
    const queue = [];

    for (let v = 0; v < state.matchLeft.length; v += 1) {
      if (state.matchLeft[v] !== -1) continue;
      distance[v] = 0;
      queue.push(v);
    }
    let found = Infinity;

    while (queue.length) {
      const v = queue.shift();

      if (distance[v] >= found) continue;
      adjacency[v].forEach(function (r) {
        state.report.edgesExamined += 1;
        const next = state.matchRight[r];

        if (next === -1) { found = Math.min(found, distance[v] + 1); return; }

        if (distance[next] !== Infinity) return;
        distance[next] = distance[v] + 1;
        queue.push(next);
      });
    }
    return { distance: distance, shortest: found };
  }

  function hopcroftKarpDfs(adjacency, v, state) {
    state.report.dfsCalls += 1;

    for (let i = 0; i < adjacency[v].length; i += 1) {
      const r = adjacency[v][i];

      state.report.edgesExamined += 1;
      const next = state.matchRight[r];

      if (next !== -1 && state.distance[next] !== state.distance[v] + 1) continue;

      if (next === -1 || hopcroftKarpDfs(adjacency, next, state)) {
        state.matchRight[r] = v;
        state.matchLeft[v] = r;
        return true;
      }
    }
    state.distance[v] = Infinity;
    return false;
  }

  /**
   * Each phase finds a maximal set of *vertex-disjoint* shortest augmenting
   * paths at once, so the number of phases is O(sqrt(V)) rather than O(V).
   * The phase count is reported because that is the entire difference from
   * Kuhn, and on a small graph it is often no difference at all.
   */
  function hopcroftKarp(graph, options) {
    const report = (options || {}).report || emptyReport();
    const adjacency = adjacencyOf(graph);
    const state = { matchLeft: new Array(graph.left).fill(-1),
      matchRight: new Array(graph.right).fill(-1), report: report };

    for (;;) {
      const layers = hopcroftKarpLayers(adjacency, state);

      if (layers.shortest === Infinity) break;
      report.phases += 1;
      report.longestPath = Math.max(report.longestPath, layers.shortest);
      state.distance = layers.distance;

      for (let v = 0; v < graph.left; v += 1) {
        if (state.matchLeft[v] !== -1) continue;

        if (!hopcroftKarpDfs(adjacency, v, state)) continue;
        report.augmentingPaths += 1;
      }
    }
    return { matchLeft: state.matchLeft, matchRight: state.matchRight,
      size: state.matchLeft.filter(function (r) { return r !== -1; }).length, report: report };
  }

  /* ------------------------------------------------------------ Koenig */

  /**
   * Koenig's theorem: in a bipartite graph the maximum matching and the
   * minimum vertex cover have the same size, and the cover is constructible.
   * Start from the unmatched left vertices, alternate, then take the left
   * vertices NOT reached plus the right vertices that were.
   */
  function vertexCover(graph, matching) {
    const adjacency = adjacencyOf(graph);
    const leftSeen = new Array(graph.left).fill(false);
    const rightSeen = new Array(graph.right).fill(false);
    const queue = [];

    for (let v = 0; v < graph.left; v += 1) {
      if (matching.matchLeft[v] !== -1) continue;
      leftSeen[v] = true;
      queue.push(v);
    }

    while (queue.length) {
      const v = queue.shift();

      adjacency[v].forEach(function (r) {
        if (rightSeen[r] || matching.matchLeft[v] === r) return;
        rightSeen[r] = true;
        const next = matching.matchRight[r];

        if (next === -1 || leftSeen[next]) return;
        leftSeen[next] = true;
        queue.push(next);
      });
    }
    const cover = { left: [], right: [] };

    for (let v = 0; v < graph.left; v += 1) {
      if (leftSeen[v]) continue;
      cover.left.push(v);
    }

    for (let r = 0; r < graph.right; r += 1) {
      if (!rightSeen[r]) continue;
      cover.right.push(r);
    }
    cover.size = cover.left.length + cover.right.length;
    return cover;
  }

  /** Does the cover actually cover every edge? Koenig's equality is easy to
   *  quote and easy to get wrong by one vertex. */
  function checkCover(graph, cover) {
    const left = new Set(cover.left);
    const right = new Set(cover.right);
    let uncovered = 0;

    graph.edges.forEach(function (edge) {
      if (left.has(edge.from) || right.has(edge.to)) return;
      uncovered += 1;
    });
    return { uncovered: uncovered, valid: uncovered === 0 };
  }

  /* -------------------------------------------------------------- Hall */

  /**
   * Hall's condition fails exactly when some set S of left vertices has fewer
   * than |S| neighbours, and the witness is far more useful than the boolean.
   * The left vertices an alternating search reaches from an unmatched one form
   * such a set: every right vertex it touches is already matched back into the
   * set, so the neighbourhood is one short.
   */
  function hallViolator(graph, matching) {
    const adjacency = adjacencyOf(graph);
    const start = matching.matchLeft.indexOf(-1);

    if (start === -1) return null;
    const leftSeen = new Array(graph.left).fill(false);
    const rightSeen = new Array(graph.right).fill(false);
    const queue = [start];

    leftSeen[start] = true;

    while (queue.length) {
      const v = queue.shift();

      adjacency[v].forEach(function (r) {
        if (rightSeen[r]) return;
        rightSeen[r] = true;
        const next = matching.matchRight[r];

        if (next === -1 || leftSeen[next]) return;
        leftSeen[next] = true;
        queue.push(next);
      });
    }
    const set = [];
    const neighbours = [];

    leftSeen.forEach(function (flag, v) { if (flag) set.push(v); });
    rightSeen.forEach(function (flag, r) { if (flag) neighbours.push(r); });
    return { set: set, neighbours: neighbours, violates: neighbours.length < set.length };
  }

  /* ------------------------------------------------------ Gale-Shapley */

  /**
   * Proposals from the left, each in preference order; the right side holds
   * the best offer so far and rejects the rest. Terminates because a proposer
   * never repeats a proposal, and the result is stable, perfect, and
   * proposer-optimal - three different properties that are constantly
   * conflated with "maximum".
   */
  function galeShapley(leftPreferences, rightPreferences, options) {
    const report = (options || {}).report || emptyReport();
    const size = leftPreferences.length;
    const rank = rightPreferences.map(function (order) {
      const table = new Array(size).fill(size);

      order.forEach(function (who, position) { table[who] = position; });
      return table;
    });
    const next = new Array(size).fill(0);
    const matchLeft = new Array(size).fill(-1);
    const matchRight = new Array(rightPreferences.length).fill(-1);
    const free = [];

    for (let v = 0; v < size; v += 1) free.push(v);

    while (free.length) {
      const suitor = free.pop();

      if (next[suitor] >= leftPreferences[suitor].length) continue;
      const target = leftPreferences[suitor][next[suitor]];

      next[suitor] += 1;
      report.proposals += 1;
      const held = matchRight[target];

      if (held !== -1 && rank[target][held] <= rank[target][suitor]) {
        report.rejections += 1;
        free.push(suitor);
        continue;
      }

      if (held !== -1) { matchLeft[held] = -1; free.push(held); report.rejections += 1; }
      matchRight[target] = suitor;
      matchLeft[suitor] = target;
    }
    return { matchLeft: matchLeft, matchRight: matchRight, report: report,
      size: matchLeft.filter(function (r) { return r !== -1; }).length };
  }

  /**
   * A blocking pair is two people who both prefer each other to what they
   * were given. A matching with none is stable, and counting them is the only
   * way to tell a stable matching from a merely plausible one.
   */
  function blockingPairs(leftPreferences, rightPreferences, matching) {
    const pairs = [];

    leftPreferences.forEach(function (order, suitor) {
      const current = matching.matchLeft[suitor];
      const currentRank = current === -1 ? order.length : order.indexOf(current);

      order.forEach(function (target, position) {
        if (position >= currentRank) return;
        const held = matching.matchRight[target];
        const preference = rightPreferences[target];
        const heldRank = held === -1 ? preference.length : preference.indexOf(held);

        if (heldRank <= preference.indexOf(suitor)) return;
        pairs.push({ left: suitor, right: target });
      });
    });
    return pairs;
  }

  /* --------------------------------------------------------- invariants */

  /** Is this a matching at all - every edge real, no vertex used twice? */
  function checkMatching(graph, matching) {
    const present = new Set();
    let bogus = 0;
    let inconsistent = 0;

    graph.edges.forEach(function (edge) { present.add(edge.from + '>' + edge.to); });
    matching.matchLeft.forEach(function (r, v) {
      if (r === -1) return;

      if (!present.has(v + '>' + r)) bogus += 1;

      if (matching.matchRight[r] !== v) inconsistent += 1;
    });
    return { bogus: bogus, inconsistent: inconsistent,
      valid: bogus === 0 && inconsistent === 0 };
  }

  return {
    emptyReport: emptyReport, adjacencyOf: adjacencyOf,
    kuhn: kuhn, hopcroftKarp: hopcroftKarp,
    vertexCover: vertexCover, checkCover: checkCover, hallViolator: hallViolator,
    galeShapley: galeShapley, blockingPairs: blockingPairs, checkMatching: checkMatching
  };
}));
