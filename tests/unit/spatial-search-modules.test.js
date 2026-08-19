'use strict';

/**
 * Unit tests for the M08 curves, one-dimensional range structures, vector
 * indexes and broad phases.
 *
 * Three different notions of correctness are checked here, and they are not
 * interchangeable:
 *
 *   exact      a curve conversion round-trips, a segment tree matches a brute
 *              replay of the same operations, sweep and prune reports the same
 *              pair set as an all-pairs test on every frame
 *   bounded    a sparse table and a segment tree must agree on every query,
 *              because both are exact and disagreement means one is broken
 *   measured   an approximate vector index has no exact answer to match, so
 *              the assertion is a *recall floor at a stated ef* - the only
 *              honest form the claim can take
 *
 * Everything is pure and DOM-free.
 */

const test = require('node:test');
const assert = require('node:assert');

const SpaceFilling = require('../../src/js/algorithms/space-filling.js');
const RangeStructures = require('../../src/js/algorithms/range-structures.js');
const AnnIndex = require('../../src/js/algorithms/ann-index.js');
const Hnsw = require('../../src/js/algorithms/hnsw.js');
const BroadPhase = require('../../src/js/algorithms/broad-phase.js');
const RangeLab = require('../../src/js/machines/range-lab.js');
const VectorLab = require('../../src/js/machines/vector-lab.js');

/* ------------------------------------------------------ space-filling */

test('curves: Morton round-trips for every coordinate in the tested width', function () {
  for (let y = 0; y < 256; y += 1) {
    for (let x = 0; x < 256; x += 1) {
      const back = SpaceFilling.mortonDecode(SpaceFilling.morton2d(x, y));
      if (back.x !== x || back.y !== y) {
        assert.fail('morton(' + x + ',' + y + ') decoded to (' + back.x + ',' + back.y + ')');
      }
    }
  }
});

test('curves: Hilbert round-trips and is a bijection over the whole grid', function () {
  const order = 6;
  const side = 1 << order;
  const seen = new Set();

  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      const index = SpaceFilling.hilbertIndex(x, y, order);
      assert.ok(index >= 0 && index < side * side, 'index ' + index + ' out of range');
      assert.ok(!seen.has(index), 'index ' + index + ' used twice');
      seen.add(index);
      const back = SpaceFilling.hilbertDecode(index, order);
      assert.deepStrictEqual([back.x, back.y], [x, y]);
    }
  }
  assert.strictEqual(seen.size, side * side);
});

test('curves: Hilbert never jumps and Morton does', function () {
  const hilbert = SpaceFilling.locality({ order: 6, curve: 'hilbert' });
  const morton = SpaceFilling.locality({ order: 6, curve: 'morton' });

  assert.strictEqual(hilbert.jumpMax, 1, 'a Hilbert step is always to an adjacent cell');
  assert.strictEqual(hilbert.jumpMean, 1);
  assert.ok(morton.jumpMax > 1, 'Z-order must jump; it measured ' + morton.jumpMax);
});

/* This is the measurement that corrects the folklore, so it is asserted in
   both directions: the obvious metric says Z-order wins, and the metric that
   decides query cost says Hilbert does. A section that states only the second
   is repeating a slogan it has not checked. */
test('curves: "Hilbert has better locality" is false under the neighbour-gap metric', function () {
  const hilbert = SpaceFilling.locality({ order: 6, curve: 'hilbert' });
  const morton = SpaceFilling.locality({ order: 6, curve: 'morton' });

  assert.ok(hilbert.neighbourMean > morton.neighbourMean,
    'hilbert ' + hilbert.neighbourMean.toFixed(2) + ' against morton ' + morton.neighbourMean.toFixed(2));
  assert.ok(hilbert.neighbourMax > morton.neighbourMax);
});

test('curves: and true under the one that decides query cost - runs per window', function () {
  [4, 8, 16].forEach(function (side) {
    const hilbert = SpaceFilling.windowRanges({ order: 6, curve: 'hilbert', side: side });
    const morton = SpaceFilling.windowRanges({ order: 6, curve: 'morton', side: side });
    assert.ok(hilbert.meanRanges < morton.meanRanges,
      side + 'x' + side + ': hilbert ' + hilbert.meanRanges.toFixed(2) +
      ' against morton ' + morton.meanRanges.toFixed(2));
  });
});

