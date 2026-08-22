'use strict';

/**
 * Every figure the M13.4-M13.6 worked examples quote, recomputed from the
 * modules and then checked against the prose.
 */

const test = require('node:test');
const assert = require('node:assert');

const Core = require('../../src/js/algorithms/graph-core.js');
const Biconnectivity = require('../../src/js/algorithms/biconnectivity.js');
const ShortestPaths = require('../../src/js/algorithms/shortest-paths.js');
const GraphLab = require('../../src/js/machines/graph-lab.js');
const Format = require('../../src/js/utils/format.js');
const Random = require('../../src/js/utils/random.js');

require('../../src/js/content/concepts-graphs-paths.js');
require('../../src/js/content/examples-graphs-paths.js');
const prose = require('../support/worked-example-prose.js');

/* --------------------------------------------------------------- 13.4 */

/** The section's own recipe: shape, 40 nodes, seed 3, with redundant links
 *  duplicating the current bridges rather than arbitrary edges. */
function connectivity(shape, extra) {
  const side = Math.max(3, Math.round(Math.sqrt(40)));
  let graph = GraphLab.build({ shape: shape, n: 40, rows: side, columns: side,
    seed: 3, m: 56 });

  if (extra > 0) {
    const analysis = Biconnectivity.analyse(Core.adjacencyList(graph), {});

    graph = Core.duplicateEdges(graph, analysis.bridges.slice(0, extra)
      .map(function (bridge) { return bridge.id; }));
  }
  return { graph: graph, run: GraphLab.connectivityRun(graph, { withOracle: true }) };
}

test('bridges-and-cuts: a barbell has one bridge and one link removes it', function () {
  const base = connectivity('barbell', 0);
  const analysis = base.run.analysis;

  assert.strictEqual(base.graph.n, 40);
  assert.strictEqual(base.graph.edges.length, 381);
  assert.strictEqual(analysis.bridges.length, 1);
  assert.strictEqual(analysis.articulation.length, 2);
  assert.strictEqual(analysis.blocks.length, 3);
  assert.strictEqual(base.run.matchesOracle, true);
  assert.strictEqual(Format.fixed(100 * 1 / 381, 1), '0.3');
  assert.strictEqual(Format.fixed(100 * 2 / 40, 1), '5.0');
  prose.quotes('bridges-and-cuts', ['381', '0.3%', '5.0%', '3 blocks']);
});

test('bridges-and-cuts: redundancy removes bridges and leaves cut vertices alone', function () {
  const rows = [0, 1, 2, 4, 8].map(function (extra) {
    const state = connectivity('barbell', extra);

    return { extra: extra, bridges: state.run.analysis.bridges.length,
      cuts: state.run.analysis.articulation.length,
      blocks: state.run.analysis.blocks.length, oracle: state.run.matchesOracle };
  });

  assert.deepStrictEqual(rows.map(function (row) { return row.bridges; }), [1, 0, 0, 0, 0]);
  assert.deepStrictEqual(rows.map(function (row) { return row.cuts; }), [2, 2, 2, 2, 2]);
  assert.deepStrictEqual(rows.map(function (row) { return row.blocks; }), [3, 3, 3, 3, 3]);
  rows.forEach(function (row) { assert.strictEqual(row.oracle, true); });
  prose.quotes('bridges-and-cuts', ['1 to 0', '2', '3']);
});

test('bridges-and-cuts: a path is all bridges and redundancy is linear there', function () {
  const rows = [0, 1, 2, 4, 8].map(function (extra) {
    const state = connectivity('path', extra);

    return { bridges: state.run.analysis.bridges.length,
      cuts: state.run.analysis.articulation.length,
      blocks: state.run.analysis.blocks.length };
  });

  assert.deepStrictEqual(rows.map(function (row) { return row.bridges; }), [39, 38, 37, 35, 31]);
  assert.deepStrictEqual(rows.map(function (row) { return row.cuts; }), [38, 38, 38, 38, 38]);
  assert.deepStrictEqual(rows.map(function (row) { return row.blocks; }), [39, 39, 39, 39, 39]);
  assert.strictEqual(Format.fixed(100 * 39 / 39, 1), '100.0');
  assert.strictEqual(Format.fixed(100 * 38 / 40, 1), '95.0');
  prose.quotes('bridges-and-cuts', ['39', '38', '37', '35', '31', '100.0%', '95.0%']);
});

