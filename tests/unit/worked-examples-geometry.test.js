'use strict';

/**
 * Every figure the M16.1-M16.3 worked examples quote, recomputed from the
 * modules and then checked against the prose.
 *
 * The section controllers are not imported; the calls below reproduce what
 * they make at their default control settings, which is the contract this
 * suite is really pinning down - if a default moves, the prose is wrong and
 * this fails.
 */

const test = require('node:test');
const assert = require('node:assert');

const GeometryCore = require('../../src/js/algorithms/geometry-core.js');
const Polygon = require('../../src/js/algorithms/polygon.js');
const ConvexHull = require('../../src/js/algorithms/convex-hull.js');
const Lab = require('../../src/js/machines/geometry-lab.js');

require('../../src/js/content/concepts-geometry.js');
require('../../src/js/content/examples-geometry.js');
const prose = require('../support/worked-example-prose.js');

/* ---------------------------------------------------------------- 16.1 */

/** The section's default triple, reproduced exactly. */
function defaultTriple() {
  const ULP = Math.pow(2, -52);
  const a = GeometryCore.point(0.15608477592468262, 0.7452991008758545);
  const b = GeometryCore.point(3.1257132530212406, 0.40750494003295895);
  const onLine = -0.10375108718872073;

  return { a: a, b: b,
    c: GeometryCore.point(7.620286083221436, onLine + 1 * Math.abs(onLine) * ULP) };
}

test('primitives: the six orderings rank the three predicates', function () {
  const triple = defaultTriple();
  const checked = Lab.permutationCheck(triple.a, triple.b, triple.c);

  assert.strictEqual(checked.value.toExponential(3), '4.441e-16');
  assert.deepStrictEqual(checked.naive.even, [1, 0, 1]);
  assert.strictEqual(checked.naive.consistent, false);
  assert.deepStrictEqual(checked.epsilon.even, [0, 0, 0]);
  assert.deepStrictEqual(checked.epsilon.odd, [0, 0, 0]);
  assert.strictEqual(checked.epsilon.consistent, true);
  assert.deepStrictEqual(checked.adaptive.even, [1, 1, 1]);
  assert.deepStrictEqual(checked.adaptive.odd, [-1, -1, -1]);
  assert.strictEqual(checked.adaptive.consistent, true);
  prose.quotes('geometry-primitives',
    ['4.441e-16', 'left (+1), collinear (0), left (+1)', 'all six answer collinear (0)',
      'left (+1) three times and right (−1) three times']);
});

test('primitives: the sweep, and the column nobody checks', function () {
  const sweep = Lab.robustnessSweep(4000, 5);

  assert.strictEqual(sweep.trials, 4000);
  assert.strictEqual(sweep.naive, 1121);
  assert.strictEqual(sweep.naiveWrong, 642);
  assert.strictEqual(sweep.epsilon, 0);
  assert.strictEqual(sweep.epsilonWrong, 4000);
  assert.strictEqual(sweep.epsilonFlattened, 4000);
  assert.strictEqual(sweep.adaptive, 0);
  assert.strictEqual(sweep.escalations, 2507);
  prose.quotes('geometry-primitives',
    ['naive 1 121 contradictions and 642 wrong; epsilon 0 and 4 000; adaptive 0 and 0',
      'calling a real turn collinear 4 000 times where the naive test does it 0 times',
      '2 507 escalated']);
});

test('primitives: escalation is zero on ordinary points and 62.67% on adversarial ones', function () {
  const ordinary = Lab.escalationRate(4000, 9);
  const sweep = Lab.robustnessSweep(4000, 5);

  assert.strictEqual(ordinary.calls, 4000);
  assert.strictEqual(ordinary.exact, 0);
  assert.strictEqual(ordinary.rate, 0);
  assert.strictEqual((100 * sweep.escalations / sweep.trials).toFixed(2), '62.67');
  prose.quotes('geometry-primitives',
    ['4 000 calls, 0 escalated to exact — a rate of 0.00%', '62.67%',
      '0.00% escalation on ordinary points against 62.67%']);
});

/* ---------------------------------------------------------------- 16.2 */

