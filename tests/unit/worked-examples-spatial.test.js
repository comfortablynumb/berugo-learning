'use strict';

/**
 * Every figure the M08.1-M08.3 worked examples quote, recomputed.
 *
 * Each test does two things: it reproduces the measurement with the same
 * generator, seed and parameters the demo uses, and it asserts the example
 * *still quotes it*. Moving a number without moving the prose therefore fails
 * the build, which is the only way a figure and the sentence around it stay
 * attached to each other.
 */

const test = require('node:test');
const assert = require('node:assert');

const SpatialHash = require('../../src/js/algorithms/spatial-hash.js');
const Quadtree = require('../../src/js/algorithms/quadtree.js');
const KdTree = require('../../src/js/algorithms/kd-tree.js');
const SpatialLab = require('../../src/js/machines/spatial-lab.js');
const registries = require('../../src/js/content/registries.js');
require('../../src/js/content/examples-spatial.js');
require('../../src/js/content/concepts-spatial.js');

const BOUNDS = SpatialLab.BOUNDS;
const COUNT = 20000;
const QUERIES = 200;
const CELL_SIZES = [5, 10, 15, 20, 25, 35, 50, 75, 100, 150, 200];

function proseFor(sectionId) {
  const examples = registries.ExampleRegistry.get(sectionId) || [];
  const concepts = registries.ConceptRegistry.get(sectionId) || [];
  return examples.map(function (example) {
    return [example.goal, example.setup, example.answer].concat(
      example.steps.map(function (step) { return step.do + ' ' + step.why + ' ' + step.work + ' ' + step.result; })
    ).join(' ');
  }).join(' ') + ' ' + concepts.map(function (concept) {
    return concept.plain + ' ' + concept.formal + ' ' +
      (Array.isArray(concept.detail) ? concept.detail.join(' ') : concept.detail) + ' ' + concept.example;
  }).join(' ');
}

function quotes(sectionId, figure) {
  assert.ok(proseFor(sectionId).indexOf(figure) !== -1,
    'the ' + sectionId + ' content no longer quotes "' + figure + '"');
}

function fixed(value, digits) {
  return value.toFixed(digits === undefined ? 2 : digits);
}

/* Thousands separators in the prose are narrow spaces in words like "20 000";
   the tests quote the same rendering the content uses. */
function grouped(value) {
  return Math.round(value).toLocaleString('en-US').replace(/,/g, ' ');
}

const uniform = SpatialLab.points({ kind: 'uniform', count: COUNT, seed: 1, bounds: BOUNDS });
const clustered = SpatialLab.points({ kind: 'clustered', count: COUNT, seed: 1, bounds: BOUNDS });
const centres = SpatialLab.queries({ count: QUERIES, bounds: BOUNDS, seed: 1 });

/* ------------------------------------------------------------ 8.1 grids */

test('uniform-grids: the density, the expected answer size and the measurement', function () {
  const density = COUNT / (1000 * 1000);
  assert.strictEqual(density, 0.02);
  quotes('uniform-grids', '20 000 / 1 000² = 0.02');

  const sweep = SpatialLab.cellSweep({
    points: uniform, queries: centres, radius: 25, cellSizes: CELL_SIZES, bounds: BOUNDS
  });
  const at25 = sweep.rows.filter(function (row) { return row.cellSize === 25; })[0];

  assert.strictEqual(fixed(Math.PI * 625 * density), '39.27');
  quotes('uniform-grids', 'π · 25² · 0.02 = 39.27');
  assert.strictEqual(fixed(at25.resultsPerQuery), '38.48');
  quotes('uniform-grids', '38.48');
});

test('uniform-grids: the prediction agrees at c = 25 and c = 50 and not at c = 15', function () {
  const sweep = SpatialLab.cellSweep({
    points: uniform, queries: centres, radius: 25, cellSizes: CELL_SIZES, bounds: BOUNDS
  });
  const rows = {};
  sweep.rows.forEach(function (row) { rows[row.cellSize] = row; });

  assert.strictEqual(fixed(rows[25].predictedCandidates), '112.50');
  assert.strictEqual(fixed(rows[25].candidatesPerQuery), '109.98');
  assert.strictEqual(fixed(rows[25].cellsScanned / QUERIES), '9.00');
  quotes('uniform-grids', '109.98');
  quotes('uniform-grids', '112.50');

  assert.strictEqual(fixed(rows[50].predictedCandidates), '200.00');
  assert.strictEqual(fixed(rows[50].candidatesPerQuery), '193.66');
  quotes('uniform-grids', '193.66');

  assert.strictEqual(fixed(rows[15].cellsScanned / QUERIES), '18.84');
  assert.strictEqual(fixed(rows[15].candidatesPerQuery), '82.22');
  quotes('uniform-grids', '18.84');
  quotes('uniform-grids', '82.22');
});

