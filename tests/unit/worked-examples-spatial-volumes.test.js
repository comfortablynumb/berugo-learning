'use strict';

/**
 * Every figure the M08.4-M08.6 worked examples quote, recomputed against the
 * same generators, seeds and parameters the demos use - and checked to still
 * be present in the prose.
 */

const test = require('node:test');
const assert = require('node:assert');

const RTree = require('../../src/js/algorithms/r-tree.js');
const Bvh = require('../../src/js/algorithms/bvh.js');
const SpaceFilling = require('../../src/js/algorithms/space-filling.js');
const SpatialLab = require('../../src/js/machines/spatial-lab.js');
const registries = require('../../src/js/content/registries.js');
require('../../src/js/content/examples-spatial-volumes.js');
require('../../src/js/content/concepts-spatial-volumes.js');

const BOUNDS = SpatialLab.BOUNDS;
const RECTS = 20000;
const QUERIES = 200;
const RAYS = 1000;
const EXTENT = 100;

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

function grouped(value) {
  return Math.round(value).toLocaleString('en-US').replace(/,/g, ' ');
}

/* --------------------------------------------------------- 8.4 R-trees */

const rects = SpatialLab.rectangles({ count: RECTS, seed: 4, bounds: BOUNDS, size: 12 });
const windows = SpatialLab.windows({ count: QUERIES, bounds: BOUNDS, seed: 4, side: 60 });

function buildRTree(split) {
  const tree = split === 'str'
    ? RTree.bulkLoad(rects, { maxEntries: 9 })
    : RTree.create({ maxEntries: 9, split: split });
  if (split !== 'str') tree.insertAll(rects);
  const run = SpatialLab.runQueries({ index: tree, points: rects, queries: windows });
  return { shape: tree.shape(), run: run };
}

test('r-trees: four heuristics, the same height, and a 9.7x range in node visits', function () {
  const rows = {};
  ['firstfit', 'linear', 'quadratic', 'rstar'].forEach(function (split) {
    rows[split] = buildRTree(split);
  });

  ['firstfit', 'linear', 'quadratic', 'rstar'].forEach(function (split) {
    assert.strictEqual(rows[split].shape.height, 6, split + ' changed height');
    assert.strictEqual(rows[split].run.wrong, 0);
    assert.strictEqual(fixed(rows[split].run.resultsPerQuery), '105.89');
  });
  quotes('r-trees', '105.89');

  assert.strictEqual(rows.firstfit.shape.nodes, 3697);
  assert.strictEqual(rows.linear.shape.nodes, 3762);
  assert.strictEqual(rows.quadratic.shape.nodes, 3782);
  assert.strictEqual(rows.rstar.shape.nodes, 3593);
  ['3 697', '3 762', '3 782', '3 593'].forEach(function (figure) { quotes('r-trees', figure); });

  assert.strictEqual(fixed(rows.firstfit.shape.fill * 100, 1), '71.6');
  assert.strictEqual(fixed(rows.linear.shape.fill * 100, 1), '70.3');
  assert.strictEqual(fixed(rows.quadratic.shape.fill * 100, 1), '69.7');
  assert.strictEqual(fixed(rows.rstar.shape.fill * 100, 1), '73.1');
  ['71.6%', '70.3%', '69.7%', '73.1%'].forEach(function (figure) { quotes('r-trees', figure); });

  assert.strictEqual(fixed(rows.firstfit.shape.overlapRatio * 100), '113.69');
  assert.strictEqual(fixed(rows.linear.shape.overlapRatio * 100), '57.67');
  assert.strictEqual(fixed(rows.quadratic.shape.overlapRatio * 100), '59.58');
  assert.strictEqual(fixed(rows.rstar.shape.overlapRatio * 100), '24.49');
  ['113.69%', '57.67%', '59.58%', '24.49%'].forEach(function (figure) { quotes('r-trees', figure); });

  assert.strictEqual(fixed(rows.firstfit.run.nodesVisited / QUERIES), '356.04');
  assert.strictEqual(fixed(rows.linear.run.nodesVisited / QUERIES), '78.90');
  assert.strictEqual(fixed(rows.quadratic.run.nodesVisited / QUERIES), '85.32');
  assert.strictEqual(fixed(rows.rstar.run.nodesVisited / QUERIES), '36.69');
  ['356.04', '78.90', '85.32', '36.69'].forEach(function (figure) { quotes('r-trees', figure); });

  assert.strictEqual(fixed(rows.firstfit.run.candidatesPerQuery), '2250.07');
  assert.strictEqual(fixed(rows.linear.run.candidatesPerQuery), '499.41');
  assert.strictEqual(fixed(rows.quadratic.run.candidatesPerQuery), '547.07');
  assert.strictEqual(fixed(rows.rstar.run.candidatesPerQuery), '239.13');
  ['2 250.07', '499.41', '547.07', '239.13'].forEach(function (figure) { quotes('r-trees', figure); });

  assert.strictEqual(fixed(356.04 / 36.69, 1), '9.7');
  assert.strictEqual(fixed(113.69 / 24.49, 1), '4.6');
  assert.strictEqual(fixed((59.58 - 57.67) / 59.58 * 100, 1), '3.2');
  assert.strictEqual(fixed((547.07 - 499.41) / 547.07 * 100, 1), '8.7');
  ['9.7×', '4.6×', '3.2%', '8.7%'].forEach(function (figure) { quotes('r-trees', figure); });
});

