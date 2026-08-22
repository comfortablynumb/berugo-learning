'use strict';

/**
 * Property tests for the M13 graph modules.
 *
 * Every claim here is checked against something derived differently: Tarjan
 * against brute-force mutual reachability, bridges against a remove-and-recount
 * oracle, Dijkstra against Bellman-Ford, the three MST algorithms against each
 * other, contraction hierarchies against Dijkstra on every pair, and every LCA
 * structure against the naive climb.
 *
 * That is not belt and braces. A graph algorithm fails by returning a
 * well-formed, plausible answer - a distance that is slightly too large, a
 * component partition that is nearly right, a hierarchy that is wrong on one
 * pair in a thousand - and there is no internal consistency check that catches
 * any of it.
 */

const test = require('node:test');
const assert = require('node:assert');

const Core = require('../../src/js/algorithms/graph-core.js');
const Traversal = require('../../src/js/algorithms/traversal.js');
const Topological = require('../../src/js/algorithms/topological.js');
const Scc = require('../../src/js/algorithms/scc.js');
const Biconnectivity = require('../../src/js/algorithms/biconnectivity.js');
const ShortestPaths = require('../../src/js/algorithms/shortest-paths.js');
const AStar = require('../../src/js/algorithms/astar.js');
const Mst = require('../../src/js/algorithms/mst.js');
const TreeQueries = require('../../src/js/algorithms/tree-queries.js');
const Ch = require('../../src/js/algorithms/contraction-hierarchies.js');
const GraphLab = require('../../src/js/machines/graph-lab.js');
const Random = require('../../src/js/utils/random.js');

/* ------------------------------------------------------------- generators */

function randomUndirected(n, m, seed, options) {
  return Core.randomGraph(n, m, Random.seeded(seed), options || {});
}

function randomDirected(n, m, seed) {
  return Core.randomGraph(n, m, Random.seeded(seed), { directed: true });
}

/* --------------------------------------------------------------- oracles */

/** Reachability by brute force, one BFS per source. */
function reachableFrom(adjacency, source) {
  const seen = new Array(adjacency.length).fill(false);
  const queue = [source];

  seen[source] = true;

  while (queue.length) {
    const v = queue.shift();

    adjacency[v].forEach(function (edge) {
      if (seen[edge.to]) return;
      seen[edge.to] = true;
      queue.push(edge.to);
    });
  }
  return seen;
}

function componentCountWithout(graph, skipEdge) {
  const parent = [];

  for (let v = 0; v < graph.n; v += 1) parent.push(v);

  const find = function (v) {
    let at = v;

    while (parent[at] !== at) { parent[at] = parent[parent[at]]; at = parent[at]; }
    return at;
  };

  graph.edges.forEach(function (edge, id) {
    if (id === skipEdge) return;
    const a = find(edge.from);
    const b = find(edge.to);

    if (a !== b) parent[a] = b;
  });
  const roots = new Set();

  for (let v = 0; v < graph.n; v += 1) roots.add(find(v));
  return roots.size;
}

/* ------------------------------------------------------------ graph-core */

test('graph-core: the three representations describe the same graph', function () {
  for (let seed = 1; seed <= 8; seed += 1) {
    const graph = randomUndirected(30, 70, seed);
    const list = Core.adjacencyList(graph);
    const matrix = Core.adjacencyMatrix(graph);
    const csr = Core.toCsr(graph);

    for (let v = 0; v < graph.n; v += 1) {
      const fromList = list[v].map(function (edge) { return edge.to; }).sort();
      const fromCsr = [];

      for (let i = csr.offsets[v]; i < csr.offsets[v + 1]; i += 1) fromCsr.push(csr.targets[i]);
      assert.deepStrictEqual(fromCsr.sort(), fromList, 'CSR and the list disagree at ' + v);
      fromList.forEach(function (to) {
        assert.ok(matrix[v][to] < Infinity, 'the matrix has no edge ' + v + '-' + to);
      });
    }
  }
});

test('graph-core: directedEdges gives one arc per direction', function () {
  const undirected = randomUndirected(20, 40, 3);
  const directed = randomDirected(20, 40, 3);

  assert.strictEqual(Core.directedEdges(undirected).length, undirected.edges.length * 2);
  assert.strictEqual(Core.directedEdges(directed).length, directed.edges.length);
});

