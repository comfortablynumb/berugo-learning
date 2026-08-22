'use strict';

/**
 * Every figure the M14.1-M14.3 worked examples quote, recomputed from the
 * modules and then checked against the prose.
 *
 * The harnesses here mirror each section's demo exactly - the same shape, the
 * same seed, the same derived settings - so a change to a generator fails this
 * suite rather than silently invalidating a sentence.
 */

const test = require('node:test');
const assert = require('node:assert');

const MaxFlow = require('../../src/js/algorithms/max-flow.js');
const FlowLab = require('../../src/js/machines/flow-lab.js');
const ReductionLab = require('../../src/js/machines/reduction-lab.js');
const Matching = require('../../src/js/algorithms/matching.js');
const FlowView = require('../../src/js/viz/flow-view.js');

require('../../src/js/content/concepts-flow.js');
require('../../src/js/content/examples-flow.js');
const prose = require('../support/worked-example-prose.js');

const CAPACITY_STEPS = [1, 4, 16, 64, 256];

/* ------------------------------------------------------------------ 14.1 */

/** The demo's own network: layered, width 4, 4 ranks, capacity 12, seed 1. */
function defaultNetwork() {
  return FlowLab.build({ shape: 'layered', width: 4, layers: 4, capacity: 12, seed: 1 });
}

test('maximum-flow: 22, from six algorithms, checked three ways', function () {
  const graph = defaultNetwork();
  const compare = FlowLab.compareFlows(graph, {});

  assert.strictEqual(graph.n, 18);
  assert.strictEqual(graph.edges.length, 39);
  assert.strictEqual(compare.value, 22);
  assert.strictEqual(compare.agree, true);
  compare.rows.forEach(function (row) {
    assert.strictEqual(row.value, 22, row.name);
    assert.strictEqual(row.cut.capacity, 22, row.name);
    assert.strictEqual(row.check.valid, true, row.name);
  });
  const state = FlowLab.singleRun(graph, { algorithm: 'dinic' });

  assert.strictEqual(state.cut.edges.length, 8);
  assert.strictEqual(state.check.imbalanced, 0);
  prose.quotes('maximum-flow', ['22', '18', '39', '8 arcs']);
});

test('maximum-flow: 54 residual arcs, 28 of them backward', function () {
  const graph = defaultNetwork();
  const state = FlowLab.singleRun(graph, { algorithm: 'dinic' });
  const residual = FlowView.residualEdges(state.flows);
  const back = residual.filter(function (arc) { return arc.kind === 'back'; });

  assert.strictEqual(residual.length, 54);
  assert.strictEqual(back.length, 28);
  prose.quotes('maximum-flow', ['54', '28']);
});

test('maximum-flow: the work column, and its 3.4x spread', function () {
  const graph = defaultNetwork();
  const source = graph.source;
  const sink = graph.sink;
  const ford = MaxFlow.fordFulkerson(graph, source, sink, {});
  const karp = MaxFlow.edmondsKarp(graph, source, sink, {});
  const dinic = MaxFlow.dinic(graph, source, sink, {});
  const scaling = MaxFlow.capacityScaling(graph, source, sink, {});

  assert.strictEqual(ford.report.augmentingPaths, 13);
  assert.strictEqual(ford.report.arcsExamined, 576);
  assert.strictEqual(karp.report.augmentingPaths, 10);
  assert.strictEqual(karp.report.arcsExamined, 647);
  assert.strictEqual(dinic.report.augmentingPaths, 10);
  assert.strictEqual(dinic.report.phases, 1);
  assert.strictEqual(dinic.report.arcsExamined, 247);
  assert.strictEqual(scaling.report.augmentingPaths, 8);
  assert.strictEqual(scaling.report.arcsExamined, 832);
  const sweep = FlowLab.heuristicSweep(graph, { rule: 'fifo' })[0];
  const highest = FlowLab.heuristicSweep(graph, { rule: 'highest' })[0];

  assert.strictEqual(sweep.report.relabels, 41);
  assert.strictEqual(sweep.report.pushes, 79);
  assert.strictEqual(sweep.report.arcsExamined, 760);
  assert.strictEqual(highest.report.relabels, 35);
  assert.strictEqual(highest.report.pushes, 70);
  assert.strictEqual(highest.report.arcsExamined, 627);
  assert.strictEqual((832 / 247).toFixed(1), '3.4');
  prose.quotes('maximum-flow',
    ['13 paths', '576', '647', '247', '832', '41 relabels', '79 pushes', '35', '70', '627', '3.4×']);
});

