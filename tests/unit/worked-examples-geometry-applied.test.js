'use strict';

/**
 * Every figure the M16.9-M16.10 worked examples quote, recomputed from the
 * modules and then checked against the prose.
 */

const test = require('node:test');
const assert = require('node:assert');

const GeometryCore = require('../../src/js/algorithms/geometry-core.js');
const Polygon = require('../../src/js/algorithms/polygon.js');
const Transforms3D = require('../../src/js/algorithms/transforms-3d.js');
const Raster = require('../../src/js/algorithms/raster.js');
const Random = require('../../src/js/utils/random.js');

require('../../src/js/content/concepts-geometry-applied.js');
require('../../src/js/content/examples-geometry-applied.js');
const prose = require('../support/worked-example-prose.js');

/* ---------------------------------------------------------------- 16.9 */

/** The section's default pair: rotate-then-translate at 45° and a shift of 40. */
function orderedPair() {
  const angle = 45 * Math.PI / 180;
  const rotate = Transforms3D.rotationZ(angle);
  const translate = Transforms3D.translation(40, 0, 0);

  return { first: Transforms3D.compose(rotate, translate),
    second: Transforms3D.compose(translate, rotate) };
}

test('transforms: the same two operations, the opposite order', function () {
  const pair = orderedPair();
  const unit = Transforms3D.vec3(1, 0, 0);
  const origin = Transforms3D.vec3(0, 0, 0);
  const a = Transforms3D.apply(pair.first, unit);
  const b = Transforms3D.apply(pair.second, unit);
  const originA = Transforms3D.apply(pair.first, origin);
  const originB = Transforms3D.apply(pair.second, origin);
  const gap = Transforms3D.length3(Transforms3D.sub3(a, b));

  assert.strictEqual(gap.toFixed(2), '30.61');
  assert.deepStrictEqual([a.x.toFixed(1), a.y.toFixed(1), a.z.toFixed(1)], ['29.0', '29.0', '0.0']);
  assert.deepStrictEqual([b.x.toFixed(1), b.y.toFixed(1), b.z.toFixed(1)], ['40.7', '0.7', '0.0']);
  assert.deepStrictEqual([originA.x.toFixed(1), originA.y.toFixed(1)], ['28.3', '28.3']);
  assert.deepStrictEqual([originB.x.toFixed(1), originB.y.toFixed(1)], ['40.0', '0.0']);
  assert.strictEqual(pair.first[0].toFixed(2), '0.71');
  assert.strictEqual(pair.first[1].toFixed(2), '-0.71');
  assert.strictEqual(pair.first[3].toFixed(2), '28.28');
  assert.strictEqual(pair.second[3].toFixed(2), '40.00');
  assert.strictEqual(pair.second[7].toFixed(2), '0.00');
  prose.quotes('transforms-and-3d',
    ['both start 0.71 −0.71 0.00 and 0.71 0.71 0.00',
      '28.28 and 28.28 for one order, 40.00 and 0.00 for the other',
      'the origin lands at (28.3, 28.3, 0.0) and at (40.0, 0.0, 0.0)',
      '(29.0, 29.0, 0.0) against (40.7, 0.7, 0.0) — 30.61 apart']);
});

test('transforms: gimbal freedom drains for the whole approach to the pole', function () {
  const rows = [0, 15, 30, 45, 60, 75, 85, 89, 89.9, 90].map(function (degrees) {
    const coupling = Transforms3D.gimbalCoupling(degrees * Math.PI / 180, 0.01);
    return { degrees: degrees, gap: coupling.gapDegrees, baseline: coupling.baselineDegrees,
      lost: coupling.freedomLost };
  });

  assert.strictEqual(rows[0].baseline.toFixed(4), '0.8103');
  assert.deepStrictEqual(rows.map(function (row) { return row.gap.toFixed(4); }),
    ['0.8103', '0.6976', '0.5730', '0.4385', '0.2966', '0.1496', '0.0500', '0.0100', '0.0010',
      '0.0000']);
  assert.deepStrictEqual(rows.map(function (row) { return (100 * row.lost).toFixed(2); }),
    ['0.00', '13.91', '29.29', '45.88', '63.40', '81.54', '93.83', '98.77', '99.88', '100.00']);
  assert.strictEqual((0.01 * Math.sqrt(2) * 180 / Math.PI).toFixed(4), '0.8103');

  for (let i = 1; i < rows.length; i += 1) {
    assert.ok(rows[i].gap < rows[i - 1].gap, 'the gap shrinks monotonically at ' + rows[i].degrees);
  }
  prose.quotes('transforms-and-3d',
    ['the two results are 0.8103° apart',
      'gaps of 0.6976°, 0.5730° and 0.4385° — 13.91%, 29.29% and 45.88% lost',
      '63.40%, 81.54% and finally 100.00% at a gap of 0.0000°']);
});