test('r-trees: STR bulk loading against the incremental builds', function () {
  const quadratic = buildRTree('quadratic');
  const rstar = buildRTree('rstar');
  const str = buildRTree('str');

  assert.strictEqual(quadratic.shape.leaves, 3186);
  assert.strictEqual(str.shape.leaves, 2254);
  assert.strictEqual(str.shape.height, 5);
  assert.strictEqual(fixed(str.shape.fill * 100, 1), '98.6');
  assert.strictEqual(fixed(str.shape.overlapRatio * 100), '35.89');
  assert.strictEqual(fixed(str.run.nodesVisited / QUERIES), '28.43');
  assert.strictEqual(fixed(str.run.candidatesPerQuery), '247.48');
  assert.strictEqual(str.run.wrong, 0);

  ['3 186', '2 254', 'height 5', '98.6%', '35.89%', '28.43', '247.48'].forEach(function (figure) {
    quotes('r-trees', figure);
  });

  assert.strictEqual(Math.ceil(Math.sqrt(RECTS / 9)), 48);
  quotes('r-trees', '⌈√(20 000/9)⌉ = 48');
  assert.strictEqual(fixed(RECTS / quadratic.shape.leaves, 1), '6.3');
  assert.strictEqual(fixed((3186 - 2254) / 3186 * 100, 0), '29');
  assert.strictEqual(fixed(85.32 / 28.43, 1), '3.0');
  assert.strictEqual(fixed(547.07 / 247.48, 1), '2.2');
  assert.strictEqual(fixed((36.69 - 28.43) / 36.69 * 100, 1), '22.5');
  assert.strictEqual(fixed((247.48 - 239.13) / 247.48 * 100, 1), '3.4');
  ['6.3', '29%', '3.0×', '2.2×', '22.5%', '3.4%'].forEach(function (figure) { quotes('r-trees', figure); });
  assert.strictEqual(Math.ceil(9 * 0.4), 4);
  quotes('r-trees', '⌈9 × 0.4⌉ = 4');
  assert.strictEqual(rstar.shape.height, 6);
});

/* ------------------------------------------------------------- 8.5 BVH */

function freshScene() {
  return SpatialLab.scene({ count: RECTS, seed: 5, clumps: 6, extent: EXTENT, size: 2 });
}

const rays = SpatialLab.rays({ count: RAYS, seed: 5, extent: EXTENT });

test('bvh: the SAH build against the median split', function () {
  const scene = freshScene();
  const oracle = Bvh.bruteForce(scene);
  const truth = rays.map(function (ray) { return oracle.intersect(ray); });
  const hits = truth.filter(function (result) { return result.hit; }).length;
  assert.strictEqual(hits, 254);
  quotes('bounding-volumes', '254 hits');

  const rows = {};
  ['median', 'sah'].forEach(function (strategy) {
    const tree = Bvh.build(scene, { strategy: strategy, leafSize: 4, bins: 16 });
    tree.resetStats();
    let wrong = 0;
    rays.forEach(function (ray, index) {
      const found = tree.intersect(ray);
      if (!!found.hit !== !!truth[index].hit) { wrong += 1; return; }
      if (found.hit && Math.abs(found.t - truth[index].t) > 1e-6) wrong += 1;
    });
    rows[strategy] = { shape: tree.shape(), stats: tree.stats(), wrong: wrong };
  });

  assert.strictEqual(rows.median.wrong, 0);
  assert.strictEqual(rows.sah.wrong, 0);
  assert.strictEqual(rows.median.shape.nodes, 15423);
  assert.strictEqual(rows.median.shape.leaves, 7712);
  assert.strictEqual(rows.median.shape.maxDepth, 13);
  assert.strictEqual(rows.sah.shape.nodes, 13273);
  assert.strictEqual(rows.sah.shape.leaves, 6637);
  assert.strictEqual(rows.sah.shape.maxDepth, 18);
  ['15 423', '7 712', 'depth 13', '13 273', '6 637', 'depth 18'].forEach(function (figure) {
    quotes('bounding-volumes', figure);
  });

  measured.median = rows.median;
  measured.sah = rows.sah;
});

