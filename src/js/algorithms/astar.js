/**
 * A* and the heuristic family: weighted A*, bidirectional A*, IDA* and ALT
 * landmarks.
 *
 * A* *is* Dijkstra with a potential. Ordering the queue by g + h instead of g
 * is exactly reweighting each edge to w(u, v) + h(v) − h(u), and a consistent
 * heuristic is precisely one that keeps every reweighted edge non-negative -
 * which is the condition Dijkstra needs. Seeing it that way explains every
 * property in one go, including the two that are usually memorised
 * separately:
 *
 *   **admissible** (h never overestimates) is what makes the answer optimal.
 *   **consistent** (h(u) ≤ w(u, v) + h(v)) is what makes it optimal *without
 *   reopening closed nodes*.
 *
 * An admissible-but-inconsistent heuristic still finds the optimal path, and
 * only if you reopen. Skipping the reopen check for speed - which almost
 * everyone does - silently requires consistency, and `reopen: false` here
 * makes that failure demonstrable rather than warned about.
 *
 * Weighted A* multiplies h by w > 1. The path it returns is within a factor
 * of w of optimal, and that bound is *reported as a measured gap* rather than
 * quoted: on real instances the gap is usually far smaller than w, which is
 * why the technique is worth having.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AStar = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { expanded: 0, generated: 0, relaxations: 0, reopened: 0, pushes: 0,
      staleSkipped: 0, reopensSuppressed: 0, meetingPoint: -1, iterations: 0 };
  }

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

  /* -------------------------------------------------------------- A* */

  /**
   * `heuristic(v)` estimates the remaining cost from v to the target. With
   * `weight` above 1 this is weighted A*; with `reopen: false` a closed node
   * is never revisited, which is correct exactly when the heuristic is
   * consistent.
   */
  function search(adjacency, source, target, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const heuristic = settings.heuristic || function () { return 0; };
    const weight = settings.weight === undefined ? 1 : settings.weight;
    const reopen = settings.reopen !== false;
    const n = adjacency.length;
    const g = new Array(n).fill(Infinity);
    const parent = new Array(n).fill(-1);
    const closed = new Array(n).fill(false);
    const heap = createHeap();

    g[source] = 0;
    heap.push(weight * heuristic(source), source);
    report.pushes += 1;

    while (heap.size()) {
      const top = heap.pop();
      const node = top.value;

      /* Three different things can pop a closed node, and conflating them
         makes a consistent heuristic look like it reopens. A *stale* entry is
         a duplicate left behind by a later, cheaper push: its key is above the
         node's current f, and it is pure lazy-heap bookkeeping. A *genuine*
         reopening is an entry whose key matches the current f, which only
         happens when g fell after the node was closed - and that needs an
         inconsistent heuristic. */
      if (closed[node] && top.key > g[node] + weight * heuristic(node) + 1e-9) {
        report.staleSkipped += 1;
        continue;
      }

      if (closed[node] && !reopen) { report.reopensSuppressed += 1; continue; }

      if (closed[node]) report.reopened += 1;
      closed[node] = true;
      report.expanded += 1;

      if (node === target) break;
      expand(adjacency, node, { g: g, parent: parent, heap: heap, heuristic: heuristic,
        weight: weight, report: report });
    }
    return { distance: g[target], g: g, parent: parent, closed: closed,
      path: pathTo(parent, source, target), report: report };
  }

  function expand(adjacency, node, context) {
    adjacency[node].forEach(function (edge) {
      context.report.relaxations += 1;
      const candidate = context.g[node] + edge.weight;

      if (candidate >= context.g[edge.to]) return;
      context.g[edge.to] = candidate;
      context.parent[edge.to] = node;
      context.report.generated += 1;
      context.heap.push(candidate + context.weight * context.heuristic(edge.to), edge.to);
      context.report.pushes += 1;
    });
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

  /* ------------------------------------------------------- the heuristics */

  /** Four-connected grids move in axis steps, so Manhattan is exact when
   *  every edge costs one - and exact is the strongest admissible there is. */
  function manhattan(positionOf, target, scale) {
    const goal = positionOf(target);
    const factor = scale === undefined ? 1 : scale;
    return function (v) {
      const p = positionOf(v);
      return factor * (Math.abs(p.x - goal.x) + Math.abs(p.y - goal.y));
    };
  }

  /** Straight-line distance. Admissible on a four-connected grid and *loose*
   *  there, because you cannot travel diagonally - which is why it expands
   *  more nodes than Manhattan for the same answer. */
  function euclidean(positionOf, target, scale) {
    const goal = positionOf(target);
    const factor = scale === undefined ? 1 : scale;
    return function (v) {
      const p = positionOf(v);
      return factor * Math.hypot(p.x - goal.x, p.y - goal.y);
    };
  }

  function chebyshev(positionOf, target, scale) {
    const goal = positionOf(target);
    const factor = scale === undefined ? 1 : scale;
    return function (v) {
      const p = positionOf(v);
      return factor * Math.max(Math.abs(p.x - goal.x), Math.abs(p.y - goal.y));
    };
  }

  /** Deliberately inadmissible: Manhattan times a factor above the true edge
   *  cost, so it overestimates and the returned path is not optimal. */
  function inflated(positionOf, target, factor) {
    return manhattan(positionOf, target, factor);
  }

  /**
   * ALT: precompute exact distances to and from a few landmarks, then use the
   * triangle inequality |d(L, t) − d(L, v)| ≤ d(v, t). It needs no geometry
   * at all, which is why it works on road networks and social graphs where
   * coordinates are absent or meaningless.
   */
  function landmarkHeuristic(landmarkDistances, target) {
    return function (v) {
      let best = 0;

      landmarkDistances.forEach(function (distances) {
        const a = distances[target];
        const b = distances[v];

        if (a === Infinity || b === Infinity) return;
        best = Math.max(best, Math.abs(a - b));
      });
      return best;
    };
  }

  /** Pick landmarks far apart: the farthest vertex from an arbitrary start,
   *  then the farthest from that, and so on. Random landmarks give a much
   *  weaker bound, which is a measurable difference rather than folklore. */
  function chooseLandmarks(adjacency, count, distancesFrom) {
    const chosen = [0];
    let distances = [distancesFrom(0)];

    while (chosen.length < count) {
      let best = 0;
      let bestScore = -1;

      for (let v = 0; v < adjacency.length; v += 1) {
        let score = Infinity;

        distances.forEach(function (row) {
          if (row[v] === Infinity) return;
          score = Math.min(score, row[v]);
        });

        if (score === Infinity || score <= bestScore) continue;
        bestScore = score;
        best = v;
      }

      if (chosen.indexOf(best) !== -1) break;
      chosen.push(best);
      distances = distances.concat([distancesFrom(best)]);
    }
    return { landmarks: chosen, distances: distances };
  }

  /* -------------------------------------------------- consistency checks */

  /** Does h never overestimate? Checked against exact distances, which is
   *  only possible on the small graphs the tests and demos use - and is the
   *  only honest way to make the claim. */
  function checkAdmissible(heuristic, exactToTarget) {
    const problems = [];

    exactToTarget.forEach(function (exact, v) {
      if (exact === Infinity) return;

      if (heuristic(v) <= exact + 1e-9) return;
      problems.push({ node: v, heuristic: heuristic(v), exact: exact });
    });
    return { admissible: problems.length === 0, problems: problems.slice(0, 5) };
  }

  /** Does h(u) ≤ w(u, v) + h(v) on every edge? This is the condition that
   *  makes the reopen check unnecessary. */
  function checkConsistent(adjacency, heuristic) {
    const problems = [];

    adjacency.forEach(function (edges, from) {
      edges.forEach(function (edge) {
        if (heuristic(from) <= edge.weight + heuristic(edge.to) + 1e-9) return;
        problems.push({ from: from, to: edge.to, weight: edge.weight,
          hFrom: heuristic(from), hTo: heuristic(edge.to) });
      });
    });
    return { consistent: problems.length === 0, problems: problems.slice(0, 5) };
  }

  /* ------------------------------------------------------- bidirectional */

  /**
   * Two searches, one from each end, stopping when the frontiers meet. The
   * meeting condition is the subtle part: the first vertex settled by both is
   * *not* necessarily on a shortest path, so the best meeting cost has to be
   * tracked separately and the loop continues until the two frontier keys sum
   * to at least that cost.
   */
  function bidirectional(adjacency, reverseAdjacency, source, target, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const n = adjacency.length;
    const forward = { g: new Array(n).fill(Infinity), closed: new Array(n).fill(false),
      parent: new Array(n).fill(-1), heap: createHeap() };
    const backward = { g: new Array(n).fill(Infinity), closed: new Array(n).fill(false),
      parent: new Array(n).fill(-1), heap: createHeap() };

    forward.g[source] = 0;
    forward.heap.push(0, source);
    backward.g[target] = 0;
    backward.heap.push(0, target);
    let best = Infinity;
    let meeting = -1;

    while (forward.heap.size() && backward.heap.size()) {
      const topForward = forward.heap.pop();
      const topBackward = backward.heap.pop();

      if (topForward.key + topBackward.key >= best) break;
      meeting = stepSide(adjacency, forward, backward, topForward.value,
        { best: best, meeting: meeting, report: report, set: function (v) { best = v; } });
      meeting = stepSide(reverseAdjacency, backward, forward, topBackward.value,
        { best: best, meeting: meeting, report: report, set: function (v) { best = v; } });
    }
    report.meetingPoint = meeting;
    return { distance: best, meeting: meeting,
      path: joinPaths(forward.parent, backward.parent, source, target, meeting), report: report };
  }

  /** One side's expansion, updating the best meeting cost when a vertex is
   *  reachable from both directions. */
  function stepSide(adjacency, side, other, node, context) {
    if (side.closed[node]) return context.meeting;
    side.closed[node] = true;
    context.report.expanded += 1;
    let meeting = context.meeting;

    adjacency[node].forEach(function (edge) {
      context.report.relaxations += 1;

      if (side.g[node] + edge.weight < side.g[edge.to]) {
        side.g[edge.to] = side.g[node] + edge.weight;
        side.parent[edge.to] = node;
        side.heap.push(side.g[edge.to], edge.to);
        context.report.pushes += 1;
      }

      if (other.g[edge.to] === Infinity) return;
      const total = side.g[edge.to] + other.g[edge.to];

      if (total >= context.best) return;
      context.best = total;
      context.set(total);
      meeting = edge.to;
    });
    return meeting;
  }

  function joinPaths(forwardParent, backwardParent, source, target, meeting) {
    if (meeting === -1) return null;
    const left = pathTo(forwardParent, source, meeting);
    const right = pathTo(backwardParent, target, meeting);

    if (!left || !right) return null;
    return left.concat(right.slice(0, right.length - 1).reverse());
  }

  /* --------------------------------------------------------------- IDA* */

  /**
   * Iterative deepening on f = g + h, with the next threshold taken as the
   * smallest f that exceeded the current one. Memory is the recursion depth
   * rather than the frontier, which is the entire point - and the cost is
   * re-expanding the shallow nodes on every iteration, reported as
   * `iterations` and `expanded` so the trade is a number.
   */
  function idaStar(adjacency, source, target, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const heuristic = settings.heuristic || function () { return 0; };
    const budget = settings.nodeBudget || 400000;
    let threshold = heuristic(source);

    while (report.expanded < budget) {
      report.iterations += 1;
      const found = boundedSearch(adjacency, [source], 0, threshold,
        { target: target, heuristic: heuristic, report: report, budget: budget });

      if (found.path) return { distance: found.cost, path: found.path, report: report };

      if (found.next === Infinity) return { distance: Infinity, path: null, report: report };
      threshold = found.next;
    }
    return { distance: null, path: null, budgetExhausted: true, report: report };
  }

  /** One depth-bounded probe. Returns either the path or the next threshold. */
  function boundedSearch(adjacency, path, cost, threshold, context) {
    const node = path[path.length - 1];
    const f = cost + context.heuristic(node);

    if (f > threshold) return { path: null, next: f };

    if (node === context.target) return { path: path.slice(), cost: cost, next: Infinity };
    context.report.expanded += 1;

    if (context.report.expanded > context.budget) return { path: null, next: Infinity };
    let next = Infinity;
    let found = null;

    adjacency[node].forEach(function (edge) {
      if (found || path.indexOf(edge.to) !== -1) return;
      context.report.relaxations += 1;
      path.push(edge.to);
      const result = boundedSearch(adjacency, path, cost + edge.weight, threshold, context);
      path.pop();

      if (result.path) { found = result; return; }
      next = Math.min(next, result.next);
    });
    return found || { path: null, next: next };
  }

  return {
    emptyReport: emptyReport, createHeap: createHeap,
    search: search, pathTo: pathTo,
    manhattan: manhattan, euclidean: euclidean, chebyshev: chebyshev, inflated: inflated,
    landmarkHeuristic: landmarkHeuristic, chooseLandmarks: chooseLandmarks,
    checkAdmissible: checkAdmissible, checkConsistent: checkConsistent,
    bidirectional: bidirectional, idaStar: idaStar
  };
}));
