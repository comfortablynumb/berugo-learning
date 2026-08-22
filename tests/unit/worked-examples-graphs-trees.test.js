'use strict';

/**
 * Every figure the M13.9-M13.10 worked examples quote, recomputed from the
 * modules and then checked against the prose.
 */

const test = require('node:test');
const assert = require('node:assert');

const Core = require('../../src/js/algorithms/graph-core.js');
const Mst = require('../../src/js/algorithms/mst.js');
const ShortestPaths = require('../../src/js/algorithms/shortest-paths.js');
const TreeQueries = require('../../src/js/algorithms/tree-queries.js');
const GraphLab = require('../../src/js/machines/graph-lab.js');
const Format = require('../../src/js/utils/format.js');
const Random = require('../../src/js/utils/random.js');

require('../../src/js/content/concepts-graphs-trees.js');
require('../../src/js/content/examples-graphs-trees.js');
const prose = require('../support/worked-example-prose.js');

/* --------------------------------------------------------------- 13.9 */

/** The demo's own instance: 60 nodes, 180 edges, seed 3, weights 1 to 20. */
function mstGraph(seed, range, n, m) {
  return Core.randomGraph(n || 60, m || 180, Random.seeded(seed), { weightRange: range || 20 });
}

function edgeIdsOf(run) {
  return run.edges.map(function (edge) { return edge.id; })
    .sort(function (a, b) { return a - b; }).join(',');
}

test('minimum-spanning-trees: all three weigh 270 and cost differently', function () {
  const graph = mstGraph(3);
  const run = GraphLab.compareMst(graph);

  assert.strictEqual(graph.edges.length, 180);
  assert.strictEqual(run.agree, true);
  run.rows.forEach(function (entry) {
    assert.strictEqual(entry.run.weight, 270, entry.name);
    assert.strictEqual(entry.run.edges.length, 59, entry.name);
    const check = Mst.checkSpanning(graph, entry.run.edges);

    assert.strictEqual(check.acyclic, true, entry.name + ' produced a cycle');
    assert.strictEqual(check.spansComponents, true, entry.name + ' did not span');
  });
  assert.deepStrictEqual(run.rows.map(function (entry) { return entry.work; }), [1666, 2280, 1170]);
  assert.strictEqual(run.rows[2].run.report.rounds, 3);
  assert.strictEqual(run.distinct.duplicates, 160);
  prose.quotes('minimum-spanning-trees', ['270', '59', '1 666', '2 280', '1 170', '3 rounds', '160']);
});

test('minimum-spanning-trees: Prim exploits one cut at a time', function () {
  const graph = mstGraph(3);
  const prim = Mst.prim(graph, Core.adjacencyList(graph), {});
  const witness = Mst.safeEdgeFor(graph, prim.edges.slice(0, 20), prim.edges[20]);

  assert.strictEqual(witness.inside.length, 21);
  assert.strictEqual(prim.edges[20].weight, 5);
  assert.strictEqual(witness.lightestCrossing, 5);
  assert.strictEqual(witness.isSafe, true);
  assert.strictEqual(prim.edges[20].from + ' – ' + prim.edges[20].to, '4 – 24');
  prose.quotes('minimum-spanning-trees', ['21 nodes', '4–24', 'weight 5']);
});

test('minimum-spanning-trees: duplicate weights break tree uniqueness, not weight', function () {
  const rows = [3, 100000].map(function (range) {
    let sameWeight = 0;
    let sameTree = 0;
    let duplicates = 0;

    for (let seed = 1; seed <= 20; seed += 1) {
      const graph = mstGraph(seed, range);
      const run = GraphLab.compareMst(graph);
      const ids = run.rows.map(function (entry) { return edgeIdsOf(entry.run); });

      duplicates += run.distinct.duplicates;

      if (run.agree) sameWeight += 1;

      if (ids[0] === ids[1] && ids[1] === ids[2]) sameTree += 1;
    }
    return { range: range, sameWeight: sameWeight, sameTree: sameTree,
      duplicates: Format.fixed(duplicates / 20, 1) };
  });

  assert.deepStrictEqual(rows.map(function (row) { return row.sameWeight; }), [20, 20]);
  assert.deepStrictEqual(rows.map(function (row) { return row.sameTree; }), [0, 20]);
  assert.strictEqual(rows[0].duplicates, '177.0');
  assert.strictEqual(rows[1].duplicates, '0.2');
  prose.quotes('minimum-spanning-trees', ['20 of 20', '0 of 20', '177', '0.2']);
});

test('minimum-spanning-trees: the runner-up ties when the weights repeat', function () {
  const graph = mstGraph(3);
  const chosen = Mst.kruskal(graph, {}).edges;
  const second = Mst.secondBest(graph, chosen);

  assert.strictEqual(second.weight, 270, 'a tie means the MST was never unique');
  assert.strictEqual(second.removed, 76);
  assert.strictEqual(second.added, 109);
  prose.quotes('minimum-spanning-trees', ['edge 76 out and edge 109 in', 'difference of 0']);
});

