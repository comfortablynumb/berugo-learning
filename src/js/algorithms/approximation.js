/**
 * Approximation algorithms, each carrying the ratio it can actually prove.
 *
 * An approximation algorithm without a ratio is a heuristic, and the
 * difference is not pedantic: a heuristic can be arbitrarily bad on an input
 * you have not seen, and a 2-approximation cannot. Every algorithm here comes
 * with the argument that bounds it, and - because a bound is a promise about
 * the worst case rather than a description of behaviour - with the instance
 * that attains it, generated rather than described.
 *
 * The gap between the two is the practical content. Greedy set cover has a
 * ln n bound and is usually within a few percent of optimal; the tight
 * instance has to be constructed on purpose and does not arise by accident.
 * Knowing both facts is what lets you ship it, and knowing only the bound is
 * what makes people write an ILP they did not need.
 *
 * One trap is worth naming because it catches everyone once. The
 * 2-approximation for vertex cover takes BOTH endpoints of every edge in a
 * maximal matching, which feels wastefully unclever - and the obvious
 * improvement, repeatedly taking the highest-degree vertex, has no constant
 * ratio at all: it is Θ(log n) away from optimal on a constructible family.
 * The clever-looking algorithm is the bad one, which is why `vertexCover`
 * ships both and the demo measures them together.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Approximation = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* ---------------------------------------------------------- vertex cover */

  /**
   * Take a maximal matching and keep both endpoints of every matched edge.
   * Every edge is covered because the matching was maximal, and any cover has
   * to pick at least one endpoint per matched edge, so |matching| is a lower
   * bound on the optimum and the answer is at most twice it. The lower bound
   * is returned, because it is a certificate: it proves the ratio for THIS
   * instance without knowing the optimum.
   */
  function vertexCoverMatching(graph) {
    const used = new Array(graph.n).fill(false);
    const matching = [];

    graph.edges.forEach(function (edge) {
      if (used[edge.from] || used[edge.to]) return;
      used[edge.from] = true;
      used[edge.to] = true;
      matching.push(edge);
    });
    const cover = [];
    for (let i = 0; i < graph.n; i += 1) { if (used[i]) cover.push(i); }

    return { cover: cover, size: cover.length, matching: matching,
      lowerBound: matching.length, ratioBound: 2,
      guaranteed: cover.length <= 2 * matching.length };
  }

  /** The plausible alternative with no constant ratio: repeatedly take the
   *  vertex of highest remaining degree. Θ(log n) away on the right family. */
  function vertexCoverGreedyDegree(graph) {
    const remaining = graph.edges.map(function (edge) { return { from: edge.from, to: edge.to }; });
    const cover = [];

    while (remaining.length > 0) {
      const degree = new Array(graph.n).fill(0);
      remaining.forEach(function (edge) { degree[edge.from] += 1; degree[edge.to] += 1; });
      let best = 0;
      for (let v = 1; v < graph.n; v += 1) { if (degree[v] > degree[best]) best = v; }
      cover.push(best);
      for (let i = remaining.length - 1; i >= 0; i -= 1) {
        if (remaining[i].from === best || remaining[i].to === best) remaining.splice(i, 1);
      }
    }
    return { cover: cover, size: cover.length, ratioBound: null };
  }

  /** Every edge covered? A cover that is not a cover is the failure mode that
   *  survives a ratio check, because it is small. */
  function coversEveryEdge(graph, cover) {
    const inCover = new Array(graph.n).fill(false);
    cover.forEach(function (v) { inCover[v] = true; });
    let uncovered = 0;
    graph.edges.forEach(function (edge) {
      if (!inCover[edge.from] && !inCover[edge.to]) uncovered += 1;
    });
    return { valid: uncovered === 0, uncovered: uncovered };
  }

  /**
   * The family that defeats highest-degree greedy: a left side of k vertices
   * and, for each i in 2..k, a right group of floor(k/i) vertices each joined
   * to i left vertices. Greedy takes every right group; the optimum is the
   * left side, of size k.
   */
  function degreeTrapInstance(k) {
    const edges = [];
    let next = k;
    const groups = [];

    for (let i = k; i >= 2; i -= 1) {
      const count = Math.floor(k / i);
      const group = [];
      for (let g = 0; g < count; g += 1) {
        const right = next;
        next += 1;
        group.push(right);
        for (let j = 0; j < i; j += 1) edges.push({ from: (g * i + j) % k, to: right, weight: 1 });
      }
      if (count > 0) groups.push({ degree: i, vertices: group });
    }
    return { graph: { n: next, edges: edges, directed: false, name: 'degree-trap' },
      optimum: k, left: k, groups: groups };
  }

  /* ------------------------------------------------------------- set cover */

  /**
   * Greedy set cover: repeatedly take the set covering the most uncovered
   * elements. The bound is H(m) <= 1 + ln m where m is the largest set size,
   * and it is tight - `setCoverTightInstance` builds a family that attains it.
   */
  function setCoverGreedy(instance) {
    const covered = new Array(instance.universe).fill(false);
    const chosen = [];
    let remaining = instance.universe;
    let cost = 0;
    const rounds = [];

    while (remaining > 0) {
      const pick = bestSet(instance.sets, covered);
      if (pick.gain === 0) break;
      chosen.push(pick.index);
      cost += instance.sets[pick.index].cost === undefined ? 1 : instance.sets[pick.index].cost;
      instance.sets[pick.index].members.forEach(function (e) {
        if (!covered[e]) { covered[e] = true; remaining -= 1; }
      });
      rounds.push({ set: pick.index, gain: pick.gain, remaining: remaining });
    }
    const largest = instance.sets.reduce(function (a, s) {
      return Math.max(a, s.members.length);
    }, 0);
    return { chosen: chosen, cost: cost, rounds: rounds, covered: remaining === 0,
      uncovered: remaining, bound: harmonic(largest), largestSet: largest };
  }

  function bestSet(sets, covered) {
    let bestIndex = -1;
    let bestScore = 0;
    let bestGain = 0;

    for (let i = 0; i < sets.length; i += 1) {
      let gain = 0;
      for (let j = 0; j < sets[i].members.length; j += 1) {
        if (!covered[sets[i].members[j]]) gain += 1;
      }
      const cost = sets[i].cost === undefined ? 1 : sets[i].cost;
      const score = gain / cost;
      if (gain > 0 && score > bestScore) { bestScore = score; bestIndex = i; bestGain = gain; }
    }
    return { index: bestIndex, gain: bestGain, score: bestScore };
  }

  function harmonic(m) {
    let out = 0;
    for (let i = 1; i <= m; i += 1) out += 1 / i;
    return out;
  }

  /**
   * Vazirani's tight instance, which attains the H(n) bound exactly rather
   * than approaching it. The universe has n elements; each singleton {i} has
   * cost 1/(n - i), and one set covering everything costs 1 + epsilon. Greedy
   * scores by elements-per-cost, so at every step the remaining cheapest
   * singleton beats the full set by a hair, and greedy pays
   * 1/n + 1/(n-1) + ... + 1 = H(n) for an optimum of 1 + epsilon.
   *
   * The instance is contrived on purpose. That is the lesson: the bound is
   * attained by a family somebody had to construct, and greedy set cover on
   * inputs that arise by accident is usually within a few percent of optimal.
   */
  function setCoverTightInstance(n, epsilon) {
    const slack = epsilon === undefined ? 0.01 : epsilon;
    const sets = [];
    const all = [];

    for (let i = 0; i < n; i += 1) {
      all.push(i);
      sets.push({ members: [i], cost: 1 / (n - i), label: 'singleton ' + i });
    }
    sets.push({ members: all, cost: 1 + slack, label: 'the whole universe' });
    return { universe: n, sets: sets, optimum: 1 + slack, greedyCost: harmonic(n),
      ratio: harmonic(n) / (1 + slack), epsilon: slack };
  }

  /* -------------------------------------------------------------- geometry */

  function euclidean(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function distanceMatrix(points) {
    const n = points.length;
    const out = [];

    for (let i = 0; i < n; i += 1) {
      const row = new Array(n);
      for (let j = 0; j < n; j += 1) row[j] = euclidean(points[i], points[j]);
      out.push(row);
    }
    return out;
  }

  function tourLength(order, matrix) {
    let total = 0;
    for (let i = 0; i < order.length; i += 1) {
      total += matrix[order[i]][order[(i + 1) % order.length]];
    }
    return total;
  }

  /** Prim's MST on the distance matrix - the lower bound every metric TSP
   *  approximation is measured against. */
  function minimumSpanningTree(matrix) {
    const n = matrix.length;
    const inTree = new Array(n).fill(false);
    const best = new Array(n).fill(Infinity);
    const parent = new Array(n).fill(-1);
    const edges = [];
    let weight = 0;
    best[0] = 0;

    for (let step = 0; step < n; step += 1) {
      let pick = -1;
      for (let v = 0; v < n; v += 1) {
        if (!inTree[v] && (pick === -1 || best[v] < best[pick])) pick = v;
      }
      inTree[pick] = true;
      weight += best[pick];
      if (parent[pick] >= 0) edges.push({ from: parent[pick], to: pick, weight: best[pick] });
      for (let v = 0; v < n; v += 1) {
        if (!inTree[v] && matrix[pick][v] < best[v]) { best[v] = matrix[pick][v]; parent[v] = pick; }
      }
    }
    return { edges: edges, weight: weight, parent: parent };
  }

  /**
   * Double the MST, walk it, shortcut repeats. Doubling gives an Eulerian
   * multigraph of weight 2·MST, the walk visits every vertex, and the
   * triangle inequality says shortcutting never lengthens it - so the tour is
   * at most 2·MST <= 2·OPT, because deleting any edge of an optimal tour
   * leaves a spanning tree.
   */
  function mstTour(matrix) {
    const tree = minimumSpanningTree(matrix);
    const adjacency = [];
    for (let i = 0; i < matrix.length; i += 1) adjacency.push([]);
    tree.edges.forEach(function (edge) {
      adjacency[edge.from].push(edge.to);
      adjacency[edge.to].push(edge.from);
    });
    const order = preorder(adjacency, matrix.length);

    return { order: order, length: tourLength(order, matrix), mst: tree.weight,
      ratioBound: 2, lowerBound: tree.weight, shortcuts: matrix.length - 1 };
  }

  function preorder(adjacency, n) {
    const seen = new Array(n).fill(false);
    const order = [];
    const stack = [0];

    while (stack.length > 0) {
      const v = stack.pop();
      if (seen[v]) continue;
      seen[v] = true;
      order.push(v);
      for (let i = adjacency[v].length - 1; i >= 0; i -= 1) {
        if (!seen[adjacency[v][i]]) stack.push(adjacency[v][i]);
      }
    }
    return order;
  }

  /**
   * Christofides: instead of doubling every edge, add a minimum-weight
   * perfect matching on the odd-degree vertices only. That matching costs at
   * most OPT/2 - the odd vertices in tour order split into two alternating
   * matchings whose total is at most OPT - so the tour is at most 3/2·OPT.
   * The odd set is always even in size, which is the handshake lemma doing
   * real work rather than decorating a textbook.
   */
  function christofides(matrix) {
    const tree = minimumSpanningTree(matrix);
    const degree = new Array(matrix.length).fill(0);
    tree.edges.forEach(function (edge) { degree[edge.from] += 1; degree[edge.to] += 1; });
    const odd = [];
    for (let v = 0; v < matrix.length; v += 1) { if (degree[v] % 2 === 1) odd.push(v); }

    const matching = minimumPerfectMatching(odd, matrix);
    const adjacency = [];
    for (let i = 0; i < matrix.length; i += 1) adjacency.push([]);
    tree.edges.forEach(function (edge) {
      adjacency[edge.from].push(edge.to);
      adjacency[edge.to].push(edge.from);
    });
    matching.pairs.forEach(function (pair) {
      adjacency[pair[0]].push(pair[1]);
      adjacency[pair[1]].push(pair[0]);
    });
    const order = eulerShortcut(adjacency, matrix.length);
    return { order: order, length: tourLength(order, matrix), mst: tree.weight,
      matching: matching.weight, oddVertices: odd.length, ratioBound: 1.5,
      lowerBound: tree.weight };
  }

  /** Exact minimum-weight perfect matching by bitmask DP - the odd set is
   *  small, and an approximate matching here would break the 3/2 bound. */
  function minimumPerfectMatching(vertices, matrix) {
    const k = vertices.length;
    if (k === 0) return { pairs: [], weight: 0 };
    const full = 1 << k;
    const best = new Array(full).fill(Infinity);
    const choice = new Array(full).fill(null);
    best[0] = 0;

    for (let mask = 0; mask < full; mask += 1) {
      if (best[mask] === Infinity) continue;
      let first = -1;
      for (let i = 0; i < k; i += 1) { if (!((mask >>> i) & 1)) { first = i; break; } }
      if (first === -1) continue;
      for (let j = first + 1; j < k; j += 1) {
        if ((mask >>> j) & 1) continue;
        const next = mask | (1 << first) | (1 << j);
        const cost = best[mask] + matrix[vertices[first]][vertices[j]];
        if (cost >= best[next]) continue;
        best[next] = cost;
        choice[next] = { mask: mask, pair: [vertices[first], vertices[j]] };
      }
    }
    return { pairs: unwindMatching(choice, full - 1), weight: best[full - 1] };
  }

  function unwindMatching(choice, mask) {
    const out = [];
    let at = mask;
    while (at > 0 && choice[at]) { out.push(choice[at].pair); at = choice[at].mask; }
    return out;
  }

  /** Hierholzer's circuit, then skip vertices already seen. */
  function eulerShortcut(adjacency, n) {
    const used = adjacency.map(function (list) { return new Array(list.length).fill(false); });
    const stack = [0];
    const circuit = [];

    while (stack.length > 0) {
      const v = stack[stack.length - 1];
      let advanced = false;
      for (let i = 0; i < adjacency[v].length; i += 1) {
        if (used[v][i]) continue;
        used[v][i] = true;
        const u = adjacency[v][i];
        for (let j = 0; j < adjacency[u].length; j += 1) {
          if (adjacency[u][j] === v && !used[u][j]) { used[u][j] = true; break; }
        }
        stack.push(u);
        advanced = true;
        break;
      }
      if (!advanced) circuit.push(stack.pop());
    }
    const seen = new Array(n).fill(false);
    const order = [];
    circuit.forEach(function (v) { if (!seen[v]) { seen[v] = true; order.push(v); } });
    return order;
  }

  /* -------------------------------------------------------------- k-centre */

  /**
   * Farthest-first traversal: start anywhere, repeatedly open the centre
   * farthest from the ones already open. The radius is at most twice the
   * optimum, and no polynomial algorithm does better unless P = NP - this is
   * one of the few places where the obvious greedy is provably the end of the
   * road rather than a stepping stone.
   */
  function kCentreGreedy(matrix, k) {
    const n = matrix.length;
    const centres = [0];
    const nearest = matrix[0].slice();

    while (centres.length < k) {
      let pick = 0;
      for (let v = 1; v < n; v += 1) { if (nearest[v] > nearest[pick]) pick = v; }
      centres.push(pick);
      for (let v = 0; v < n; v += 1) nearest[v] = Math.min(nearest[v], matrix[pick][v]);
    }
    let radius = 0;
    for (let v = 0; v < n; v += 1) radius = Math.max(radius, nearest[v]);
    return { centres: centres, radius: radius, ratioBound: 2, assignment: nearest };
  }

  /* --------------------------------------------------------- load balancing */

  /**
   * List scheduling: assign each job to the machine that is currently least
   * loaded. The makespan is at most (2 - 1/m) times optimal, because the last
   * job to finish started when every machine was busy. Sorting the jobs
   * longest-first (LPT) improves the bound to 4/3 - 1/(3m) for the cost of a
   * sort, and the demo runs both on the same list.
   */
  function listScheduling(jobs, machines, options) {
    const settings = options || {};
    const order = settings.lpt
      ? jobs.slice().sort(function (a, b) { return b - a; })
      : jobs.slice();
    const load = new Array(machines).fill(0);
    const assignment = [];

    order.forEach(function (job) {
      let pick = 0;
      for (let m = 1; m < machines; m += 1) { if (load[m] < load[pick]) pick = m; }
      load[pick] += job;
      assignment.push({ job: job, machine: pick });
    });
    const total = jobs.reduce(function (a, b) { return a + b; }, 0);
    const longest = jobs.reduce(function (a, b) { return Math.max(a, b); }, 0);

    return { makespan: Math.max.apply(null, load), load: load, assignment: assignment,
      lowerBound: Math.max(total / machines, longest),
      ratioBound: settings.lpt ? 4 / 3 - 1 / (3 * machines) : 2 - 1 / machines,
      lpt: Boolean(settings.lpt) };
  }

  /** The instance that makes plain list scheduling attain 2 - 1/m: m(m-1)
   *  unit jobs followed by one job of length m. */
  function schedulingTrapInstance(machines) {
    const jobs = [];
    for (let i = 0; i < machines * (machines - 1); i += 1) jobs.push(1);
    jobs.push(machines);
    return { jobs: jobs, machines: machines, optimum: machines,
      trapMakespan: 2 * machines - 1 };
  }

  return {
    vertexCoverMatching: vertexCoverMatching, vertexCoverGreedyDegree: vertexCoverGreedyDegree,
    coversEveryEdge: coversEveryEdge, degreeTrapInstance: degreeTrapInstance,
    setCoverGreedy: setCoverGreedy, setCoverTightInstance: setCoverTightInstance,
    harmonic: harmonic,
    euclidean: euclidean, distanceMatrix: distanceMatrix, tourLength: tourLength,
    minimumSpanningTree: minimumSpanningTree, mstTour: mstTour, christofides: christofides,
    minimumPerfectMatching: minimumPerfectMatching,
    kCentreGreedy: kCentreGreedy,
    listScheduling: listScheduling, schedulingTrapInstance: schedulingTrapInstance
  };
}));