test('transforms: 20 000 rays, two derivations, no disagreement', function () {
  const rng = Random.seeded(97);
  const stats = Transforms3D.report();
  let disagreements = 0;
  let roundTrips = 0;

  for (let i = 0; i < 20000; i += 1) {
    const a = Transforms3D.vec3(rng.next() * 4 - 2, rng.next() * 4 - 2, rng.next() * 4 - 2);
    const b = Transforms3D.vec3(rng.next() * 4 - 2, rng.next() * 4 - 2, rng.next() * 4 - 2);
    const c = Transforms3D.vec3(rng.next() * 4 - 2, rng.next() * 4 - 2, rng.next() * 4 - 2);
    const origin = Transforms3D.vec3(rng.next() * 6 - 3, rng.next() * 6 - 3, -5);
    const direction = Transforms3D.normalise3(
      Transforms3D.vec3(rng.next() * 0.6 - 0.3, rng.next() * 0.6 - 0.3, 1));
    const fast = Transforms3D.rayTriangle(origin, direction, a, b, c, { report: stats });
    const reference = Transforms3D.rayTrianglePlane(origin, direction, a, b, c);

    if (Boolean(fast) !== Boolean(reference)) { disagreements += 1; continue; }
    if (!fast) continue;
    if (Math.abs(fast.t - reference.t) > 1e-6) disagreements += 1;
    const rebuilt = Transforms3D.fromBarycentric(a, b, c, fast.u, fast.v);

    if (Math.abs(rebuilt.x - fast.point.x) > 1e-6 ||
      Math.abs(rebuilt.y - fast.point.y) > 1e-6 ||
      Math.abs(rebuilt.z - fast.point.z) > 1e-6) roundTrips += 1;
  }
  assert.strictEqual(stats.hits, 715);
  assert.strictEqual(stats.rayTests, 20000);
  assert.strictEqual(stats.misses, 19285);
  assert.strictEqual(stats.parallel, 0);
  assert.strictEqual(disagreements, 0);
  assert.strictEqual(roundTrips, 0);
  prose.quotes('transforms-and-3d',
    ['715 hits and 19 285 misses, with 0 parallel cases',
      '0 disagreements, and 0 barycentric round-trip errors on every hit']);
});

/* --------------------------------------------------------------- 16.10 */

const FILL_RING = [[3, 3], [27, 6], [24, 25], [7, 21]];
const CURVE = [[0, 0], [0, 60], [80, 60], [80, 0]];
const SHAPE_A = [[0, 0], [14, 0], [16, 9], [7, 14], [-1, 8]];
const SHAPE_B = [[0, 0], [12, 2], [13, 11], [3, 12]];

function ringOf(pairs, dx, dy) {
  return pairs.map(function (p) {
    return GeometryCore.point(p[0] + (dx || 0), p[1] + (dy || 0));
  });
}

test('applied: two line algorithms differ only in a tie-break', function () {
  const rng = Random.seeded(89);
  let identical = 0;
  let sameCount = 0;
  let sameEnds = 0;

  for (let i = 0; i < 3000; i += 1) {
    const a = GeometryCore.point(Math.round(rng.next() * 60 - 30), Math.round(rng.next() * 60 - 30));
    const b = GeometryCore.point(Math.round(rng.next() * 60 - 30), Math.round(rng.next() * 60 - 30));
    const bres = Raster.bresenham(a, b);
    const round = Raster.lineByRounding(a, b);
    const one = bres.map(function (p) { return p.x + ',' + p.y; }).join(' ');
    const two = round.map(function (p) { return p.x + ',' + p.y; }).join(' ');

    if (one === two) identical += 1;
    if (bres.length === round.length) sameCount += 1;
    if (bres[0].x === round[0].x && bres[0].y === round[0].y &&
      bres[bres.length - 1].x === round[round.length - 1].x &&
      bres[bres.length - 1].y === round[round.length - 1].y) sameEnds += 1;
  }
  assert.strictEqual(identical, 2492);
  assert.strictEqual(3000 - identical, 508);
  assert.strictEqual((100 * identical / 3000).toFixed(1), '83.1');
  assert.strictEqual(sameCount, 3000);
  assert.strictEqual(sameEnds, 3000);
  prose.quotes('applied-geometry',
    ['2 492 identical sets — 83.1% — and 508 differing',
      'endpoints equal on 3 000 of 3 000, and pixel counts equal on 3 000 of 3 000']);
});