test('minimum-spanning-trees: the minimax path is not the shortest path', function () {
  const graph = mstGraph(3);
  const adjacency = Core.adjacencyList(graph);
  const chosen = Mst.kruskal(graph, {}).edges;
  const probe = Random.seeded(101);
  let checked = 0;
  let wrong = 0;
  let shortestWorse = 0;
  const first = [];

  for (let q = 0; q < 200; q += 1) {
    const source = probe.int(graph.n);
    const target = probe.int(graph.n);

    if (source === target) continue;
    checked += 1;
    const viaTree = Mst.bottleneck(graph.n, chosen, source, target);
    const oracle = Mst.bottleneckByBruteForce(graph, source, target);
    const run = ShortestPaths.dijkstra(adjacency, source, { target: target });
    let worst = 0;
    let at = target;

    while (at !== source && run.parent[at] !== -1) {
      const from = run.parent[at];
      const here = at;

      adjacency[from].forEach(function (edge) {
        if (edge.to !== here) return;
        worst = Math.max(worst, edge.weight);
      });
      at = from;
    }

    if (viaTree !== oracle) wrong += 1;

    if (worst > viaTree) shortestWorse += 1;

    if (first.length === 0) {
      first.push({ source: source, target: target, viaTree: viaTree,
        cost: run.distance[target], worst: worst });
    }
  }
  assert.strictEqual(checked, 198);
  assert.strictEqual(wrong, 0);
  assert.strictEqual(shortestWorse, 136);
  assert.deepStrictEqual(first[0], { source: 8, target: 45, viaTree: 5, cost: 18, worst: 9 });
  prose.quotes('minimum-spanning-trees', ['198', '136', '8 → 45', 'minimax hop is 5', '18', '9']);
});

test('minimum-spanning-trees: the ranking inverts with density', function () {
  const rows = [60, 900].map(function (m) {
    const run = GraphLab.compareMst(mstGraph(3, 20, 60, m));

    return run.rows.map(function (entry) { return entry.work; });
  });

  assert.deepStrictEqual(rows[0], [425, 426, 619]);
  assert.deepStrictEqual(rows[1], [10576, 15840, 8428]);
  prose.quotes('minimum-spanning-trees',
    ['425', '426', '619', '10 576', '15 840', '8 428']);
});

/* -------------------------------------------------------------- 13.10 */

/** The demo's own tree: 200 nodes, seed 4, with 200 query pairs from seed 77. */
function treeRun(kind, n) {
  const tree = TreeQueries.shapedTree(kind, n, Random.seeded(4));
  const adjacency = Core.adjacencyList(tree);
  const rooted = TreeQueries.rootTree(adjacency, 0, {});
  const euler = TreeQueries.eulerTour(adjacency, 0, {});
  const probe = Random.seeded(77);
  const pairs = [];

  for (let q = 0; q < 200; q += 1) pairs.push([probe.int(n), probe.int(n)]);
  return { tree: tree, rooted: rooted, pairs: pairs,
    lifting: TreeQueries.buildLifting(rooted, {}),
    sparse: TreeQueries.buildSparse(euler, {}),
    hld: TreeQueries.heavyLight(adjacency, rooted, {}), euler: euler };
}

function costsOf(state) {
  const naive = TreeQueries.emptyReport();
  const lift = TreeQueries.emptyReport();
  const sparse = TreeQueries.emptyReport();
  const chains = TreeQueries.emptyReport();

  state.pairs.forEach(function (pair) {
    TreeQueries.naiveLca(state.rooted, pair[0], pair[1], { report: naive });
    TreeQueries.liftingLca(state.lifting, pair[0], pair[1], { report: lift });
    TreeQueries.sparseLca(state.sparse, pair[0], pair[1], { report: sparse });
    TreeQueries.chainsOnPath(state.hld, state.rooted, pair[0], pair[1], { report: chains });
  });
  return { naive: naive.querySteps, lift: lift.jumps, sparse: sparse.querySteps,
    segments: chains.querySteps + state.pairs.length };
}

test('tree-path-queries: on a shallow tree binary lifting costs more than the climb', function () {
  const state = treeRun('random', 200);
  const costs = costsOf(state);

  assert.strictEqual(state.rooted.report.maxDepth, 13);
  assert.strictEqual(costs.naive, 1630);
  assert.strictEqual(costs.lift, 1916);
  assert.strictEqual(costs.sparse, 200);
  assert.strictEqual(costs.segments, 770);
  assert.strictEqual(state.lifting.cells, 1800);
  assert.strictEqual(state.lifting.levels, 9);
  assert.strictEqual(state.sparse.cells, 3591);
  assert.strictEqual(state.euler.tour.length, 399);
  assert.strictEqual(Format.fixed(1630 / 200, 2), '8.15');
  assert.strictEqual(Format.fixed(1916 / 200, 2), '9.58');
  assert.strictEqual(Format.fixed(770 / 200, 2), '3.85');
  prose.quotes('tree-path-queries',
    ['13', '1 630', '1 916', '1 800', '3 591', '399', '8.15', '9.58', '3.85']);
});