/** The section's probe grid: `steps` per side over the ring's bounding box. */
function probeGrid(ring, steps) {
  const xs = ring.map(function (p) { return p.x; });
  const ys = ring.map(function (p) { return p.y; });
  const minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
  const minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
  const out = [];

  for (let iy = 0; iy < steps; iy += 1) {
    for (let ix = 0; ix < steps; ix += 1) {
      out.push(Polygon.contains(ring, GeometryCore.point(
        minX + (ix + 0.5) * (maxX - minX) / steps,
        minY + (iy + 0.5) * (maxY - minY) / steps
      )));
    }
  }
  return out;
}

function disagreements(ring, steps) {
  return probeGrid(ring, steps).filter(function (v) { return !v.agree; }).length;
}

test('containment: the pentagram centre is inside by one rule and outside by the other', function () {
  const ring = Lab.polygon('pentagram');
  const centre = Polygon.centroid(ring);
  const verdict = Polygon.contains(ring, centre);
  const probes = probeGrid(ring, 21);
  const disagreeing = probes.filter(function (v) { return !v.agree; }).length;

  assert.strictEqual(Polygon.area(ring).toFixed(2), '3600.00');
  assert.strictEqual(Polygon.isCounterClockwise(ring), true);
  assert.strictEqual(verdict.crossings, 2);
  assert.strictEqual(Math.abs(verdict.windingCount), 2);
  assert.strictEqual(probes.length, 441);
  assert.strictEqual(disagreeing, 44);
  assert.strictEqual((100 * disagreeing / probes.length).toFixed(1), '10.0');
  assert.strictEqual(Polygon.selfIntersections(ring).length, 5);
  prose.quotes('polygon-containment',
    ['3 600.00, wound counter-clockwise', '2 ray crossings and a winding number of 2',
      '44 of 441 probes disagree — 10.0%', '5 self-intersections']);
});

test('containment: only the doubly-wound ring disagrees, and the bowtie does not', function () {
  const rows = Lab.polygonNames().map(function (name) {
    const ring = Lab.polygon(name);
    return { name: name, vertices: ring.length, area: Polygon.area(ring),
      convex: Polygon.isConvex(ring), simple: Polygon.isSimple(ring),
      disagreeing: disagreements(ring, 21) };
  });
  const simple = rows.filter(function (row) { return row.simple; });
  const crossing = rows.filter(function (row) { return !row.simple; });

  assert.strictEqual(rows.length, 8);
  assert.strictEqual(simple.length, 6);
  assert.strictEqual(crossing.length, 2);
  simple.forEach(function (row) {
    assert.strictEqual(row.disagreeing, 0, row.name + ' is simple and must not disagree');
  });

  const bowtie = rows.find(function (row) { return row.name === 'bowtie'; });
  const pentagram = rows.find(function (row) { return row.name === 'pentagram'; });
  const star = rows.find(function (row) { return row.name === 'star'; });

  assert.strictEqual(bowtie.disagreeing, 0);
  assert.strictEqual(bowtie.area.toFixed(1), '0.0');
  assert.strictEqual(pentagram.disagreeing, 44);
  assert.strictEqual(pentagram.convex, false);
  assert.strictEqual(star.vertices, 8);
  assert.strictEqual(star.area.toFixed(1), '1980.0');
  assert.strictEqual(star.simple, true);
  assert.strictEqual(star.disagreeing, 0);
  prose.quotes('polygon-containment',
    ['6 simple polygons, 0 disagreeing probes between them',
      'a signed area of 0.0 from its two cancelling lobes',
      '8 vertices, an area of 1 980.0, simple, and 0 disagreeing probes']);
});

test('containment: the pentagram turns consistently and is still not convex', function () {
  const ring = Lab.polygon('pentagram');
  const signs = new Set();

  for (let i = 0; i < ring.length; i += 1) {
    signs.add(GeometryCore.orient2d(ring[i], ring[(i + 1) % ring.length],
      ring[(i + 2) % ring.length]));
  }
  assert.strictEqual(ring.length, 5);
  assert.strictEqual(signs.size, 1, 'every turn goes the same way');
  assert.strictEqual(Polygon.isConvex(ring), false);
  prose.quotes('polygon-containment',
    ["all 5 of the pentagram's turns go the same way, and it is not convex"]);
});

/* ---------------------------------------------------------------- 16.3 */

