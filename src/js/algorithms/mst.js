/**
 * Minimum spanning trees: Kruskal, Prim, Borůvka - and the two consequences
 * almost nobody connects to them.
 *
 * All three algorithms are correct for the same reason, the **cut property**:
 * for any partition of the vertices, the lightest edge crossing it is in some
 * MST. Kruskal exploits it by always taking the globally lightest edge that
 * joins two components; Prim by always taking the lightest edge leaving one
 * growing component; Borůvka by taking the lightest edge leaving *every*
 * component at once, which is why it parallelises. Different schedules over
 * one theorem, and `safeEdgeFor` reports the cut each choice exploits so a
 * demo can show the argument rather than assert it.
 *
 * **The MST is also the minimax path structure.** The path between two
 * vertices *in the MST* minimises the maximum edge weight along it, over all
 * paths in the graph. That is the actual question in network design - "make
 * the worst hop as good as possible" - and it comes free with the tree.
 * `bottleneck()` computes it and `bottleneckByBruteForce()` checks it, because
 * the connection is surprising enough to be worth verifying.
 *
 * Duplicate weights are the input that separates a correct implementation
 * from a lucky one: the MST is unique exactly when all weights are distinct,
 * so with ties the three algorithms may return *different trees of the same
 * total weight*. Asserting tree equality would be wrong; asserting equal
 * weight is the real invariant.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Mst = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { comparisons: 0, unions: 0, finds: 0, pushes: 0, rounds: 0,
      edgesConsidered: 0, sortCost: 0 };
  }

  /* -------------------------------------------------- disjoint set union */

  function createDsu(n, report) {
    const parent = [];
    const rank = new Array(n).fill(0);

    for (let v = 0; v < n; v += 1) parent.push(v);

    function find(v) {
      let root = v;

      while (parent[root] !== root) { root = parent[root]; if (report) report.finds += 1; }
      let at = v;

      while (parent[at] !== root) { const next = parent[at]; parent[at] = root; at = next; }
      return root;
    }

    function union(a, b) {
      const ra = find(a);
      const rb = find(b);

      if (ra === rb) return false;

      if (report) report.unions += 1;

      if (rank[ra] < rank[rb]) parent[ra] = rb;
      else if (rank[rb] < rank[ra]) parent[rb] = ra;
      else { parent[rb] = ra; rank[ra] += 1; }
      return true;
    }
    return { find: find, union: union, parent: parent };
  }

  /* -------------------------------------------------------------- Kruskal */

  /**
   * Sort every edge, take each one that joins two components. The sort is the
   * whole cost on a sparse graph, which is why `sortCost` is reported
   * separately from the union-find work - the two answer different questions
   * about where the time goes.
   */
  function kruskal(graph, options) {
    const report = (options || {}).report || emptyReport();
    const sorted = graph.edges.map(function (edge, id) {
      return { from: edge.from, to: edge.to, weight: edge.weight, id: id };
    }).sort(function (a, b) { return a.weight - b.weight || a.id - b.id; });

    report.sortCost = graph.edges.length === 0 ? 0
      : Math.ceil(graph.edges.length * Math.log2(graph.edges.length));
    const dsu = createDsu(graph.n, report);
    const chosen = [];
    const cuts = [];
    let total = 0;

    sorted.forEach(function (edge) {
      report.edgesConsidered += 1;
      report.comparisons += 1;

      if (!dsu.union(edge.from, edge.to)) return;
      chosen.push(edge);
      cuts.push({ edge: edge.id, reason: 'lightest edge joining two components' });
      total += edge.weight;
    });
    return { edges: chosen, weight: total, cuts: cuts,
      spanning: chosen.length === graph.n - 1, report: report };
  }

  /* ----------------------------------------------------------------- Prim */

  /**
   * Grow one component, always taking the lightest edge leaving it. The heap
   * holds candidate edges rather than vertices, which is the lazy variant -
   * simpler, and it pushes more entries than an indexed heap would, which the
   * counters make visible.
   */
  function prim(graph, adjacency, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const inTree = new Array(graph.n).fill(false);
    const chosen = [];
    let total = 0;
    let components = 0;

    for (let source = 0; source < graph.n; source += 1) {
      if (inTree[source]) continue;
      components += 1;
      growFrom(adjacency, source, { inTree: inTree, chosen: chosen, report: report,
        add: function (weight) { total += weight; } });
    }
    return { edges: chosen, weight: total, components: components,
      spanning: chosen.length === graph.n - components, report: report };
  }

  function growFrom(adjacency, source, context) {
    const heap = [];
    const push = function (entry) {
      heap.push(entry);
      context.report.pushes += 1;
      let i = heap.length - 1;

      while (i > 0) {
        const parent = (i - 1) >> 1;
        context.report.comparisons += 1;

        if (heap[parent].weight <= heap[i].weight) break;
        const t = heap[parent]; heap[parent] = heap[i]; heap[i] = t;
        i = parent;
      }
    };

    context.inTree[source] = true;
    adjacency[source].forEach(function (edge) {
      push({ from: source, to: edge.to, weight: edge.weight, id: edge.id });
    });

    while (heap.length) {
      const best = popSmallest(heap, context.report);
      context.report.edgesConsidered += 1;

      if (context.inTree[best.to]) continue;
      context.inTree[best.to] = true;
      context.chosen.push(best);
      context.add(best.weight);
      adjacency[best.to].forEach(function (edge) {
        if (context.inTree[edge.to]) return;
        push({ from: best.to, to: edge.to, weight: edge.weight, id: edge.id });
      });
    }
  }

  function popSmallest(heap, report) {
    const top = heap[0];
    const last = heap.pop();

    if (!heap.length) return top;
    heap[0] = last;
    let i = 0;

    while (true) {
      const left = 2 * i + 1;
      let best = i;

      if (left < heap.length) {
        report.comparisons += 1;

        if (heap[left].weight < heap[best].weight) best = left;
      }

      if (left + 1 < heap.length) {
        report.comparisons += 1;

        if (heap[left + 1].weight < heap[best].weight) best = left + 1;
      }

      if (best === i) break;
      const t = heap[best]; heap[best] = heap[i]; heap[i] = t;
      i = best;
    }
    return top;
  }

  /* -------------------------------------------------------------- Borůvka */

  /**
   * Every component picks its own lightest outgoing edge, and they all merge
   * at once. The component count at least halves per round, so there are at
   * most log₂n rounds - and because the rounds are independent per component,
   * this is the MST algorithm that parallelises.
   *
   * Ties must be broken *consistently* (by edge id here), or two components
   * can each pick a different copy of the same-weight edge between them and
   * the merge produces a cycle.
   */
  function boruvka(graph, options) {
    const report = (options || {}).report || emptyReport();
    const dsu = createDsu(graph.n, report);
    const chosen = [];
    const taken = new Set();
    let total = 0;
    let components = graph.n;

    while (components > 1) {
      report.rounds += 1;
      const best = cheapestPerComponent(graph, dsu, report);
      let merged = 0;

      best.forEach(function (edge) {
        if (!edge || taken.has(edge.id)) return;

        if (!dsu.union(edge.from, edge.to)) return;
        taken.add(edge.id);
        chosen.push(edge);
        total += edge.weight;
        components -= 1;
        merged += 1;
      });

      if (merged === 0) break;
    }
    return { edges: chosen, weight: total, components: components,
      spanning: chosen.length === graph.n - 1, report: report };
  }

  /** One round's scan. The tie-break by edge id is load-bearing. */
  function cheapestPerComponent(graph, dsu, report) {
    const best = {};

    graph.edges.forEach(function (edge, id) {
      report.edgesConsidered += 1;
      const a = dsu.find(edge.from);
      const b = dsu.find(edge.to);

      if (a === b) return;
      const candidate = { from: edge.from, to: edge.to, weight: edge.weight, id: id };

      [a, b].forEach(function (component) {
        const current = best[component];
        report.comparisons += 1;

        if (current && (current.weight < candidate.weight ||
            (current.weight === candidate.weight && current.id < candidate.id))) return;
        best[component] = candidate;
      });
    });
    return Object.keys(best).map(function (key) { return best[key]; });
  }

  /* ------------------------------------------------------- the invariants */

  /** Is this edge set a spanning forest? Acyclic, and connecting every vertex
   *  that the graph connects. */
  function checkSpanning(graph, edges) {
    const dsu = createDsu(graph.n, null);
    let acyclic = true;

    edges.forEach(function (edge) {
      if (dsu.union(edge.from, edge.to)) return;
      acyclic = false;
    });
    const full = createDsu(graph.n, null);

    graph.edges.forEach(function (edge) { full.union(edge.from, edge.to); });
    let connected = true;

    for (let v = 0; v < graph.n; v += 1) {
      if (dsu.find(v) === dsu.find(0) || full.find(v) !== full.find(0)) continue;
      connected = false;
    }
    return { acyclic: acyclic, spansComponents: connected };
  }

  /** The cut a chosen edge crosses, as data - which is what turns the cut
   *  property from a claim into something a demo can draw. */
  function safeEdgeFor(graph, chosenSoFar, candidate) {
    const dsu = createDsu(graph.n, null);

    chosenSoFar.forEach(function (edge) { dsu.union(edge.from, edge.to); });
    const side = dsu.find(candidate.from);
    const inside = [];

    for (let v = 0; v < graph.n; v += 1) {
      if (dsu.find(v) !== side) continue;
      inside.push(v);
    }
    let lightest = Infinity;

    graph.edges.forEach(function (edge) {
      const a = dsu.find(edge.from);
      const b = dsu.find(edge.to);

      if ((a === side) === (b === side)) return;
      lightest = Math.min(lightest, edge.weight);
    });
    return { inside: inside, lightestCrossing: lightest,
      isSafe: candidate.weight === lightest };
  }

  /* -------------------------------------------- minimax / bottleneck paths */

  /**
   * The minimax path between two vertices: minimise the maximum edge weight
   * along the way. The answer is the maximum edge on the MST path between
   * them, which is the connection worth knowing - the MST already answers a
   * question people usually reach for a separate algorithm to solve.
   */
  function bottleneck(n, mstEdges, source, target) {
    const adjacency = [];

    for (let v = 0; v < n; v += 1) adjacency.push([]);
    mstEdges.forEach(function (edge) {
      adjacency[edge.from].push({ to: edge.to, weight: edge.weight });
      adjacency[edge.to].push({ to: edge.from, weight: edge.weight });
    });
    const seen = new Array(n).fill(false);
    const stack = [{ node: source, worst: 0 }];

    seen[source] = true;

    while (stack.length) {
      const frame = stack.pop();

      if (frame.node === target) return frame.worst;
      adjacency[frame.node].forEach(function (edge) {
        if (seen[edge.to]) return;
        seen[edge.to] = true;
        stack.push({ node: edge.to, worst: Math.max(frame.worst, edge.weight) });
      });
    }
    return Infinity;
  }

  /**
   * The oracle: binary-search the threshold, keeping only edges at or below
   * it, and ask whether source still reaches target. Slow, and it makes no
   * reference to the MST at all - which is what makes it a check.
   */
  function bottleneckByBruteForce(graph, source, target) {
    const weights = graph.edges.map(function (edge) { return edge.weight; })
      .sort(function (a, b) { return a - b; });
    let low = 0;
    let high = weights.length - 1;
    let best = Infinity;

    while (low <= high) {
      const mid = (low + high) >> 1;

      if (reachableUnder(graph, source, target, weights[mid])) {
        best = weights[mid];
        high = mid - 1;
      } else low = mid + 1;
    }
    return best;
  }

  function reachableUnder(graph, source, target, threshold) {
    const dsu = createDsu(graph.n, null);

    graph.edges.forEach(function (edge) {
      if (edge.weight > threshold) return;
      dsu.union(edge.from, edge.to);
    });
    return dsu.find(source) === dsu.find(target);
  }

  /**
   * The second-best spanning tree: for each MST edge, remove it and find the
   * best replacement. The answer differs from the MST by exactly one edge,
   * which is a theorem worth demonstrating rather than stating.
   */
  function secondBest(graph, mstEdges) {
    const inTree = new Set(mstEdges.map(function (edge) { return edge.id; }));
    const baseWeight = mstEdges.reduce(function (a, edge) { return a + edge.weight; }, 0);
    let best = null;

    mstEdges.forEach(function (removed) {
      const kept = mstEdges.filter(function (edge) { return edge.id !== removed.id; });
      const dsu = createDsu(graph.n, null);

      kept.forEach(function (edge) { dsu.union(edge.from, edge.to); });

      graph.edges.forEach(function (edge, id) {
        if (inTree.has(id) || dsu.find(edge.from) === dsu.find(edge.to)) return;
        const weight = baseWeight - removed.weight + edge.weight;

        if (best !== null && weight >= best.weight) return;
        best = { weight: weight, removed: removed.id, added: id };
      });
    });
    return best;
  }

  /** The MST is unique exactly when no two edges share a weight in a way that
   *  matters. Distinct weights are sufficient, and the demo needs to know. */
  function weightsAreDistinct(graph) {
    const seen = new Set();
    let duplicates = 0;

    graph.edges.forEach(function (edge) {
      if (seen.has(edge.weight)) { duplicates += 1; return; }
      seen.add(edge.weight);
    });
    return { distinct: duplicates === 0, duplicates: duplicates };
  }

  return {
    emptyReport: emptyReport, createDsu: createDsu,
    kruskal: kruskal, prim: prim, boruvka: boruvka,
    checkSpanning: checkSpanning, safeEdgeFor: safeEdgeFor,
    bottleneck: bottleneck, bottleneckByBruteForce: bottleneckByBruteForce,
    secondBest: secondBest, weightsAreDistinct: weightsAreDistinct
  };
}));
