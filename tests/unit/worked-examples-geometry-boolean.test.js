'use strict';

/**
 * Every figure the M16.7-M16.8 worked examples quote, recomputed from the
 * modules and then checked against the prose.
 */

const test = require('node:test');
const assert = require('node:assert');

const GeometryCore = require('../../src/js/algorithms/geometry-core.js');
const Polygon = require('../../src/js/algorithms/polygon.js');
const Clipping = require('../../src/js/algorithms/clipping.js');
const Calipers = require('../../src/js/algorithms/calipers.js');
const Random = require('../../src/js/utils/random.js');
const Lab = require('../../src/js/machines/geometry-lab.js');

require('../../src/js/content/concepts-geometry-boolean.js');
require('../../src/js/content/examples-geometry-boolean.js');
const prose = require('../support/worked-example-prose.js');

/* ---------------------------------------------------------------- 16.7 */

const SUBJECT = [[20, 20], [80, 20], [80, 80], [20, 80]];
const CLIPS = {
  notch: [[0, 0], [100, 0], [100, 100], [60, 100], [60, 40], [40, 40], [40, 100], [0, 100]],
  shallow: [[0, 0], [100, 0], [100, 100], [60, 100], [60, 80], [40, 80], [40, 100], [0, 100]],
  'l-shape': [[0, 0], [100, 0], [100, 50], [50, 50], [50, 100], [0, 100]],
  chevron: [[0, 0], [100, 0], [50, 50], [100, 100], [0, 100]],
  star: [[50, 100], [62, 62], [100, 50], [62, 38], [50, 0], [38, 38], [0, 50], [38, 62]],
  band: [[0, 30], [100, 30], [100, 70], [0, 70]],
  square: [[10, 10], [90, 10], [90, 90], [10, 90]]
};

function ring(pairs) {
  return pairs.map(function (p) { return GeometryCore.point(p[0], p[1]); });
}

function clipped(name, grid) {
  const subject = ring(SUBJECT);
  const clip = ring(CLIPS[name]);
  const sh = Clipping.sutherlandHodgman(subject, clip);
  const decomposed = Clipping.clipConvexDecomposed(subject, clip);
  const sampled = Clipping.booleanArea(subject, clip, Clipping.INTERSECTION, grid);

  return { clip: clip, vertices: sh.length,
    shArea: sh.length >= 3 ? Polygon.area(sh) : 0,
    pieces: decomposed.length,
    decomposedArea: decomposed.reduce(function (sum, r) { return sum + Polygon.area(r); }, 0),
    sampled: sampled.area, convex: Polygon.isConvex(clip) };
}

test('clipping: the notch returns nothing, and the decomposition returns the answer', function () {
  const state = clipped('notch', 400);

  assert.strictEqual(state.convex, false);
  assert.strictEqual(state.vertices, 0);
  assert.strictEqual(state.shArea.toFixed(1), '0.0');
  assert.strictEqual(state.pieces, 6);
  assert.strictEqual(state.decomposedArea.toFixed(1), '2800.0');
  assert.strictEqual(state.sampled.toFixed(1), '2800.0');
  prose.quotes('polygon-clipping',
    ['Sutherland-Hodgman returns 0 vertices and an area of 0.0; the answer is 2 800.0',
      '6 pieces for the notch, totalling 2 800.0 — the sampled value exactly']);
});

test('clipping: five concave clips fail in two different ways', function () {
  const rows = Object.keys(CLIPS).map(function (name) {
    const state = clipped(name, 400);
    return { name: name, convex: state.convex, sh: state.shArea, vertices: state.vertices,
      decomposed: state.decomposedArea, sampled: state.sampled,
      error: state.sampled > 0 ? Math.abs(state.shArea - state.sampled) / state.sampled : 0 };
  });
  const by = {};

  rows.forEach(function (row) { by[row.name] = row; });
  const concave = rows.filter(function (row) { return !row.convex; });
  const empty = concave.filter(function (row) { return row.vertices === 0; });

  assert.strictEqual(rows.length, 7);
  assert.strictEqual(concave.length, 5);
  assert.strictEqual(empty.length, 2);
  assert.strictEqual(concave.length - empty.length, 3);
  assert.strictEqual((100 * by['l-shape'].error).toFixed(1), '66.7');
  assert.strictEqual((100 * by.chevron.error).toFixed(1), '66.8');
  assert.strictEqual((100 * by.star.error).toFixed(1), '60.0');
  assert.strictEqual((100 * by.square.error).toFixed(1), '0.0');
  assert.strictEqual((100 * by.band.error).toFixed(1), '0.3');
  assert.strictEqual(by['l-shape'].vertices, 4);
  assert.strictEqual(by['l-shape'].sh.toFixed(1), '900.0');
  assert.strictEqual(by['l-shape'].decomposed.toFixed(1), '2700.0');
  assert.strictEqual(by.chevron.vertices, 5);
  assert.strictEqual(by.chevron.sh.toFixed(1), '900.0');
  rows.forEach(function (row) {
    assert.ok(Math.abs(row.decomposed - row.sampled) / row.sampled < 0.005,
      row.name + ': the decomposition must match the sampler to within its own resolution');
  });
  prose.quotes('polygon-clipping',
    ['a 4-vertex polygon of area 900.0 against 2 700.0, and a 5-vertex one of 900.0 against 2 700.0',
      '66.7% and 66.8% missing', 'the square at 0.0% error and the band at 0.3%',
      '2 return an empty polygon, 3 return a wrong area']);
});

