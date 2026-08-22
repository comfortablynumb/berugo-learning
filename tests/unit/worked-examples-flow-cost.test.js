'use strict';

/**
 * Every figure the M14.4-M14.5 worked examples quote, recomputed from the
 * modules and then checked against the prose.
 */

const test = require('node:test');
const assert = require('node:assert');

const MinCostFlow = require('../../src/js/algorithms/min-cost-flow.js');
const Matching = require('../../src/js/algorithms/matching.js');
const Weighted = require('../../src/js/algorithms/weighted-matching.js');
const MatchingLab = require('../../src/js/machines/matching-lab.js');

require('../../src/js/content/concepts-flow-cost.js');
require('../../src/js/content/examples-flow-cost.js');
const prose = require('../support/worked-example-prose.js');

/* ------------------------------------------------------------------ 14.4 */

/** The demo's own instance: 6 workers, costs 1 to 20, seed 1. */
function costMatrix() {
  return MatchingLab.costMatrix({ size: 6, range: 20, seed: 1 });
}

test('min-cost-flow: 28 by three routes, and by all 720 permutations', function () {
  const matrix = costMatrix();
  const network = MinCostFlow.assignmentNetwork(matrix);
  const ssp = MinCostFlow.successiveShortestPaths(network, network.source, network.sink, {});
  const cancel = MinCostFlow.cycleCancelling(network, network.source, network.sink, {});
  const hungarian = Weighted.hungarian(matrix, {});
  const truth = MatchingLab.bruteForceAssignment(matrix);

  assert.strictEqual(ssp.cost, 28);
  assert.strictEqual(cancel.cost, 28);
  assert.strictEqual(hungarian.cost, 28);
  assert.strictEqual(truth.cost, 28);
  assert.strictEqual(truth.permutations, 720);
  assert.strictEqual(ssp.report.dijkstraRuns, 7);
  assert.strictEqual(ssp.report.bellmanFordRuns, 0);
  assert.strictEqual(ssp.report.relaxations, 582);
  assert.strictEqual(cancel.report.cyclesCancelled, 4);
  assert.strictEqual(cancel.report.bellmanFordRuns, 5);
  assert.strictEqual(hungarian.report.phases, 6);
  assert.strictEqual(hungarian.report.comparisons, 45);
  assert.strictEqual(Weighted.checkHungarian(matrix, hungarian).valid, true);
  assert.strictEqual(MinCostFlow.checkOptimal(ssp.network).optimal, true);
  prose.quotes('min-cost-flow',
    ['28', '720', '7 Dijkstra runs', '0 Bellman-Ford passes', '582', '4 cycles',
      '5 Bellman-Ford passes', '6 phases', '45 comparisons']);
});

test('min-cost-flow: the cost curve is convex, which is why the greedy is correct', function () {
  const matrix = costMatrix();
  const network = MinCostFlow.assignmentNetwork(matrix);
  const costs = [];

  for (let limit = 1; limit <= 6; limit += 1) {
    const run = MinCostFlow.successiveShortestPaths(network, network.source, network.sink,
      { flowLimit: limit });

    assert.strictEqual(run.flow, limit, 'the flow limit must bind');
    costs.push(run.cost);
  }
  assert.deepStrictEqual(costs, [1, 2, 4, 9, 18, 28]);
  const marginal = costs.map(function (cost, i) { return i === 0 ? cost : cost - costs[i - 1]; });

  assert.deepStrictEqual(marginal, [1, 1, 2, 5, 9, 10]);

  for (let i = 1; i < marginal.length; i += 1) {
    assert.ok(marginal[i] >= marginal[i - 1], 'the marginal cost may never fall');
  }
  prose.quotes('min-cost-flow', ['1, 2, 4, 9, 18, 28', '1, 1, 2, 5, 9, 10']);
});

test('min-cost-flow: negative arc costs are fine and both methods agree on 81', function () {
  const network = buildGeneralNetwork();

  assert.strictEqual(network.n, 14);
  const negative = network.edges.filter(function (edge) { return edge.cost < 0; }).length;

  assert.strictEqual(negative, 5);
  const ssp = MinCostFlow.successiveShortestPaths(network, network.source, network.sink, {});
  const cancel = MinCostFlow.cycleCancelling(network, network.source, network.sink, {});

  assert.strictEqual(ssp.flow, 3);
  assert.strictEqual(ssp.cost, 81);
  assert.strictEqual(cancel.flow, 3);
  assert.strictEqual(cancel.cost, 81);
  assert.strictEqual(MinCostFlow.checkOptimal(ssp.network).optimal, true);
  prose.quotes('min-cost-flow', ['14 vertices', '5 negative arcs', '3 units at cost 81']);
});

/**
 * The general network the 14.4 panel builds, exactly: a spine so the sink is
 * reachable at all, then random arcs, with every cost produced by UNDOING a
 * reweighting - `base - p(u) + p(v)` - which guarantees negative arcs and no
 * negative cycle. A purely random cost assignment gives one or the other and
 * never both.
 */
function buildGeneralNetwork() {
  const Random = require('../../src/js/utils/random.js');
  const n = 14;
  const random = Random.seeded(7);
  const potential = [];

  for (let v = 0; v < n; v += 1) potential.push(random.int(12));
  const edges = [];
  const seen = {};
  const add = function (a, b) {
    const key = a + '>' + b;

    if (a === b || seen[key]) return;
    seen[key] = true;
    const base = 1 + random.int(15);

    edges.push({ from: a, to: b, capacity: 1 + random.int(8),
      cost: base - potential[a] + potential[b] });
  };

  for (let v = 0; v + 1 < n; v += 1) add(v, v + 1);

  for (let i = 0; i < n * 3; i += 1) add(random.int(n), random.int(n));
  return { n: n, edges: edges, source: 0, sink: n - 1 };
}