test('maximum-flow: 1 999 against 2 000, and 2 of 20 random networks', function () {
  const graph = MaxFlow.backEdgeExample(1000);
  const greedy = MaxFlow.greedyNoResidual(graph, graph.source, graph.sink, {});
  const proper = MaxFlow.fordFulkerson(graph, graph.source, graph.sink, {});

  assert.strictEqual(greedy.value, 1999);
  assert.strictEqual(greedy.report.augmentingPaths, 3);
  assert.strictEqual(proper.value, 2000);
  assert.strictEqual(proper.report.augmentingPaths, 2);
  let short = 0;
  let worst = 0;

  for (let seed = 1; seed <= 20; seed += 1) {
    const network = FlowLab.build({ shape: 'layered', seed: seed });
    const rough = MaxFlow.greedyNoResidual(network, network.source, network.sink, {}).value;
    const truth = MaxFlow.dinic(network, network.source, network.sink, {}).value;

    if (rough >= truth) continue;
    short += 1;
    worst = Math.max(worst, 100 * (truth - rough) / truth);
  }
  assert.strictEqual(short, 2);
  assert.strictEqual(worst.toFixed(1), '9.5');
  prose.quotes('maximum-flow', ['1 999', '2 000', '2 of 20', '9.5%']);
});

test('maximum-flow: the capacity sweep, and the phase count that does not move', function () {
  const rows = CAPACITY_STEPS.map(function (capacity) {
    const graph = FlowLab.build({ shape: 'layered', width: 4, layers: 4,
      capacity: capacity, seed: 1 });

    return { value: MaxFlow.dinic(graph, graph.source, graph.sink, {}),
      ford: MaxFlow.fordFulkerson(graph, graph.source, graph.sink, {}),
      karp: MaxFlow.edmondsKarp(graph, graph.source, graph.sink, {}),
      scaling: MaxFlow.capacityScaling(graph, graph.source, graph.sink, {}) };
  });

  assert.deepStrictEqual(rows.map(function (r) { return r.value.value; }), [4, 10, 29, 103, 403]);
  assert.deepStrictEqual(rows.map(function (r) { return r.ford.report.augmentingPaths; }),
    [4, 9, 14, 16, 14]);
  assert.deepStrictEqual(rows.map(function (r) { return r.karp.report.augmentingPaths; }),
    [4, 9, 9, 13, 13]);
  assert.deepStrictEqual(rows.map(function (r) { return r.value.report.phases; }), [1, 1, 1, 1, 1]);
  assert.deepStrictEqual(rows.map(function (r) { return r.scaling.report.scalingRounds; }),
    [1, 3, 5, 7, 8]);
  prose.quotes('maximum-flow', ['4 / 10 / 29 / 103 / 403', '4 / 9 / 14 / 16 / 14',
    '4 / 9 / 9 / 13 / 13', '1 / 3 / 5 / 7 / 8']);
});

/* ------------------------------------------------------------------ 14.2 */

const SMOOTHNESS_STEPS = [0, 1, 2, 5, 8, 12];

function segmentation(smoothness) {
  return FlowLab.build({ shape: 'segmentation', rows: 8, columns: 8, noise: 20,
    smooth: smoothness, seed: 1 });
}

function segmentationRun(smoothness) {
  const graph = segmentation(smoothness);
  const run = MaxFlow.dinic(graph, graph.source, graph.sink, {});
  const cut = MaxFlow.minCut(run.network, graph.source);
  let wrong = 0;

  for (let pixel = 0; pixel < graph.truth.length; pixel += 1) {
    if ((cut.side[pixel] ? 1 : 0) === graph.truth[pixel]) continue;
    wrong += 1;
  }
  return { cut: cut.capacity, wrong: wrong, pixels: graph.truth.length };
}

