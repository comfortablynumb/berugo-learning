'use strict';

/**
 * Every figure the M14.8-M14.10 worked examples quote, recomputed from the
 * modules and then checked against the prose.
 */

const test = require('node:test');
const assert = require('node:assert');

const Coloring = require('../../src/js/algorithms/coloring.js');
const Layout = require('../../src/js/algorithms/layout.js');
const Spectral = require('../../src/js/algorithms/spectral.js');
const Centrality = require('../../src/js/algorithms/centrality.js');
const AnalysisLab = require('../../src/js/machines/graph-analysis-lab.js');

require('../../src/js/content/concepts-graph-analysis.js');
require('../../src/js/content/examples-graph-analysis.js');
const prose = require('../support/worked-example-prose.js');

/* ------------------------------------------------------------------ 14.8 */

/** The demo's own graph: random, 18 vertices, seed 1. */
function colourGraph(shape) {
  return AnalysisLab.build({ shape: shape || 'random', n: 18, seed: 1, rows: 5, columns: 5 });
}

test('graph-coloring: 5, 3 and 4 colours where the chromatic number is 3', function () {
  const run = AnalysisLab.colouringRun(colourGraph(), {});

  assert.deepStrictEqual(run.rows.map(function (row) { return row.name; }),
    ['natural', 'degree', 'degeneracy']);
  assert.deepStrictEqual(run.rows.map(function (row) { return row.colours; }), [5, 3, 4]);
  assert.deepStrictEqual(run.rows.map(function (row) { return row.report.colourChecks; }),
    [72, 72, 72]);
  assert.strictEqual(run.conflicts, 0);
  assert.strictEqual(run.exact, 3);
  assert.strictEqual(run.degeneracy, 3);
  assert.strictEqual(run.bound, 4);
  run.rows.forEach(function (row) {
    assert.strictEqual(row.check.valid, true, row.name + ' produced a conflict');
  });
  prose.quotes('graph-coloring', ['5 colours', '3 colours', '4 colours', '72', '3', '4']);
});

test('graph-coloring: on a two-colourable graph the intuitive ordering is the worst', function () {
  const run = AnalysisLab.colouringRun(colourGraph('bipartite'), {});

  assert.deepStrictEqual(run.rows.map(function (row) { return row.colours; }), [2, 4, 2]);
  assert.strictEqual(run.exact, 2);
  assert.strictEqual(run.conflicts, 0);
  prose.quotes('graph-coloring', ['natural 2, degree 4, degeneracy 2']);
});

test('graph-coloring: one search, three names, and the pivot priced', function () {
  const instance = colourGraph();
  const run = AnalysisLab.cliqueRun(instance);

  assert.strictEqual(run.clique.length, 3);
  assert.deepStrictEqual(run.clique.slice().sort(function (a, b) { return a - b; }), [0, 4, 15]);
  assert.strictEqual(run.free.length, 8);
  assert.strictEqual(run.cover, 10);
  assert.strictEqual(instance.adjacency.length, 18);
  assert.strictEqual(run.cliqueCheck.valid, true);
  assert.strictEqual(run.independentCheck.valid, true);
  assert.strictEqual(run.pivoted.report.maximalCliques, 24);
  assert.strictEqual(run.plain.report.maximalCliques, 24);
  assert.strictEqual(run.pivoted.report.recursionNodes, 41);
  assert.strictEqual(run.plain.report.recursionNodes, 64);
  assert.strictEqual(run.saving.toFixed(2), '1.56');
  prose.quotes('graph-coloring',
    ['0, 4 and 15', '24 maximal cliques', '41 recursion nodes', '64 recursion nodes',
      '1.56', '18 − 8 = 10']);
});