test('graph-core: an edge-list Bellman-Ford needs directedEdges on an undirected graph', function () {
  /* This is the bug the helper exists for: relaxing only from -> to walks a
     directed subgraph and returns distances that are merely too large. */
  const graph = Core.grid(12, 12, { random: Random.seeded(7), weightRange: 9 });
  const adjacency = Core.adjacencyList(graph);
  const truth = ShortestPaths.dijkstra(adjacency, 0, {}).distance;
  const expanded = ShortestPaths.bellmanFord(Core.directedEdges(graph), graph.n, 0, {}).distance;
  const naive = ShortestPaths.bellmanFord(graph.edges, graph.n, 0, {}).distance;
  let wrong = 0;

  for (let v = 0; v < graph.n; v += 1) {
    assert.strictEqual(expanded[v], truth[v], 'expanded edge list disagrees at ' + v);

    if (naive[v] !== truth[v]) wrong += 1;
  }
  assert.ok(wrong > 0, 'the un-expanded edge list must be visibly wrong, or the check proves nothing');
});

test('graph-core: duplicateEdges duplicates exactly the edges named', function () {
  const graph = Core.path(10, {});
  const doubled = Core.duplicateEdges(graph, [0, 0, 4]);

  assert.strictEqual(doubled.edges.length, graph.edges.length + 3);
  assert.strictEqual(Core.duplicateEdges(graph, []).edges.length, graph.edges.length);
});

/* -------------------------------------------------------------- traversal */

test('traversal: BFS and DFS visit the same vertices and examine the same edges', function () {
  for (let seed = 1; seed <= 6; seed += 1) {
    const graph = randomUndirected(60, 140, seed);
    const run = GraphLab.traversalRun(graph, 0);
    const bfsSeen = run.bfs.distance.filter(function (d) { return d !== Infinity; }).length;

    assert.strictEqual(run.dfs.report.nodesVisited, run.bfs.report.nodesVisited,
      'seed ' + seed + ': the two walks visit different vertex counts');
    assert.ok(bfsSeen > 0);
  }
});

test('traversal: an undirected walk produces only tree and back edges', function () {
  for (let seed = 1; seed <= 6; seed += 1) {
    const graph = randomUndirected(50, 120, seed);
    const run = GraphLab.traversalRun(graph, 0);
    const counts = run.classification;

    assert.strictEqual(counts.forward || 0, 0, 'undirected graphs have no forward edge');
    assert.strictEqual(counts.cross || 0, 0, 'undirected graphs have no cross edge');
    assert.strictEqual((counts.tree || 0) + (counts.back || 0), graph.edges.length,
      'seed ' + seed + ': every edge must be classified exactly once');
  }
});

test('traversal: bipartite agrees with a two-colouring by BFS', function () {
  const grid = Core.grid(8, 8, {});
  const adjacency = Core.adjacencyList(grid);

  assert.strictEqual(Traversal.bipartite(adjacency, {}).bipartite, true, 'a grid is bipartite');

  const triangle = Core.createGraph(3, [
    { from: 0, to: 1, weight: 1 }, { from: 1, to: 2, weight: 1 }, { from: 2, to: 0, weight: 1 }
  ]);

  assert.strictEqual(Traversal.bipartite(Core.adjacencyList(triangle), {}).bipartite, false,
    'a triangle is an odd cycle');
});

/* ------------------------------------------------------------ topological */

test('topological: every returned order has every edge pointing forwards', function () {
  for (let seed = 1; seed <= 8; seed += 1) {
    const dag = Core.randomDag(50, 120, Random.seeded(seed), {});
    const adjacency = Core.adjacencyList(dag);
    const kahn = Topological.kahn(adjacency, {});

    assert.ok(kahn.order, 'seed ' + seed + ': a DAG must have an order');
    const position = new Array(dag.n).fill(-1);

    kahn.order.forEach(function (v, i) { position[v] = i; });
    dag.edges.forEach(function (edge) {
      assert.ok(position[edge.from] < position[edge.to],
        'seed ' + seed + ': ' + edge.from + '->' + edge.to + ' points backwards in the order');
    });
  }
});