test('uniform-grids: the work minimum is at a cell of 15, not at c = r', function () {
  const sweep = SpatialLab.cellSweep({
    points: uniform, queries: centres, radius: 25, cellSizes: CELL_SIZES, bounds: BOUNDS
  });
  const rows = {};
  sweep.rows.forEach(function (row) { rows[row.cellSize] = row; });

  assert.strictEqual(sweep.best.cellSize, 15);
  assert.strictEqual(fixed(rows[5].work), '180.10');
  assert.strictEqual(fixed(rows[15].work), '101.06');
  assert.strictEqual(fixed(rows[25].work), '118.98');
  assert.strictEqual(fixed(rows[200].work), '1150.00');

  ['180.10', '101.06', '118.98', '1 150.00'].forEach(function (figure) {
    quotes('uniform-grids', figure);
  });
});

test('uniform-grids: clustering leaves the prediction alone and moves the measurement', function () {
  const sweep = SpatialLab.cellSweep({
    points: clustered, queries: centres, radius: 25, cellSizes: CELL_SIZES, bounds: BOUNDS
  });
  const at25 = sweep.rows.filter(function (row) { return row.cellSize === 25; })[0];

  assert.strictEqual(fixed(at25.predictedCandidates), '112.50');
  assert.strictEqual(fixed(at25.candidatesPerQuery), '148.19');
  assert.strictEqual(fixed(at25.resultsPerQuery), '34.41');
  assert.strictEqual(fixed(at25.candidatesPerQuery / at25.resultsPerQuery), '4.31');
  assert.strictEqual(at25.occupancy.longest, 269);

  ['148.19', '34.41', '4.31', '269'].forEach(function (figure) { quotes('uniform-grids', figure); });
  assert.strictEqual(fixed(148.19 / 112.50 - 1, 3), '0.317');
  quotes('uniform-grids', '31.7%');
});

test('uniform-grids: the three indexes on both distributions', function () {
  const cases = { uniform: uniform, clustered: clustered };
  const measured = {};

  Object.keys(cases).forEach(function (kind) {
    measured[kind] = {};
    SpatialLab.compareIndexes({
      points: cases[kind], queries: centres, radius: 25, bounds: BOUNDS,
      cellSize: 25, kinds: ['grid', 'quadtree', 'kdtree']
    }).forEach(function (row) { measured[kind][row.kind] = row; });
  });

  assert.strictEqual(fixed(measured.uniform.grid.candidatesPerQuery), '109.98');
  assert.strictEqual(fixed(measured.uniform.quadtree.candidatesPerQuery), '80.85');
  assert.strictEqual(fixed(measured.uniform.kdtree.candidatesPerQuery), '73.67');
  assert.strictEqual(fixed(measured.clustered.grid.candidatesPerQuery), '148.19');
  assert.strictEqual(fixed(measured.clustered.quadtree.candidatesPerQuery), '57.78');
  assert.strictEqual(fixed(measured.clustered.kdtree.candidatesPerQuery), '58.16');

  ['80.85', '73.67', '57.78', '58.16'].forEach(function (figure) { quotes('uniform-grids', figure); });
  assert.strictEqual(grouped(measured.uniform.grid.bytes), '332 800');
  assert.strictEqual(grouped(measured.uniform.quadtree.bytes), '790 896');
  assert.strictEqual(grouped(measured.uniform.kdtree.bytes), '967 640');
  ['332 800', '790 896', '967 640'].forEach(function (figure) { quotes('uniform-grids', figure); });
});