const measured = {};

test('bvh: the cost model predicted the ray counts', function () {
  const rows = measured;
  assert.strictEqual(fixed(rows.median.shape.sahCost), '65.81');
  assert.strictEqual(fixed(rows.sah.shape.sahCost), '49.44');
  assert.strictEqual(fixed(rows.median.stats.nodesVisited / RAYS), '40.70');
  assert.strictEqual(fixed(rows.sah.stats.nodesVisited / RAYS), '25.71');
  assert.strictEqual(fixed(rows.median.stats.primitivesTested / RAYS), '9.14');
  assert.strictEqual(fixed(rows.sah.stats.primitivesTested / RAYS), '7.76');
  assert.strictEqual(grouped(rows.median.shape.overlap), '215 703');
  assert.strictEqual(grouped(rows.sah.shape.overlap), '148 414');
  ['65.81', '49.44', '40.70', '25.71', '9.14', '7.76', '215 703', '148 414']
    .forEach(function (figure) { quotes('bounding-volumes', figure); });

  /* The claim the browser pass corrected: at leaf size 4 the SAH's
     "do not split at all" branch never fires, so the leaf-count difference is
     the split positions rather than that rule. Asserted in both directions so
     the prose cannot drift back to the convenient story. */
  assert.strictEqual(rows.sah.shape.leavesByCost, 0);
  const tiny = Bvh.build(freshScene(), { strategy: 'sah', leafSize: 1, bins: 16 });
  assert.strictEqual(tiny.shape().leavesByCost, 69);
  assert.strictEqual(fixed(tiny.shape().sahCost), '36.28');
  ['69 times', '36.28', '0 leaves made because splitting would have cost more'].forEach(function (figure) {
    quotes('bounding-volumes', figure);
  });

  assert.strictEqual(fixed((65.81 - 49.44) / 65.81 * 100, 1), '24.9');
  assert.strictEqual(fixed((40.70 - 25.71) / 40.70 * 100, 1), '36.8');
  assert.strictEqual(fixed((9.14 - 7.76) / 9.14 * 100, 1), '15.1');
  assert.strictEqual(fixed((215703 - 148414) / 215703 * 100, 1), '31.2');
  assert.strictEqual(fixed(40.70 / 25.71, 1), '1.6');
  ['24.9%', '36.8%', '15.1%', '31.2%', '1.6×'].forEach(function (figure) {
    quotes('bounding-volumes', figure);
  });
});

function moveScene(scene, motion) {
  scene.forEach(function (primitive, index) {
    const shift = motion === 'coherent'
      ? [Math.sin(primitive.centroid[0] / 20) * 2, Math.cos(primitive.centroid[1] / 20) * 2, 0]
      : [((index % 11) - 5) * 1.5, ((index % 7) - 3) * 1.5, ((index % 5) - 2) * 1.5];
    primitive.min = primitive.min.map(function (v, a) { return v + shift[a]; });
    primitive.max = primitive.max.map(function (v, a) { return v + shift[a]; });
    primitive.centroid = primitive.centroid.map(function (v, a) { return v + shift[a]; });
    primitive.points = primitive.points.map(function (point) {
      return point.map(function (v, a) { return v + shift[a]; });
    });
  });
}

function measureRays(tree) {
  tree.resetStats();
  rays.forEach(function (ray) { tree.intersect(ray); });
  return tree.stats();
}