test('clipping: the sampler answers four operations and one free identity', function () {
  const subject = ring(SUBJECT);
  const clip = ring(CLIPS.notch);
  const rows = [Clipping.INTERSECTION, Clipping.UNION, Clipping.DIFFERENCE, Clipping.XOR]
    .map(function (operation) {
      const measured = Clipping.booleanArea(subject, clip, operation, 400);
      return { operation: operation, area: measured.area, hits: measured.hits,
        cells: measured.cells, resolution: measured.cellArea };
    });
  const by = {};

  rows.forEach(function (row) { by[row.operation] = row; });
  assert.strictEqual(by[Clipping.INTERSECTION].area.toFixed(1), '2800.0');
  assert.strictEqual(by[Clipping.UNION].area.toFixed(1), '9600.0');
  assert.strictEqual(by[Clipping.DIFFERENCE].area.toFixed(1), '800.0');
  assert.strictEqual(by[Clipping.XOR].area.toFixed(1), '6800.0');
  assert.strictEqual(by[Clipping.INTERSECTION].hits, 44800);
  assert.strictEqual(by[Clipping.UNION].hits, 153600);
  assert.strictEqual(by[Clipping.INTERSECTION].cells, 160000);
  assert.strictEqual(by[Clipping.INTERSECTION].resolution.toFixed(4), '0.0625');

  const union = by[Clipping.UNION].area;
  const intersection = by[Clipping.INTERSECTION].area;

  assert.strictEqual((union + intersection).toFixed(1), '12400.0');
  assert.strictEqual((union - intersection).toFixed(1), by[Clipping.XOR].area.toFixed(1));
  prose.quotes('polygon-clipping',
    ['intersection 2 800.0 from 44 800 cells, union 9 600.0 from 153 600, difference 800.0, xor 6 800.0',
      '9 600.0 + 2 800.0 = 12 400.0', 'each of the 160 000 cells is 0.0625 in area']);
});

test('clipping: the offset disc, and the corner count nobody sets', function () {
  const radius = 8;
  const square = ring([[30, 30], [70, 30], [70, 70], [30, 70]]);
  const trueArea = Polygon.area(square) + Polygon.perimeter(square) * radius +
    Math.PI * radius * radius;
  const rows = [3, 6, 8, 12, 16, 32, 64].map(function (corners) {
    const offset = Clipping.offsetConvex(square, radius, corners);
    const area = Polygon.area(offset);
    return { corners: corners, area: area, shortfall: (trueArea - area) / trueArea,
      vertices: offset.length };
  });

  assert.strictEqual(trueArea.toFixed(1), '3081.1');
  assert.deepStrictEqual(rows.map(function (row) { return row.area.toFixed(1); }),
    ['2717.4', '2960.5', '3061.0', '3072.0', '3075.9', '3079.8', '3080.7']);
  assert.deepStrictEqual(rows.map(function (row) { return (100 * row.shortfall).toFixed(2); }),
    ['11.80', '3.91', '0.65', '0.29', '0.17', '0.04', '0.01']);
  assert.deepStrictEqual(rows.map(function (row) { return row.vertices; }),
    [7, 10, 12, 16, 20, 36, 68]);
  rows.forEach(function (row) {
    assert.ok(row.area < trueArea, 'the approximating disc is inscribed, so it is always short');
  });
  prose.quotes('polygon-clipping',
    ['2 717.4 against a true 3 081.1 — 11.80% short', '3 075.9, 0.17% short',
      '11.80%, 3.91%, 0.65%, 0.29%, 0.17%, 0.04%, 0.01% at 3, 6, 8, 12, 16, 32 and 64 corners']);
});

/* ---------------------------------------------------------------- 16.8 */

/** The section's diagonal strip, reproduced exactly. */
function diagonalStrip(count, seed) {
  const rng = Random.seeded(seed);
  const out = [];

  for (let i = 0; i < count; i += 1) {
    const t = i / Math.max(1, count - 1);
    out.push(GeometryCore.point(t * 100 + (rng.next() - 0.5) * 6,
      t * 100 + (rng.next() - 0.5) * 6));
  }
  return out;
}

function pointsFor(scene, count) {
  if (scene === 'diagonal') return diagonalStrip(count, 61);
  return Lab.points(scene, count, 61);
}

function measured(scene, count, steps) {
  const points = pointsFor(scene, count);
  const stats = Calipers.report();
  const hull = Calipers.hullOf(points, stats);

  return { points: points, hull: hull,
    diameter: Calipers.diameter(points, { hull: hull, report: stats }),
    brute: Calipers.diameterBruteForce(points, stats),
    rectangle: Calipers.minimumAreaRectangle(points, { hull: hull, report: stats }),
    sweep: Calipers.rectangleByRotationSweep(points, steps),
    box: Calipers.boundingBox(points),
    circle: Calipers.smallestEnclosingCircle(points, { report: stats }),
    stats: stats };
}