/* ------------------------------------------------------------------ 14.5 */

function defaultBipartite() {
  return MatchingLab.build({ shape: 'random', left: 9, seed: 1 });
}

test('bipartite-matching: 9 three ways, at 45, 57 and 280 units of work', function () {
  const graph = defaultBipartite();
  const compare = MatchingLab.compareMatchings(graph);

  assert.strictEqual(graph.edges.length, 25);
  assert.strictEqual(compare.size, 9);
  assert.strictEqual(compare.agree, true);
  assert.strictEqual(compare.rows[0].report.edgesExamined, 45);
  assert.strictEqual(compare.rows[0].report.augmentingPaths, 9);
  assert.strictEqual(compare.rows[1].report.edgesExamined, 57);
  assert.strictEqual(compare.rows[1].report.phases, 2);
  assert.strictEqual(compare.rows[2].report.arcsExamined, 280);
  prose.quotes('bipartite-matching', ['25', '9', '45', '57', '280', '2 phases']);
});

test('bipartite-matching: Koenig gives a cover of 9 touching all 25 edges', function () {
  const graph = defaultBipartite();
  const state = MatchingLab.structureRun(graph);

  assert.strictEqual(state.matching.size, 9);
  assert.strictEqual(state.cover.size, 9);
  assert.strictEqual(state.check.valid, true);
  assert.strictEqual(Matching.checkCover(graph, state.cover).uncovered, 0);
  assert.strictEqual(graph.left + graph.right - state.cover.size, 9);
  assert.strictEqual(state.perfect, true);
  prose.quotes('bipartite-matching', ['cover of 9', '25 edges', '18 − 9 = 9']);
});

test('bipartite-matching: the deficiency shape hands back a Hall witness', function () {
  const graph = MatchingLab.build({ shape: 'deficiency', left: 9, seed: 1 });
  const state = MatchingLab.structureRun(graph);

  assert.strictEqual(state.violator.violates, true);
  assert.strictEqual(state.violator.set.length, 3);
  assert.strictEqual(state.violator.neighbours.length, 2);
  prose.quotes('bipartite-matching', ['3 left vertices share 2 neighbours']);
});

test('bipartite-matching: the phase sweep, and the crossover between 16 and 32', function () {
  const rows = MatchingLab.phaseSweep({});

  assert.deepStrictEqual(rows.map(function (r) { return r.size; }), [8, 16, 32, 64, 128, 256]);
  assert.deepStrictEqual(rows.map(function (r) { return r.phases; }), [2, 2, 2, 3, 4, 4]);
  assert.deepStrictEqual(rows.map(function (r) { return r.kuhnEdges; }),
    [20, 110, 315, 1375, 4184, 12426]);
  assert.deepStrictEqual(rows.map(function (r) { return r.hkEdges; }),
    [58, 173, 324, 1044, 2458, 4530]);
  assert.deepStrictEqual(rows.map(function (r) { return r.root.toFixed(2); }),
    ['2.83', '4.00', '5.66', '8.00', '11.31', '16.00']);
  rows.forEach(function (row) { assert.strictEqual(row.agree, true, 'sizes must agree at ' + row.size); });
  assert.strictEqual((12426 / 4530).toFixed(2), '2.74');
  assert.strictEqual((58 / 20).toFixed(1), '2.9');
  assert.ok(rows[1].hkEdges > rows[1].kuhnEdges && rows[2].hkEdges > rows[2].kuhnEdges,
    'Hopcroft-Karp must still be losing at 16 and 32');
  assert.ok(rows[3].hkEdges < rows[3].kuhnEdges, 'and winning by 64');
  prose.quotes('bipartite-matching',
    ['2, 2, 2, 3, 4, 4', '20, 110, 315, 1 375, 4 184, 12 426',
      '58, 173, 324, 1 044, 2 458, 4 530', '2.74', '2.9']);
});

test('bipartite-matching: both stable runs, and the transfer between them', function () {
  const run = MatchingLab.stableRun({ size: 8, seed: 1 });

  assert.strictEqual(run.byLeft.report.proposals, 18);
  assert.strictEqual(run.byLeft.report.rejections, 10);
  assert.strictEqual(run.byRight.report.proposals, 21);
  assert.strictEqual(run.byRight.report.rejections, 13);
  assert.strictEqual(run.leftBlocking.length, 0);
  assert.strictEqual(run.rightBlocking.length, 0);
  assert.strictEqual(run.leftRank, 10);
  assert.strictEqual(run.rightRank, 20);
  assert.strictEqual(run.same, 3);
  let better = 0;
  let worse = 0;

  run.byLeft.matchLeft.forEach(function (partner, who) {
    const mine = run.left[who].indexOf(partner);
    const theirs = run.left[who].indexOf(run.byRight.matchRight[who]);

    if (mine < theirs) better += 1;

    if (mine > theirs) worse += 1;
  });
  assert.strictEqual(better, 5);
  assert.strictEqual(worse, 0);
  prose.quotes('bipartite-matching',
    ['18 proposals', '10 rejections', '21 proposals', '13 rejections', '10 to 20',
      '3 of the 8 pairs', '5 people strictly better off']);
});