test('hulls: one hull, four bills', function () {
  const points = Lab.points('uniform', 200, 21);
  const comparison = Lab.compareHulls(points, 'drop');
  const by = {};

  comparison.rows.forEach(function (row) { by[row.name] = row; });

  assert.strictEqual(points.length, 200);
  assert.strictEqual(comparison.rows.length, 4);
  assert.strictEqual(comparison.agree, true);
  comparison.rows.forEach(function (row) {
    assert.strictEqual(row.vertices, 12, row.name + ' returned a different hull size');
    assert.strictEqual(row.ok, true, row.name + ' failed the oracle');
  });
  assert.strictEqual(by['monotone-chain'].orient, 789);
  assert.strictEqual(by['monotone-chain'].comparisons, 1262);
  assert.strictEqual(by.quickhull.orient, 1314);
  assert.strictEqual(by.quickhull.comparisons, 0);
  assert.strictEqual(by['graham-scan'].orient, 1651);
  assert.strictEqual(by['graham-scan'].comparisons, 1253);
  assert.strictEqual(by['gift-wrapping'].orient, 2400);
  assert.strictEqual(by['gift-wrapping'].comparisons, 0);
  assert.strictEqual((2400 / 789).toFixed(2), '3.04');
  assert.strictEqual((100 * 12 / 200).toFixed(1), '6.0');
  prose.quotes('convex-hulls',
    ['4 of 4 returned the identical 12-vertex hull from 200 points',
      '789 for monotone chain, 1 314 quickhull, 1 651 Graham, 2 400 gift wrapping',
      '1 262 and 1 253 comparisons for the two sorting algorithms, 0 for the other two',
      '12 of 200 points are on the hull — 6.0%', '3.04×']);
});

test('hulls: output sensitivity is a bet on h, measured at 1 024 points', function () {
  const cloud = Lab.points('uniform', 1024, 21);
  const ring = Lab.points('circle', 1024, 21);

  function cost(points, name) {
    const stats = ConvexHull.report();
    ConvexHull.run(name, points, { collinear: 'drop', report: stats });
    return stats.orient;
  }
  const cloudHull = ConvexHull.monotoneChain(cloud, { collinear: 'drop' }).hull.length;
  const ringHull = ConvexHull.monotoneChain(ring, { collinear: 'drop' }).hull.length;

  assert.strictEqual(cloudHull, 16);
  assert.strictEqual(ringHull, 1024);
  assert.strictEqual(cost(cloud, 'gift-wrapping'), 16384);
  assert.strictEqual(cost(ring, 'gift-wrapping'), 1047552);
  assert.strictEqual(cost(cloud, 'monotone-chain'), 4077);
  assert.strictEqual(cost(ring, 'monotone-chain'), 4090);
  assert.strictEqual((1047552 / 16384).toFixed(1), '63.9');
  prose.quotes('convex-hulls',
    ['16 hull vertices, so gift wrapping does 16 384 orientation tests',
      '1 024 hull vertices and 1 047 552 orientation tests — 63.9× the cloud',
      '4 077 tests on the cloud against 4 090 on the circle']);
});

test('hulls: the degenerate sets, under both collinear policies', function () {
  const rows = ['collinear', 'coincident', 'grid', 'circle', 'near-collinear']
    .map(function (scene) {
      const points = Lab.points(scene, 60, 21);
      const drop = Lab.compareHulls(points, 'drop');
      const keep = Lab.compareHulls(points, 'keep');
      return { scene: scene, drop: drop.rows[0].vertices, keep: keep.rows[0].vertices,
        agree: drop.agree && keep.agree };
    });
  const by = {};

  rows.forEach(function (row) { by[row.scene] = row; });
  rows.forEach(function (row) {
    assert.strictEqual(row.agree, true, row.scene + ': the four algorithms disagreed');
  });
  assert.deepStrictEqual([by.collinear.drop, by.collinear.keep], [2, 60]);
  assert.deepStrictEqual([by.grid.drop, by.grid.keep], [5, 24]);
  assert.deepStrictEqual([by.coincident.drop, by.coincident.keep], [6, 8]);
  assert.deepStrictEqual([by.circle.drop, by.circle.keep], [60, 60]);
  prose.quotes('convex-hulls',
    ['collinear 2 against 60; grid 5 against 24; coincident 6 against 8; circle 60 against 60',
      '5 of 5 sets agree across all 4 algorithms under both policies',
      'On 60 collinear points the two policies give 2 vertices and 60; on a 60-point grid ' +
        'they give 5 and 24.']);
});
