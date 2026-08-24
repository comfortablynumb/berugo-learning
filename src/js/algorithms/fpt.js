/**
 * Parameterised algorithms: exponential in the parameter, polynomial in the data.
 *
 * "NP-hard" says nothing about the instance in front of you. What it says is
 * that no algorithm is polynomial in the SIZE of the instance for every
 * instance. Parameterised complexity replaces that with a sharper question:
 * pick a number k that describes the part of the problem that is actually
 * small — the size of the answer you will accept, the width of the structure,
 * the number of exceptions — and ask for `f(k) · n^O(1)`. That is a promise
 * about the shape of the cost rather than a hope about the instance.
 *
 * Vertex cover is the worked example because all three techniques land on it
 * cleanly and their effects are separable:
 *
 *   - **Branch and reduce.** Pick an uncovered edge; one of its two endpoints
 *     is in the cover, so branch on both and drop k by one. That is 2^k · n
 *     with no cleverness at all. Branching on a high-degree vertex instead —
 *     take it, or take all of its neighbours — gives the 1.47^k bound, and the
 *     module reports the measured branching factor rather than quoting it.
 *   - **Kernelisation.** Before searching, shrink. A vertex of degree above k
 *     must be in any cover of size k (covering its edges one by one would cost
 *     more than k), an isolated vertex never is, and once those rules are
 *     exhausted an instance with more than k² edges is a NO. That is Buss's
 *     kernel, and the striking part is that it is a POLYNOMIAL-time preprocess
 *     whose output size depends only on k.
 *   - **Dynamic programming over a tree decomposition.** If the graph is
 *     nearly a tree, the parameter is the width rather than the answer size,
 *     and the cost is 2^w · n for a decomposition of width w. The module
 *     builds a decomposition from a min-degree elimination ordering, which is
 *     a heuristic, so the width it reports is an upper bound and the code says
 *     so rather than calling it the treewidth.
 *
 * Every one of them is checked against brute force on every fixture, because
 * a kernelisation rule that is subtly too aggressive returns a smaller cover
 * for an instance that has none, and nothing else notices.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Fpt = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* ------------------------------------------------------------- the shape */

  /**
   * An instance is a vertex set (so kernelisation can delete vertices without
   * renumbering), an edge list over it, and the budget k. `forced` carries the
   * vertices a reduction rule has already committed to, which is what makes a
   * kernel's answer mappable back to the original instance.
   */
  function instanceFrom(graph, k) {
    const alive = new Set();

    for (let v = 0; v < graph.n; v += 1) alive.add(v);
    return { n: graph.n, alive: alive, edges: graph.edges.map(function (edge) {
      return { from: edge.from, to: edge.to };
    }), k: k, forced: [] };
  }

  function liveEdges(instance) {
    return instance.edges.filter(function (edge) {
      return instance.alive.has(edge.from) && instance.alive.has(edge.to);
    });
  }

  function degrees(instance) {
    const out = new Map();

    instance.alive.forEach(function (v) { out.set(v, 0); });
    liveEdges(instance).forEach(function (edge) {
      out.set(edge.from, out.get(edge.from) + 1);
      out.set(edge.to, out.get(edge.to) + 1);
    });
    return out;
  }

  function neighboursOf(instance, vertex) {
    const out = [];

    liveEdges(instance).forEach(function (edge) {
      if (edge.from === vertex) out.push(edge.to);
      if (edge.to === vertex) out.push(edge.from);
    });
    return out;
  }

  /* --------------------------------------------------------- brute force */

  /**
   * Every subset of size at most k, in increasing size, so the first hit is a
   * minimum cover. 2ⁿ, and it is the oracle for everything else.
   */
  function bruteForceCover(graph, k) {
    const total = Math.pow(2, graph.n);
    let best = null;
    let examined = 0;

    for (let mask = 0; mask < total; mask += 1) {
      examined += 1;
      const chosen = [];
      for (let v = 0; v < graph.n; v += 1) { if ((mask >>> v) & 1) chosen.push(v); }
      if (k !== undefined && chosen.length > k) continue;
      if (best !== null && chosen.length >= best.length) continue;
      if (!coversAll(graph, chosen)) continue;
      best = chosen;
    }
    return { found: best !== null, cover: best, size: best === null ? null : best.length,
      examined: examined };
  }

  function coversAll(graph, chosen) {
    const set = new Set(chosen);

    for (let i = 0; i < graph.edges.length; i += 1) {
      const edge = graph.edges[i];
      if (!set.has(edge.from) && !set.has(edge.to)) return false;
    }
    return true;
  }

  /* -------------------------------------------------- branch and reduce */

  /**
   * `rule` selects the branching. 'edge' takes an arbitrary uncovered edge and
   * branches on its two endpoints: 2^k, and the honest baseline. 'degree'
   * branches on a highest-degree vertex — either it is in the cover, or every
   * one of its neighbours is — which is what produces a base below 2 and is
   * the reason the measured branching factor is worth reporting.
   */
  function branchAndReduce(graph, k, options) {
    const settings = options || {};
    const state = { nodes: 0, reductions: 0, budget: settings.budget === undefined
      ? 2000000 : settings.budget, exhausted: false,
      rule: settings.rule === undefined ? 'degree' : settings.rule,
      reduce: settings.reduce !== false };
    const found = searchCover(instanceFrom(graph, k), state);

    return { found: found !== null, cover: found, size: found === null ? null : found.length,
      nodes: state.nodes, reductions: state.reductions, exhausted: state.exhausted,
      rule: state.rule, k: k };
  }

  function searchCover(instance, state) {
    state.nodes += 1;
    if (state.nodes > state.budget) { state.exhausted = true; return null; }
    const reduced = state.reduce ? applyRules(instance, state) : instance;

    if (reduced === null) return null;
    const edges = liveEdges(reduced);
    if (edges.length === 0) return reduced.forced.slice();
    if (reduced.k <= 0) return null;
    return branchOn(reduced, edges, state);
  }

  function branchOn(instance, edges, state) {
    const branches = state.rule === 'degree'
      ? degreeBranches(instance)
      : [[edges[0].from], [edges[0].to]];

    for (let b = 0; b < branches.length; b += 1) {
      const taken = branches[b];
      if (taken.length > instance.k) continue;
      const found = searchCover(withTaken(instance, taken), state);
      if (found !== null) return found;
    }
    return null;
  }

  /** Take the highest-degree vertex, or take all of its neighbours. */
  function degreeBranches(instance) {
    const degree = degrees(instance);
    let best = null;

    degree.forEach(function (count, vertex) {
      if (best === null || count > degree.get(best)) best = vertex;
    });
    return [[best], neighboursOf(instance, best)];
  }

  function withTaken(instance, taken) {
    const alive = new Set(instance.alive);

    taken.forEach(function (v) { alive.delete(v); });
    return { n: instance.n, alive: alive, edges: instance.edges, k: instance.k - taken.length,
      forced: instance.forced.concat(taken) };
  }

  /* --------------------------------------------------------- the kernel */

  /**
   * The two reduction rules, applied to a fixed point. Returns `null` when a
   * rule proves the instance is a NO — which is the case the rules exist for
   * and the case a careless implementation turns into a wrong answer.
   */
  function applyRules(instance, state) {
    let current = instance;
    let moved = true;

    while (moved) {
      moved = false;
      const degree = degrees(current);
      const isolated = [];
      let high = null;

      degree.forEach(function (count, vertex) {
        if (count === 0) isolated.push(vertex);
        if (count > current.k && high === null) high = vertex;
      });
      if (isolated.length > 0) { current = withDropped(current, isolated); moved = true; }
      if (high === null) continue;
      if (current.k <= 0) return null;
      if (state) state.reductions += 1;
      current = withTaken(current, [high]);
      moved = true;
    }
    return current;
  }

  /** Dropping a vertex removes it without charging the budget. */
  function withDropped(instance, vertices) {
    const alive = new Set(instance.alive);

    vertices.forEach(function (v) { alive.delete(v); });
    return { n: instance.n, alive: alive, edges: instance.edges, k: instance.k,
      forced: instance.forced };
  }

  /**
   * Buss's kernel. Apply the rules, then read the size: an instance whose
   * reduced graph has more than k² edges is a NO, because every surviving
   * vertex has degree at most k and a cover of k vertices can therefore reach
   * at most k² edges. The output is a graph on at most k² + k vertices whose
   * size does not depend on n at all.
   */
  function bussKernel(graph, k) {
    const reduced = applyRules(instanceFrom(graph, k), null);

    if (reduced === null) {
      return { decided: true, answer: false, reason: 'a reduction rule ran the budget to zero',
        forced: [], vertices: 0, edges: 0, k: 0, bound: k * k };
    }
    const edges = liveEdges(reduced);
    const touched = new Set();

    edges.forEach(function (edge) { touched.add(edge.from); touched.add(edge.to); });
    if (edges.length > reduced.k * reduced.k) {
      return { decided: true, answer: false, forced: reduced.forced, vertices: touched.size,
        edges: edges.length, k: reduced.k, bound: reduced.k * reduced.k,
        reason: edges.length + ' edges is more than k² = ' + (reduced.k * reduced.k) };
    }
    return { decided: edges.length === 0, answer: edges.length === 0 ? true : null,
      forced: reduced.forced, vertices: touched.size, edges: edges.length, k: reduced.k,
      bound: reduced.k * reduced.k, graph: kernelGraph(touched, edges), reason: null };
  }

  /** The kernel as a standalone graph, plus the map back to the original ids. */
  function kernelGraph(touched, edges) {
    const order = Array.from(touched).sort(function (a, b) { return a - b; });
    const index = new Map();

    order.forEach(function (v, i) { index.set(v, i); });
    return { n: order.length, directed: false, name: 'buss-kernel',
      edges: edges.map(function (edge) {
        return { from: index.get(edge.from), to: index.get(edge.to), weight: 1 };
      }), original: order };
  }

  /** Kernelise, search the kernel, and map the answer back to the source. */
  function kernelThenSearch(graph, k, options) {
    const kernel = bussKernel(graph, k);

    if (kernel.decided) {
      return { found: kernel.answer === true, cover: kernel.answer === true
        ? kernel.forced.slice() : null, kernel: kernel, nodes: 0 };
    }
    const solved = branchAndReduce(kernel.graph, kernel.k, options);

    if (!solved.found) return { found: false, cover: null, kernel: kernel, nodes: solved.nodes };
    const mapped = solved.cover.map(function (v) { return kernel.graph.original[v]; });
    return { found: true, cover: kernel.forced.concat(mapped).sort(function (a, b) {
      return a - b;
    }), kernel: kernel, nodes: solved.nodes };
  }

  /* ---------------------------------------- treewidth and the DP over it */

  /**
   * A min-degree elimination ordering and the decomposition it induces. The
   * width it reports is an UPPER BOUND on treewidth — min-degree is a
   * heuristic and computing treewidth exactly is itself NP-hard — and calling
   * the number "the treewidth" is the standard overclaim.
   */
  function treeDecomposition(graph) {
    const fill = adjacencySets(graph);
    const remaining = new Set(fill.keys());
    const bags = [];
    let width = 0;

    while (remaining.size > 0) {
      const vertex = minDegreeVertex(fill, remaining);
      const bag = [vertex].concat(Array.from(fill.get(vertex)).filter(function (u) {
        return remaining.has(u);
      }));
      width = Math.max(width, bag.length - 1);
      connectNeighbours(fill, bag.slice(1));
      remaining.delete(vertex);
      bags.push({ vertices: bag.slice().sort(function (a, b) { return a - b; }),
        eliminated: vertex });
    }
    return { bags: bags, width: width, tree: linkBags(bags), exact: false,
      note: 'min-degree elimination — an upper bound on treewidth, not the treewidth' };
  }

  function adjacencySets(graph) {
    const out = new Map();

    for (let v = 0; v < graph.n; v += 1) out.set(v, new Set());
    graph.edges.forEach(function (edge) {
      out.get(edge.from).add(edge.to);
      out.get(edge.to).add(edge.from);
    });
    return out;
  }

  function minDegreeVertex(fill, remaining) {
    let best = null;
    let bestDegree = Infinity;

    remaining.forEach(function (v) {
      let degree = 0;
      fill.get(v).forEach(function (u) { if (remaining.has(u)) degree += 1; });
      if (degree >= bestDegree) return;
      bestDegree = degree;
      best = v;
    });
    return best;
  }

  /** Eliminating a vertex makes its surviving neighbours a clique. */
  function connectNeighbours(fill, neighbours) {
    for (let i = 0; i < neighbours.length; i += 1) {
      for (let j = i + 1; j < neighbours.length; j += 1) {
        fill.get(neighbours[i]).add(neighbours[j]);
        fill.get(neighbours[j]).add(neighbours[i]);
      }
    }
  }

  /**
   * Each bag's parent is the next bag containing the highest-numbered vertex
   * of the bag other than the one eliminated — the standard construction, and
   * the one that makes the running intersection property hold.
   */
  function linkBags(bags) {
    const position = new Map();

    bags.forEach(function (bag, i) { position.set(bag.eliminated, i); });
    return bags.map(function (bag, i) {
      let parent = -1;
      bag.vertices.forEach(function (v) {
        if (v === bag.eliminated) return;
        const at = position.get(v);
        if (at !== undefined && at > i && (parent === -1 || at < parent)) parent = at;
      });
      return { index: i, parent: parent };
    });
  }

  /**
   * Minimum vertex cover by DP over the decomposition. For every bag and every
   * subset of it that covers the bag's internal edges, the table holds the
   * cheapest cover of the subtree agreeing with that subset on the bag. Cost
   * is 2^(w+1) per bag, which is the fixed-parameter promise with width as the
   * parameter rather than answer size.
   */
  function coverByTreewidth(graph) {
    const decomposition = treeDecomposition(graph);
    const children = childrenOf(decomposition);
    const tables = new Array(decomposition.bags.length).fill(null);
    const order = postOrder(decomposition, children);
    let roots = 0;
    let total = 0;

    order.forEach(function (index) {
      tables[index] = bagTable(graph, decomposition.bags[index], children[index], tables,
        decomposition.bags);
    });
    decomposition.tree.forEach(function (link, index) {
      if (link.parent !== -1) return;
      roots += 1;
      total += bestOf(tables[index]);
    });
    return { size: total, width: decomposition.width, bags: decomposition.bags.length,
      roots: roots, states: Math.pow(2, decomposition.width + 1),
      decomposition: decomposition };
  }

  function childrenOf(decomposition) {
    const out = decomposition.bags.map(function () { return []; });

    decomposition.tree.forEach(function (link) {
      if (link.parent === -1) return;
      out[link.parent].push(link.index);
    });
    return out;
  }

  function postOrder(decomposition, children) {
    const out = [];
    const visit = function (index) {
      children[index].forEach(visit);
      out.push(index);
    };

    decomposition.tree.forEach(function (link) {
      if (link.parent === -1) visit(link.index);
    });
    return out;
  }

  /**
   * One bag's table. A state is a subset of the bag; it is legal when it
   * covers every edge with both endpoints in the bag. Its cost is its own size
   * plus, for each child, the cheapest compatible child state minus the
   * vertices they share — otherwise a shared vertex is paid for twice.
   */
  function bagTable(graph, bag, children, tables, bags) {
    const vertices = bag.vertices;
    const inside = internalEdges(graph, vertices);
    const table = new Map();

    for (let mask = 0; mask < (1 << vertices.length); mask += 1) {
      const chosen = subsetOf(vertices, mask);
      if (!coversInside(inside, chosen)) continue;
      let cost = chosen.size;
      let feasible = true;
      children.forEach(function (child) {
        const best = bestCompatible(tables[child], bags[child].vertices, chosen, vertices);
        if (best === null) { feasible = false; return; }
        cost += best;
      });
      if (feasible) table.set(mask, cost);
    }
    return { table: table, vertices: vertices };
  }

  function internalEdges(graph, vertices) {
    const set = new Set(vertices);

    return graph.edges.filter(function (edge) {
      return set.has(edge.from) && set.has(edge.to);
    });
  }

  function subsetOf(vertices, mask) {
    const out = new Set();

    vertices.forEach(function (v, i) { if ((mask >>> i) & 1) out.add(v); });
    return out;
  }

  function coversInside(edges, chosen) {
    for (let i = 0; i < edges.length; i += 1) {
      if (!chosen.has(edges[i].from) && !chosen.has(edges[i].to)) return false;
    }
    return true;
  }

  /** The cheapest child state agreeing with the parent on the shared vertices,
   *  with the shared chosen vertices refunded so they are counted once. */
  function bestCompatible(childTable, childVertices, chosen, parentVertices) {
    const shared = new Set(childVertices.filter(function (v) {
      return parentVertices.indexOf(v) !== -1;
    }));
    let best = null;

    childTable.table.forEach(function (cost, mask) {
      const childChosen = subsetOf(childVertices, mask);
      let agrees = true;
      shared.forEach(function (v) {
        if (childChosen.has(v) !== chosen.has(v)) agrees = false;
      });
      if (!agrees) return;
      let refund = 0;
      shared.forEach(function (v) { if (childChosen.has(v)) refund += 1; });
      const value = cost - refund;
      if (best === null || value < best) best = value;
    });
    return best;
  }

  function bestOf(entry) {
    let best = Infinity;

    entry.table.forEach(function (cost) { best = Math.min(best, cost); });
    return best === Infinity ? 0 : best;
  }

  /* ------------------------------------------------------ the measurement */

  /**
   * The branching factor, measured. Solve the same family at rising k, fit
   * nodes ≈ c·bᵏ through consecutive ratios, and report the geometric mean.
   * Quoting 1.4656 from the literature and printing whatever the code does is
   * how a "1.47^k algorithm" ends up being 2^k with a comment.
   */
  function branchingFactor(runs) {
    const usable = runs.filter(function (run) { return run.nodes > 1 && !run.exhausted; });
    const ratios = [];

    for (let i = 1; i < usable.length; i += 1) {
      const steps = usable[i].k - usable[i - 1].k;
      if (steps <= 0) continue;
      ratios.push(Math.pow(usable[i].nodes / usable[i - 1].nodes, 1 / steps));
    }
    if (ratios.length === 0) return { base: null, samples: 0 };
    const product = ratios.reduce(function (a, b) { return a * b; }, 1);
    return { base: Math.pow(product, 1 / ratios.length), samples: ratios.length,
      ratios: ratios };
  }

  return {
    instanceFrom: instanceFrom, liveEdges: liveEdges, degrees: degrees,
    bruteForceCover: bruteForceCover, coversAll: coversAll,
    branchAndReduce: branchAndReduce, applyRules: applyRules,
    bussKernel: bussKernel, kernelThenSearch: kernelThenSearch,
    treeDecomposition: treeDecomposition, coverByTreewidth: coverByTreewidth,
    branchingFactor: branchingFactor
  };
}));
