/**
 * Centrality and community detection: Brandes's betweenness, closeness, and
 * Louvain modularity.
 *
 * Betweenness asks how many shortest paths run *through* a vertex, and the
 * naive way to compute it - enumerate all pairs, enumerate their shortest
 * paths, count - is exponential in the path count. Brandes's contribution is
 * an accumulation identity that computes every vertex's score in one
 * breadth-first sweep per source, taking the whole thing to O(VE). The
 * dependency recursion is the algorithm; everything else is bookkeeping.
 *
 * Modularity compares the edges inside a community against what a random
 * graph with the same degrees would have had. It is a *score*, not a truth:
 * Louvain optimises it greedily, the optimum is NP-hard, and modularity has a
 * known resolution limit that makes it merge communities smaller than about
 * sqrt(2m). The module reports the score rather than claiming the partition.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Centrality = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { sources: 0, edgesExamined: 0, passes: 0, moves: 0, levels: 0,
      pathsCounted: 0 };
  }

  /* ------------------------------------------------------------- Brandes */

  /** One breadth-first sweep: distances, shortest-path counts, and the
   *  predecessor lists the accumulation walks back through. */
  function brandesSweep(adjacency, source, report) {
    const n = adjacency.length;
    const distance = new Array(n).fill(-1);
    const paths = new Array(n).fill(0);
    const predecessors = [];
    const order = [];
    const queue = [source];

    for (let v = 0; v < n; v += 1) predecessors.push([]);
    distance[source] = 0;
    paths[source] = 1;

    while (queue.length) {
      const v = queue.shift();

      order.push(v);
      adjacency[v].forEach(function (w) {
        report.edgesExamined += 1;

        if (distance[w] === -1) {
          distance[w] = distance[v] + 1;
          queue.push(w);
        }

        if (distance[w] !== distance[v] + 1) return;
        paths[w] += paths[v];
        report.pathsCounted += 1;
        predecessors[w].push(v);
      });
    }
    return { distance: distance, paths: paths, predecessors: predecessors, order: order };
  }

  /**
   * The accumulation, walked in reverse breadth-first order:
   * delta[v] = sum over successors w of (paths[v]/paths[w]) * (1 + delta[w]).
   * Every vertex's dependency on one source is computed once, which is what
   * replaces enumerating paths.
   */
  function brandes(adjacency, options) {
    const report = (options || {}).report || emptyReport();
    const n = adjacency.length;
    const score = new Array(n).fill(0);

    for (let source = 0; source < n; source += 1) {
      report.sources += 1;
      const sweep = brandesSweep(adjacency, source, report);
      const delta = new Array(n).fill(0);

      for (let i = sweep.order.length - 1; i >= 0; i -= 1) {
        const w = sweep.order[i];

        sweep.predecessors[w].forEach(function (v) {
          delta[v] += (sweep.paths[v] / sweep.paths[w]) * (1 + delta[w]);
        });

        if (w === source) continue;
        score[w] += delta[w];
      }
    }
    return { score: score.map(function (value) { return value / 2; }), report: report };
  }

  /**
   * The same numbers by enumerating every shortest path between every pair.
   * Exponential in the worst case and the only check that owes nothing to the
   * accumulation identity.
   */
  function betweennessByEnumeration(adjacency) {
    const n = adjacency.length;
    const score = new Array(n).fill(0);

    for (let s = 0; s < n; s += 1) {
      const sweep = brandesSweep(adjacency, s, emptyReport());

      for (let t = 0; t < n; t += 1) {
        if (t === s || sweep.distance[t] === -1) continue;
        const paths = [];

        collectPaths(sweep.predecessors, s, t, [t], paths);
        paths.forEach(function (path) {
          path.slice(1, path.length - 1).forEach(function (v) {
            score[v] += 1 / paths.length;
          });
        });
      }
    }
    return score.map(function (value) { return value / 2; });
  }

  function collectPaths(predecessors, source, at, current, out) {
    if (at === source) { out.push(current.slice().reverse()); return; }
    predecessors[at].forEach(function (v) {
      current.push(v);
      collectPaths(predecessors, source, v, current, out);
      current.pop();
    });
  }

  /** Closeness: the reciprocal of the mean distance to everything reachable,
   *  scaled by the reachable fraction so disconnected graphs stay comparable. */
  function closeness(adjacency, options) {
    const report = (options || {}).report || emptyReport();
    const n = adjacency.length;

    return { score: adjacency.map(function (list, source) {
      const sweep = brandesSweep(adjacency, source, report);
      let total = 0;
      let reached = 0;

      sweep.distance.forEach(function (d, v) {
        if (d <= 0 || v === source) return;
        total += d;
        reached += 1;
      });

      if (reached === 0 || total === 0) return 0;
      return (reached / total) * (reached / (n - 1));
    }), report: report };
  }

  /* ------------------------------------------------------------ modularity */

  /**
   * Q = sum over communities of (edges inside / m) − (degree sum / 2m)².
   * The second term is what a random graph with the same degrees would have
   * produced, which is why a high Q means "more clustered than chance" rather
   * than "clustered".
   */
  function modularity(adjacency, community) {
    const degree = adjacency.map(function (list) { return list.length; });
    const total = degree.reduce(function (a, b) { return a + b; }, 0);

    if (total === 0) return 0;
    const inside = {};
    const attached = {};

    adjacency.forEach(function (list, v) {
      attached[community[v]] = (attached[community[v]] || 0) + degree[v];
      list.forEach(function (w) {
        if (community[v] !== community[w]) return;
        inside[community[v]] = (inside[community[v]] || 0) + 1;
      });
    });
    let q = 0;

    Object.keys(attached).forEach(function (key) {
      const share = attached[key] / total;

      q += (inside[key] || 0) / total - share * share;
    });
    return q;
  }

  /* --------------------------------------------------------------- Louvain */

  function localMoving(adjacency, community, report) {
    const degree = adjacency.map(function (list) { return list.length; });
    const total = degree.reduce(function (a, b) { return a + b; }, 0);
    const attached = {};

    community.forEach(function (c, v) { attached[c] = (attached[c] || 0) + degree[v]; });
    let moved = false;

    adjacency.forEach(function (list, v) {
      const weights = {};

      list.forEach(function (w) {
        report.edgesExamined += 1;
        weights[community[w]] = (weights[community[w]] || 0) + 1;
      });
      const current = community[v];

      attached[current] -= degree[v];
      let best = current;
      let bestGain = gainOf(weights[current] || 0, attached[current], degree[v], total);

      Object.keys(weights).forEach(function (key) {
        const candidate = Number(key);
        const gain = gainOf(weights[candidate], attached[candidate] || 0, degree[v], total);

        if (gain <= bestGain + 1e-12) return;
        bestGain = gain;
        best = candidate;
      });
      community[v] = best;
      attached[best] = (attached[best] || 0) + degree[v];

      if (best === current) return;
      moved = true;
      report.moves += 1;
    });
    return moved;
  }

  function gainOf(sharedEdges, attachedDegree, ownDegree, total) {
    return sharedEdges / total - (attachedDegree * ownDegree) / (total * total / 2) / 2;
  }

  /** Collapse each community into one vertex, keeping the edges between them
   *  so the next level optimises over the same objective at a coarser scale. */
  function collapse(adjacency, community) {
    const labels = {};
    let next = 0;

    community.forEach(function (c) {
      if (labels[c] !== undefined) return;
      labels[c] = next;
      next += 1;
    });
    const mapped = community.map(function (c) { return labels[c]; });
    const out = [];

    for (let v = 0; v < next; v += 1) out.push([]);
    adjacency.forEach(function (list, v) {
      list.forEach(function (w) { out[mapped[v]].push(mapped[w]); });
    });
    return { adjacency: out, mapped: mapped, count: next };
  }

  /**
   * Greedy local moving, then collapse, then repeat. It optimises modularity
   * and does not maximise it - the maximum is NP-hard - so the score is
   * reported rather than the partition claimed to be correct.
   */
  function louvain(adjacency, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    let level = adjacency;
    let assignment = adjacency.map(function (ignored, v) { return v; });
    const limit = settings.levels || 10;

    for (let round = 0; round < limit; round += 1) {
      const community = level.map(function (ignored, v) { return v; });
      let moved = false;

      for (let pass = 0; pass < 20; pass += 1) {
        report.passes += 1;

        if (!localMoving(level, community, report)) break;
        moved = true;
      }
      const folded = collapse(level, community);

      assignment = assignment.map(function (c) { return folded.mapped[c]; });
      report.levels += 1;

      if (!moved || folded.count === level.length) break;
      level = folded.adjacency;
    }
    return { community: assignment, communities: new Set(assignment).size,
      modularity: modularity(adjacency, assignment), report: report };
  }

  /** Every partition, scored. Only affordable below about ten vertices, and
   *  the only way to know how far from optimal a greedy score is. */
  function bestModularity(adjacency, limit) {
    const n = adjacency.length;

    if (n > (limit === undefined ? 9 : limit)) return null;
    const assignment = new Array(n).fill(0);
    let best = -Infinity;

    const search = function (v, used) {
      if (v >= n) { best = Math.max(best, modularity(adjacency, assignment)); return; }

      for (let c = 0; c <= used; c += 1) {
        assignment[v] = c;
        search(v + 1, Math.max(used, c + 1));
      }
    };

    search(0, 0);
    return best;
  }

  return {
    emptyReport: emptyReport, brandes: brandes,
    betweennessByEnumeration: betweennessByEnumeration, closeness: closeness,
    modularity: modularity, louvain: louvain, bestModularity: bestModularity,
    collapse: collapse
  };
}));
