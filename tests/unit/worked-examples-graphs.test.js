'use strict';

/**
 * Every figure the M13.1-M13.3 worked examples quote, recomputed from the
 * modules and then checked against the prose.
 *
 * The second half is the half that matters. Recomputing a number proves the
 * code still produces it; asserting the content still quotes it is what stops
 * a measurement moving while the sentence beside it stays where it was.
 */

const test = require('node:test');
const assert = require('node:assert');

const Core = require('../../src/js/algorithms/graph-core.js');
const Topological = require('../../src/js/algorithms/topological.js');
const GraphLab = require('../../src/js/machines/graph-lab.js');
const Format = require('../../src/js/utils/format.js');
const Random = require('../../src/js/utils/random.js');

require('../../src/js/content/concepts-graphs.js');
require('../../src/js/content/examples-graphs.js');
const prose = require('../support/worked-example-prose.js');

/* --------------------------------------------------------------- 13.1 */

/** The demo's own recipe: shape `grid`, 400 nodes, seed 3, source 0. */
function representationRun() {
  const side = Math.max(3, Math.round(Math.sqrt(400)));
  const graph = GraphLab.build({ shape: 'grid', n: 400, rows: side, columns: side,
    seed: 3, m: 800 });
  return { graph: graph, describe: GraphLab.describe(graph),
    run: GraphLab.traversalRun(graph, 0) };
}

test('graph-representations: the three representations cost what the example says', function () {
  const state = representationRun();
  const memory = state.describe.memory;

  assert.strictEqual(state.graph.n, 400);
  assert.strictEqual(state.graph.edges.length, 760);
  assert.strictEqual(Format.bytes(memory.csr), '25.3 KB');
  assert.strictEqual(Format.bytes(memory.adjacencyList), '38.8 KB');
  assert.strictEqual(Format.bytes(memory.adjacencyMatrix), '1.2 MB');
  assert.strictEqual(Format.fixed(memory.adjacencyMatrix / memory.csr, 2), '49.38');
  assert.strictEqual(Format.fixed(memory.adjacencyList / memory.csr, 2), '1.53');
  assert.strictEqual(Format.fixed(100 * memory.density, 2), '0.95');
  prose.quotes('graph-representations',
    ['400', '760', '25.3 KB', '38.8 KB', '1.2 MB', '49.38', '1.53', '0.95%']);
});

test('graph-representations: the matrix and CSR cross at half density', function () {
  const rows = [400, 4000, 20000, 40000, 79800].map(function (m) {
    const graph = Core.randomGraph(400, m, Random.seeded(3), {});
    const memory = Core.memoryOf(graph);

    return { edges: graph.edges.length,
      ratio: Format.fixed(memory.adjacencyMatrix / memory.csr, 2),
      matrix: Format.bytes(memory.adjacencyMatrix), csr: Format.bytes(memory.csr) };
  });

  assert.deepStrictEqual(rows.map(function (row) { return row.ratio; }),
    ['88.86', '9.88', '2.00', '1.00', '0.50']);
  assert.strictEqual(rows[4].matrix, '1.2 MB');
  /* n²/4 is where 8n² meets 32m, and the sweep lands on it exactly. */
  assert.strictEqual(rows[3].edges, 40000);
  prose.quotes('graph-representations', ['88.86', '9.88', '2.00', '1.00', '0.50', '40 000']);
});

test('graph-representations: BFS and DFS do equal work and differ only in the peak', function () {
  const state = representationRun();
  const bfs = state.run.bfs.report;
  const dfs = state.run.dfs.report;

  assert.strictEqual(bfs.nodesVisited, 400);
  assert.strictEqual(dfs.nodesVisited, 400);
  assert.strictEqual(bfs.edgesExamined, 1520);
  assert.strictEqual(dfs.edgesExamined, 1520);
  assert.strictEqual(bfs.maxFrontier, 20);
  assert.strictEqual(dfs.maxDepth, 400);
  prose.quotes('graph-representations', ['400', '1 520', '20', '400']);
});

test('graph-representations: the edge classification partitions the edge set', function () {
  const state = representationRun();
  const counts = state.run.classification;

  assert.strictEqual(counts.tree, 399);
  assert.strictEqual(counts.back, 361);
  assert.strictEqual(counts.forward || 0, 0);
  assert.strictEqual(counts.cross || 0, 0);
  assert.strictEqual(counts.tree + counts.back, state.graph.edges.length);
  prose.quotes('graph-representations', ['399', '361', '760']);
});

/* --------------------------------------------------------------- 13.2 */

