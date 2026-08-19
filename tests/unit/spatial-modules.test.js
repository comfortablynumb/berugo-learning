'use strict';

/**
 * Unit tests for the M08 two-dimensional indexes.
 *
 * The centre of this file is one property applied to every family: over any
 * point set, on any query, the index returns *exactly* the set brute force
 * returns - no missing element, no extra one, and no duplicate. Spatial
 * indexes fail by returning a plausible subset, and a plausible subset is
 * invisible to everything except an oracle.
 *
 * The point sets are deliberately hostile. Uniform data flatters every
 * structure; clustered data is what real data looks like; collinear points
 * make a quadtree degenerate along one diagonal; and coincident points are the
 * input that turns split-until-one-per-leaf into an infinite recursion.
 *
 * Everything here is pure and DOM-free, so `node --test` loads the modules
 * directly.
 */

const test = require('node:test');
const assert = require('node:assert');

const SpatialHash = require('../../src/js/algorithms/spatial-hash.js');
const Quadtree = require('../../src/js/algorithms/quadtree.js');
const KdTree = require('../../src/js/algorithms/kd-tree.js');
const RTree = require('../../src/js/algorithms/r-tree.js');
const Bvh = require('../../src/js/algorithms/bvh.js');
const SpatialLab = require('../../src/js/machines/spatial-lab.js');

const BOUNDS = SpatialLab.BOUNDS;

const KINDS = ['uniform', 'clustered', 'collinear', 'coincident', 'grid'];

function pointsOf(kind, count) {
  return SpatialLab.points({ kind: kind, count: count, seed: 11, bounds: BOUNDS });
}

/* --------------------------------------------------- the standing property */

const FAMILIES = [
  {
    name: 'uniform grid',
    build: function (list) {
      const index = SpatialHash.create({ cellSize: 40, bounds: BOUNDS, mode: 'grid' });
      index.insertAll(list);
      return index;
    }
  },
  {
    name: 'spatial hash',
    build: function (list) {
      const index = SpatialHash.create({ cellSize: 40, bounds: BOUNDS, mode: 'hash', buckets: 512 });
      index.insertAll(list);
      return index;
    }
  },
  {
    name: 'quadtree',
    build: function (list) {
      const index = Quadtree.create({ bounds: BOUNDS, capacity: 8, maxDepth: 12 });
      index.insertAll(list);
      return index;
    }
  },
  {
    name: 'loose quadtree',
    build: function (list) {
      const index = Quadtree.create({ bounds: BOUNDS, capacity: 8, maxDepth: 12, looseness: 1.5 });
      index.insertAll(list);
      return index;
    }
  },
  {
    name: 'k-d tree',
    build: function (list) { return KdTree.build(list, { leafSize: 8 }); }
  },
  {
    name: 'R-tree (quadratic)',
    build: function (list) {
      const index = RTree.create({ maxEntries: 9, split: 'quadratic' });
      index.insertAll(list.map(SpatialLab.asRectangle));
      return index;
    }
  }
];

FAMILIES.forEach(function (family) {
  KINDS.forEach(function (kind) {
    test('spatial: ' + family.name + ' answers radius queries exactly on ' + kind + ' points', function () {
      const list = pointsOf(kind, 1500);
      const index = family.build(list);
      const centres = SpatialLab.queries({ count: 60, bounds: BOUNDS, seed: 3 });
      const run = SpatialLab.runQueries({ index: index, points: list, queries: centres, radius: 45 });

      assert.strictEqual(run.wrong, 0,
        run.wrong + ' of ' + centres.length + ' queries disagreed with brute force (' + run.missing + ' points missing)');
      assert.ok(run.results > 0, 'the query set found nothing at all, so it proves nothing');
    });
  });
});

FAMILIES.forEach(function (family) {
  test('spatial: ' + family.name + ' answers window queries exactly', function () {
    const list = pointsOf('clustered', 1200);
    const index = family.build(list);
    const boxes = SpatialLab.windows({ count: 50, bounds: BOUNDS, seed: 5, side: 90 });
    const run = SpatialLab.runQueries({ index: index, points: list, queries: boxes });

    assert.strictEqual(run.wrong, 0, run.wrong + ' window queries disagreed with brute force');
    assert.strictEqual(run.duplicated === undefined ? 0 : run.duplicated, 0);
  });
});

/* ---------------------------------------------------------------- the grid */

test('grid: an object wider than a cell is reported once, not once per cell', function () {
  const index = SpatialHash.create({ cellSize: 10, bounds: BOUNDS, mode: 'grid' });
  index.insert({ id: 'wide', minX: 100, minY: 100, maxX: 260, maxY: 260 });
  const found = index.queryRange({ minX: 90, minY: 90, maxX: 300, maxY: 300 });

  assert.strictEqual(found.length, 1, 'the straddling object came back ' + found.length + ' times');
  assert.ok(index.stats().duplicateVisits > 0, 'the repeats must be counted, not silently absent');
});

