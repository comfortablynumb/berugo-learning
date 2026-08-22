'use strict';

/**
 * Every figure the M13.7-M13.8 worked examples quote, recomputed from the
 * modules and then checked against the prose.
 */

const test = require('node:test');
const assert = require('node:assert');

const Core = require('../../src/js/algorithms/graph-core.js');
const AStar = require('../../src/js/algorithms/astar.js');
const ShortestPaths = require('../../src/js/algorithms/shortest-paths.js');
const Ch = require('../../src/js/algorithms/contraction-hierarchies.js');
const GraphLab = require('../../src/js/machines/graph-lab.js');
const Format = require('../../src/js/utils/format.js');
const Random = require('../../src/js/utils/random.js');

require('../../src/js/content/concepts-graphs-routes.js');
require('../../src/js/content/examples-graphs-routes.js');
const prose = require('../support/worked-example-prose.js');

/* --------------------------------------------------------------- 13.7 */

/** The demo's own terrain: a weighted grid, seed 7, steps costing 1 to 9. */
function terrain(side) {
  const graph = Core.grid(side, side, { random: Random.seeded(7), weightRange: 9 });
  const adjacency = Core.adjacencyList(graph);
  const target = graph.n - 1;
  return { graph: graph, adjacency: adjacency, target: target,
    baseline: ShortestPaths.dijkstra(adjacency, 0, {}),
    exact: ShortestPaths.dijkstra(adjacency, target, {}).distance };
}

function altHeuristic(state, count) {
  const chosen = AStar.chooseLandmarks(state.adjacency, count, function (v) {
    return ShortestPaths.dijkstra(state.adjacency, v, {}).distance;
  });
  return AStar.landmarkHeuristic(chosen.distances, state.target);
}

test('heuristic-search: geometry is admissible here and prunes nothing', function () {
  const state = terrain(40);
  const optimal = state.baseline.distance[state.target];

  assert.strictEqual(state.graph.n, 1600);
  assert.strictEqual(optimal, 249);
  assert.strictEqual(state.baseline.report.settled, 1600);

  [AStar.manhattan(state.graph.positionOf, state.target, 1),
    AStar.euclidean(state.graph.positionOf, state.target, 1)].forEach(function (heuristic) {
    const run = AStar.search(state.adjacency, 0, state.target, { heuristic: heuristic });

    assert.strictEqual(AStar.checkAdmissible(heuristic, state.exact).admissible, true);
    assert.strictEqual(AStar.checkConsistent(state.adjacency, heuristic).consistent, true);
    assert.strictEqual(run.distance, 249);
    assert.strictEqual(run.report.expanded, 1600, 'the pruning is exactly zero');
  });
  prose.quotes('heuristic-search', ['249', '1 600']);
});

test('heuristic-search: ALT expands 98 for the same answer', function () {
  const state = terrain(40);
  const rows = [1, 2, 4, 8].map(function (count) {
    const heuristic = altHeuristic(state, count);
    const run = AStar.search(state.adjacency, 0, state.target, { heuristic: heuristic });

    return { count: count, distance: run.distance, expanded: run.report.expanded,
      admissible: AStar.checkAdmissible(heuristic, state.exact).admissible };
  });

  assert.deepStrictEqual(rows.map(function (row) { return row.expanded; }), [1256, 98, 98, 98]);
  rows.forEach(function (row) {
    assert.strictEqual(row.distance, 249);
    assert.strictEqual(row.admissible, true);
  });
  assert.strictEqual(Format.fixed(1600 / 98, 2), '16.33');
  assert.strictEqual(Format.fixed(1600 / 1256, 2), '1.27');
  prose.quotes('heuristic-search', ['1 256', '98', '16.33', '1.27']);
});

test('heuristic-search: inflating the heuristic is a bounded, measured trade', function () {
  const state = terrain(40);
  const optimal = state.baseline.distance[state.target];
  const rows = [5, 9].map(function (factor) {
    const heuristic = AStar.manhattan(state.graph.positionOf, state.target, factor);
    const run = AStar.search(state.adjacency, 0, state.target, { heuristic: heuristic });

    return { factor: factor, distance: run.distance, expanded: run.report.expanded,
      admissible: AStar.checkAdmissible(heuristic, state.exact).admissible,
      gap: Format.fixed(100 * (run.distance - optimal) / optimal, 2) };
  });

  assert.deepStrictEqual(rows.map(function (row) { return row.distance; }), [295, 361]);
  assert.deepStrictEqual(rows.map(function (row) { return row.expanded; }), [142, 83]);
  assert.deepStrictEqual(rows.map(function (row) { return row.gap; }), ['18.47', '44.98']);
  rows.forEach(function (row) { assert.strictEqual(row.admissible, false); });
  assert.strictEqual(Math.round(1600 / 142), 11);
  assert.strictEqual(Math.round(1600 / 83), 19);
  prose.quotes('heuristic-search', ['295', '361', '142', '83', '18.47%', '44.98%', '11×', '19×']);
});