test('curves: an exact decomposition covers the rectangle and nothing else', function () {
  const rect = { x0: 9, y0: 5, x1: 26, y1: 21 };
  ['morton', 'hilbert'].forEach(function (curve) {
    const result = SpaceFilling.decompose(rect, { order: 6, curve: curve });
    assert.strictEqual(result.cells, 18 * 17);
    assert.strictEqual(result.scanned, result.cells);
    assert.strictEqual(result.falsePositives, 0);
    assert.ok(result.ranges >= 1 && result.ranges <= result.cells);
  });
});

test('curves: coalescing to a budget trades false positives for round trips', function () {
  const rect = { x0: 9, y0: 5, x1: 26, y1: 21 };
  const exact = SpaceFilling.decompose(rect, { order: 6, curve: 'hilbert' });
  const merged = SpaceFilling.coalesce(exact, 8);

  assert.ok(merged.ranges <= 8);
  assert.ok(merged.ranges < exact.ranges, 'the budget must actually bite');
  assert.ok(merged.falsePositives > 0, 'and merging must cost cells the rectangle never held');
  assert.strictEqual(merged.scanned, merged.cells + merged.falsePositives);
});

test('curves: a geohash prefix is a bounding box that contains the point', function () {
  const point = { lat: 51.5007, lon: -0.1246 };
  const full = SpaceFilling.geohash(point, 9);
  assert.strictEqual(full.hash.length, 9);

  [3, 5, 7, 9].forEach(function (precision) {
    const box = SpaceFilling.geohashDecode(full.hash.slice(0, precision));
    assert.ok(point.lat >= box.latRange[0] && point.lat <= box.latRange[1], 'latitude outside the cell at ' + precision);
    assert.ok(point.lon >= box.lonRange[0] && point.lon <= box.lonRange[1], 'longitude outside the cell at ' + precision);
  });

  const coarse = SpaceFilling.geohashDecode(full.hash.slice(0, 3));
  const fine = SpaceFilling.geohashDecode(full.hash);
  assert.ok((coarse.latRange[1] - coarse.latRange[0]) > (fine.latRange[1] - fine.latRange[0]),
    'dropping characters must widen the cell');
});

/* ------------------------------------------------- range structures */

test('range: every sum structure matches a brute replay of the same operations', function () {
  const result = RangeLab.compare({ n: 1024, count: 20000, seed: 3 });
  assert.strictEqual(result.rows.length, 4);
  result.rows.forEach(function (row) {
    assert.strictEqual(row.mismatches, 0, row.label + ' disagreed on ' + row.mismatches + ' queries');
  });
  assert.strictEqual(result.cheapest.id, 'fenwick', 'the cheapest by slots touched was ' + result.cheapest.id);
});

test('range: the lazy segment tree matches brute force over 100 000 mixed operations', function () {
  const result = RangeLab.lazyRun({ n: 512, count: 100000, seed: 5 });
  assert.strictEqual(result.mismatches, 0, result.mismatches + ' of ' + result.queries + ' range minima were wrong');
  assert.ok(result.queries > 40000 && result.updates > 40000, 'the mix must exercise both sides');
});

test('range: a sparse table and a segment tree agree on every min query', function () {
  const result = RangeLab.idempotentRun({ n: 2048, count: 20000, seed: 7 });
  assert.strictEqual(result.mismatches, 0);
  assert.ok(result.tableSlotsPerQuery < result.treeSlotsPerQuery, 'the table must touch fewer slots');
  assert.ok(result.memoryRatio > 1, 'and must pay for it in memory');
});

test('range: the merge-sort tree answers an order statistic no monoid can', function () {
  const result = RangeLab.orderStatisticRun({ n: 1024, count: 2000, seed: 9 });
  assert.strictEqual(result.mismatches, 0);
  assert.ok(result.bytesPerElement > 8, 'sorted copies at every level cost more than one array');
});