test('grid: the hashed mode pays phantom candidates that the direct grid does not', function () {
  const list = pointsOf('uniform', 4000);
  const centres = SpatialLab.queries({ count: 40, bounds: BOUNDS, seed: 9 });

  const direct = SpatialHash.create({ cellSize: 30, bounds: BOUNDS, mode: 'grid' });
  direct.insertAll(list);
  SpatialLab.runQueries({ index: direct, points: list, queries: centres, radius: 40 });

  const hashed = SpatialHash.create({ cellSize: 30, bounds: BOUNDS, mode: 'hash', buckets: 256 });
  hashed.insertAll(list);
  SpatialLab.runQueries({ index: hashed, points: list, queries: centres, radius: 40 });

  assert.strictEqual(direct.stats().phantomCandidates, 0, 'a direct-addressed grid cannot collide');
  assert.ok(hashed.stats().phantomCandidates > 0, 'a 256-bucket table over 1 156 cells must collide');
});

test('grid: the predicted candidate count matches the measured one on uniform data', function () {
  const list = pointsOf('uniform', 8000);
  const centres = SpatialLab.queries({ count: 200, bounds: BOUNDS, seed: 21 });
  const index = SpatialHash.create({ cellSize: 25, bounds: BOUNDS, mode: 'grid' });
  index.insertAll(list);
  const run = SpatialLab.runQueries({ index: index, points: list, queries: centres, radius: 25 });
  const predicted = SpatialHash.expected({
    count: list.length, area: 1000 * 1000, cellSize: 25, radius: 25
  });

  const ratio = run.candidatesPerQuery / predicted.candidates;
  assert.ok(ratio > 0.85 && ratio < 1.15,
    'measured ' + run.candidatesPerQuery.toFixed(1) + ' against a predicted ' + predicted.candidates.toFixed(1));
});

/* ------------------------------------------------------------- quadtrees */

test('quadtree: coincident points terminate and respect the depth cap', function () {
  const list = SpatialLab.points({ kind: 'coincident', count: 5000, distinct: 3, seed: 4, bounds: BOUNDS });
  const index = Quadtree.create({ bounds: BOUNDS, capacity: 4, maxDepth: 10 });
  index.insertAll(list);
  const shape = index.shape();

  assert.strictEqual(index.size(), 5000);
  assert.ok(shape.maxDepth <= 10, 'depth ' + shape.maxDepth + ' passed the cap');
  assert.ok(shape.largestLeaf > 4, 'a leaf must be allowed to overflow, or the recursion never ends');
  assert.ok(index.checkInvariants().ok, index.checkInvariants().problems.join('; '));
});

test('quadtree: the empty-node problem is real and is reported', function () {
  const list = pointsOf('clustered', 4000);
  const index = Quadtree.create({ bounds: BOUNDS, capacity: 4, maxDepth: 12 });
  index.insertAll(list);
  const shape = index.shape();

  assert.ok(shape.emptyLeaves > 0, 'clustered data must leave empty leaves behind');
  assert.ok(shape.emptyLeaves < shape.leaves, 'not every leaf can be empty');
});

test('quadtree: a smaller capacity buys fewer candidates and costs more nodes', function () {
  const list = pointsOf('uniform', 4000);
  const centres = SpatialLab.queries({ count: 50, bounds: BOUNDS, seed: 6 });
  const rows = [2, 8, 32].map(function (capacity) {
    const index = Quadtree.create({ bounds: BOUNDS, capacity: capacity, maxDepth: 14 });
    index.insertAll(list);
    const run = SpatialLab.runQueries({ index: index, points: list, queries: centres, radius: 40 });
    return { capacity: capacity, candidates: run.candidatesPerQuery, nodes: index.shape().nodes };
  });

  assert.ok(rows[0].candidates < rows[2].candidates, 'a tighter bucket must test fewer candidates');
  assert.ok(rows[0].nodes > rows[2].nodes, 'and must cost more nodes to do it');
});

test('octree: the three-dimensional case indexes and queries correctly', function () {
  const tree = Quadtree.octree({ bounds: { min: [0, 0, 0], max: [100, 100, 100] }, capacity: 4, maxDepth: 8 });
  const list = [];
  for (let i = 0; i < 800; i += 1) {
    list.push({ id: i, p: [(i * 37) % 100, (i * 53) % 100, (i * 71) % 100] });
  }
  tree.insertAll(list);

  const rect = { min: [20, 20, 20], max: [60, 60, 60] };
  const found = tree.queryBox(rect).map(function (item) { return item.id; }).sort();
  const truth = list.filter(function (item) {
    return item.p.every(function (value, axis) { return value >= rect.min[axis] && value <= rect.max[axis]; });
  }).map(function (item) { return item.id; }).sort();

  assert.deepStrictEqual(found, truth);
  assert.ok(tree.shape().nodes > 1);
});