test('minimum-cut: the cut rises the whole way while the answer improves', function () {
  const base = segmentationRun(3);

  assert.strictEqual(base.pixels, 64);
  assert.strictEqual(base.cut, 159);
  assert.strictEqual(base.wrong, 4);
  assert.strictEqual((100 * base.wrong / base.pixels).toFixed(1), '6.3');
  const cuts = [];
  const wrongs = [];

  SMOOTHNESS_STEPS.forEach(function (smoothness) {
    const row = segmentationRun(smoothness);

    cuts.push(row.cut);
    wrongs.push(row.wrong);
  });
  assert.deepStrictEqual(cuts, [92, 123, 145, 182, 210, 242]);
  assert.deepStrictEqual(wrongs, [10, 8, 5, 2, 0, 0]);

  for (let i = 1; i < cuts.length; i += 1) {
    assert.ok(cuts[i] > cuts[i - 1], 'the objective must rise monotonically');
    assert.ok(wrongs[i] <= wrongs[i - 1], 'and the answer must improve monotonically');
  }
  prose.quotes('minimum-cut',
    ['159', '4 of 64', '6.3', '92, 123, 145, 159, 182, 210, 242', '10, 8, 5, 4, 2, 0, 0', '15.6%']);
});

test('minimum-cut: project selection agrees with brute force on all five seeds', function () {
  const positive = [];
  const cuts = [];
  const realised = [];
  const taken = [];

  for (let seed = 1; seed <= 5; seed += 1) {
    const instance = ReductionLab.projectInstance(seed, {});
    const run = ReductionLab.closureToCut(instance);
    const truth = ReductionLab.closureByBruteForce(instance);

    assert.strictEqual(run.valid, true, 'seed ' + seed + ': the reduction did not round-trip');
    assert.strictEqual(run.mapped.profit, truth, 'seed ' + seed + ': brute force disagrees');
    positive.push(instance.profit.reduce(function (sum, p) { return sum + Math.max(0, p); }, 0));
    cuts.push(run.targetValue);
    realised.push(run.mapped.profit);
    taken.push(run.mapped.chosen.length);
  }
  assert.deepStrictEqual(positive, [43, 27, 20, 25, 31]);
  assert.deepStrictEqual(cuts, [3, 5, 8, 7, 4]);
  assert.deepStrictEqual(realised, [40, 22, 12, 18, 27]);
  assert.deepStrictEqual(taken, [5, 7, 4, 4, 7]);
  prose.quotes('minimum-cut',
    ['43, 27, 20, 25, 31', '3, 5, 8, 7, 4', '40, 22, 12, 18, 27', '5, 7, 4, 4 and 7', '256']);
});

test('minimum-cut: Koenig on four seeds, every cover verified', function () {
  const edges = [];
  const matchings = [];

  for (let seed = 1; seed <= 4; seed += 1) {
    const instance = ReductionLab.bipartiteInstance(seed, {});
    const run = ReductionLab.coverToMatching(instance);

    assert.strictEqual(run.valid, true, 'seed ' + seed + ': the cover is not valid');
    assert.strictEqual(Matching.checkCover(instance, run.mapped).uncovered, 0);
    edges.push(instance.edges.length);
    matchings.push(run.targetValue);
  }
  assert.deepStrictEqual(edges, [13, 14, 14, 15]);
  assert.deepStrictEqual(matchings, [5, 7, 6, 6]);
  prose.quotes('minimum-cut', ['13, 14, 14, 15', '5, 7, 6, 6']);
});

test('minimum-cut: max-flow min-cut across five shapes at seed 2', function () {
  const shapes = ['layered', 'grid', 'unit', 'bottleneck', 'bipartite'];
  const values = [];
  const crossing = [];

  shapes.forEach(function (shape) {
    const graph = FlowLab.build({ shape: shape, seed: 2 });
    const state = FlowLab.singleRun(graph, { algorithm: 'dinic' });

    assert.strictEqual(state.cut.capacity, state.value, shape + ': the cut is not tight');
    state.cut.edges.forEach(function (arc) {
      const carried = state.flows[arc.id];

      assert.strictEqual(carried.flow, carried.capacity, shape + ': a crossing arc has slack');
    });
    values.push(state.value);
    crossing.push(state.cut.edges.length);
  });
  assert.deepStrictEqual(values, [23, 10, 4, 7, 6]);
  assert.deepStrictEqual(crossing, [5, 5, 4, 1, 6]);
  prose.quotes('minimum-cut', ['23, 10, 4, 7, 6', '5, 5, 4, 1, 6']);
});

