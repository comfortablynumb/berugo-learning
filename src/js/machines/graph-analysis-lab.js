/**
 * GraphAnalysisLab - the harness for the last three M14 sections.
 *
 * Colouring, layout and spectral analysis have nothing algorithmic in common,
 * but they share one awkward requirement: they all want a plain adjacency list
 * of neighbour indices, and every generator in the platform produces the
 * weighted `{ to, weight, id }` shape the shortest-path modules need. Rather
 * than converting in three section controllers, the conversion lives here once
 * and every generator is exposed through `build`.
 *
 * The second thing they share is that all three fail *plausibly*. A colouring
 * with a conflict still looks like a colouring, a layout with crossings still
 * looks like a picture, and a PageRank vector that leaks probability still
 * sorts into a ranking somebody will act on. So each run here carries its own
 * check - conflicts, energy monotonicity, mass conservation - as a field.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GraphAnalysisLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function modules() {
    if (typeof module !== 'undefined' && module.exports) {
      return {
        Core: require('../algorithms/graph-core.js'),
        Coloring: require('../algorithms/coloring.js'),
        Layout: require('../algorithms/layout.js'),
        Spectral: require('../algorithms/spectral.js'),
        Centrality: require('../algorithms/centrality.js'),
        Random: require('../utils/random.js')
      };
    }
    return { Core: scope.GraphCore, Coloring: scope.Coloring, Layout: scope.Layout,
      Spectral: scope.Spectral, Centrality: scope.Centrality, Random: scope.Random };
  }

  const SHAPES = ['random', 'clustered', 'interval', 'planar-grid', 'scale-free', 'wheel', 'bipartite'];

  /* ------------------------------------------------------------ generation */

  /** Strip the weight and id a shortest-path module needs; everything here
   *  cares only about who is adjacent to whom. */
  function plainAdjacency(graph) {
    return modules().Core.adjacencyList(graph).map(function (list) {
      return list.map(function (entry) { return entry.to; });
    });
  }

  /** Undirected edge list from an adjacency, each pair once, for drawing. */
  function edgesOf(adjacency) {
    const edges = [];

    adjacency.forEach(function (list, v) {
      list.forEach(function (u) { if (v < u) edges.push({ from: v, to: u }); });
    });
    return edges;
  }

  /**
   * One entry point for every shape. `clustered` and `bipartite` exist because
   * they are the two cases where the answers are *known*: a graph built from k
   * dense groups has k communities, and a bipartite graph is 2-colourable
   * whatever a greedy ordering happens to report.
   */
  function build(spec) {
    const settings = spec || {};
    const instance = shapeFor(settings.shape || 'random', settings);

    if (settings.connect === false) return instance;
    instance.joined = ensureConnected(instance.adjacency);
    return instance;
  }

  function shapeFor(shape, settings) {
    const random = modules().Random.seeded(settings.seed === undefined ? 1 : settings.seed);
    const n = settings.n || 30;

    if (shape === 'interval') return intervalShape(n, settings, random);

    if (shape === 'planar-grid') return gridShape(settings);

    if (shape === 'clustered') return clusteredShape(n, settings, random);

    if (shape === 'wheel') return wheelShape(n);

    if (shape === 'bipartite') return bipartiteShape(n, settings, random);

    if (shape === 'scale-free') {
      return { adjacency: plainAdjacency(modules().Core.scaleFree(n, settings.attachments || 2,
        random, {})), name: 'scale-free', n: n };
    }
    return { adjacency: plainAdjacency(modules().Core.randomGraph(n, settings.m || n * 2,
      random, {})), name: 'random', n: n };
  }

  /**
   * Join every component to the previous one. Three of the four questions in
   * these sections have a degenerate answer on a disconnected graph - the
   * Fiedler value is 0, the bisection cuts nothing, and betweenness is
   * undefined across components - so leaving an isolated vertex in by accident
   * silently replaces the demonstration with a trivial one.
   */
  function ensureConnected(adjacency) {
    const seen = new Array(adjacency.length).fill(false);
    const roots = [];

    for (let v = 0; v < adjacency.length; v += 1) {
      if (seen[v]) continue;
      roots.push(v);
      const queue = [v];

      seen[v] = true;

      while (queue.length) {
        const at = queue.pop();

        adjacency[at].forEach(function (u) {
          if (seen[u]) return;
          seen[u] = true;
          queue.push(u);
        });
      }
    }

    for (let i = 1; i < roots.length; i += 1) {
      adjacency[roots[i - 1]].push(roots[i]);
      adjacency[roots[i]].push(roots[i - 1]);
    }
    return roots.length - 1;
  }

  /** Intervals on a line, and the overlap graph they induce. Greedy in left
   *  endpoint order is provably optimal here, which is the whole point. */
  function intervalShape(n, settings, random) {
    const intervals = [];
    const span = settings.span || 60;

    for (let v = 0; v < n; v += 1) {
      const start = random.int(span);
      intervals.push({ start: start, end: start + 2 + random.int(settings.width || 8) });
    }
    const adjacency = modules().Coloring.intervalGraph(intervals);

    return { adjacency: adjacency, intervals: intervals, name: 'interval', n: n };
  }

  /** A grid is planar, bipartite and 2-colourable, which makes it the control
   *  case: any ordering that needs three colours here is the ordering's fault. */
  function gridShape(settings) {
    const rows = settings.rows || 6;
    const columns = settings.columns || 6;
    const graph = modules().Core.grid(rows, columns, {});

    return { adjacency: plainAdjacency(graph), name: 'planar-grid', n: rows * columns,
      rows: rows, columns: columns, positions: graph.positions };
  }

  /** k dense groups with a few links between them: the community structure is
   *  known by construction, so Louvain has something to be right or wrong about. */
  function clusteredShape(n, settings, random) {
    const groups = settings.groups || 4;
    const size = Math.max(3, Math.floor(n / groups));
    const adjacency = [];
    const truth = [];
    const seen = {};

    for (let v = 0; v < groups * size; v += 1) { adjacency.push([]); truth.push(Math.floor(v / size)); }

    function link(a, b) {
      const key = Math.min(a, b) + '-' + Math.max(a, b);

      if (a === b || seen[key]) return;
      seen[key] = true;
      adjacency[a].push(b);
      adjacency[b].push(a);
    }

    for (let g = 0; g < groups; g += 1) {
      for (let i = 0; i < size; i += 1) {
        for (let j = i + 1; j < size; j += 1) {
          if (random.next() > (settings.density || 0.7)) continue;
          link(g * size + i, g * size + j);
        }
      }
    }

    for (let i = 0; i < (settings.bridges || groups); i += 1) {
      link(random.int(adjacency.length), random.int(adjacency.length));
    }
    return { adjacency: adjacency, truth: truth, groups: groups,
      name: 'clustered', n: adjacency.length };
  }

  /** An odd wheel: the rim is an odd cycle needing three colours, the hub
   *  needs a fourth. It is the smallest graph where greedy ordering matters. */
  function wheelShape(n) {
    const rim = Math.max(5, (n - 1) % 2 === 0 ? n - 2 : n - 1);
    const adjacency = [];

    for (let v = 0; v <= rim; v += 1) adjacency.push([]);

    for (let v = 0; v < rim; v += 1) {
      const next = (v + 1) % rim;

      adjacency[v].push(next);
      adjacency[next].push(v);
      adjacency[v].push(rim);
      adjacency[rim].push(v);
    }
    return { adjacency: adjacency, name: 'wheel', n: rim + 1, rim: rim };
  }

  /** Two sides, edges only between them: 2-colourable, no odd cycle, and the
   *  case where every hard problem in this section turns easy. */
  function bipartiteShape(n, settings, random) {
    const half = Math.floor(n / 2);
    const adjacency = [];
    const seen = {};

    for (let v = 0; v < n; v += 1) adjacency.push([]);

    for (let i = 0; i < (settings.m || n * 2); i += 1) {
      const a = random.int(half);
      const b = half + random.int(n - half);
      const key = a + '-' + b;

      if (seen[key]) continue;
      seen[key] = true;
      adjacency[a].push(b);
      adjacency[b].push(a);
    }
    return { adjacency: adjacency, name: 'bipartite', n: n, half: half };
  }

  /* -------------------------------------------------------------- colouring */

  const ORDERS = ['natural', 'degree', 'degeneracy'];

  function orderFor(name, adjacency) {
    const C = modules().Coloring;

    if (name === 'degree') return { order: C.degreeOrder(adjacency), degeneracy: null };

    if (name === 'degeneracy') return C.degeneracyOrder(adjacency, {});
    return { order: C.naturalOrder(adjacency), degeneracy: null };
  }

  /**
   * The same graph greedily coloured in three orders, plus the exact chromatic
   * number when the graph is small enough to afford it. The colour count is
   * the whole story and it is entirely decided by the order.
   */
  function colouringRun(instance, options) {
    const C = modules().Coloring;
    const settings = options || {};
    const adjacency = instance.adjacency;
    const rows = ORDERS.map(function (name) {
      const chosen = orderFor(name, adjacency);
      const run = C.greedyColoring(adjacency, chosen.order, {});

      return { name: name, colours: run.colours, colour: run.colour,
        degeneracy: chosen.degeneracy, report: run.report,
        check: C.checkColoring(adjacency, run.colour) };
    });
    const limit = settings.exactLimit === undefined ? 18 : settings.exactLimit;
    const exact = C.chromaticNumber(adjacency, limit);
    const degeneracy = C.degeneracyOrder(adjacency, {}).degeneracy;

    return { rows: rows, exact: exact, degeneracy: degeneracy,
      bound: degeneracy + 1, best: Math.min.apply(null, rows.map(function (r) { return r.colours; })),
      worst: Math.max.apply(null, rows.map(function (r) { return r.colours; })),
      conflicts: rows.filter(function (r) { return !r.check.valid; }).length };
  }

  /**
   * Cliques with and without pivoting, plus the complement reading. A maximum
   * clique in G is a maximum independent set in the complement of G and a
   * minimum vertex cover is everything else - one problem, three names, and
   * the panel shows all three numbers adding up.
   */
  function cliqueRun(instance) {
    const C = modules().Coloring;
    const adjacency = instance.adjacency;
    const pivoted = C.bronKerbosch(adjacency, { pivot: true });
    const plain = C.bronKerbosch(adjacency, { pivot: false });
    const independent = C.bronKerbosch(C.complement(adjacency), { pivot: true });
    const clique = biggest(pivoted.cliques);
    const free = biggest(independent.cliques);

    return { pivoted: pivoted, plain: plain, independent: independent,
      clique: clique, free: free,
      cliqueCheck: C.checkClique(adjacency, clique),
      independentCheck: C.checkIndependent(adjacency, free),
      cover: adjacency.length - free.length,
      saving: plain.report.recursionNodes / Math.max(1, pivoted.report.recursionNodes) };
  }

  /** `bronKerbosch` reports the largest size but returns every maximal clique;
   *  the actual vertices are what a checker and a drawing both need. */
  function biggest(cliques) {
    let best = [];

    cliques.forEach(function (members) {
      if (members.length <= best.length) return;
      best = members;
    });
    return best;
  }

  /**
   * Chaitin's allocator, which is graph colouring with an escape hatch. Push
   * any vertex of degree below k onto a stack and delete it; when none is left,
   * spill the highest-degree survivor and carry on. Then pop, colouring each
   * vertex with a register none of its live neighbours holds.
   *
   * The spill count is the number this whole section is really about: a
   * compiler does not get to say "this function needs five registers and the
   * machine has four", so it pays in memory traffic instead.
   */
  function chaitinRun(adjacency, registers) {
    const degree = adjacency.map(function (list) { return list.length; });
    const removed = new Array(adjacency.length).fill(false);
    const stack = [];
    const spilled = [];

    for (let step = 0; step < adjacency.length; step += 1) {
      const pick = nextVertex(degree, removed, registers);

      removed[pick.v] = true;
      adjacency[pick.v].forEach(function (u) { if (!removed[u]) degree[u] -= 1; });

      if (pick.spill) spilled.push(pick.v);
      else stack.push(pick.v);
    }
    return colourStack(adjacency, stack, spilled, registers);
  }

  /** The lowest-degree vertex under k if one exists, otherwise the highest-
   *  degree vertex, which is the one that will be spilled. */
  function nextVertex(degree, removed, registers) {
    let low = -1;
    let high = -1;

    for (let v = 0; v < degree.length; v += 1) {
      if (removed[v]) continue;

      if (degree[v] < registers && (low === -1 || degree[v] < degree[low])) low = v;

      if (high === -1 || degree[v] > degree[high]) high = v;
    }
    return low !== -1 ? { v: low, spill: false } : { v: high, spill: true };
  }

  function colourStack(adjacency, stack, spilled, registers) {
    const colour = new Array(adjacency.length).fill(-1);

    for (let i = stack.length - 1; i >= 0; i -= 1) {
      const v = stack[i];
      const taken = new Set();

      adjacency[v].forEach(function (u) { if (colour[u] !== -1) taken.add(colour[u]); });

      for (let pick = 0; pick < registers; pick += 1) {
        if (taken.has(pick)) continue;
        colour[v] = pick;
        break;
      }
    }
    const failed = stack.filter(function (v) { return colour[v] === -1; }).length;

    return { registers: registers, colour: colour, spills: spilled.length,
      spilled: spilled, failed: failed, check: checkAllocated(adjacency, colour) };
  }

  /**
   * A spilled vertex has no register, so it is not part of the colouring and
   * must be excluded from the check. Feeding it in as one more colour makes
   * every pair of spilled neighbours look like a conflict, which is the
   * opposite of what happened.
   */
  function checkAllocated(adjacency, colour) {
    let conflicts = 0;

    adjacency.forEach(function (list, v) {
      if (colour[v] === -1) return;
      list.forEach(function (u) {
        if (u <= v || colour[u] !== colour[v]) return;
        conflicts += 1;
      });
    });
    return { conflicts: conflicts, valid: conflicts === 0 };
  }

  /* ----------------------------------------------------------------- layout */

  /**
   * The same graph laid out three ways, with the crossing count for each. The
   * crossing count is the only objective measure of a drawing anybody agrees
   * on, and it is what makes "which layout is better" a question with an
   * answer rather than a preference.
   */
  function layoutRun(instance, options) {
    const L = modules().Layout;
    const settings = options || {};
    const edges = edgesOf(instance.adjacency);
    const graph = { n: instance.adjacency.length, edges: edges };
    const force = L.forceLayout(graph, { steps: settings.steps || 200, seed: settings.seed || 1 });
    const circular = L.circularLayout(graph.n, 1);
    const layered = L.layeredLayout(directedOf(graph), { sweeps: settings.sweeps || 4 });

    return { graph: graph, edges: edges,
      force: force, circular: circular, layered: layered,
      crossings: { force: L.crossings(force.positions, edges),
        circular: L.crossings(circular, edges),
        layered: layered.positions ? L.crossings(layered.positions, edges) : null },
      pairs: edges.length * (edges.length - 1) / 2,
      euler: eulerCheck(graph) };
  }

  /**
   * The layout modules work in their own coordinates - the force model in
   * roughly [-1, 1], the layered one in grid cells - because a layout
   * algorithm that knows about pixels cannot be unit tested. Fitting to a
   * canvas is therefore the caller's job, and doing it in one place keeps the
   * three drawings comparable.
   */
  function fit(positions, width, height) {
    const pad = 24;
    const xs = positions.map(function (p) { return p.x; });
    const ys = positions.map(function (p) { return p.y; });
    const spanX = Math.max(1e-9, Math.max.apply(null, xs) - Math.min.apply(null, xs));
    const spanY = Math.max(1e-9, Math.max.apply(null, ys) - Math.min.apply(null, ys));
    const minX = Math.min.apply(null, xs);
    const minY = Math.min.apply(null, ys);

    return positions.map(function (p) {
      return { x: pad + ((p.x - minX) / spanX) * (width - 2 * pad),
        y: pad + ((p.y - minY) / spanY) * (height - 2 * pad) };
    });
  }

  /** The layered algorithm needs a DAG; orienting every edge low-to-high is
   *  the cheapest acyclic orientation and does not change the crossing count. */
  function directedOf(graph) {
    return { n: graph.n, directed: true,
      edges: graph.edges.map(function (edge) {
        return { from: Math.min(edge.from, edge.to), to: Math.max(edge.from, edge.to) };
      }) };
  }

  /** Euler's formula gives E <= 3V - 6 for any simple planar graph with V >= 3.
   *  Failing it proves non-planarity; passing it proves nothing, and saying so
   *  is the difference between a test and a heuristic. */
  function eulerCheck(graph) {
    const bound = graph.n >= 3 ? 3 * graph.n - 6 : graph.n;

    return { edges: graph.edges.length, bound: bound,
      exceeds: graph.edges.length > bound,
      verdict: graph.edges.length > bound ? 'certainly not planar' : 'not ruled out' };
  }

  /**
   * The two graphs Kuratowski's theorem is about. Every non-planar graph
   * contains a subdivision of one of them, and they are the pair that shows
   * why a counting bound is not a planarity test: E <= 3V - 6 catches K5 and
   * misses K3,3 entirely. The tighter bipartite bound E <= 2V - 4 catches the
   * second, and knowing you need a *different* bound per case is the point.
   */
  function kuratowskiFixtures() {
    const k5 = [];

    for (let v = 0; v < 5; v += 1) {
      k5.push([0, 1, 2, 3, 4].filter(function (u) { return u !== v; }));
    }
    const k33 = [];

    for (let v = 0; v < 6; v += 1) {
      k33.push(v < 3 ? [3, 4, 5] : [0, 1, 2]);
    }
    return [{ name: 'K5 — five vertices, all joined', adjacency: k5, bipartite: false },
      { name: 'K3,3 — three houses, three utilities', adjacency: k33, bipartite: true }];
  }

  /**
   * Euler's bound, plus the tighter one a bipartite graph obeys. Reporting
   * both is the only honest way to present a counting test: each proves
   * non-planarity when it fails and proves nothing when it holds.
   */
  function planarityChecks(instance) {
    const edges = edgesOf(instance.adjacency).length;
    const n = instance.adjacency.length;
    const general = n >= 3 ? 3 * n - 6 : n;
    const bipartite = n >= 3 ? 2 * n - 4 : n;

    return { n: n, edges: edges, general: general, bipartite: bipartite,
      failsGeneral: edges > general,
      failsBipartite: instance.bipartite === true && edges > bipartite,
      verdict: edges > general ? 'certainly not planar'
        : (instance.bipartite === true && edges > bipartite
          ? 'certainly not planar, by the bipartite bound only' : 'not ruled out') };
  }

  /** Energy per iteration, so "the layout converges" is a curve rather than a
   *  claim. Fruchterman-Reingold cools linearly and is not monotone in energy
   *  for the first few steps; the curve says so. */
  function energyCurve(instance, options) {
    const settings = options || {};
    const run = modules().Layout.forceLayout(
      { n: instance.adjacency.length, edges: edgesOf(instance.adjacency) },
      { steps: settings.steps || 200, seed: settings.seed || 1 });
    let rises = 0;

    run.energy.forEach(function (value, index) {
      if (index === 0 || value <= run.energy[index - 1]) return;
      rises += 1;
    });
    return { curve: run.energy, rises: rises, report: run.report,
      first: run.energy[0], last: run.energy[run.energy.length - 1] };
  }

  /* --------------------------------------------------------------- spectral */

  /**
   * PageRank by power iteration against a direct linear solve, betweenness by
   * Brandes against path enumeration, the Fiedler bisection against its own
   * cut count, and Louvain against an exhaustive modularity search. Four
   * answers, four independent checks.
   */
  function spectralRun(instance, options) {
    const S = modules().Spectral;
    const C = modules().Centrality;
    const settings = options || {};
    const adjacency = instance.adjacency;
    const rank = S.pageRank(adjacency, { damping: settings.damping || 0.85,
      tolerance: settings.tolerance || 1e-10 });
    const solved = S.pageRankBySolve(adjacency, { damping: settings.damping || 0.85 });
    const fiedler = S.spectralBisection(adjacency, {});
    const between = C.brandes(adjacency, {});

    return { rank: rank, solved: solved,
      rankGap: S.maxDifference(rank.rank, solved.rank),
      distribution: S.checkDistribution(rank.rank),
      fiedler: fiedler, betweenness: between,
      closeness: C.closeness(adjacency, {}),
      exactBetweenness: adjacency.length <= (settings.exactLimit || 40)
        ? C.betweennessByEnumeration(adjacency) : null };
  }

  /**
   * A directed link graph with dangling pages - pages that link to nothing.
   * Undirected graphs have none by construction, so the bug this section is
   * really about is invisible without a generator that makes them.
   */
  function webGraph(options) {
    const settings = options || {};
    const random = modules().Random.seeded(settings.seed === undefined ? 1 : settings.seed);
    const n = settings.n || 40;
    const dangling = settings.dangling === undefined ? Math.floor(n / 5) : settings.dangling;
    const adjacency = [];

    for (let v = 0; v < n; v += 1) adjacency.push([]);

    for (let v = dangling; v < n; v += 1) {
      const links = 1 + random.int(settings.links || 4);
      const seen = {};

      for (let i = 0; i < links; i += 1) {
        const target = random.int(n);

        if (target === v || seen[target]) continue;
        seen[target] = true;
        adjacency[v].push(target);
      }
    }
    return { adjacency: adjacency, name: 'web', n: n, dangling: dangling, directed: true };
  }

  /**
   * A search for the failure everybody quotes and nobody measures. The folk
   * claim is that dropping the dangling mass makes "the ranking drift"; this
   * runs both versions over thousands of small link graphs and counts strictly
   * inverted pairs. The answer is zero, every time, while the total leaks by
   * up to 85% - so the bug is invisible in exactly the output people check and
   * catastrophic in the one they do not.
   */
  function leakSearch(options) {
    const S = modules().Spectral;
    const settings = options || {};
    const n = settings.n || 5;
    let checked = 0;
    let inversions = 0;
    let worstLeak = 0;

    for (let seed = 1; seed <= (settings.trials || 6000); seed += 1) {
      const adjacency = smallLinkGraph(n, seed);

      if (!adjacency.some(function (list) { return list.length === 0; })) continue;
      const good = S.pageRank(adjacency, { tolerance: 1e-12 }).rank;
      const leaky = S.pageRank(adjacency, { tolerance: 1e-12, redistribute: false }).rank;

      checked += 1;
      worstLeak = Math.max(worstLeak, 1 - S.checkDistribution(leaky).total);
      inversions += countInversions(good, leaky);
    }
    return { checked: checked, inversions: inversions, worstLeak: worstLeak, size: n };
  }

  function smallLinkGraph(n, seed) {
    const random = modules().Random.seeded(seed);
    const adjacency = [];

    for (let v = 0; v < n; v += 1) {
      const links = [];
      const count = random.int(n);

      for (let i = 0; i < count; i += 1) {
        const target = random.int(n);

        if (target === v || links.indexOf(target) !== -1) continue;
        links.push(target);
      }
      adjacency.push(links);
    }
    return adjacency;
  }

  /** Pairs the two vectors order differently, with a tolerance - without one,
   *  floating-point noise on a three-way tie reads as an inversion. */
  function countInversions(a, b) {
    let count = 0;

    for (let i = 0; i < a.length; i += 1) {
      for (let j = 0; j < a.length; j += 1) {
        if (a[i] > a[j] + 1e-8 && b[i] < b[j] - 1e-8) count += 1;
      }
    }
    return count;
  }

  /**
   * PageRank with the dangling mass redistributed and without, on the same
   * graph. The unfixed version still produces a vector, still sorts into a
   * ranking, and still looks entirely reasonable - it just does not sum to
   * one, and the pages it ranks highest are not the same ones.
   */
  function pageRankRun(instance, options) {
    const S = modules().Spectral;
    const settings = options || {};
    const damping = settings.damping === undefined ? 0.85 : settings.damping;
    const good = S.pageRank(instance.adjacency, { damping: damping, tolerance: 1e-12 });
    const leaky = S.pageRank(instance.adjacency,
      { damping: damping, tolerance: 1e-12, redistribute: false });
    const solved = S.pageRankBySolve(instance.adjacency, { damping: damping });

    return { good: good, leaky: leaky, solved: solved,
      gap: S.maxDifference(good.rank, solved.rank),
      leakGap: S.maxDifference(good.rank, leaky.rank),
      goodTotal: S.checkDistribution(good.rank),
      leakyTotal: S.checkDistribution(leaky.rank),
      orderChanges: rankDisagreements(good.rank, leaky.rank) };
  }

  /** How many of the top ten differ once the ranking is sorted. A vector that
   *  is 30% too small everywhere would change no ordering at all; this counts
   *  what actually moved. */
  function rankDisagreements(a, b) {
    const orderOf = function (values) {
      return values.map(function (value, index) { return { value: value, index: index }; })
        .sort(function (x, y) { return y.value - x.value || x.index - y.index; })
        .map(function (entry) { return entry.index; });
    };
    const first = orderOf(a);
    const second = orderOf(b);
    let moved = 0;

    first.forEach(function (id, position) { if (second[position] !== id) moved += 1; });
    return { moved: moved, total: first.length,
      topTen: first.slice(0, 10).filter(function (id, position) {
        return second[position] !== id;
      }).length };
  }

  /**
   * Iterations to converge against the damping factor. The theory says the
   * error falls like d^k, so a smaller d converges faster and models a surfer
   * who gives up sooner - the trade nobody mentions when quoting 0.85.
   */
  function dampingSweep(instance, options) {
    const settings = options || {};

    return (settings.dampings || [0.5, 0.7, 0.85, 0.9, 0.95, 0.99]).map(function (damping) {
      const run = modules().Spectral.pageRank(instance.adjacency,
        { damping: damping, tolerance: settings.tolerance || 1e-10 });

      return { damping: damping, iterations: run.report.iterations,
        converged: Boolean(run.report.converged), top: topOf(run.rank),
        predicted: Math.ceil(Math.log(settings.tolerance || 1e-10) / Math.log(damping)) };
    });
  }

  function topOf(rank) {
    let best = 0;

    rank.forEach(function (value, index) { if (value > rank[best]) best = index; });
    return best;
  }

  /** Louvain against the exhaustive best modularity, plus the planted truth
   *  when the generator knows it. Modularity is a score, not an answer, and
   *  the two disagree often enough that reporting both is the honest option. */
  function communityRun(instance, options) {
    const C = modules().Centrality;
    const settings = options || {};
    const adjacency = instance.adjacency;
    const run = C.louvain(adjacency, { seed: settings.seed || 1 });
    const exact = adjacency.length <= (settings.exactLimit || 12)
      ? C.bestModularity(adjacency, 12) : null;
    const planted = instance.truth ? C.modularity(adjacency, instance.truth) : null;

    return { run: run, exact: exact, planted: planted,
      truth: instance.truth || null,
      matches: instance.truth ? agreement(run.community, instance.truth) : null };
  }

  /** How many pairs the two partitions agree about - same community in both,
   *  or different in both. The Rand index, which does not care about labels. */
  function agreement(found, truth) {
    let same = 0;
    let total = 0;

    for (let a = 0; a < truth.length; a += 1) {
      for (let b = a + 1; b < truth.length; b += 1) {
        total += 1;

        if ((found[a] === found[b]) === (truth[a] === truth[b])) same += 1;
      }
    }
    return { same: same, total: total, rand: total === 0 ? 1 : same / total };
  }

  return {
    SHAPES: SHAPES, ORDERS: ORDERS, modules: modules, build: build,
    plainAdjacency: plainAdjacency, edgesOf: edgesOf, ensureConnected: ensureConnected,
    colouringRun: colouringRun, cliqueRun: cliqueRun, orderFor: orderFor, biggest: biggest,
    chaitinRun: chaitinRun,
    layoutRun: layoutRun, energyCurve: energyCurve, eulerCheck: eulerCheck, fit: fit,
    kuratowskiFixtures: kuratowskiFixtures, planarityChecks: planarityChecks,
    spectralRun: spectralRun, communityRun: communityRun, agreement: agreement,
    webGraph: webGraph, pageRankRun: pageRankRun, dampingSweep: dampingSweep,
    leakSearch: leakSearch, countInversions: countInversions
  };
}));