test('heuristic-search: on a uniform grid the same inflation costs nothing', function () {
  const graph = Core.grid(40, 40, {});
  const adjacency = Core.adjacencyList(graph);
  const target = graph.n - 1;
  const optimal = ShortestPaths.dijkstra(adjacency, 0, {}).distance[target];
  const run = AStar.search(adjacency, 0, target,
    { heuristic: AStar.manhattan(graph.positionOf, target, 5) });

  assert.strictEqual(optimal, 78);
  assert.strictEqual(run.distance, 78, 'every monotone route ties, so inflation cannot hurt');
  prose.quotes('heuristic-search', ['78']);
});

test('heuristic-search: the reopen check is what keeps an inconsistent heuristic optimal', function () {
  const state = terrain(20);
  const optimal = state.baseline.distance[state.target];
  const random = Random.seeded(13);
  const noisy = state.exact.map(function (d) {
    return d === Infinity ? 0 : Math.floor(d * random.next());
  });
  const heuristic = function (v) { return noisy[v]; };

  assert.strictEqual(optimal, 128);
  assert.strictEqual(AStar.checkAdmissible(heuristic, state.exact).admissible, true);
  assert.strictEqual(AStar.checkConsistent(state.adjacency, heuristic).consistent, false);

  const on = AStar.search(state.adjacency, 0, state.target, { heuristic: heuristic, reopen: true });
  const off = AStar.search(state.adjacency, 0, state.target, { heuristic: heuristic, reopen: false });

  assert.strictEqual(on.distance, 128);
  assert.strictEqual(on.report.expanded, 840);
  assert.strictEqual(on.report.reopened, 508);
  assert.strictEqual(off.distance, 155);
  assert.strictEqual(off.report.expanded, 365);
  assert.strictEqual(Format.fixed(100 * (155 - 128) / 128, 2), '21.09');

  const consistent = AStar.manhattan(state.graph.positionOf, state.target, 1);

  [true, false].forEach(function (reopen) {
    const run = AStar.search(state.adjacency, 0, state.target,
      { heuristic: consistent, reopen: reopen });

    assert.strictEqual(run.report.expanded, 400, 'a consistent heuristic is policy-independent');
    assert.strictEqual(run.report.reopened, 0);
  });
  prose.quotes('heuristic-search', ['128', '155', '840', '365', '508', '21.09%', '400']);
});

test('heuristic-search: bidirectional search is best where the walls are furthest', function () {
  const graph = Core.grid(80, 80, {});
  const adjacency = Core.adjacencyList(graph);
  const centre = 40 * 80 + 40;
  const probes = [
    { name: 'corner', from: 0, to: graph.n - 1 },
    { name: 'nearby', from: centre, to: centre + 4 * 80 + 4 },
    { name: 'far corner', from: centre, to: graph.n - 1 }
  ];
  const rows = probes.map(function (probe) {
    const plain = ShortestPaths.dijkstra(adjacency, probe.from, { target: probe.to });
    const both = AStar.bidirectional(adjacency, adjacency, probe.from, probe.to, {});

    assert.strictEqual(both.distance, plain.distance[probe.to], probe.name + ' disagrees');
    return Format.fixed(plain.report.settled / both.report.expanded, 2);
  });

  assert.deepStrictEqual(rows, ['1.01', '2.48', '2.32']);
  prose.quotes('heuristic-search', ['1.01', '2.48', '2.32']);
});

test('heuristic-search: IDA* pays enormously for the memory it saves', function () {
  const rows = [6, 8, 10].map(function (side) {
    const state = terrain(side);
    const heuristic = AStar.manhattan(state.graph.positionOf, state.target, 1);
    const ida = AStar.idaStar(state.adjacency, 0, state.target,
      { heuristic: heuristic, nodeBudget: 120000 });
    const star = AStar.search(state.adjacency, 0, state.target, { heuristic: heuristic });

    return { side: side, ida: ida, star: star };
  });

  assert.strictEqual(rows[0].ida.report.expanded, 1068);
  assert.strictEqual(rows[0].star.report.expanded, 34);
  assert.strictEqual(rows[1].ida.report.expanded, 34164);
  assert.strictEqual(rows[1].star.report.expanded, 64);
  assert.strictEqual(rows[2].ida.budgetExhausted, true);
  assert.strictEqual(rows[2].star.report.expanded, 100);
  prose.quotes('heuristic-search', ['1 068', '34 164', '64', '120 000', '100']);
});

/* --------------------------------------------------------------- 13.8 */

function roadLike(side) {
  return Core.roadLike(side, side, Random.seeded(11), {});
}

test('route-planning: 18 shortcuts for 28 876 witness steps on a road-like 6 x 6', function () {
  const graph = roadLike(6);
  const report = Ch.emptyReport();
  const hierarchy = Ch.build(graph, { report: report });
  const size = Ch.sizeOf(graph, hierarchy);

  assert.strictEqual(graph.n, 36);
  assert.strictEqual(graph.edges.length, 62);
  assert.strictEqual(size.shortcuts, 18);
  assert.strictEqual(size.total, 80);
  assert.strictEqual(Format.fixed(size.growth, 2), '1.29');
  assert.strictEqual(report.witnessesFound, 70);
  assert.strictEqual(report.witnessSteps, 28876);
  assert.strictEqual(Math.round(28876 / 70), 413);
  prose.quotes('route-planning', ['18 shortcuts', '62', '80', '1.29', '70', '28 876', '413']);
});