/** The demo's own recipe: 40 packages, 2 dependencies each, seed 5. */
function packageGraph(withCycle) {
  const random = Random.seeded(5);
  const graph = Core.randomDag(40, 80, random, {});

  if (withCycle && graph.edges.length > 0) {
    const late = graph.edges[graph.edges.length - 1];

    graph.edges.push({ from: late.to, to: late.from, weight: 1 });
  }
  const durations = [];

  for (let v = 0; v < 40; v += 1) durations.push(1 + random.int(5));
  return { graph: graph, durations: durations, adjacency: Core.adjacencyList(graph) };
}

test('topological-order: the critical path is the floor no worker count breaks', function () {
  const built = packageGraph(false);
  const kahn = Topological.kahn(built.adjacency, {});
  const critical = Topological.criticalPath(built.adjacency, built.durations, {});
  const total = built.durations.reduce(function (a, d) { return a + d; }, 0);

  assert.strictEqual(kahn.order.length, 40);
  assert.strictEqual(total, 118);
  assert.strictEqual(critical.length, 25);
  assert.strictEqual(critical.path.length, 7);
  assert.strictEqual(Format.fixed(total / critical.length, 2), '4.72');
  prose.quotes('topological-order', ['40', '118', '25', '7', '4.72']);
});

test('topological-order: the schedule flattens at the critical path', function () {
  const built = packageGraph(false);
  const rows = [1, 2, 4, 8, 16, 64].map(function (workers) {
    return Topological.scheduleWith(built.adjacency, workers, built.durations, {});
  });

  assert.deepStrictEqual(rows.map(function (row) { return row.makespan; }),
    [118, 59, 36, 25, 25, 25]);
  const peak = Math.max.apply(null, rows.map(function (row) { return row.peakWorkers; }));

  assert.strictEqual(peak, 11);
  prose.quotes('topological-order', ['118', '59', '36', '25', '11']);
});

test('topological-order: one back edge blocks the order and yields the cycle', function () {
  const built = packageGraph(true);
  const kahn = Topological.kahn(built.adjacency, {});
  const dfs = Topological.dfsOrder(built.adjacency, {});

  assert.strictEqual(kahn.order, null);
  assert.strictEqual(kahn.partial.length, 37);
  assert.strictEqual(dfs.order, null);
  assert.ok(kahn.cycle && kahn.cycle.length === 2, 'the injected cycle is two packages long');
  assert.strictEqual(Topological.verifyCycle(built.adjacency, kahn.cycle), true);
  const named = kahn.cycle.slice().sort(function (a, b) { return a - b; });

  assert.deepStrictEqual(named, [19, 34], 'the cycle is between packages 19 and 34');
  prose.quotes('topological-order', ['37', '34 → 19 → 34']);
});

/* --------------------------------------------------------------- 13.3 */

/** The demo's own recipe: `chained-cycles`, 60 nodes, density 2, seed 7. */
function sccRun(shape) {
  const graph = GraphLab.build({ shape: shape, n: 60, seed: 7, m: 120, directed: true,
    components: 15, size: 4 });
  return { graph: graph, run: GraphLab.connectivityRun(graph, {}) };
}

test('strongly-connected: two derivations, one partition, one acyclic condensation', function () {
  const state = sccRun('chained-cycles');
  const run = state.run;

  assert.strictEqual(run.tarjan.components.length, 15);
  assert.strictEqual(run.kosaraju.components.length, 15);
  assert.strictEqual(run.agree.agree, true);
  assert.strictEqual(state.graph.edges.length, 74);
  assert.strictEqual(run.tarjan.report.edgesExamined, 74);
  assert.strictEqual(run.kosaraju.report.edgesExamined, 148);
  assert.strictEqual(run.condensation.n, 15);
  assert.strictEqual(run.condensation.edges.length, 14);
  assert.strictEqual(run.acyclic.acyclic, true);
  assert.strictEqual(run.profile.largest, 4);
  prose.quotes('strongly-connected', ['15', '74', '148', '14', '4']);
});

test('strongly-connected: a random digraph gives a giant component and singletons', function () {
  const state = sccRun('random');
  const run = state.run;
  const singletons = run.tarjan.components.filter(function (list) {
    return list.length === 1;
  }).length;

  assert.strictEqual(run.tarjan.components.length, 18);
  assert.strictEqual(run.profile.largest, 43);
  assert.strictEqual(Format.fixed(100 * 43 / 60, 1), '71.7');
  assert.strictEqual(singletons, 17);
  assert.strictEqual(state.graph.edges.length, 120);
  assert.strictEqual(run.condensation.edges.length, 21);
  prose.quotes('strongly-connected', ['18', '43', '71.7%', '17', '120', '21']);
});