/* -------------------------------------------------------------- k-d trees */

test('kd: nearest agrees with brute force on every point set, in both prune modes', function () {
  ['uniform', 'clustered', 'collinear'].forEach(function (kind) {
    ['plane', 'box'].forEach(function (mode) {
      const list = pointsOf(kind, 2000);
      const run = SpatialLab.nearestRun({
        points: list, queries: SpatialLab.queries({ count: 250, bounds: BOUNDS, seed: 8 }),
        k: 1, pruneWith: mode
      });
      assert.strictEqual(run.wrong, 0, kind + '/' + mode + ': ' + run.wrong + ' wrong nearest answers');
    });
  });
});

test('kd: k-nearest agrees with brute force over 10 000 answered neighbours', function () {
  const list = pointsOf('clustered', 3000);
  const run = SpatialLab.nearestRun({
    points: list, queries: SpatialLab.queries({ count: 1000, bounds: BOUNDS, seed: 14 }), k: 10
  });

  assert.strictEqual(run.wrong, 0, run.wrong + ' of 1 000 k-nearest answers were wrong');
  assert.strictEqual(run.results, 10000);
});

test('kd: the box bound prunes strictly harder than the splitting plane', function () {
  const list = pointsOf('clustered', 4000);
  const centres = SpatialLab.queries({ count: 300, bounds: BOUNDS, seed: 15 });
  const plane = SpatialLab.nearestRun({ points: list, queries: centres, k: 1, pruneWith: 'plane' });
  const box = SpatialLab.nearestRun({ points: list, queries: centres, k: 1, pruneWith: 'box' });

  assert.ok(box.distancesPerQuery < plane.distancesPerQuery,
    'box ' + box.distancesPerQuery.toFixed(1) + ' against plane ' + plane.distancesPerQuery.toFixed(1));
  assert.strictEqual(box.wrong, 0);
});

test('kd: deleting half the points leaves the answers right and the work unchanged', function () {
  const list = pointsOf('uniform', 2000);
  const tree = KdTree.build(list, { leafSize: 8 });
  const live = list.filter(function (point, index) { return index % 2 === 0; });
  list.forEach(function (point, index) { if (index % 2) tree.remove(point); });

  const centres = SpatialLab.queries({ count: 120, bounds: BOUNDS, seed: 17 });
  let wrong = 0;
  centres.forEach(function (centre) {
    const found = tree.nearest(centre.p);
    const truth = SpatialLab.bruteNearest(live, centre, 1)[0];
    if (Math.abs(found.distance - truth.distance) > 1e-9) wrong += 1;
  });

  assert.strictEqual(wrong, 0, 'tombstones must not change the answer');
  assert.strictEqual(tree.size(), 1000);
  assert.ok(tree.stats().tombstonesVisited > 0, 'and the cost of not rebuilding must be visible');
});

test('kd: the tree invariant holds on the degenerate inputs', function () {
  ['collinear', 'coincident'].forEach(function (kind) {
    const tree = KdTree.build(pointsOf(kind, 1000), { leafSize: 4 });
    const verdict = tree.checkInvariants();
    assert.ok(verdict.ok, kind + ': ' + verdict.problems.slice(0, 3).join('; '));
  });
});

/* --------------------------------------------------------------- R-trees */

test('rtree: every split heuristic keeps the tree invariants', function () {
  const rects = SpatialLab.rectangles({ count: 2000, seed: 2, bounds: BOUNDS, size: 14 });
  RTree.strategies.forEach(function (split) {
    const tree = RTree.create({ maxEntries: 9, split: split });
    tree.insertAll(rects);
    const verdict = tree.checkInvariants();
    assert.ok(verdict.ok, split + ': ' + verdict.problems.slice(0, 3).join('; '));
    assert.strictEqual(tree.size(), 2000);
  });
});

test('rtree: the quadratic split leaves less overlap than a naive first-fit split', function () {
  const rects = SpatialLab.rectangles({ count: 3000, seed: 12, bounds: BOUNDS, size: 16 });
  const shapes = {};
  ['firstfit', 'quadratic', 'rstar'].forEach(function (split) {
    const tree = RTree.create({ maxEntries: 9, split: split });
    tree.insertAll(rects);
    shapes[split] = tree.shape();
  });

  assert.ok(shapes.quadratic.overlap < shapes.firstfit.overlap,
    'quadratic ' + shapes.quadratic.overlap.toFixed(0) + ' against first-fit ' + shapes.firstfit.overlap.toFixed(0));
  assert.ok(shapes.rstar.overlap < shapes.firstfit.overlap);
});