test('graph-coloring: the spill count, and never an invalid allocation', function () {
  const adjacency = colourGraph().adjacency;
  const spills = [2, 3, 4, 5, 6].map(function (registers) {
    const run = AnalysisLab.chaitinRun(adjacency, registers);

    assert.strictEqual(run.check.conflicts, 0, registers + ' registers: a conflict');
    return run.spills;
  });

  assert.deepStrictEqual(spills, [5, 3, 0, 0, 0]);
  prose.quotes('graph-coloring', ['5, 3, 0, 0 and 0', '18']);
});

test('graph-coloring: greedy is exact on an interval graph, by the clique number', function () {
  for (let seed = 1; seed <= 5; seed += 1) {
    const instance = AnalysisLab.build({ shape: 'interval', n: 16, seed: seed });
    const run = Coloring.greedyColoring(instance.adjacency,
      Coloring.leftEndpointOrder(instance.intervals), {});

    assert.strictEqual(run.colours, Coloring.maxOverlap(instance.intervals),
      'seed ' + seed + ': left-endpoint order must use exactly the maximum overlap');
    assert.strictEqual(Coloring.checkColoring(instance.adjacency, run.colour).valid, true);
  }
});

/* ------------------------------------------------------------------ 14.9 */

test('graph-layout: 0, 70 and 0 crossings on the grid', function () {
  const instance = AnalysisLab.build({ shape: 'planar-grid', rows: 5, columns: 5, seed: 1 });
  const run = AnalysisLab.layoutRun(instance, { steps: 200, seed: 1 });

  assert.strictEqual(run.graph.n, 25);
  assert.strictEqual(run.edges.length, 40);
  assert.strictEqual(run.pairs, 780);
  assert.strictEqual(run.crossings.force, 0);
  assert.strictEqual(run.crossings.circular, 70);
  assert.strictEqual(run.crossings.layered, 0);
  assert.strictEqual(run.layered.report.layers, 9);
  assert.strictEqual(run.layered.report.dummyNodes, 0);
  assert.strictEqual(run.layered.report.sweeps, 4);
  assert.strictEqual((100 * 70 / 780).toFixed(2), '8.97');
  prose.quotes('graph-layout',
    ['0 crossings over 780 candidate pairs', '70 crossings', '9 layers', '0 dummy vertices',
      '4 barycentre sweeps', '8.97%']);
});

test('graph-layout: the energy falls overall and rises on a third of the steps', function () {
  const instance = AnalysisLab.build({ shape: 'planar-grid', rows: 5, columns: 5, seed: 1 });
  const run = AnalysisLab.energyCurve(instance, { steps: 200, seed: 1 });

  assert.strictEqual(run.curve.length, 201);
  assert.strictEqual(run.first.toFixed(2), '123.67');
  assert.strictEqual(run.last.toFixed(2), '4.70');
  assert.strictEqual(run.rises, 68);
  assert.strictEqual((100 * 68 / 200).toFixed(1), '34.0');
  assert.ok(run.last < run.first, 'the endpoint claim must still hold');
  prose.quotes('graph-layout', ['123.67', '4.70', '68 of the 200', '34.0%']);
});

test('graph-layout: the scale-free graph, where the margins shrink', function () {
  const instance = AnalysisLab.build({ shape: 'scale-free', n: 24, seed: 1 });
  const run = AnalysisLab.layoutRun(instance, { steps: 200, seed: 1 });
  const energy = AnalysisLab.energyCurve(instance, { steps: 200, seed: 1 });

  assert.strictEqual(run.crossings.force, 45);
  assert.strictEqual(run.crossings.circular, 268);
  assert.strictEqual(run.crossings.layered, 96);
  assert.strictEqual(run.layered.report.dummyNodes, 48);
  assert.strictEqual(energy.rises, 82);
  assert.ok(run.crossings.force < run.crossings.layered,
    'the ranking must survive the harder graph');
  prose.quotes('graph-layout',
    ['45 force, 268 circular, 96 layered', '48 dummy vertices', '82 of 200']);
});