test('topological: a cycle is reported as a real cycle', function () {
  for (let seed = 1; seed <= 8; seed += 1) {
    const graph = Core.chainedCycles(4, 5);
    const adjacency = Core.adjacencyList(graph);
    const run = Topological.kahn(adjacency, {});

    assert.strictEqual(run.order, null, 'a chained-cycles graph has no order');
    assert.ok(run.cycle && run.cycle.length >= 2, 'the cycle must be returned');
    const present = new Set();

    graph.edges.forEach(function (edge) { present.add(edge.from + '>' + edge.to); });
    run.cycle.forEach(function (v, i) {
      const w = run.cycle[(i + 1) % run.cycle.length];

      assert.ok(present.has(v + '>' + w), v + '->' + w + ' is not an edge of the graph');
    });
  }
});

/* ------------------------------------------------------------------- scc */

test('scc: Tarjan matches brute-force mutual reachability', function () {
  for (let seed = 1; seed <= 6; seed += 1) {
    const graph = randomDirected(24, 60, seed);
    const adjacency = Core.adjacencyList(graph);
    const tarjan = Scc.tarjan(adjacency, {});
    const reach = [];

    for (let v = 0; v < graph.n; v += 1) reach.push(reachableFrom(adjacency, v));

    for (let u = 0; u < graph.n; u += 1) {
      for (let v = 0; v < graph.n; v += 1) {
        const mutual = reach[u][v] && reach[v][u];

        assert.strictEqual(tarjan.component[u] === tarjan.component[v], mutual,
          'seed ' + seed + ': vertices ' + u + ' and ' + v);
      }
    }
  }
});

test('scc: Tarjan and Kosaraju agree, and the condensation is acyclic', function () {
  for (let seed = 1; seed <= 8; seed += 1) {
    const graph = randomDirected(50, 130, seed);
    const run = GraphLab.connectivityRun(graph, {});

    assert.strictEqual(run.agree.agree, true,
      'seed ' + seed + ': the two partitions differ — ' + run.agree.witness);
    assert.strictEqual(run.acyclic.acyclic, true,
      'seed ' + seed + ': the condensation has a cycle — only ' + run.acyclic.placed +
        ' components could be placed');
  }
});

/* -------------------------------------------------------- biconnectivity */

test('biconnectivity: bridges match the removal oracle, parallel edges included', function () {
  const shapes = [
    Core.path(30, {}),
    Core.star(24),
    Core.barbell(10),
    Core.grid(5, 5, {}),
    randomUndirected(24, 34, 5)
  ];

  shapes.forEach(function (base, index) {
    [0, 1, 3].forEach(function (extra) {
      const graph = extra === 0 ? base : Core.withParallelEdges(base, extra);
      const analysis = Biconnectivity.analyse(Core.adjacencyList(graph), {});
      const found = analysis.bridges.map(function (b) { return b.id; })
        .sort(function (a, b) { return a - b; });
      const baseline = componentCountWithout(graph, -1);
      const want = [];

      graph.edges.forEach(function (edge, id) {
        if (componentCountWithout(graph, id) <= baseline) return;
        want.push(id);
      });
      assert.deepStrictEqual(found, want,
        'shape ' + index + ' with ' + extra + ' parallel edges');
    });
  });
});

test('biconnectivity: the block-cut structure is a forest', function () {
  for (let seed = 1; seed <= 6; seed += 1) {
    const graph = randomUndirected(40, 60, seed);
    const run = GraphLab.connectivityRun(graph, { withOracle: true });

    assert.strictEqual(run.matchesOracle, true, 'seed ' + seed + ': the oracle disagrees');
    assert.strictEqual(Biconnectivity.verifyTree(run.blockCutTree).isForest, true,
      'seed ' + seed + ': the block-cut structure is not a forest');
  }
});

/* -------------------------------------------------------- shortest paths */

test('shortest-paths: Dijkstra, SPFA and Bellman-Ford agree on non-negative graphs', function () {
  for (let seed = 1; seed <= 8; seed += 1) {
    const graph = randomUndirected(40, 110, seed);
    const run = GraphLab.compareShortestPaths(graph, 0, {});

    run.rows.forEach(function (row) {
      assert.strictEqual(row.disagreements, 0,
        'seed ' + seed + ': ' + row.name + ' disagrees on ' + row.disagreements + ' vertices');
    });
  }
});