test('applied: the coverage sum balances against the polygon area', function () {
  const ring = ringOf(FILL_RING);
  const stats = Raster.report();
  const spans = Raster.scanlineFill(ring, stats);
  const coverage = Raster.coverageFill(ring, 4, stats);
  const pixels = spans.reduce(function (sum, span) { return sum + span.x1 - span.x0 + 1; }, 0);
  const coverageSum = coverage.reduce(function (sum, c) { return sum + c.coverage; }, 0);
  const partial = coverage.filter(function (c) { return c.coverage > 0 && c.coverage < 1; }).length;

  assert.strictEqual(pixels, 378);
  assert.strictEqual(Polygon.area(ring).toFixed(2), '377.50');
  assert.strictEqual(coverageSum.toFixed(2), '377.63');
  assert.strictEqual(coverage.length, 411);
  assert.strictEqual(partial, 67);
  assert.ok(Math.abs(coverageSum - Polygon.area(ring)) < 1,
    'a biased filter would not land within a pixel of the true area');
  prose.quotes('applied-geometry',
    ['378 pixels filled, and 411 touched at all',
      'coverages sum to 377.63 against a true area of 377.50']);
});

test('applied: flattening costs far less per digit than it looks', function () {
  const p = CURVE.map(function (q) { return GeometryCore.point(q[0], q[1]); });
  const rows = [4, 1, 0.25, 0.0625, 0.015625].map(function (tolerance) {
    const stats = Raster.report();
    const flat = Raster.flattenCubic(p[0], p[1], p[2], p[3], tolerance, stats);
    return { tolerance: tolerance, segments: flat.length - 1,
      subdivisions: stats.subdivisions,
      error: Raster.flattenError(p[0], p[1], p[2], p[3], flat, 400) };
  });

  assert.deepStrictEqual(rows.map(function (row) { return row.segments; }), [8, 14, 28, 56, 110]);
  assert.deepStrictEqual(rows.map(function (row) { return row.subdivisions; }), [7, 13, 27, 55, 109]);
  assert.deepStrictEqual(rows.map(function (row) { return row.error.toFixed(4); }),
    ['0.9291', '0.7126', '0.1808', '0.0457', '0.0116']);
  rows.forEach(function (row) {
    assert.ok(row.error <= row.tolerance, 'at tolerance ' + row.tolerance + ' the error must fit');
  });
  assert.strictEqual((4 / 0.015625).toFixed(0), '256');
  assert.strictEqual((110 / 8).toFixed(1), '13.8');
  prose.quotes('applied-geometry',
    ['8, 14, 28, 56 and 110 segments at tolerances 4, 1, 0.25, 0.0625 and 0.015625',
      '256× the precision for 13.8× the segments']);
});

test('applied: the separating axis, the oracle, and a push that separates', function () {
  const rows = [0, 3, 6, 9, 12, 15, 18, 21, 24].map(function (separation) {
    const a = ringOf(SHAPE_A);
    const b = ringOf(SHAPE_B, 6 + separation, 2);
    const stats = Raster.report();
    const result = Raster.separatingAxis(a, b, { report: stats });
    const oracle = Raster.overlapBySampling(a, b, 150);
    let separated = null;

    if (result.colliding && result.mtv) {
      const after = Raster.separatingAxis(a, Raster.translateRing(b, result.mtv));
      separated = !after.colliding || after.overlap <= 1e-9;
    }
    return { separation: separation, axes: result.axesTested, colliding: result.colliding,
      oracle: oracle.overlapping, overlap: result.overlap || 0, separated: separated };
  });

  rows.forEach(function (row) {
    assert.strictEqual(row.colliding, row.oracle,
      'the sampling oracle disagreed at separation ' + row.separation);
    if (!row.colliding) return;
    assert.strictEqual(row.separated, true,
      'the push did not separate the shapes at separation ' + row.separation);
  });
  const overlapping = rows.filter(function (row) { return row.colliding; });
  const clear = rows.filter(function (row) { return !row.colliding; });

  assert.strictEqual(overlapping.length, 3);
  assert.strictEqual(clear.length, 6);
  assert.deepStrictEqual(overlapping.map(function (row) { return row.overlap.toFixed(3); }),
    ['8.243', '5.315', '2.386']);
  assert.deepStrictEqual(overlapping.map(function (row) { return row.axes; }), [9, 9, 9]);
  assert.deepStrictEqual(clear.map(function (row) { return row.axes; }), [2, 2, 2, 2, 2, 2]);
  prose.quotes('applied-geometry',
    ['9 axes tested while overlapping, 2 once separated', 'the oracle agrees at all 9 separations',
      '8.243, 5.315 and 2.386 at separations of 0, 3 and 6']);
});