test('bridges-and-cuts: the parallel-edge case separates the two implementations', function () {
  const graph = Core.createGraph(3, [
    { from: 0, to: 1, weight: 1 }, { from: 0, to: 1, weight: 1 }, { from: 1, to: 2, weight: 1 }
  ]);
  const analysis = Biconnectivity.analyse(Core.adjacencyList(graph), {});
  const oracle = Biconnectivity.bridgesByRemoval(graph);

  assert.strictEqual(oracle.length, 1, 'only 1-2 is a bridge');
  assert.strictEqual(analysis.bridges.length, 1);
  assert.strictEqual(Biconnectivity.sameEdges(analysis.bridges, oracle).same, true);
  prose.quotes('bridges-and-cuts', ['1 of 3 edges']);
});

/* --------------------------------------------------------------- 13.5 */

/** The demo's own recipe: a 30 x 30 grid, seed 7, weights 1 to 9. */
function gridRun() {
  const graph = Core.grid(30, 30, { random: Random.seeded(7), weightRange: 9 });
  const adjacency = Core.adjacencyList(graph);
  return { graph: graph, adjacency: adjacency,
    compare: GraphLab.compareShortestPaths(graph, 0, {}),
    dijkstra: ShortestPaths.dijkstra(adjacency, 0, {}) };
}

test('shortest-paths-basics: three algorithms agree at 181 and pay differently', function () {
  const state = gridRun();
  const rows = state.compare.rows;
  const target = state.graph.n - 1;

  assert.strictEqual(state.graph.n, 900);
  rows.forEach(function (row) {
    assert.strictEqual(row.distance[target], 181, row.name + ' disagrees on the distance');
    assert.strictEqual(row.disagreements, 0, row.name + ' disagrees with Bellman-Ford');
  });
  assert.strictEqual(rows[0].report.relaxations, 20880);
  assert.strictEqual(rows[0].report.rounds, 6);
  assert.strictEqual(rows[1].report.relaxations, 3480);
  assert.strictEqual(rows[2].report.relaxations, 6516);
  prose.quotes('shortest-paths-basics', ['181', '900', '20 880', '6', '3 480', '6 516']);
});

test('shortest-paths-basics: the lazy heap costs 253 stale pops of 1 153', function () {
  const state = gridRun();
  const report = state.dijkstra.report;

  assert.strictEqual(report.pushes, 1153);
  assert.strictEqual(report.pops, 1153);
  assert.strictEqual(report.staleSkipped, 253);
  assert.strictEqual(report.settled, 900);
  assert.strictEqual(Format.fixed(100 * 253 / 1153, 1), '21.9');
  prose.quotes('shortest-paths-basics', ['1 153', '253', '21.9%', '900']);
});

test('shortest-paths-basics: the reconstructed path costs 181', function () {
  const state = gridRun();
  const target = state.graph.n - 1;
  const path = ShortestPaths.pathTo(state.dijkstra.parent, 0, target);

  assert.ok(path);
  assert.strictEqual(ShortestPaths.pathCost(state.adjacency, path), 181);
  prose.quotes('shortest-paths-basics', ['181']);
});

test('shortest-paths-basics: the counter-example is correct at 1 and wrong at 3', function () {
  const example = ShortestPaths.negativeExample();
  const adjacency = Core.adjacencyList(example);
  const greedy = ShortestPaths.dijkstra(adjacency, 0, {});
  const truth = ShortestPaths.bellmanFord(example.edges, example.n, 0, {});

  assert.strictEqual(greedy.distance[1], 1, 'd[1] comes out CORRECT — that is the trap');
  assert.strictEqual(truth.distance[1], 1);
  assert.strictEqual(greedy.distance[3], 3);
  assert.strictEqual(truth.distance[3], 2);
  prose.quotes('shortest-paths-basics', ['d[3] = 3', 'd[3] = 3 where Bellman-Ford gives 2']);
});

test('shortest-paths-basics: 0-1 BFS makes no comparisons at all', function () {
  /* The demo's own recipe: the same 30 x 30 grid with every weight redrawn as
     0 or 1 from seed 11.  A deque needs no ordering comparison; the heap's are
     counted as its pops, which is the work the deque removes. */
  const random = Random.seeded(11);
  const base = Core.grid(30, 30, {});
  const graph = Core.createGraph(base.n, base.edges.map(function (edge) {
    return { from: edge.from, to: edge.to, weight: random.int(2) };
  }), { name: 'zero-one grid' });
  const adjacency = Core.adjacencyList(graph);
  const deque = ShortestPaths.zeroOneBfs(adjacency, 0, {});
  const heap = ShortestPaths.dijkstra(adjacency, 0, {});

  assert.strictEqual(heap.report.pops, 1142, 'the heap pop count is the comparison column');

  for (let v = 0; v < graph.n; v += 1) {
    assert.strictEqual(deque.distance[v], heap.distance[v], 'the two disagree at ' + v);
  }
  prose.quotes('shortest-paths-basics', ['0 comparisons', '1 142', '900']);
});