test('range: the canonical decomposition of any interval stays under 2 log n nodes', function () {
  const values = RangeLab.values({ n: 1024, seed: 11 });
  let worst = 0;
  for (let from = 0; from < 1024; from += 7) {
    for (let to = from; to < 1024; to += 13) {
      const result = RangeLab.decomposition({ values: values, from: from, to: to });
      if (result.count > worst) worst = result.count;
      assert.ok(result.count <= result.bound, 'interval [' + from + ',' + to + '] needed ' + result.count + ' nodes');
    }
  }
  assert.ok(worst > 10, 'some interval must actually be awkward, or the bound proves nothing');
});

test('range: the Fenwick bit trick finds the same index as a linear scan', function () {
  const values = RangeLab.values({ n: 512, seed: 13, spread: 5 }).map(function (value) { return value + 1; });
  const tree = RangeStructures.fenwick(values);
  let total = 0;
  values.forEach(function (value) { total += value; });

  for (let target = 1; target <= total; target += 37) {
    let running = 0;
    let expected = 0;
    for (let i = 0; i < values.length; i += 1) {
      running += values[i];
      if (running >= target) { expected = i; break; }
    }
    assert.strictEqual(tree.findKth(target), expected, 'findKth(' + target + ')');
  }
});

test('range: a sparse table refuses a non-idempotent operation instead of lying', function () {
  assert.throws(function () {
    RangeStructures.sparseTable([1, 2, 3], { monoid: 'sum' });
  }, /idempotent/);
});

/* --------------------------------------------------- vector indexes */

test('ann: the VP-tree is exact, so its recall against brute force is 1', function () {
  const vectors = VectorLab.vectors({ count: 1200, dims: 16, clusters: 8, seed: 3 });
  const questions = VectorLab.queries({ count: 60, dims: 16, clusters: 8, seed: 3 });
  const truth = VectorLab.truthFor(vectors, questions, 10);
  const tree = AnnIndex.vpTree(vectors, { leafSize: 16, seed: 3 });
  const scored = VectorLab.score(tree, questions, truth, 10);

  assert.strictEqual(scored.recall, 1, 'an exact structure that misses is broken, not approximate');
  assert.ok(scored.distancesPerQuery < vectors.length, 'and it must prune something');
});

test('ann: HNSW clears a stated recall floor at a stated ef', function () {
  const vectors = VectorLab.vectors({ count: 3000, dims: 24, clusters: 16, seed: 5 });
  const questions = VectorLab.queries({ count: 80, dims: 24, clusters: 16, seed: 5 });
  const truth = VectorLab.truthFor(vectors, questions, 10);
  const graph = Hnsw.build(vectors, { M: 8, efConstruction: 200, seed: 5 });
  const scored = VectorLab.score(VectorLab.efWrapper(graph, 64), questions, truth, 10);

  assert.ok(scored.recall >= 0.95, 'recall at ef = 64 was ' + (scored.recall * 100).toFixed(1) + '%');
  assert.ok(scored.distancesPerQuery < vectors.length / 2,
    'and it must cost less than half a scan: ' + scored.distancesPerQuery.toFixed(0));
  assert.ok(graph.checkInvariants().ok, graph.checkInvariants().problems.join('; '));
});

/* efConstruction is not a free parameter: the same M and the same query-time
   ef give a graph that cannot be searched well if the build beam was too
   narrow, and no query-time dial recovers it. */
test('ann: a graph built with too narrow a beam cannot be fixed at query time', function () {
  const vectors = VectorLab.vectors({ count: 3000, dims: 24, clusters: 16, seed: 5 });
  const questions = VectorLab.queries({ count: 80, dims: 24, clusters: 16, seed: 5 });
  const truth = VectorLab.truthFor(vectors, questions, 10);
  const narrow = Hnsw.build(vectors, { M: 8, efConstruction: 48, seed: 5 });
  const wide = Hnsw.build(vectors, { M: 8, efConstruction: 200, seed: 5 });

  const a = VectorLab.score(VectorLab.efWrapper(narrow, 200), questions, truth, 10);
  const b = VectorLab.score(VectorLab.efWrapper(wide, 200), questions, truth, 10);
  assert.ok(b.recall > a.recall,
    'efConstruction 48 reached ' + (a.recall * 100).toFixed(1) + '% and 200 reached ' + (b.recall * 100).toFixed(1) + '%');
});