test('uniform-grids: the sparse domain and the phantom-candidate sweep', function () {
  const wide = { minX: 0, minY: 0, maxX: 10000, maxY: 10000 };
  const sparse = SpatialLab.points({ kind: 'clustered', count: COUNT, seed: 1, bounds: wide, spread: 40 });
  const direct = SpatialHash.create({ cellSize: 25, bounds: wide, mode: 'grid' });
  direct.insertAll(sparse);
  const hashed = SpatialHash.create({ cellSize: 25, bounds: wide, mode: 'hash', buckets: 4096 });
  hashed.insertAll(sparse);

  assert.strictEqual(direct.occupancy().buckets, 160000);
  assert.strictEqual(direct.occupancy().used, 2257);
  assert.strictEqual(direct.occupancy().bytes, 1600000);
  assert.strictEqual(hashed.occupancy().buckets, 4096);
  ['160 000', '2 257', '1.6 MB', '4 096'].forEach(function (figure) { quotes('uniform-grids', figure); });

  const table = SpatialHash.create({ cellSize: 25, bounds: BOUNDS, mode: 'hash', buckets: 256 });
  table.insertAll(uniform);
  const run = SpatialLab.runQueries({ index: table, points: uniform, queries: centres, radius: 25 });
  const wasted = run.phantomCandidates / (run.candidatesTested + run.phantomCandidates);
  assert.strictEqual(fixed(wasted * 100, 1), '86.3');
  assert.strictEqual(fixed(run.phantomCandidates / QUERIES), '694.11');
  ['86.3%', '694.11'].forEach(function (figure) { quotes('uniform-grids', figure); });
});

/* -------------------------------------------------------- 8.2 quadtrees */

test('quadtrees: the capacity sweep on clustered points', function () {
  const rows = {};
  [2, 8, 16, 32, 64].forEach(function (capacity) {
    const tree = Quadtree.create({ bounds: BOUNDS, capacity: capacity, maxDepth: 14 });
    tree.insertAll(clustered);
    const run = SpatialLab.runQueries({
      index: tree, points: clustered, queries: centres, radius: 25
    });
    rows[capacity] = { shape: tree.shape(), run: run };
  });

  assert.strictEqual(rows[2].shape.nodes, 29893);
  assert.strictEqual(rows[2].shape.leaves, 22420);
  assert.strictEqual(rows[2].shape.emptyLeaves, 7832);
  assert.strictEqual(rows[2].shape.maxDepth, 14);
  assert.strictEqual(rows[2].shape.largestLeaf, 7);
  assert.strictEqual(rows[2].shape.bytes, 1914864);
  assert.strictEqual(fixed(rows[2].run.candidatesPerQuery), '50.31');
  assert.strictEqual(fixed(rows[2].run.nodesVisited / QUERIES), '84.21');
  assert.strictEqual(fixed(rows[2].run.nodesPruned / QUERIES), '26.69');

  assert.strictEqual(rows[64].shape.nodes, 1185);
  assert.strictEqual(rows[64].shape.leaves, 889);
  assert.strictEqual(rows[64].shape.emptyLeaves, 94);
  assert.strictEqual(rows[64].shape.maxDepth, 8);
  assert.strictEqual(rows[64].shape.bytes, 536880);
  assert.strictEqual(fixed(rows[64].run.candidatesPerQuery), '87.73');
  assert.strictEqual(fixed(rows[64].run.nodesVisited / QUERIES), '11.45');
  assert.strictEqual(fixed(rows[64].run.nodesPruned / QUERIES), '15.15');

  ['29 893', '22 420', '7 832', '1 914 864', '50.31', '84.21', '26.69',
    '1 185', '889', '94', '536 880', '87.73', '11.45', '15.15',
    '7 721', '57.78', '29.84', '4 165', '63.55', '20.43', '2 221', '72.41', '14.97'
  ].forEach(function (figure) { quotes('quadtrees', figure); });
});

test('quadtrees: the derived ratios the answer states', function () {
  const shapes = {};
  [2, 64].forEach(function (capacity) {
    const tree = Quadtree.create({ bounds: BOUNDS, capacity: capacity, maxDepth: 14 });
    tree.insertAll(clustered);
    shapes[capacity] = tree.shape();
  });

  assert.strictEqual(fixed(87.73 / 50.31), '1.74');
  assert.strictEqual(Math.round(shapes[2].nodes / shapes[64].nodes), 25);
  assert.strictEqual(fixed(shapes[2].bytes / shapes[64].bytes, 1), '3.6');
  assert.strictEqual(fixed(84.21 / 11.45, 1), '7.4');
  assert.strictEqual(fixed(shapes[2].bytes / COUNT, 1), '95.7');
  assert.strictEqual(fixed(shapes[64].bytes / COUNT, 1), '26.8');

  ['1.74', '25×', '3.6×', '7.4×', '95.7', '26.8'].forEach(function (figure) { quotes('quadtrees', figure); });
});

