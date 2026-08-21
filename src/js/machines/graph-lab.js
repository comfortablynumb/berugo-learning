/**
 * GraphLab - the harness every M13 section drives.
 *
 * One place that knows how to build a graph, run an algorithm on it and
 * report the counters, so that "A* expands fewer nodes than Dijkstra" is a
 * comparison between two runs measured by the same instrument rather than two
 * numbers from two harnesses.
 *
 * Two things it deliberately does *not* do.
 *
 * It does not cache graphs by object identity - every call rebuilds from the
 * seed. A section that mutates a shared graph while another section holds a
 * reference to it is the kind of bug that takes an afternoon, and rebuilding
 * a ten-thousand-edge graph is a millisecond.
 *
 * It does not hide a disagreement. `compareShortestPaths` runs several
 * algorithms and returns the number of vertices they disagree on as a
 * *field*. A shortest-path bug produces a plausible number, so the
 * disagreement count is the only thing that separates a working comparison
 * from a broken one - and an exception would make the demo unusable exactly
 * when it is most interesting.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GraphLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function modules() {
    if (typeof module !== 'undefined' && module.exports) {
      return {
        Core: require('../algorithms/graph-core.js'),
        Traversal: require('../algorithms/traversal.js'),
        Topological: require('../algorithms/topological.js'),
        Scc: require('../algorithms/scc.js'),
        Biconnectivity: require('../algorithms/biconnectivity.js'),
        ShortestPaths: require('../algorithms/shortest-paths.js'),
        AStar: require('../algorithms/astar.js'),
        Mst: require('../algorithms/mst.js'),
        TreeQueries: require('../algorithms/tree-queries.js'),
        Ch: require('../algorithms/contraction-hierarchies.js'),
        Random: require('../utils/random.js')
      };
    }
    return {
      Core: scope.GraphCore, Traversal: scope.Traversal, Topological: scope.Topological,
      Scc: scope.Scc, Biconnectivity: scope.Biconnectivity, ShortestPaths: scope.ShortestPaths,
      AStar: scope.AStar, Mst: scope.Mst, TreeQueries: scope.TreeQueries,
      Ch: scope.ContractionHierarchies, Random: scope.Random
    };
  }

  const SHAPES = ['grid', 'random', 'scale-free', 'road-like', 'path', 'star',
    'barbell', 'dag', 'chained-cycles'];

  /* ------------------------------------------------------------ generation */

  /**
   * One entry point for every shape, so a section's control panel is a select
   * over `SHAPES` rather than a switch statement repeated per section.
   */
  function build(spec) {
    const M = modules();
    const settings = spec || {};
    const random = M.Random.seeded(settings.seed === undefined ? 1 : settings.seed);
    const n = settings.n || 200;

    if (settings.shape === 'grid') {
      return M.Core.grid(settings.rows || 12, settings.columns || 12,
        { random: settings.weighted ? random : null, weightRange: settings.weightRange || 9 });
    }

    if (settings.shape === 'road-like') {
      return M.Core.roadLike(settings.rows || 12, settings.columns || 12, random, {});
    }

    if (settings.shape === 'scale-free') return M.Core.scaleFree(n, settings.attachments || 2, random, settings);

    if (settings.shape === 'path') return M.Core.path(n, settings);

    if (settings.shape === 'star') return M.Core.star(n);

    if (settings.shape === 'barbell') return M.Core.barbell(Math.max(3, Math.floor(n / 2)));

    if (settings.shape === 'dag') return M.Core.randomDag(n, settings.m || n * 2, random, settings);

    if (settings.shape === 'chained-cycles') {
      return M.Core.chainedCycles(settings.components || 5, settings.size || 4);
    }
    return M.Core.randomGraph(n, settings.m || n * 2, random, settings);
  }

  /** Everything a section wants to say about a graph before running anything. */
  function describe(graph) {
    const M = modules();
    return {
      name: graph.name,
      n: graph.n,
      edges: graph.edges.length,
      directed: Boolean(graph.directed),
      memory: M.Core.memoryOf(graph),
      degrees: M.Core.degreeStats(graph),
      wellFormed: M.Core.checkWellFormed(graph).valid
    };
  }

  /* ------------------------------------------------------------ traversal */

  /** BFS and DFS on the same graph, so the frontier and the stack can be
   *  compared rather than described. */
  function traversalRun(graph, source) {
    const M = modules();
    const adjacency = M.Core.adjacencyList(graph);
    const bfs = M.Traversal.bfs(adjacency, source, {});
    const dfs = M.Traversal.dfs(adjacency, { sources: [source], directed: graph.directed });
    return {
      adjacency: adjacency, bfs: bfs, dfs: dfs,
      classification: M.Traversal.classificationCounts(dfs.classified),
      components: M.Traversal.components(adjacency, {}),
      bipartite: graph.directed ? null : M.Traversal.bipartite(adjacency, {})
    };
  }

  /* -------------------------------------------------------- shortest paths */

  /**
   * Several shortest-path algorithms on one instance, with the number of
   * vertices they disagree on reported as a field. On a graph with negative
   * edges the disagreement is the point rather than a failure.
   */
  function compareShortestPaths(graph, source, options) {
    const M = modules();
    const settings = options || {};
    const adjacency = M.Core.adjacencyList(graph);
    const rows = [];
    const truth = M.ShortestPaths.bellmanFord(graph.edges, graph.n, source, {});

    rows.push(row('Bellman-Ford', truth.distance, truth.report, truth.distance));
    const dijkstra = M.ShortestPaths.dijkstra(adjacency, source, {});
    rows.push(row('Dijkstra', dijkstra.distance, dijkstra.report, truth.distance));
    const spfa = M.ShortestPaths.spfa(adjacency, source, {});
    rows.push(row('SPFA', spfa.distance, spfa.report, truth.distance));

    if (settings.includeZeroOne) {
      const zeroOne = M.ShortestPaths.zeroOneBfs(adjacency, source, {});
      rows.push(row('0-1 BFS', zeroOne.distance, zeroOne.report, truth.distance));
    }
    return { rows: rows, truth: truth, dijkstra: dijkstra, adjacency: adjacency,
      negativeCycle: truth.negativeCycle };
  }

  function row(name, distance, report, truth) {
    let wrong = 0;

    distance.forEach(function (value, v) {
      if (value === truth[v]) return;
      wrong += 1;
    });
    return { name: name, distance: distance, report: report, disagreements: wrong };
  }

  /* ------------------------------------------------------------- heuristics */

  /**
   * Dijkstra and A* under several heuristics on the same query, with the
   * optimality gap measured rather than bounded. Every row reports its
   * admissibility, checked against exact distances.
   */
  function compareHeuristics(graph, source, target, options) {
    const M = modules();
    const settings = options || {};
    const adjacency = M.Core.adjacencyList(graph);
    const exact = M.ShortestPaths.dijkstra(adjacency, target, {}).distance;
    const baseline = M.ShortestPaths.dijkstra(adjacency, source, {});
    const optimal = baseline.distance[target];
    const rows = [{ name: 'Dijkstra', distance: optimal, expanded: baseline.report.settled,
      gap: 0, admissible: true, consistent: true }];

    (settings.heuristics || []).forEach(function (entry) {
      const run = M.AStar.search(adjacency, source, target,
        { heuristic: entry.heuristic, weight: entry.weight || 1, reopen: entry.reopen !== false });
      rows.push({
        name: entry.name,
        distance: run.distance,
        expanded: run.report.expanded,
        reopened: run.report.reopened,
        gap: optimal === 0 ? 0 : (run.distance - optimal) / optimal,
        admissible: M.AStar.checkAdmissible(entry.heuristic, exact).admissible,
        consistent: M.AStar.checkConsistent(adjacency, entry.heuristic).consistent,
        pathValid: M.ShortestPaths.pathCost(adjacency, run.path) === run.distance
      });
    });
    return { rows: rows, optimal: optimal, adjacency: adjacency };
  }

  /* -------------------------------------------------------------- the MSTs */

  /** All three MST algorithms on one graph. The invariant is equal *weight*,
   *  not an equal tree - with duplicate weights the trees may differ. */
  function compareMst(graph) {
    const M = modules();
    const adjacency = M.Core.adjacencyList(graph);
    const kruskal = M.Mst.kruskal(graph, {});
    const prim = M.Mst.prim(graph, adjacency, {});
    const boruvka = M.Mst.boruvka(graph, {});
    const rows = [
      { name: 'Kruskal', run: kruskal, work: kruskal.report.sortCost + kruskal.report.finds },
      { name: 'Prim', run: prim, work: prim.report.comparisons + prim.report.pushes },
      { name: 'Borůvka', run: boruvka, work: boruvka.report.edgesConsidered + boruvka.report.finds }
    ];
    const weights = rows.map(function (entry) { return entry.run.weight; });
    return { rows: rows, agree: weights.every(function (w) { return w === weights[0]; }),
      distinct: M.Mst.weightsAreDistinct(graph), adjacency: adjacency };
  }

  /* ---------------------------------------------------------- connectivity */

  /** SCCs both ways plus the condensation, or bridges plus the removal
   *  oracle - whichever the graph's directedness makes meaningful. */
  function connectivityRun(graph, options) {
    const M = modules();
    const settings = options || {};
    const adjacency = M.Core.adjacencyList(graph);

    if (graph.directed) {
      const tarjan = M.Scc.tarjan(adjacency, {});
      const kosaraju = M.Scc.kosaraju(adjacency, M.Core.adjacencyList(M.Core.reverse(graph)), {});
      const condensed = M.Scc.condensation(adjacency, tarjan.component, tarjan.components.length);
      return { directed: true, tarjan: tarjan, kosaraju: kosaraju, condensation: condensed,
        agree: M.Scc.agree(tarjan.component, kosaraju.component),
        acyclic: M.Scc.verifyAcyclic(condensed), profile: M.Scc.sizeProfile(tarjan.components) };
    }
    const analysis = M.Biconnectivity.analyse(adjacency, {});
    const oracle = settings.withOracle && graph.n <= 400
      ? M.Biconnectivity.bridgesByRemoval(graph) : null;
    return { directed: false, analysis: analysis, oracle: oracle,
      matchesOracle: oracle ? M.Biconnectivity.sameEdges(analysis.bridges, oracle).same : null,
      blockCutTree: M.Biconnectivity.blockCutTree(graph, analysis) };
  }

  /* ---------------------------------------------------------------- routing */

  /** Dijkstra, bidirectional Dijkstra and a contraction hierarchy on one
   *  query, with the preprocessing cost reported beside the query saving. */
  function compareRouting(graph, source, target, options) {
    const M = modules();
    const settings = options || {};
    const adjacency = M.Core.adjacencyList(graph);
    const plain = M.ShortestPaths.dijkstra(adjacency, source, { target: target });
    const bidirectional = M.AStar.bidirectional(adjacency, adjacency, source, target, {});
    const hierarchy = settings.hierarchy || M.Ch.build(graph, { hopLimit: settings.hopLimit });
    const chQuery = M.Ch.query(hierarchy, source, target, {});
    return {
      hierarchy: hierarchy,
      size: M.Ch.sizeOf(graph, hierarchy),
      rows: [
        { name: 'Dijkstra', distance: plain.distance[target], settled: plain.report.settled },
        { name: 'bidirectional Dijkstra', distance: bidirectional.distance,
          settled: bidirectional.report.expanded },
        { name: 'contraction hierarchy', distance: chQuery.distance,
          settled: chQuery.report.settledForward + chQuery.report.settledBackward }
      ],
      agree: Math.abs(chQuery.distance - plain.distance[target]) < 1e-9 &&
        Math.abs(bidirectional.distance - plain.distance[target]) < 1e-9
    };
  }

  /* -------------------------------------------------------- tree queries */

  /** The three LCA implementations on one tree, checked against the naive
   *  climb - which is the only one that cannot be subtly wrong. */
  function compareLca(tree, queries) {
    const M = modules();
    const adjacency = M.Core.adjacencyList(tree);
    const rooted = M.TreeQueries.rootTree(adjacency, 0, {});
    const lifting = M.TreeQueries.buildLifting(rooted, {});
    const euler = M.TreeQueries.eulerTour(adjacency, 0, {});
    const sparse = M.TreeQueries.buildSparse(euler, {});
    const hld = M.TreeQueries.heavyLight(adjacency, rooted, {});
    const naiveReport = M.TreeQueries.emptyReport();
    const liftReport = M.TreeQueries.emptyReport();
    const sparseReport = M.TreeQueries.emptyReport();
    let wrong = 0;
    let worstSegments = 0;

    queries.forEach(function (pair) {
      const truth = M.TreeQueries.naiveLca(rooted, pair[0], pair[1], { report: naiveReport });

      if (M.TreeQueries.liftingLca(lifting, pair[0], pair[1], { report: liftReport }) !== truth) wrong += 1;

      if (M.TreeQueries.sparseLca(sparse, pair[0], pair[1], { report: sparseReport }) !== truth) wrong += 1;
      const path = M.TreeQueries.chainsOnPath(hld, rooted, pair[0], pair[1], {});
      worstSegments = Math.max(worstSegments, path.count);
    });
    return { rooted: rooted, lifting: lifting, sparse: sparse, hld: hld, disagreements: wrong,
      worstSegments: worstSegments, naiveReport: naiveReport, liftReport: liftReport,
      sparseReport: sparseReport };
  }

  return {
    SHAPES: SHAPES, modules: modules,
    build: build, describe: describe, traversalRun: traversalRun,
    compareShortestPaths: compareShortestPaths, compareHeuristics: compareHeuristics,
    compareMst: compareMst, connectivityRun: connectivityRun,
    compareRouting: compareRouting, compareLca: compareLca
  };
}));