test('rtree: STR bulk loading packs the leaves and shortens the tree', function () {
  const rects = SpatialLab.rectangles({ count: 5000, seed: 19, bounds: BOUNDS, size: 12 });
  const incremental = RTree.create({ maxEntries: 9, split: 'quadratic' });
  incremental.insertAll(rects);
  const bulk = RTree.bulkLoad(rects, { maxEntries: 9 });

  assert.ok(bulk.shape().fill > incremental.shape().fill, 'bulk loading must pack the leaves fuller');
  assert.ok(bulk.shape().leaves < incremental.shape().leaves);
  assert.ok(bulk.checkInvariants({ minFill: false }).ok);
});

test('rtree: both builds answer window queries exactly', function () {
  const rects = SpatialLab.rectangles({ count: 3000, seed: 23, bounds: BOUNDS, size: 14 });
  const boxes = SpatialLab.windows({ count: 60, bounds: BOUNDS, seed: 24, side: 70 });

  [RTree.create({ maxEntries: 9, split: 'rstar' }), null].forEach(function (maybe) {
    const tree = maybe || RTree.bulkLoad(rects, { maxEntries: 9 });
    if (maybe) tree.insertAll(rects);
    const run = SpatialLab.runQueries({ index: tree, points: rects, queries: boxes });
    assert.strictEqual(run.wrong, 0);
  });
});

/* ------------------------------------------------------------------- BVH */

test('bvh: both builders agree with brute force on every ray, including misses', function () {
  const scene = SpatialLab.scene({ count: 1200, seed: 5, clumps: 4 });
  const rays = SpatialLab.rays({ count: 400, seed: 6 });
  const oracle = Bvh.bruteForce(scene);

  ['median', 'sah'].forEach(function (strategy) {
    const tree = Bvh.build(scene, { strategy: strategy, leafSize: 4, bins: 12 });
    let wrong = 0;
    rays.forEach(function (ray) {
      const found = tree.intersect(ray);
      const truth = oracle.intersect(ray);
      if (!!found.hit !== !!truth.hit) { wrong += 1; return; }
      if (found.hit && Math.abs(found.t - truth.t) > 1e-6) wrong += 1;
    });
    assert.strictEqual(wrong, 0, strategy + ': ' + wrong + ' rays disagreed with brute force');
  });
});

test('bvh: an axis-parallel ray does not vanish into a NaN comparison', function () {
  const box = { min: [0, 0, 0], max: [10, 10, 10] };

  const through = Bvh.rayBox({ origin: [-5, 5, 5], direction: [1, 0, 0] }, box, Infinity);
  assert.strictEqual(through, 5, 'a ray straight down an axis must enter the box at 5');

  const onFace = Bvh.rayBox({ origin: [-5, 0, 5], direction: [1, 0, 0] }, box, Infinity);
  assert.strictEqual(onFace, 5, 'an origin exactly on a slab plane is the 0 x Infinity = NaN case');

  const past = Bvh.rayBox({ origin: [-5, 20, 5], direction: [1, 0, 0] }, box, Infinity);
  assert.strictEqual(past, null, 'and a parallel ray outside the slab must miss');
});

test('bvh: the SAH build has the lower SAH cost, which is what it optimised', function () {
  const scene = SpatialLab.scene({ count: 3000, seed: 7, clumps: 6 });
  const median = Bvh.build(scene, { strategy: 'median', leafSize: 4 });
  const sah = Bvh.build(scene, { strategy: 'sah', leafSize: 4, bins: 16 });

  assert.ok(sah.cost() < median.cost(),
    'SAH ' + sah.cost().toFixed(1) + ' against median ' + median.cost().toFixed(1));
});

test('bvh: refitting a moved scene keeps the topology and grows the root', function () {
  const scene = SpatialLab.scene({ count: 800, seed: 8, clumps: 3 });
  const tree = Bvh.build(scene, { strategy: 'sah', leafSize: 4 });
  const before = tree.shape().nodes;

  scene.forEach(function (primitive, index) {
    const shift = (index % 7) - 3;
    primitive.min = primitive.min.map(function (value) { return value + shift; });
    primitive.max = primitive.max.map(function (value) { return value + shift; });
  });
  const growth = tree.refit();

  assert.strictEqual(tree.shape().nodes, before, 'a refit changes boxes, never topology');
  assert.ok(growth.growth > 1, 'and a scattered move must grow the root box');
});