test('quadtrees: coincident points terminate and the depth cap buys nothing', function () {
  const list = SpatialLab.points({
    kind: 'coincident', count: COUNT, distinct: 3, seed: 2, bounds: BOUNDS
  });
  const rows = {};
  [8, 12, 16, 20].forEach(function (cap) {
    const tree = Quadtree.create({ bounds: BOUNDS, capacity: 8, maxDepth: cap });
    tree.insertAll(list);
    rows[cap] = tree.shape();
  });

  assert.deepStrictEqual([rows[8].nodes, rows[12].nodes, rows[16].nodes, rows[20].nodes], [89, 137, 185, 233]);
  [8, 12, 16, 20].forEach(function (cap) {
    assert.strictEqual(rows[cap].maxDepth, cap);
    assert.strictEqual(rows[cap].largestLeaf, 6667);
  });
  assert.strictEqual((rows[20].nodes - rows[8].nodes) / 12, 12, 'twelve nodes per extra level');

  ['89', '137', '185', '233', '6 667', '12 nodes per extra level'].forEach(function (figure) {
    quotes('quadtrees', figure);
  });

  const one = Quadtree.create({ bounds: BOUNDS, capacity: 8, maxDepth: 12 });
  one.insertAll(SpatialLab.points({ kind: 'coincident', count: COUNT, distinct: 1, seed: 2, bounds: BOUNDS }));
  assert.strictEqual(one.shape().nodes, 49);
  assert.strictEqual(one.shape().largestLeaf, 20000);

  const ten = Quadtree.create({ bounds: BOUNDS, capacity: 8, maxDepth: 12 });
  ten.insertAll(SpatialLab.points({ kind: 'coincident', count: COUNT, distinct: 10, seed: 2, bounds: BOUNDS }));
  assert.strictEqual(ten.shape().nodes, 405);
  assert.strictEqual(ten.shape().largestLeaf, 2000);
  ['49 nodes', '405 nodes', '2 000'].forEach(function (figure) { quotes('quadtrees', figure); });
});

test('quadtrees: the natural depths, and what looseness is worth on boxes', function () {
  const shapes = {};
  [['uniform', uniform], ['clustered', clustered]].forEach(function (pair) {
    const tree = Quadtree.create({ bounds: BOUNDS, capacity: 8, maxDepth: 14 });
    tree.insertAll(pair[1]);
    shapes[pair[0]] = tree.shape();
  });
  assert.strictEqual(shapes.uniform.maxDepth, 7);
  assert.strictEqual(shapes.clustered.maxDepth, 11);
  assert.strictEqual(shapes.clustered.nodes, 7721);
  assert.strictEqual(shapes.uniform.emptyLeaves, 86);
  ['depth 11', 'depth 7', '86'].forEach(function (figure) { quotes('quadtrees', figure); });

  const boxes = SpatialLab.rectangles({ count: 5000, seed: 2, bounds: BOUNDS, size: 60 });
  const windows = SpatialLab.windows({ count: 100, bounds: BOUNDS, seed: 2, side: 60 });
  const loose = {};
  [1, 1.5, 2].forEach(function (looseness) {
    const tree = Quadtree.create({
      bounds: BOUNDS, capacity: 8, maxDepth: 12, looseness: looseness
    });
    tree.insertAll(boxes);
    loose[looseness] = {
      shape: tree.shape(),
      run: SpatialLab.runQueries({ index: tree, points: boxes, queries: windows })
    };
  });

  assert.strictEqual(fixed(loose[1].run.candidatesPerQuery), '1792.18');
  assert.strictEqual(fixed(loose[1.5].run.candidatesPerQuery), '606.29');
  assert.strictEqual(fixed(loose[2].run.candidatesPerQuery), '1159.50');
  assert.ok(loose[1].shape.nodes >= 321 && loose[2].shape.nodes <= 393);
  ['1 792.18', '606.29', '1 159.50', '321', '393'].forEach(function (figure) { quotes('quadtrees', figure); });
});

/* --------------------------------------------------------- 8.3 k-d trees */

test('kd-trees: the tree shape and the build comparison count', function () {
  const tree = KdTree.build(clustered, { leafSize: 8 });
  const shape = tree.shape();

  assert.strictEqual(shape.nodes, 8191);
  assert.strictEqual(shape.leaves, 4096);
  assert.strictEqual(shape.maxDepth, 12);
  assert.strictEqual(shape.buildComparisons, 720512);
  assert.strictEqual(fixed(COUNT / shape.leaves), '4.88');

  ['8 191', '4 096', 'depth exactly 12', '720 512', '4.88'].forEach(function (figure) {
    quotes('kd-trees', figure);
  });
  assert.strictEqual(Math.round(720512 / COUNT), 36);
  quotes('kd-trees', '36 per point');
});