/* ------------------------------------------------------------------ 14.3 */

function relabelNetwork() {
  return FlowLab.build({ shape: 'layered', width: 5, layers: 5, seed: 1 });
}

test('push-relabel: 20, and the three assertions that separate a flow from a preflow', function () {
  const graph = relabelNetwork();
  const sweep = FlowLab.heuristicSweep(graph, { rule: 'fifo' });
  const tuned = sweep[0];

  assert.strictEqual(graph.n, 27);
  assert.strictEqual(tuned.value, 20);
  assert.strictEqual(MaxFlow.dinic(graph, graph.source, graph.sink, {}).value, 20);
  assert.strictEqual(tuned.report.relabels, 50);
  assert.strictEqual(tuned.report.gapLifts, 23);
  assert.strictEqual(tuned.report.globalRelabels, 2);
  assert.strictEqual(tuned.report.pushes, 87);
  assert.strictEqual(tuned.report.saturating, 39);
  assert.strictEqual(tuned.report.nonSaturating, 48);
  assert.strictEqual(tuned.heights.valid, true);
  assert.strictEqual(tuned.heights.stillActive, 0);
  prose.quotes('push-relabel', ['20', '50 relabels', '23 gap lifts', '87 pushes', '39', '48']);
});

test('push-relabel: the heuristics are not additive, and the table says so', function () {
  const graph = relabelNetwork();
  const sweep = FlowLab.heuristicSweep(graph, { rule: 'fifo' });
  const relabels = sweep.map(function (row) { return row.report.relabels; });
  const pushes = sweep.map(function (row) { return row.report.pushes; });
  const visits = sweep.map(function (row) { return row.report.arcsExamined; });

  assert.deepStrictEqual(relabels, [50, 83, 44, 369]);
  assert.deepStrictEqual(pushes, [87, 142, 108, 719]);
  assert.deepStrictEqual(visits, [1030, 989, 1011, 4433]);
  assert.ok(relabels[2] < relabels[0],
    'global relabelling alone must beat the pair, or the section is overclaiming');
  assert.strictEqual((relabels[3] / relabels[0]).toFixed(2), '7.38');
  assert.strictEqual((relabels[3] / relabels[1]).toFixed(2), '4.45');
  assert.strictEqual((relabels[3] / relabels[2]).toFixed(2), '8.39');
  prose.quotes('push-relabel',
    ['369', '719', '4 433', '83', '142', '989', '44', '108', '1 011', '7.38', '4.45', '8.39']);
});

test('push-relabel: against the whole augmenting-path family on one network', function () {
  const graph = defaultNetwork();
  const source = graph.source;
  const sink = graph.sink;
  const visits = [
    MaxFlow.fordFulkerson(graph, source, sink, {}).report.arcsExamined,
    MaxFlow.edmondsKarp(graph, source, sink, {}).report.arcsExamined,
    MaxFlow.dinic(graph, source, sink, {}).report.arcsExamined,
    MaxFlow.capacityScaling(graph, source, sink, {}).report.arcsExamined
  ];

  assert.deepStrictEqual(visits, [576, 647, 247, 832]);
  const graph3 = relabelNetwork();
  const family = [
    MaxFlow.fordFulkerson(graph3, graph3.source, graph3.sink, {}).report.arcsExamined,
    MaxFlow.edmondsKarp(graph3, graph3.source, graph3.sink, {}).report.arcsExamined,
    MaxFlow.dinic(graph3, graph3.source, graph3.sink, {}).report.arcsExamined,
    MaxFlow.capacityScaling(graph3, graph3.source, graph3.sink, {}).report.arcsExamined
  ];

  assert.deepStrictEqual(family, [607, 1116, 409, 1164]);
  const fifo = FlowLab.heuristicSweep(graph3, { rule: 'fifo' })[0].report.arcsExamined;
  const highest = FlowLab.heuristicSweep(graph3, { rule: 'highest' })[0].report.arcsExamined;

  assert.strictEqual(fifo, 1030);
  assert.strictEqual(highest, 1048);
  prose.quotes('push-relabel', ['607', '1 116', '409', '1 164', '1 030', '1 048']);
});