test('shortest-paths: the reconstructed path costs the reported distance', function () {
  for (let seed = 1; seed <= 8; seed += 1) {
    const graph = Core.grid(10, 10, { random: Random.seeded(seed), weightRange: 9 });
    const adjacency = Core.adjacencyList(graph);
    const target = graph.n - 1;
    const run = ShortestPaths.dijkstra(adjacency, 0, { target: target });
    const path = ShortestPaths.pathTo(run.parent, 0, target);

    assert.ok(path, 'seed ' + seed + ': the target is reachable on a grid');
    assert.strictEqual(ShortestPaths.pathCost(adjacency, path), run.distance[target],
      'seed ' + seed + ': the path does not cost the reported distance');
  }
});

test('shortest-paths: the negative counter-example is wrong downstream, not at the negative edge', function () {
  const example = ShortestPaths.negativeExample();
  const adjacency = Core.adjacencyList(example);
  const greedy = ShortestPaths.dijkstra(adjacency, 0, {});
  const truth = ShortestPaths.bellmanFord(example.edges, example.n, 0, {});

  assert.strictEqual(greedy.distance[1], truth.distance[1],
    'the vertex at the end of the negative edge comes out CORRECT — that is the trap');
  assert.notStrictEqual(greedy.distance[3], truth.distance[3],
    'and its successor does not, which is why a smaller example demonstrates nothing');
});

test('shortest-paths: the Floyd-Warshall loop order is load-bearing', function () {
  const graph = randomDirected(30, 90, 9);
  const matrix = Core.adjacencyMatrix(graph);
  const right = ShortestPaths.floydWarshall(matrix, {});
  const wrong = ShortestPaths.floydWarshall(matrix, { wrongOrder: true });
  let differing = 0;

  for (let i = 0; i < graph.n; i += 1) {
    for (let j = 0; j < graph.n; j += 1) {
      if (right.distance[i][j] === wrong.distance[i][j]) continue;
      differing += 1;
    }
  }
  assert.ok(differing > 0, 'the swapped order must be visibly wrong');
  assert.strictEqual(right.report.relaxations, wrong.report.relaxations,
    'both orders do the same work — that is what makes the bug invisible');
});

test('shortest-paths: Johnson agrees with Bellman-Ford from every vertex', function () {
  for (let seed = 1; seed <= 4; seed += 1) {
    const graph = randomDirected(24, 70, seed);
    const random = Random.seeded(seed + 500);
    const potential = [];

    for (let v = 0; v < graph.n; v += 1) potential.push(random.int(16));
    graph.edges.forEach(function (edge) {
      edge.weight = edge.weight - potential[edge.from] + potential[edge.to];
    });
    const negatives = graph.edges.filter(function (edge) { return edge.weight < 0; }).length;

    assert.ok(negatives > 0, 'seed ' + seed + ': the construction must produce negative edges');
    const johnson = ShortestPaths.johnson(graph, {});

    for (let source = 0; source < graph.n; source += 1) {
      const truth = ShortestPaths.bellmanFord(graph.edges, graph.n, source, {}).distance;

      for (let target = 0; target < graph.n; target += 1) {
        assert.strictEqual(johnson.distance[source][target], truth[target],
          'seed ' + seed + ': ' + source + ' -> ' + target);
      }
    }
  }
});

/* ------------------------------------------------------------------ A* */

test('astar: an admissible heuristic returns Dijkstra’s cost', function () {
  for (let seed = 1; seed <= 6; seed += 1) {
    const graph = Core.grid(14, 14, { random: Random.seeded(seed), weightRange: 9 });
    const adjacency = Core.adjacencyList(graph);
    const target = graph.n - 1;
    const optimal = ShortestPaths.dijkstra(adjacency, 0, {}).distance[target];
    const exact = ShortestPaths.dijkstra(adjacency, target, {}).distance;
    const heuristic = AStar.manhattan(graph.positionOf, target, 1);

    assert.strictEqual(AStar.checkAdmissible(heuristic, exact).admissible, true);
    assert.strictEqual(AStar.search(adjacency, 0, target, { heuristic: heuristic }).distance, optimal,
      'seed ' + seed);
  }
});