test('graph-layout: two non-planar graphs, two different arguments', function () {
  const fixtures = AnalysisLab.kuratowskiFixtures();
  const k5 = AnalysisLab.planarityChecks(fixtures[0]);
  const k33 = AnalysisLab.planarityChecks(fixtures[1]);
  const grid = AnalysisLab.planarityChecks(
    AnalysisLab.build({ shape: 'planar-grid', rows: 5, columns: 5, seed: 1 }));

  assert.strictEqual(k5.n, 5);
  assert.strictEqual(k5.edges, 10);
  assert.strictEqual(k5.general, 9);
  assert.strictEqual(k5.failsGeneral, true);
  assert.strictEqual(k33.n, 6);
  assert.strictEqual(k33.edges, 9);
  assert.strictEqual(k33.general, 12);
  assert.strictEqual(k33.failsGeneral, false);
  assert.strictEqual(k33.bipartite, 8);
  assert.strictEqual(k33.failsBipartite, true);
  assert.strictEqual(grid.edges, 40);
  assert.strictEqual(grid.general, 69);
  assert.strictEqual(grid.bipartite, 46);
  assert.strictEqual(grid.failsGeneral, false);
  prose.quotes('graph-layout',
    ['10 edges against a bound of 9', '9 edges against a bound of 12', '2V − 4 = 8',
      '40 edges against bounds of 69 and 46']);
});

test('graph-layout: crossings ignore edges that share an endpoint', function () {
  const square = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }];

  assert.strictEqual(Layout.crossings(square, [{ from: 0, to: 1 }, { from: 0, to: 2 }]), 0);
  assert.strictEqual(Layout.crossings(square, [{ from: 0, to: 3 }, { from: 1, to: 2 }]), 1);
});

/* ----------------------------------------------------------------- 14.10 */

function clusters() {
  return AnalysisLab.build({ shape: 'clustered', n: 24, seed: 1 });
}

test('spectral-methods: four measures, checked four ways', function () {
  const instance = clusters();
  const run = AnalysisLab.spectralRun(instance, { damping: 0.85 });

  assert.strictEqual(instance.adjacency.length, 24);
  assert.strictEqual(run.rank.report.iterations, 93);
  assert.ok(run.rankGap < 1e-9, 'power iteration must match the solve');
  assert.strictEqual(run.rankGap.toExponential(2), '3.46e-11');
  assert.strictEqual(run.distribution.total.toFixed(6), '1.000000');
  assert.strictEqual(run.betweenness.report.sources, 24);
  const exact = run.exactBetweenness;
  let worst = 0;

  run.betweenness.score.forEach(function (value, v) {
    worst = Math.max(worst, Math.abs(value - exact[v]));
  });
  assert.ok(worst < 1e-12, 'Brandes must agree with enumeration');
  assert.strictEqual(worst.toExponential(1), '1.7e-13');
  assert.strictEqual(run.fiedler.eigenvalue.toFixed(5), '0.06497');
  assert.strictEqual(run.fiedler.cut, 1);
  assert.deepStrictEqual(run.fiedler.sizes, [12, 12]);
  prose.quotes('spectral-methods',
    ['93 iterations', '3.46e-11', '1.000000', '1.7e-13', '0.06497', '12 and 12',
      '24 single-source sweeps']);
});

test('spectral-methods: the three centrality measures disagree', function () {
  const run = AnalysisLab.spectralRun(clusters(), { damping: 0.85 });

  function top(scores) {
    let best = 0;

    scores.forEach(function (value, index) { if (value > scores[best]) best = index; });
    return best;
  }
  const byBetween = top(run.betweenness.score);
  const byClose = top(run.closeness.score);
  const byRank = top(run.rank.rank);

  assert.strictEqual(byBetween, 20);
  assert.strictEqual(byClose, 7);
  assert.strictEqual(byRank, 7);
  assert.strictEqual(run.betweenness.score[byBetween].toFixed(4), '138.8333');
  assert.strictEqual(run.closeness.score[byClose].toFixed(4), '0.3651');
  assert.strictEqual(run.rank.rank[byRank].toFixed(4), '0.0563');
  assert.notStrictEqual(byBetween, byClose,
    'if the three ever agree here the section has lost its argument');
  prose.quotes('spectral-methods',
    ['20 at 138.8333', '7 at 0.3651', '7 at 0.0563']);
});