test('route-planning: the query settles 37 where Dijkstra settles 64', function () {
  const graph = roadLike(8);
  const run = GraphLab.compareRouting(graph, 0, graph.n - 1, {});

  assert.strictEqual(run.agree, true);
  assert.deepStrictEqual(run.rows.map(function (row) { return row.distance; }), [46, 46, 46]);
  assert.deepStrictEqual(run.rows.map(function (row) { return row.settled; }), [64, 42, 37]);
  assert.strictEqual(Format.fixed(100 * 37 / 64, 0), '58');
  prose.quotes('route-planning', ['46', '64', '42', '37', '58%']);
});

test('route-planning: 4 460 pairs across six fixtures, 0 wrong', function () {
  const fixtures = [
    Core.grid(5, 5, {}),
    Core.grid(6, 6, { random: Random.seeded(3), weightRange: 9 }),
    Core.randomGraph(30, 80, Random.seeded(5), {}),
    roadLike(6),
    Core.path(20, {}),
    Core.barbell(5)
  ];
  let pairs = 0;
  let wrong = 0;
  const shortcuts = [];

  fixtures.forEach(function (graph) {
    const hierarchy = Ch.build(graph, {});
    const check = GraphLab.routingAllPairs(graph, hierarchy);

    shortcuts.push(hierarchy.shortcuts.length);
    pairs += check.pairs;
    wrong += check.wrong;
  });
  assert.strictEqual(pairs, 4460);
  assert.strictEqual(wrong, 0);
  assert.deepStrictEqual(shortcuts, [0, 46, 35, 18, 0, 0]);
  prose.quotes('route-planning', ['4 460', '0 wrong']);
});

test('route-planning: the two witness-search errors are not symmetric', function () {
  const graph = roadLike(6);
  const bounded = Ch.build(graph, {});
  const none = Ch.build(graph, { witness: 'none' });
  const broken = Ch.build(graph, { witness: 'ignore-contracted' });
  const noneCheck = GraphLab.routingAllPairs(graph, none);
  const brokenCheck = GraphLab.routingAllPairs(graph, broken);

  assert.strictEqual(bounded.shortcuts.length, 18);
  assert.strictEqual(none.shortcuts.length, 492);
  assert.strictEqual(Format.fixed(Ch.sizeOf(graph, none).growth, 2), '8.94');
  assert.strictEqual(noneCheck.pairs, 1260);
  assert.strictEqual(noneCheck.wrong, 0);

  assert.strictEqual(broken.shortcuts.length, 20);
  assert.strictEqual(Format.fixed(Ch.sizeOf(graph, broken).growth, 2), '1.32');
  assert.strictEqual(brokenCheck.wrong, 42);
  assert.strictEqual(brokenCheck.unreachable, 20);
  assert.strictEqual(Format.fixed(100 * 42 / 1260, 1), '3.3');
  assert.strictEqual(Format.fixed(100 * 20 / 1260, 1), '1.6');
  prose.quotes('route-planning', ['492', '8.94', '1 260', '20 shortcuts', '1.32', '42', '3.3%', '1.6%']);
});

test('route-planning: truncating the witness search never changes an answer', function () {
  const graph = roadLike(8);
  const rows = [2, 3, 5, 8].map(function (limit) {
    const hierarchy = Ch.build(graph, { hopLimit: limit });
    const check = GraphLab.routingAllPairs(graph, hierarchy);

    assert.strictEqual(check.wrong, 0, 'hop limit ' + limit + ' changed an answer');
    assert.strictEqual(check.pairs, 4032);
    return hierarchy.shortcuts.length;
  });

  assert.deepStrictEqual(rows, [176, 118, 84, 84]);
  prose.quotes('route-planning', ['176', '118', '84', '4 032']);
});

test('route-planning: preprocessing grows 295x for 9x the nodes', function () {
  const rows = [4, 6, 8, 10, 12].map(function (side) {
    const graph = roadLike(side);
    const report = Ch.emptyReport();
    const hierarchy = Ch.build(graph, { report: report });
    const run = GraphLab.compareRouting(graph, 0, graph.n - 1, { hierarchy: hierarchy });

    return { n: graph.n, witnessSteps: report.witnessSteps,
      settled: run.rows.map(function (row) { return row.settled; }) };
  });

  assert.strictEqual(rows[0].witnessSteps, 2927);
  assert.strictEqual(rows[4].witnessSteps, 864467);
  assert.strictEqual(rows[0].n, 16);
  assert.strictEqual(rows[4].n, 144);
  assert.strictEqual(Math.round(864467 / 2927), 295);
  assert.strictEqual(Math.round(144 / 16), 9);
  assert.deepStrictEqual(rows[4].settled, [144, 123, 87]);
  prose.quotes('route-planning', ['2 927', '864 467', '295×', '9×', '87', '144']);
});