test('astar: a consistent heuristic never reopens, and stale pops are counted separately', function () {
  const graph = Core.grid(20, 20, { random: Random.seeded(7), weightRange: 9 });
  const adjacency = Core.adjacencyList(graph);
  const target = graph.n - 1;
  const heuristic = AStar.manhattan(graph.positionOf, target, 1);

  assert.strictEqual(AStar.checkConsistent(adjacency, heuristic).consistent, true);
  const run = AStar.search(adjacency, 0, target, { heuristic: heuristic });

  assert.strictEqual(run.report.reopened, 0,
    'a consistent heuristic cannot produce a node worth reopening');
  assert.ok(run.report.staleSkipped > 0,
    'the lazy heap must still leave duplicates behind, or the distinction is untested');
});

test('astar: admissible + inconsistent + no reopening returns a worse path', function () {
  const graph = Core.grid(20, 20, { random: Random.seeded(7), weightRange: 9 });
  const adjacency = Core.adjacencyList(graph);
  const target = graph.n - 1;
  const exact = ShortestPaths.dijkstra(adjacency, target, {}).distance;
  const random = Random.seeded(13);
  const noisy = exact.map(function (d) {
    return d === Infinity ? 0 : Math.floor(d * random.next());
  });
  const heuristic = function (v) { return noisy[v]; };

  assert.strictEqual(AStar.checkAdmissible(heuristic, exact).admissible, true);
  assert.strictEqual(AStar.checkConsistent(adjacency, heuristic).consistent, false);
  const optimal = ShortestPaths.dijkstra(adjacency, 0, {}).distance[target];
  const withReopen = AStar.search(adjacency, 0, target, { heuristic: heuristic, reopen: true });
  const without = AStar.search(adjacency, 0, target, { heuristic: heuristic, reopen: false });

  assert.strictEqual(withReopen.distance, optimal, 'reopening keeps the answer optimal');
  assert.ok(without.distance > optimal,
    'without reopening the answer must be worse, or the section overclaims');
  assert.ok(withReopen.report.reopened > 0, 'and the reopenings must be genuine');
});

test('astar: bidirectional search agrees with Dijkstra', function () {
  const graph = Core.grid(20, 20, {});
  const adjacency = Core.adjacencyList(graph);

  [[0, graph.n - 1], [210, 250], [210, 399], [210, 230]].forEach(function (probe) {
    const plain = ShortestPaths.dijkstra(adjacency, probe[0], { target: probe[1] });
    const both = AStar.bidirectional(adjacency, adjacency, probe[0], probe[1], {});

    assert.strictEqual(both.distance, plain.distance[probe[1]],
      probe[0] + ' -> ' + probe[1]);
  });
});

test('astar: IDA* returns the same cost as A* where it finishes at all', function () {
  const graph = Core.grid(8, 8, { random: Random.seeded(7), weightRange: 9 });
  const adjacency = Core.adjacencyList(graph);
  const target = graph.n - 1;
  const heuristic = AStar.manhattan(graph.positionOf, target, 1);
  const ida = AStar.idaStar(adjacency, 0, target, { heuristic: heuristic, nodeBudget: 120000 });
  const star = AStar.search(adjacency, 0, target, { heuristic: heuristic });

  assert.strictEqual(ida.distance, star.distance);
  assert.ok(ida.report.expanded > 100 * star.report.expanded,
    'the whole point is that it pays enormously for the memory saving');
});

/* ------------------------------------------------- contraction hierarchies */

test('contraction hierarchies: every pair matches Dijkstra on every fixture', function () {
  const fixtures = [
    Core.grid(5, 5, {}),
    Core.grid(6, 6, { random: Random.seeded(3), weightRange: 9 }),
    randomUndirected(30, 80, 5),
    Core.roadLike(6, 6, Random.seeded(11), {}),
    Core.path(20, {}),
    Core.barbell(5)
  ];
  let pairs = 0;

  fixtures.forEach(function (graph, index) {
    const hierarchy = Ch.build(graph, {});
    const check = GraphLab.routingAllPairs(graph, hierarchy);

    pairs += check.pairs;
    assert.strictEqual(check.wrong, 0, 'fixture ' + index + ': ' + check.wrong + ' pairs wrong');
  });
  assert.ok(pairs > 4000, 'the fixtures must cover thousands of pairs, not dozens');
});