test('tree-path-queries: on a path of 200 every ranking inverts', function () {
  const state = treeRun('path', 200);
  const costs = costsOf(state);

  assert.strictEqual(state.rooted.report.maxDepth, 199);
  assert.strictEqual(costs.naive, 11783);
  assert.strictEqual(costs.lift, 621);
  assert.strictEqual(costs.sparse, 200);
  assert.strictEqual(state.hld.chains, 1);
  assert.strictEqual(Format.fixed(11783 / 200, 2), '58.91');
  assert.strictEqual(Format.fixed(621 / 200, 2), '3.10');
  assert.strictEqual(Format.fixed(58.91 / 8.15, 1), '7.2');
  assert.strictEqual(Math.round(11783 / 621), 19);
  prose.quotes('tree-path-queries', ['199', '11 783', '621', '58.91', '3.10', '7.2×', '19×']);
});

test('tree-path-queries: the chain decomposition across five shapes', function () {
  const rows = [['random', 1000], ['path', 1000], ['star', 1000], ['caterpillar', 1000],
    ['binary', 1023]].map(function (spec) {
    const tree = TreeQueries.shapedTree(spec[0], spec[1], Random.seeded(4));
    const adjacency = Core.adjacencyList(tree);
    const rooted = TreeQueries.rootTree(adjacency, 0, {});
    const hld = TreeQueries.heavyLight(adjacency, rooted, {});
    const probe = Random.seeded(77);
    let worst = 0;
    let total = 0;

    for (let q = 0; q < 400; q += 1) {
      const path = TreeQueries.chainsOnPath(hld, rooted, probe.int(tree.n), probe.int(tree.n), {});

      worst = Math.max(worst, path.count);
      total += path.count;
    }
    return { kind: spec[0], chains: hld.chains, worst: worst,
      mean: Format.fixed(total / 400, 2), depth: rooted.report.maxDepth };
  });

  assert.deepStrictEqual(rows.map(function (row) { return row.chains; }), [505, 1, 999, 500, 512]);
  assert.deepStrictEqual(rows.map(function (row) { return row.worst; }), [9, 1, 3, 14, 15]);
  assert.deepStrictEqual(rows.map(function (row) { return row.mean; }),
    ['5.26', '1.00', '2.99', '7.77', '8.02']);
  assert.deepStrictEqual(rows.map(function (row) { return row.depth; }), [16, 999, 1, 9, 9]);
  rows.forEach(function (row) {
    assert.ok(row.worst <= 2 * Math.log2(row.kind === 'binary' ? 1023 : 1000),
      row.kind + ' exceeds the 2 log2 n bound');
  });
  prose.quotes('tree-path-queries',
    ['505', '999', '500', '512', '5.26', '1.00', '2.99', '7.77', '8.02', '14', '15']);
});

test('tree-path-queries: every implementation agrees with the naive climb', function () {
  let wrong = 0;
  let queries = 0;

  ['random', 'path', 'star', 'caterpillar', 'binary'].forEach(function (kind) {
    const tree = TreeQueries.shapedTree(kind, 120, Random.seeded(4));
    const adjacency = Core.adjacencyList(tree);
    const rooted = TreeQueries.rootTree(adjacency, 0, {});
    const lifting = TreeQueries.buildLifting(rooted, {});
    const sparse = TreeQueries.buildSparse(TreeQueries.eulerTour(adjacency, 0, {}), {});
    const hld = TreeQueries.heavyLight(adjacency, rooted, {});
    const probe = Random.seeded(77);

    for (let q = 0; q < 480; q += 1) {
      const a = probe.int(120);
      const b = probe.int(120);
      const truth = TreeQueries.naiveLca(rooted, a, b, {});

      queries += 1;

      if (TreeQueries.liftingLca(lifting, a, b, {}) !== truth) wrong += 1;

      if (TreeQueries.sparseLca(sparse, a, b, {}) !== truth) wrong += 1;
      const k = rooted.depth[a];

      if (TreeQueries.kthAncestor(lifting, a, k, {}) !==
        TreeQueries.naiveAncestor(rooted, a, k)) wrong += 1;
      const path = TreeQueries.chainsOnPath(hld, rooted, a, b, {});

      if (!TreeQueries.verifySegments(hld, rooted, a, b, path.segments).valid) wrong += 1;
    }
  });
  assert.strictEqual(queries, 2400);
  assert.strictEqual(wrong, 0);
  prose.quotes('tree-path-queries', ['2 400', '480']);
});