test('ann: recall rises with ef and the work rises with it', function () {
  const vectors = VectorLab.vectors({ count: 2000, dims: 16, clusters: 12, seed: 7 });
  const questions = VectorLab.queries({ count: 60, dims: 16, clusters: 12, seed: 7 });
  const truth = VectorLab.truthFor(vectors, questions, 10);
  const graph = Hnsw.build(vectors, { M: 6, efConstruction: 32, seed: 7 });
  const rows = VectorLab.sweep({
    vectors: vectors, queries: questions, truth: truth, index: graph, k: 10, values: [10, 20, 40, 80]
  });

  for (let i = 1; i < rows.length; i += 1) {
    assert.ok(rows[i].recall >= rows[i - 1].recall - 1e-9,
      'recall fell from ef ' + rows[i - 1].value + ' to ' + rows[i].value);
    assert.ok(rows[i].distancesPerQuery > rows[i - 1].distancesPerQuery, 'a bigger beam must cost more');
  }
  assert.ok(rows[0].recall < rows[rows.length - 1].recall, 'the dial must actually move recall');
});

test('ann: the selection heuristic builds a graph a greedy walk can cross', function () {
  const vectors = VectorLab.vectors({ count: 2000, dims: 16, clusters: 12, seed: 9 });
  const questions = VectorLab.queries({ count: 60, dims: 16, clusters: 12, seed: 9 });
  const truth = VectorLab.truthFor(vectors, questions, 10);

  const withHeuristic = Hnsw.build(vectors, { M: 6, efConstruction: 32, seed: 9 });
  const nearestOnly = Hnsw.build(vectors, { M: 6, efConstruction: 32, seed: 9, select: 'nearest' });
  const a = VectorLab.score(VectorLab.efWrapper(withHeuristic, 16), questions, truth, 10);
  const b = VectorLab.score(VectorLab.efWrapper(nearestOnly, 16), questions, truth, 10);

  assert.ok(a.recall > b.recall,
    'heuristic ' + (a.recall * 100).toFixed(1) + '% against nearest-only ' + (b.recall * 100).toFixed(1) + '%');
});

test('ann: product quantisation trades recall for two orders of magnitude of memory', function () {
  const vectors = VectorLab.vectors({ count: 2000, dims: 32, clusters: 12, seed: 11 });
  const questions = VectorLab.queries({ count: 50, dims: 32, clusters: 12, seed: 11 });
  const truth = VectorLab.truthFor(vectors, questions, 10);
  const exact = AnnIndex.bruteForce(vectors);
  const quantised = AnnIndex.productQuantiser(vectors, { parts: 8, centroids: 64, seed: 11 });
  const scored = VectorLab.score(quantised, questions, truth, 10);

  assert.ok(scored.recall > 0.3 && scored.recall < 1,
    'a lossy code must lose something and still be useful: ' + (scored.recall * 100).toFixed(1) + '%');
  assert.ok(exact.bytes() / quantised.bytes() > 10,
    'the memory saving was only ' + (exact.bytes() / quantised.bytes()).toFixed(1) + 'x');
});

test('ann: probing more IVF lists raises recall', function () {
  const vectors = VectorLab.vectors({ count: 2000, dims: 16, clusters: 12, seed: 13 });
  const questions = VectorLab.queries({ count: 50, dims: 16, clusters: 12, seed: 13 });
  const truth = VectorLab.truthFor(vectors, questions, 10);
  const index = AnnIndex.ivf(vectors, { lists: 48, seed: 13 });

  const low = VectorLab.score(VectorLab.probeWrapper(index, 1), questions, truth, 10);
  const high = VectorLab.score(VectorLab.probeWrapper(index, 12), questions, truth, 10);

  assert.ok(high.recall > low.recall,
    'probe 1 gave ' + (low.recall * 100).toFixed(1) + '% and probe 12 gave ' + (high.recall * 100).toFixed(1) + '%');
  assert.ok(high.distancesPerQuery > low.distancesPerQuery);
});

/* ------------------------------------------------------- broad phase */