test('bvh: refitting is free under coherent motion and a 5.2x regression under scattered', function () {
  const results = {};
  ['coherent', 'scattered'].forEach(function (motion) {
    const scene = freshScene();
    const tree = Bvh.build(scene, { strategy: 'sah', leafSize: 4, bins: 16 });
    const before = tree.cost();
    moveScene(scene, motion);
    const growth = tree.refit();
    const refitStats = measureRays(tree);
    const rebuilt = Bvh.build(scene, { strategy: 'sah', leafSize: 4, bins: 16 });
    results[motion] = {
      before: before, growth: growth.growth, refitCost: tree.cost(), rebuildCost: rebuilt.cost(),
      refitPrims: refitStats.primitivesTested / RAYS,
      rebuildPrims: measureRays(rebuilt).primitivesTested / RAYS,
      nodes: tree.shape().nodes, rebuiltNodes: rebuilt.shape().nodes
    };
  });

  assert.strictEqual(fixed(results.coherent.before), '49.44');
  assert.strictEqual(fixed(results.coherent.refitCost), '49.95');
  assert.strictEqual(fixed(results.coherent.rebuildCost), '50.85');
  assert.strictEqual(fixed(results.coherent.refitPrims), '7.99');
  assert.strictEqual(fixed(results.coherent.rebuildPrims), '8.24');
  assert.strictEqual(fixed(results.coherent.growth), '0.98');
  ['49.95', '50.85', '7.99', '8.24', '0.98'].forEach(function (figure) {
    quotes('bounding-volumes', figure);
  });

  assert.strictEqual(fixed(results.scattered.refitCost), '258.29');
  assert.strictEqual(fixed(results.scattered.rebuildCost), '50.76');
  assert.strictEqual(fixed(results.scattered.refitPrims), '82.32');
  assert.strictEqual(fixed(results.scattered.rebuildPrims), '9.61');
  assert.strictEqual(fixed(results.scattered.growth), '1.16');
  ['258.29', '50.76', '82.32', '9.61', '1.16'].forEach(function (figure) {
    quotes('bounding-volumes', figure);
  });

  assert.strictEqual(fixed(82.32 / 9.61, 1), '8.6');
  assert.strictEqual(fixed(258.29 / 49.44, 1), '5.2');
  assert.strictEqual(fixed((49.95 - 49.44) / 49.44 * 100, 1), '1.0');
  ['8.6×', '5.2×', '1.0%'].forEach(function (figure) { quotes('bounding-volumes', figure); });
  assert.strictEqual(results.scattered.nodes, 13273, 'a refit never changes the topology');
});

/* ---------------------------------------------------------- 8.6 curves */

const RECT = { x0: 9, y0: 5, x1: 26, y1: 21 };

test('curves: the 18 x 17 window decomposes into 45 Morton or 22 Hilbert ranges', function () {
  const morton = SpaceFilling.decompose(RECT, { order: 6, curve: 'morton' });
  const hilbert = SpaceFilling.decompose(RECT, { order: 6, curve: 'hilbert' });

  assert.strictEqual(morton.cells, 306);
  assert.strictEqual(morton.ranges, 45);
  assert.strictEqual(morton.span, 772);
  assert.strictEqual(hilbert.ranges, 22);
  assert.strictEqual(hilbert.span, 758);

  ['18 × 17 = 306', '45', '772', '22', '758'].forEach(function (figure) {
    quotes('space-filling-curves', figure);
  });
});

test('curves: coalescing to a budget, on both curves', function () {
  const rows = {};
  ['morton', 'hilbert'].forEach(function (curve) {
    const exact = SpaceFilling.decompose(RECT, { order: 6, curve: curve });
    rows[curve] = {};
    [4, 8, 16, 22].forEach(function (budget) {
      const merged = SpaceFilling.coalesce(exact, budget);
      rows[curve][budget] = merged;
    });
  });

  assert.strictEqual(rows.hilbert[4].scanned, 436);
  assert.strictEqual(rows.hilbert[4].falsePositives, 130);
  assert.strictEqual(rows.hilbert[8].scanned, 347);
  assert.strictEqual(rows.hilbert[8].falsePositives, 41);
  assert.strictEqual(rows.hilbert[16].scanned, 320);
  assert.strictEqual(rows.hilbert[16].falsePositives, 14);
  assert.strictEqual(rows.hilbert[22].scanned, 306);
  assert.strictEqual(rows.hilbert[22].falsePositives, 0);
  ['436', '130', '347', '41', '320', '14'].forEach(function (figure) {
    quotes('space-filling-curves', figure);
  });

  assert.strictEqual(rows.morton[4].scanned, 489);
  assert.strictEqual(rows.morton[4].falsePositives, 183);
  assert.strictEqual(rows.morton[8].scanned, 387);
  assert.strictEqual(rows.morton[8].falsePositives, 81);
  assert.strictEqual(rows.morton[16].scanned, 338);
  assert.strictEqual(rows.morton[16].falsePositives, 32);
  ['489', '183', '387', '81', '338', '32'].forEach(function (figure) {
    quotes('space-filling-curves', figure);
  });

  assert.strictEqual(fixed(130 / 306 * 100, 1), '42.5');
  assert.strictEqual(fixed(41 / 306 * 100, 1), '13.4');
  assert.strictEqual(fixed(14 / 306 * 100, 1), '4.6');
  assert.strictEqual(fixed(183 / 306 * 100, 1), '59.8');
  assert.strictEqual(fixed(81 / 306 * 100, 1), '26.5');
  assert.strictEqual(fixed(32 / 306 * 100, 1), '10.5');
  ['42.5%', '13.4%', '4.6%', '59.8%', '26.5%', '10.5%'].forEach(function (figure) {
    quotes('space-filling-curves', figure);
  });
});