test('calipers: nine angles, and the rectangle that beats the box tenfold', function () {
  const state = measured('diagonal', 80, 3600);
  const candidates = state.hull.map(function (p, i) {
    const edge = GeometryCore.sub(state.hull[(i + 1) % state.hull.length], p);
    return Calipers.extentAlong(state.hull, Math.atan2(edge.y, edge.x));
  }).sort(function (a, b) { return a.area - b.area; });

  assert.strictEqual(state.hull.length, 9);
  assert.strictEqual(candidates.length, 9);
  assert.strictEqual(state.rectangle.area.toFixed(1), '932.6');
  assert.strictEqual(candidates[0].area.toFixed(1), '932.6');
  assert.strictEqual(candidates[1].area.toFixed(1), '933.8');
  assert.strictEqual((candidates[0].angle * 180 / Math.PI).toFixed(2), '-135.09');
  assert.strictEqual((candidates[1].angle * 180 / Math.PI).toFixed(2), '44.84');
  assert.strictEqual(candidates[0].width.toFixed(2), '141.47');
  assert.strictEqual(candidates[0].height.toFixed(2), '6.59');
  assert.strictEqual(state.box.area.toFixed(1), '10058.0');
  assert.strictEqual((state.box.area / state.rectangle.area).toFixed(2), '10.79');
  prose.quotes('rotating-calipers',
    ['9 hull vertices, so 9 candidate angles',
      'the winner at −135.09° measures 141.47 by 6.59 for an area of 932.6',
      'the runner-up at 44.84° is 933.8',
      '932.6 against 10 058.0 — a ratio of 0.093, or 10.79× less area']);
});

test('calipers: the scan is better than the sweep, and that is the sweep\'s step', function () {
  const state = measured('diagonal', 80, 3600);

  assert.strictEqual(state.rectangle.area.toFixed(3), '932.559');
  assert.strictEqual(state.sweep.area.toFixed(3), '932.779');
  assert.ok(state.rectangle.area <= state.sweep.area, 'the complete scan may never lose');
  assert.strictEqual((100 * (state.sweep.area - state.rectangle.area) /
    state.sweep.area).toFixed(3), '0.024');
  assert.strictEqual((state.sweep.step * 180 / Math.PI).toFixed(4), '0.0250');
  prose.quotes('rotating-calipers',
    ['the sweep\'s best is 932.779 against the scan\'s 932.559 — 0.024% apart',
      'the sweep\'s step is 0.0250°, larger than the gap between the two answers']);
});

test('calipers: the diameter is exact, and the circle covers everything', function () {
  const state = measured('diagonal', 80, 3600);

  assert.strictEqual(state.diameter.distance.toFixed(3), '141.487');
  assert.strictEqual(state.brute.distance.toFixed(3), '141.487');
  assert.strictEqual(state.diameter.distance, state.brute.distance);
  assert.strictEqual(state.circle.circle.radius.toFixed(2), '70.74');
  assert.strictEqual(state.circle.support.length, 2);
  assert.strictEqual(state.stats.steps, 2594);
  assert.strictEqual(Calipers.circleCovers(state.points, state.circle.circle).ok, true);
  prose.quotes('rotating-calipers',
    ['141.487 against 141.487 — exact agreement',
      'radius 70.74, 2 points on the boundary, 2 594 rebuild steps, and every point covered']);
});

test('calipers: six point sets, and where the rotation buys nothing', function () {
  const rows = ['diagonal', 'uniform', 'circle', 'clustered', 'convex-heavy', 'grid']
    .map(function (scene) {
      const state = measured(scene, 80, 3600);
      return { scene: scene, hull: state.hull.length, rectangle: state.rectangle.area,
        box: state.box.area, ratio: state.rectangle.area / state.box.area,
        angle: state.rectangle.best.angle * 180 / Math.PI };
    });
  const by = {};

  rows.forEach(function (row) { by[row.scene] = row; });
  assert.deepStrictEqual(rows.map(function (row) { return row.ratio.toFixed(3); }),
    ['0.093', '1.000', '0.998', '0.999', '0.973', '1.000']);
  assert.strictEqual(by.grid.hull, 5);
  assert.strictEqual(by.circle.hull, 80);
  assert.strictEqual(by.grid.angle.toFixed(1), '0.0');
  assert.strictEqual(by.diagonal.angle.toFixed(1), '-135.1');
  rows.forEach(function (row) {
    assert.ok(row.rectangle <= row.box + 1e-9, row.scene + ': the minimum can never exceed the box');
  });
  prose.quotes('rotating-calipers',
    ['diagonal 0.093, convex-heavy 0.973, circle 0.998, clustered 0.999, uniform 1.000, grid 1.000',
      'the grid\'s best angle is 0.0° and the diagonal set\'s is −135.1°',
      'from 5 on the grid to 80 on the circle']);
});