test('spectral-methods: Louvain recovers the planted grouping, and invents one from noise', function () {
  const planted = AnalysisLab.communityRun(clusters(), {});

  assert.strictEqual(planted.run.communities, 4);
  assert.strictEqual(planted.run.modularity.toFixed(4), '0.6773');
  assert.strictEqual(planted.planted.toFixed(4), '0.6773');
  assert.strictEqual(planted.run.report.passes, 5);
  assert.strictEqual(planted.run.report.moves, 22);
  assert.strictEqual(planted.matches.rand, 1);
  assert.strictEqual(planted.matches.total, 276);
  const noise = AnalysisLab.communityRun(
    AnalysisLab.build({ shape: 'random', n: 24, seed: 1 }), {});

  assert.strictEqual(noise.run.communities, 9);
  assert.strictEqual(noise.run.modularity.toFixed(4), '0.2476');
  assert.strictEqual(noise.planted, null);
  prose.quotes('spectral-methods',
    ['4 communities at modularity 0.6773', '5 passes', '22 vertex moves', '276',
      '9 communities at 0.2476']);
});

test('spectral-methods: the d^k bound overstates the work by up to 47.8x', function () {
  const web = AnalysisLab.webGraph({ n: 40, seed: 1 });
  const rows = AnalysisLab.dampingSweep(web, {});

  assert.deepStrictEqual(rows.map(function (r) { return r.damping; }),
    [0.5, 0.7, 0.85, 0.9, 0.95, 0.99]);
  assert.deepStrictEqual(rows.map(function (r) { return r.iterations; }), [20, 27, 36, 39, 44, 48]);
  assert.deepStrictEqual(rows.map(function (r) { return r.predicted; }),
    [34, 65, 142, 219, 449, 2292]);
  assert.deepStrictEqual(rows.map(function (r) { return (r.predicted / r.iterations).toFixed(1); }),
    ['1.7', '2.4', '3.9', '5.6', '10.2', '47.8']);
  assert.deepStrictEqual(rows.map(function (r) { return r.top; }), [6, 6, 16, 16, 16, 16]);
  rows.forEach(function (row) { assert.strictEqual(row.converged, true, 'every row must converge'); });
  prose.quotes('spectral-methods',
    ['20, 27, 36, 39, 44 and 48', '34, 65, 142, 219, 449 and 2 292',
      '1.7×, 2.4×, 3.9×, 5.6×, 10.2× and 47.8×', 'page 6 at damping 0.50 and 0.70']);
});

test('spectral-methods: the leak destroys the values and leaves the order alone', function () {
  const web = AnalysisLab.webGraph({ n: 40, seed: 1 });
  const run = AnalysisLab.pageRankRun(web, {});

  assert.strictEqual(web.dangling, 8);
  assert.strictEqual(run.goodTotal.total.toFixed(6), '1.000000');
  assert.strictEqual(run.leakyTotal.total.toFixed(6), '0.434437');
  assert.strictEqual(run.orderChanges.moved, 0);
  assert.strictEqual(run.orderChanges.total, 40);
  const search = AnalysisLab.leakSearch({});

  assert.strictEqual(search.checked, 4589);
  assert.strictEqual(search.inversions, 0);
  assert.strictEqual((100 * search.worstLeak).toFixed(1), '85.0');
  prose.quotes('spectral-methods',
    ['0.434437', '0 of 40', '4 589', '0 strictly inverted pairs', '85.0%']);
});