test('curves: the locality claim is false one way and true the other', function () {
  const morton = SpaceFilling.locality({ order: 6, curve: 'morton' });
  const hilbert = SpaceFilling.locality({ order: 6, curve: 'hilbert' });

  assert.strictEqual(fixed(hilbert.neighbourMean), '39.05');
  assert.strictEqual(fixed(morton.neighbourMean), '32.50');
  assert.strictEqual(hilbert.neighbourMax, 3413);
  assert.strictEqual(morton.neighbourMax, 1366);
  assert.strictEqual(fixed(hilbert.jumpMax), '1.00');
  assert.strictEqual(fixed(morton.jumpMax), '63.01');
  assert.strictEqual(fixed(morton.jumpMean), '1.64');
  ['39.05', '32.50', '3 413', '1 366', '63.01', '1.64'].forEach(function (figure) {
    quotes('space-filling-curves', figure);
  });

  const windows = {};
  ['morton', 'hilbert'].forEach(function (curve) {
    windows[curve] = {};
    [4, 8, 16].forEach(function (side) {
      windows[curve][side] = SpaceFilling.windowRanges({ order: 6, curve: curve, side: side });
    });
  });

  assert.strictEqual(fixed(windows.hilbert[4].meanRanges), '3.94');
  assert.strictEqual(fixed(windows.hilbert[8].meanRanges), '7.86');
  assert.strictEqual(fixed(windows.hilbert[16].meanRanges), '15.68');
  assert.strictEqual(fixed(windows.morton[4].meanRanges), '6.25');
  assert.strictEqual(fixed(windows.morton[8].meanRanges), '13.95');
  assert.strictEqual(fixed(windows.morton[16].meanRanges), '29.49');
  ['3.94', '7.86', '15.68', '6.25', '13.95', '29.49'].forEach(function (figure) {
    quotes('space-filling-curves', figure);
  });

  assert.strictEqual(fixed(windows.hilbert[4].cellsPerRange), '4.06');
  assert.strictEqual(fixed(windows.hilbert[16].cellsPerRange), '16.33');
  assert.strictEqual(fixed(windows.morton[4].cellsPerRange), '2.56');
  assert.strictEqual(fixed(windows.morton[16].cellsPerRange), '8.68');
  ['4.06', '16.33', '2.56', '8.68'].forEach(function (figure) {
    quotes('space-filling-curves', figure);
  });

  assert.strictEqual(fixed(6.25 / 3.94), '1.59');
  assert.strictEqual(fixed(13.95 / 7.86), '1.77');
  assert.strictEqual(fixed(29.49 / 15.68), '1.88');
  ['1.59×', '1.77×', '1.88×'].forEach(function (figure) { quotes('space-filling-curves', figure); });
});

test('curves: the geohash of the demo point, and its prefix cells', function () {
  const point = { lat: 51.5007, lon: -0.1246 };
  const full = SpaceFilling.geohash(point, 9);
  assert.strictEqual(full.hash, 'gcpuvpmm2');
  quotes('space-filling-curves', 'gcpuvpmm2');

  const spans = {};
  [3, 5, 7].forEach(function (precision) {
    const box = SpaceFilling.geohashDecode(full.hash.slice(0, precision));
    spans[precision] = (box.latRange[1] - box.latRange[0]) * 111.32;
  });

  assert.strictEqual(fixed(spans[3], 0), '157');
  assert.strictEqual(fixed(spans[5], 1), '4.9');
  assert.strictEqual(fixed(spans[7] * 1000, 0), '153');
  ['156 km', '4.9 km', '153 m'].forEach(function (figure) {
    quotes('space-filling-curves', figure);
  });
});