test('broad phase: every phase reports exactly the brute-force pair set each frame', function () {
  const scene = BroadPhase.world({ count: 220, seed: 4, speed: 60, radius: 7 });
  const bodies = scene.bodies.map(function (body) { return Object.assign({}, body); });
  const phases = BroadPhase.phases.map(function (name) {
    return { name: name, phase: name === 'brute' ? BroadPhase.bruteForce() : (name === 'sap' ? BroadPhase.sweepAndPrune({}) : BroadPhase.hashPhase({})) };
  });

  for (let frame = 0; frame < 40; frame += 1) {
    const sets = phases.map(function (entry) { return entry.phase.pairs(bodies).slice().sort(); });
    for (let i = 1; i < sets.length; i += 1) {
      assert.deepStrictEqual(sets[i], sets[0],
        phases[i].name + ' disagreed with brute force on frame ' + frame);
    }
    BroadPhase.advance(bodies, scene.bounds, 1 / 30);
  }
});

test('broad phase: sweep and prune does far less work than all pairs', function () {
  const scene = BroadPhase.world({ count: 400, seed: 6, speed: 50, radius: 6 });
  const brute = BroadPhase.run({ world: scene, frames: 60, phase: 'brute', dt: 1 / 30 });
  const sap = BroadPhase.run({ world: scene, frames: 60, phase: 'sap', dt: 1 / 30 });

  assert.strictEqual(sap.reported, brute.reported, 'the same pairs, or the comparison is meaningless');
  assert.ok(sap.totals.tests < brute.totals.tests / 5,
    'sap tested ' + sap.totals.tests + ' against brute force ' + brute.totals.tests);
});

test('broad phase: temporal coherence is what makes the insertion sort cheap', function () {
  const slow = BroadPhase.run({ world: BroadPhase.world({ count: 300, seed: 8, speed: 5, radius: 6 }), frames: 60, phase: 'sap' });
  const fast = BroadPhase.run({ world: BroadPhase.world({ count: 300, seed: 8, speed: 400, radius: 6 }), frames: 60, phase: 'sap' });

  assert.ok(slow.totals.swaps < fast.totals.swaps,
    'slow ' + slow.totals.swaps + ' swaps against fast ' + fast.totals.swaps);

  /* The claim is about frame 2 onwards. Frame 1 sorts a random order from
     scratch and costs ~n²/4 swaps; every frame after it is the one the
     argument is about, and quoting the average over both hides exactly the
     effect the section is measuring. */
  const first = slow.frames[0].swaps;
  const later = slow.frames.slice(1).reduce(function (total, frame) { return total + frame.swaps; }, 0) / 59;
  assert.ok(first > 10000, 'the first frame really is a full sort: ' + first + ' swaps');
  assert.ok(later < first / 100,
    'later frames averaged ' + later.toFixed(1) + ' swaps against a first frame of ' + first);
});

test('broad phase: raising the speed makes the discrete phase miss real contacts', function () {
  const slow = BroadPhase.run({
    world: BroadPhase.world({ count: 200, seed: 10, speed: 30, radius: 5 }),
    frames: 60, phase: 'sap', dt: 1 / 30, checkTunnelling: true
  });
  const fast = BroadPhase.run({
    world: BroadPhase.world({ count: 200, seed: 10, speed: 1200, radius: 5 }),
    frames: 60, phase: 'sap', dt: 1 / 30, checkTunnelling: true
  });

  assert.ok(fast.missed > slow.missed,
    'slow missed ' + slow.missed + ' and fast missed ' + fast.missed);
  assert.ok(fast.missed > 0, 'tunnelling must be reproducible, or the section has no failure to show');
});

test('broad phase: the swept test finds a contact the two frame samples both miss', function () {
  const a = { id: 0, x: 0, y: 0, vx: 0, vy: 0, r: 1 };
  const b = { id: 1, x: 20, y: 0, vx: -1200, vy: 0, r: 1 };
  const dt = 1 / 30;

  const dx = (b.x + b.vx * dt) - a.x;
  assert.ok(Math.abs(b.x - a.x) > a.r + b.r, 'they are apart at the start of the step');
  assert.ok(Math.abs(dx) > a.r + b.r, 'and apart at the end of it');
  assert.ok(BroadPhase.sweptContact(a, b, dt) !== null, 'yet they passed through each other during it');
  assert.ok(BroadPhase.bruteForce().pairs([a, b]).length === 0,
    'so an all-pairs test at the frame boundary - the most expensive broad phase there is - still misses it');
});