test('kd-trees: the descent alone is 60.2% wrong and looks fine', function () {
  const questions = SpatialLab.queries({ count: 500, bounds: BOUNDS, seed: 3 });
  const descent = SpatialLab.nearestRun({
    points: clustered, queries: questions, k: 1, pruneWith: 'descent'
  });

  assert.strictEqual(descent.wrong, 301);
  assert.strictEqual(fixed(301 / 500 * 100, 1), '60.2');
  assert.strictEqual(fixed(descent.distancesPerQuery), '4.87');
  assert.strictEqual(fixed(descent.nodesVisited / 500), '13.00');
  assert.strictEqual(fixed(descent.leavesVisited / 500), '1.00');
  assert.strictEqual(fixed(descent.meanNearest, 3), '60.272');

  ['301 of 500', '60.2%', '4.87', '13 nodes visited', '60.272'].forEach(function (figure) {
    quotes('kd-trees', figure);
  });
});

test('kd-trees: the two correct bounds, and the truth the descent missed', function () {
  const questions = SpatialLab.queries({ count: 500, bounds: BOUNDS, seed: 3 });
  const plane = SpatialLab.nearestRun({ points: clustered, queries: questions, k: 1, pruneWith: 'plane' });
  const box = SpatialLab.nearestRun({ points: clustered, queries: questions, k: 1, pruneWith: 'box' });
  const ten = SpatialLab.nearestRun({ points: clustered, queries: questions, k: 10, pruneWith: 'plane' });

  assert.strictEqual(plane.wrong, 0);
  assert.strictEqual(box.wrong, 0);
  assert.strictEqual(fixed(plane.distancesPerQuery), '69.28');
  assert.strictEqual(fixed(plane.nodesVisited / 500), '51.50');
  assert.strictEqual(fixed(plane.leavesVisited / 500), '14.26');
  assert.strictEqual(fixed(plane.nodesPruned / 500), '23.97');
  assert.strictEqual(fixed(box.distancesPerQuery), '19.77');
  assert.strictEqual(fixed(box.nodesVisited / 500), '27.08');
  assert.strictEqual(fixed(box.leavesVisited / 500), '4.05');
  assert.strictEqual(fixed(plane.meanNearest, 3), '42.701');
  assert.strictEqual(fixed(ten.distancesPerQuery), '149.49');

  ['69.28', '51.50', '14.26', '23.97', '19.77', '27.08', '4.05', '42.701', '149.49']
    .forEach(function (figure) { quotes('kd-trees', figure); });

  assert.strictEqual(fixed(COUNT / 4.87, 0), '4107');
  assert.strictEqual(fixed(69.28 / 4.87, 1), '14.2');
  assert.strictEqual(fixed(69.28 / COUNT * 100, 2), '0.35');
  assert.strictEqual(fixed(69.28 / 19.77, 1), '3.5');
  ['0.35%', '3.5×'].forEach(function (figure) { quotes('kd-trees', figure); });
});

test('kd-trees: the dimension sweep, and the VP-tree that fails the same way', function () {
  const rows = {};
  SpatialLab.dimensionSweep({
    count: 4000, queries: 50, dims: [2, 4, 8, 16, 32, 64, 128], seed: 3
  }).forEach(function (row) { rows[row.dims] = row; });

  assert.strictEqual(fixed(rows[2].distancesPerQuery), '13.66');
  assert.strictEqual(fixed(rows[4].distancesPerQuery), '65.10');
  assert.strictEqual(fixed(rows[8].distancesPerQuery), '644.90');
  assert.strictEqual(fixed(rows[16].distancesPerQuery), '3981.56');
  assert.strictEqual(fixed(rows[32].distancesPerQuery), '4000.00');
  assert.strictEqual(fixed(rows[2].scanFraction * 100, 1), '0.3');
  assert.strictEqual(fixed(rows[8].scanFraction * 100, 1), '16.1');
  assert.strictEqual(fixed(rows[16].scanFraction * 100, 1), '99.5');
  assert.strictEqual(fixed(rows[2].prunedPerQuery), '9.26');
  assert.strictEqual(fixed(rows[8].prunedPerQuery), '55.26');
  assert.strictEqual(fixed(rows[16].prunedPerQuery), '1.96');
  assert.strictEqual(fixed(rows[32].prunedPerQuery), '0.00');

  ['13.66', '65.10', '644.90', '3 981.56', '4 000.00', '0.3%', '16.1%', '99.5%',
    '9.26', '55.26', '1.96', '0.00'].forEach(function (figure) { quotes('kd-trees', figure); });
});