/* --------------------------------------------------------------- 13.6 */

test('negative-weights: the arbitrage loop is two currencies at 1.007000', function () {
  const rates = [
    [1, 0.90, 0.76, 148.0],
    [1.11, 1, 0.88, 164.0],
    [1.30, 1.14, 1, 190.0],
    [0.0068, 0.0061, 0.0053, 1]
  ];
  const graph = ShortestPaths.arbitrageGraph(rates);
  const run = ShortestPaths.bellmanFord(graph.edges, graph.n, 0, {});
  const cycle = run.negativeCycle;

  assert.ok(cycle, 'the table admits arbitrage');
  assert.strictEqual(cycle.length, 2, 'the loop is two currencies');
  assert.strictEqual(run.report.rounds, 4);
  const verified = ShortestPaths.verifyNegativeCycle(graph.edges, cycle);

  assert.strictEqual(verified.valid, true);
  assert.strictEqual(Format.fixed(verified.weight, 4), '-0.0070');
  assert.strictEqual(ShortestPaths.cycleProfit(rates, cycle).toFixed(6), '1.007000');
  prose.quotes('negative-weights', ['4 currencies', '−0.0070', '1.007000', '0.70%']);
});

/** The section's own recipe: 40 nodes, 3 edges each, seed 9, then negative
 *  edges introduced by undoing a reweighting so no cycle can be negative. */
function allPairsGraph() {
  const graph = Core.randomGraph(40, 120, Random.seeded(9), { directed: true, weightRange: 20 });
  const random = Random.seeded(9 + 500);
  const potential = [];

  for (let v = 0; v < graph.n; v += 1) potential.push(random.int(16));
  graph.edges.forEach(function (edge) {
    edge.weight = edge.weight - potential[edge.from] + potential[edge.to];
  });
  return graph;
}

test('negative-weights: the swapped Floyd-Warshall loop is wrong on 554 of 1 600 cells', function () {
  const graph = allPairsGraph();
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
  assert.strictEqual(graph.n * graph.n, 1600);
  assert.strictEqual(differing, 554);
  assert.strictEqual(right.report.relaxations, 64000);
  assert.strictEqual(wrong.report.relaxations, 64000);
  assert.strictEqual(Format.fixed(100 * 554 / 1600, 1), '34.6');
  prose.quotes('negative-weights', ['64 000', '554', '1 600', '34.6%']);
});

test('negative-weights: Johnson costs 5 124 relaxations against 64 000', function () {
  const graph = allPairsGraph();
  const negatives = graph.edges.filter(function (edge) { return edge.weight < 0; }).length;
  const johnson = ShortestPaths.johnson(graph, {});
  let fromEvery = 0;

  for (let source = 0; source < graph.n; source += 1) {
    const run = ShortestPaths.bellmanFord(graph.edges, graph.n, source, {});

    fromEvery += run.report.relaxations;

    for (let target = 0; target < graph.n; target += 1) {
      assert.strictEqual(johnson.distance[source][target], run.distance[target],
        source + ' -> ' + target);
    }
  }
  assert.strictEqual(graph.edges.length, 120);
  assert.strictEqual(negatives, 7);
  assert.strictEqual(johnson.report.relaxations, 5124);
  assert.strictEqual(fromEvery, 26520);
  assert.strictEqual(Format.fixed(64000 / 5124, 1), '12.5');
  prose.quotes('negative-weights', ['5 124', '26 520', '120 edges', '7 negative', '12.5×']);
});

test('negative-weights: every reweighted edge is non-negative', function () {
  const graph = allPairsGraph();
  const johnson = ShortestPaths.johnson(graph, {});

  graph.edges.forEach(function (edge) {
    const reweighted = edge.weight + johnson.potentials[edge.from] - johnson.potentials[edge.to];

    assert.ok(reweighted >= 0, edge.from + ' -> ' + edge.to + ' reweights to ' + reweighted);
  });
});