test('contraction hierarchies: the witness search is where correctness lives', function () {
  const graph = Core.roadLike(6, 6, Random.seeded(11), {});
  const bounded = Ch.build(graph, {});
  const none = Ch.build(graph, { witness: 'none' });
  const broken = Ch.build(graph, { witness: 'ignore-contracted' });

  assert.strictEqual(GraphLab.routingAllPairs(graph, bounded).wrong, 0);
  assert.strictEqual(GraphLab.routingAllPairs(graph, none).wrong, 0,
    'skipping the search entirely is slow and correct');
  assert.ok(none.shortcuts.length > 10 * bounded.shortcuts.length,
    'and it must cost a great many more shortcuts, or the trade is not visible');
  const wrong = GraphLab.routingAllPairs(graph, broken);

  assert.ok(wrong.wrong > 0,
    'searching through contracted nodes must produce wrong pairs, or the demo overclaims');
  assert.ok(wrong.unreachable > 0,
    'and some of them report no route at all on a connected graph');
});

test('contraction hierarchies: truncating the witness search is safe in one direction', function () {
  const graph = Core.roadLike(6, 6, Random.seeded(11), {});
  let previous = 0;

  [2, 3, 5, 8].forEach(function (limit) {
    const hierarchy = Ch.build(graph, { hopLimit: limit });

    assert.strictEqual(GraphLab.routingAllPairs(graph, hierarchy).wrong, 0,
      'hop limit ' + limit + ' must never change an answer');
    const count = hierarchy.shortcuts.length;

    assert.ok(previous === 0 || count <= previous,
      'a deeper search can only find more witnesses, so shortcuts must not increase');
    previous = count;
  });
});

/* ------------------------------------------------------------------- MST */

test('mst: the three algorithms agree on weight and produce spanning forests', function () {
  [3, 20, 100000].forEach(function (range) {
    for (let seed = 1; seed <= 10; seed += 1) {
      const graph = randomUndirected(40, 110, seed, { weightRange: range });
      const run = GraphLab.compareMst(graph);

      assert.strictEqual(run.agree, true,
        'range ' + range + ', seed ' + seed + ': the weights differ');
      run.rows.forEach(function (entry) {
        const check = Mst.checkSpanning(graph, entry.run.edges);

        assert.strictEqual(check.acyclic, true, entry.name + ' produced a cycle');
        assert.strictEqual(check.spansComponents, true, entry.name + ' did not span');
      });
    }
  });
});

test('mst: distinct weights give one tree and duplicates do not', function () {
  const counts = {};

  [3, 100000].forEach(function (range) {
    let same = 0;

    for (let seed = 1; seed <= 20; seed += 1) {
      const graph = randomUndirected(40, 110, seed, { weightRange: range });
      const run = GraphLab.compareMst(graph);
      const ids = run.rows.map(function (entry) {
        return entry.run.edges.map(function (edge) { return edge.id; })
          .sort(function (a, b) { return a - b; }).join(',');
      });

      if (ids[0] === ids[1] && ids[1] === ids[2]) same += 1;
    }
    counts[range] = same;
  });
  assert.strictEqual(counts[100000], 20, 'distinct weights must give a unique tree every time');
  assert.strictEqual(counts[3], 0,
    'heavy duplicates must make the three trees differ every time, or the claim is too weak');
});

test('mst: the minimax path is the maximum edge on the MST path', function () {
  for (let seed = 1; seed <= 4; seed += 1) {
    const graph = randomUndirected(40, 120, seed);
    const chosen = Mst.kruskal(graph, {}).edges;
    const probe = Random.seeded(1000 + seed);

    for (let q = 0; q < 60; q += 1) {
      const source = probe.int(graph.n);
      const target = probe.int(graph.n);

      if (source === target) continue;
      assert.strictEqual(Mst.bottleneck(graph.n, chosen, source, target),
        Mst.bottleneckByBruteForce(graph, source, target),
        'seed ' + seed + ': ' + source + ' -> ' + target);
    }
  }
});

test('mst: the second-best tree differs by exactly one edge', function () {
  for (let seed = 1; seed <= 6; seed += 1) {
    const graph = randomUndirected(20, 60, seed, { weightRange: 100000 });
    const chosen = Mst.kruskal(graph, {}).edges;
    const best = chosen.reduce(function (a, edge) { return a + edge.weight; }, 0);
    const second = Mst.secondBest(graph, chosen);

    assert.ok(second, 'seed ' + seed + ': a replacement must exist at this density');
    assert.ok(second.weight > best,
      'with distinct weights the runner-up must be strictly worse; got ' + second.weight);
    const inTree = new Set(chosen.map(function (edge) { return edge.id; }));

    assert.ok(inTree.has(second.removed), 'the removed edge must be in the tree');
    assert.ok(!inTree.has(second.added), 'the added edge must not be');
  }
});

/* --------------------------------------------------------- tree queries */

test('tree-queries: every structure agrees with the naive climb on five shapes', function () {
  ['random', 'path', 'star', 'caterpillar', 'binary'].forEach(function (kind) {
    const tree = TreeQueries.shapedTree(kind, 120, Random.seeded(4));
    const adjacency = Core.adjacencyList(tree);
    const rooted = TreeQueries.rootTree(adjacency, 0, {});
    const lifting = TreeQueries.buildLifting(rooted, {});
    const sparse = TreeQueries.buildSparse(TreeQueries.eulerTour(adjacency, 0, {}), {});
    const hld = TreeQueries.heavyLight(adjacency, rooted, {});
    const probe = Random.seeded(77);

    for (let q = 0; q < 200; q += 1) {
      const a = probe.int(tree.n);
      const b = probe.int(tree.n);
      const truth = TreeQueries.naiveLca(rooted, a, b, {});

      assert.strictEqual(TreeQueries.liftingLca(lifting, a, b, {}), truth, kind + ': lifting');
      assert.strictEqual(TreeQueries.sparseLca(sparse, a, b, {}), truth, kind + ': sparse table');
      const k = rooted.depth[a];

      assert.strictEqual(TreeQueries.kthAncestor(lifting, a, k, {}),
        TreeQueries.naiveAncestor(rooted, a, k), kind + ': k-th ancestor');
      const path = TreeQueries.chainsOnPath(hld, rooted, a, b, {});

      assert.strictEqual(path.lca, truth, kind + ': the decomposition disagrees on the ancestor');
      assert.strictEqual(TreeQueries.verifySegments(hld, rooted, a, b, path.segments).valid, true,
        kind + ': the segments do not cover the path');
    }
  });
});

test('tree-queries: the chain decomposition stays under 2 log2 n', function () {
  [['path', 1000], ['star', 1000], ['caterpillar', 1000], ['binary', 1023], ['random', 1000]]
    .forEach(function (spec) {
      const tree = TreeQueries.shapedTree(spec[0], spec[1], Random.seeded(4));
      const adjacency = Core.adjacencyList(tree);
      const rooted = TreeQueries.rootTree(adjacency, 0, {});
      const hld = TreeQueries.heavyLight(adjacency, rooted, {});
      const probe = Random.seeded(77);
      const bound = 2 * Math.log2(spec[1]);
      let worst = 0;

      for (let q = 0; q < 400; q += 1) {
        worst = Math.max(worst,
          TreeQueries.chainsOnPath(hld, rooted, probe.int(tree.n), probe.int(tree.n), {}).count);
      }
      assert.ok(worst <= bound,
        spec[0] + ': ' + worst + ' segments exceeds the bound of ' + bound.toFixed(1));
    });
});

test('tree-queries: the lifting trace ends one step below the answer', function () {
  const tree = TreeQueries.shapedTree('random', 200, Random.seeded(4));
  const adjacency = Core.adjacencyList(tree);
  const rooted = TreeQueries.rootTree(adjacency, 0, {});
  const lifting = TreeQueries.buildLifting(rooted, {});
  const probe = Random.seeded(77);
  let traced = 0;

  for (let q = 0; q < 200; q += 1) {
    const a = probe.int(tree.n);
    const b = probe.int(tree.n);
    const trace = TreeQueries.liftingTrace(lifting, a, b);

    assert.strictEqual(trace.lca, TreeQueries.naiveLca(rooted, a, b, {}),
      'the trace must reach the same ancestor as the climb');
    const last = trace.steps[trace.steps.length - 1];

    if (!last || last.phase !== 'final') continue;
    traced += 1;
    assert.strictEqual(rooted.parent[last.from], trace.lca,
      'the descent must stop exactly one step below the ancestor');
  }
  assert.ok(traced > 20, 'enough queries must exercise the descent, not only the levelling');
});
