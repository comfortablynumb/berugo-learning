'use strict';

/**
 * Every figure the M16.4-M16.6 worked examples quote, recomputed from the
 * modules and then checked against the prose.
 */

const test = require('node:test');
const assert = require('node:assert');

const SweepLine = require('../../src/js/algorithms/sweep-line.js');
const Triangulation = require('../../src/js/algorithms/triangulation.js');
const Polygon = require('../../src/js/algorithms/polygon.js');
const Voronoi = require('../../src/js/algorithms/voronoi.js');
const Random = require('../../src/js/utils/random.js');
const Lab = require('../../src/js/machines/geometry-lab.js');

require('../../src/js/content/concepts-geometry-sweep.js');
require('../../src/js/content/examples-geometry-sweep.js');
const prose = require('../support/worked-example-prose.js');

/* ---------------------------------------------------------------- 16.4 */

test('sweep: 24 events against 66 pairs, and the same 12 crossings', function () {
  const segments = Lab.segments('random', 12, 33);
  const compared = SweepLine.compare(segments);

  assert.strictEqual(segments.length, 12);
  assert.strictEqual(compared.swept.length, 12);
  assert.strictEqual(compared.brute.length, 12);
  assert.strictEqual(compared.disagreements, 0);
  assert.strictEqual(compared.sweep.events, 24);
  assert.strictEqual(compared.bruteForce.pairsTested, 66);
  prose.quotes('sweep-line-algorithms',
    ['24 events against 66 pairs', '12 intersections found, 12 by brute force, 0 disagreements']);
});

test('sweep: the seven fixtures, four of them degenerate, all agree', function () {
  const rows = Lab.segmentScenes().map(function (scene) {
    const segments = Lab.segments(scene, 12, 33);
    const compared = SweepLine.compare(segments);
    return { scene: scene, segments: segments.length,
      brute: compared.brute.length, sweep: compared.swept.length,
      disagreements: compared.disagreements };
  });
  const by = {};

  rows.forEach(function (row) { by[row.scene] = row; });
  assert.strictEqual(rows.length, 7);
  rows.forEach(function (row) {
    assert.strictEqual(row.disagreements, 0, row.scene + ' disagreed with brute force');
    assert.strictEqual(row.sweep, row.brute, row.scene + ' found a different count');
  });
  assert.deepStrictEqual([by['shared-endpoints'].segments, by['shared-endpoints'].sweep], [3, 1]);
  assert.deepStrictEqual([by.vertical.segments, by.vertical.sweep], [4, 5]);
  assert.deepStrictEqual([by['three-through-one'].segments, by['three-through-one'].sweep], [3, 1]);
  assert.deepStrictEqual([by['collinear-overlap'].segments, by['collinear-overlap'].sweep], [3, 2]);
  assert.deepStrictEqual([by.grid.segments, by.grid.sweep], [6, 9]);
  assert.deepStrictEqual([by.sparse.segments, by.sparse.sweep], [12, 0]);
  prose.quotes('sweep-line-algorithms',
    ['3 segments, 1 intersection by both methods', '4 segments, 5 intersections by both methods',
      '3 segments, 2 intersections by both methods',
      '6 segments produce 9 crossings, and the sweep still agrees exactly',
      '12 segments, 0 crossings, and every event still maintains the two structures',
      '0 disagreements over 7 fixtures']);
});

test('sweep: rectangle union, 9 slabs and 63 subset terms, both 876.00', function () {
  const rng = Random.seeded(77);
  const rects = [];

  for (let i = 0; i < 6; i += 1) {
    const x0 = Math.round(rng.next() * 40);
    const y0 = Math.round(rng.next() * 40);
    rects.push({ x0: x0, y0: y0, x1: x0 + 4 + Math.round(rng.next() * 16),
      y1: y0 + 4 + Math.round(rng.next() * 16) });
  }
  const sweep = SweepLine.rectangleUnionArea(rects);
  const exact = SweepLine.rectangleUnionExact(rects);

  assert.strictEqual(sweep.area.toFixed(2), '876.00');
  assert.strictEqual(exact.toFixed(2), '876.00');
  assert.strictEqual(sweep.slabs, 9);
  assert.strictEqual(Math.pow(2, rects.length) - 1, 63);
  prose.quotes('sweep-line-algorithms',
    ['6 rectangles give 9 slabs', 'sweep area 876.00', '63 terms summed, giving 876.00']);
});

/* ---------------------------------------------------------------- 16.5 */

function mesh() {
  const points = Lab.points('uniform', 60, 41);
  const stats = Triangulation.report();
  const built = Triangulation.delaunay(points, { report: stats });
  return { built: built, stats: stats,
    check: Triangulation.checkDelaunay(built.points, built.triangles),
    angles: Triangulation.angleProfile(built.points, built.triangles) };
}

test('triangulation: the Delaunay mesh, checked exhaustively', function () {
  const state = mesh();

  assert.strictEqual(state.built.triangles.length, 108);
  assert.strictEqual(state.built.points.length, 60);
  assert.strictEqual(state.check.violations.length, 0);
  assert.strictEqual(state.check.ok, true);
  assert.strictEqual(state.stats.orient + state.stats.inCircle, 7531);
  assert.strictEqual(state.stats.orientExact + state.stats.inCircleExact, 0);
  assert.strictEqual(state.angles.minimum.toFixed(2), '0.52');
  assert.strictEqual(state.angles.mean.toFixed(2), '26.79');
  prose.quotes('polygon-triangulation',
    ['108 triangles against 60 vertices: 0 violations, from 7 531 predicate calls',
      '0 of those calls needed exact arithmetic', '0.52°', '26.79°']);
});

test('triangulation: 60 legal flips, and what they cost', function () {
  const state = mesh();
  const flipped = Triangulation.degrade(state.built.points, state.built.triangles, 60, 7);
  const flippedCheck = Triangulation.checkDelaunay(flipped.points, flipped.triangles);
  const flippedAngles = Triangulation.angleProfile(flipped.points, flipped.triangles);

  function under(points, triangles, limit) {
    return triangles.filter(function (t) {
      return Triangulation.minimumAngle(points[t[0]], points[t[1]], points[t[2]]) < limit;
    }).length;
  }

  assert.strictEqual(flipped.triangles.length, 108);
  assert.strictEqual(flippedCheck.violations.length, 562);
  assert.strictEqual(flippedAngles.mean.toFixed(2), '18.94');
  assert.strictEqual(state.angles.skinny, 34);
  assert.strictEqual(flippedAngles.skinny, 57);
  assert.strictEqual(under(state.built.points, state.built.triangles, 10), 18);
  assert.strictEqual(under(flipped.points, flipped.triangles, 10), 37);
  prose.quotes('polygon-triangulation',
    ['still 108 triangles, the same 60 points, the same covered region',
      '562 violations, up from 0',
      'mean smallest angle 26.79° against 18.94°; 34 skinny triangles against 57',
      '18 triangles for Delaunay against 37 for the flipped mesh']);
});

test('triangulation: ear clipping, where the count is fixed and the work is not', function () {
  const rows = ['square', 'l-shape', 'chevron', 'star', 'comb', 'spiky'].map(function (name) {
    const ring = Lab.polygon(name);
    const stats = Triangulation.report();
    const clipped = Triangulation.earClip(ring, { report: stats });
    const area = clipped.triangles.reduce(function (sum, t) {
      return sum + Polygon.area([clipped.ring[t[0]], clipped.ring[t[1]], clipped.ring[t[2]]]);
    }, 0);
    return { name: name, vertices: ring.length, triangles: clipped.triangles.length,
      tests: stats.earTests, ratio: area / Polygon.area(ring) };
  }).filter(function (row) { return row.triangles > 0; });
  const by = {};

  rows.forEach(function (row) { by[row.name] = row; });
  rows.forEach(function (row) {
    assert.strictEqual(row.triangles, row.vertices - 2,
      row.name + ': the triangle count is a theorem');
    assert.strictEqual((100 * row.ratio).toFixed(2), '100.00',
      row.name + ': the triangles must sum to the ring\'s area');
  });
  assert.strictEqual(rows.length, 6);
  assert.deepStrictEqual([by.square.triangles, by.square.tests], [2, 1]);
  assert.deepStrictEqual([by.comb.vertices, by.comb.triangles, by.comb.tests], [12, 10, 21]);
  assert.deepStrictEqual([by['l-shape'].triangles, by['l-shape'].tests], [4, 5]);
  assert.deepStrictEqual([by.star.triangles, by.star.tests], [6, 7]);
  assert.deepStrictEqual([by.spiky.triangles, by.spiky.tests], [6, 5]);
  prose.quotes('polygon-triangulation',
    ['the square gives 2 from 4 vertices, the comb 10 from 12',
      '1 ear test for the square against 21 for the comb',
      '100.00% of the area preserved on all 6 fixtures',
      'the L-shape 4 triangles from 5 tests, the star 6 from 7, the spiky 6 from 5']);
});

/* ---------------------------------------------------------------- 16.6 */

test('voronoi: two constructions, one diagram, and a brute-force grid', function () {
  const sites = Lab.points('uniform', 24, 53);
  const bounds = Voronoi.defaultBounds(sites, 8);
  const halfPlane = Voronoi.diagram(sites, { bounds: bounds });
  const dual = Voronoi.dualCells(sites, { bounds: bounds });
  const halfCheck = Voronoi.verify(halfPlane, 30);
  const dualCheck = Voronoi.verify(dual, 30);
  const comparison = Voronoi.compareConstructions(sites, { bounds: bounds });

  assert.strictEqual(halfPlane.cells.length, 24);
  assert.strictEqual(dual.cells.length, 24);
  assert.strictEqual(halfCheck.misassigned, 0);
  assert.strictEqual(dualCheck.misassigned, 0);
  assert.strictEqual(halfCheck.gridPoints, 900);
  assert.strictEqual(halfCheck.siteOutside, 0);
  assert.strictEqual(dualCheck.siteOutside, 0);
  assert.strictEqual(halfPlane.report.unbounded, 19);
  [halfPlane, dual].forEach(function (built) {
    const total = built.cells.reduce(function (sum, cell) { return sum + cell.area; }, 0);
    assert.strictEqual(total.toFixed(2), '10660.52');
  });
  assert.strictEqual(comparison.worstGap.toExponential(2), '6.71e-12');
  assert.strictEqual(comparison.relative.toExponential(2), '3.33e-15');
  prose.quotes('voronoi-diagrams',
    ['24 cells, total area 10 660.52', 'worst cell gap 6.71e-12',
      'agreement to 3.33e-15 of relative area', '19 of 24',
      '0 of 900 grid points land in the wrong cell',
      '0 of 24 sites outside their own cell, by both constructions']);
});

test('voronoi: twelve Lloyd rounds, monotone and never zero', function () {
  const sites = Lab.points('uniform', 24, 53);
  const bounds = Voronoi.defaultBounds(sites, 8);
  const history = Voronoi.lloyd(sites, { bounds: bounds, rounds: 12 }).history;

  assert.strictEqual(history.length, 12);
  assert.strictEqual(history[0].movement.toFixed(3), '137.675');
  assert.strictEqual(history[0].spread.toFixed(4), '0.8447');
  assert.strictEqual(history[0].ratio.toFixed(1), '65.6');
  assert.strictEqual(history[11].movement.toFixed(3), '14.859');
  assert.strictEqual(history[11].spread.toFixed(4), '0.2956');
  assert.strictEqual(history[11].ratio.toFixed(1), '3.2');

  for (let i = 1; i < history.length; i += 1) {
    assert.ok(history[i].movement < history[i - 1].movement, 'movement falls at round ' + i);
    assert.ok(history[i].spread < history[i - 1].spread, 'spread falls at round ' + i);
    assert.ok(history[i].movement > 0, 'and never reaches zero');
  }
  assert.deepStrictEqual(history.slice(0, 5).map(function (row) {
    return row.ratio.toFixed(1);
  }), ['65.6', '20.4', '11.0', '8.4', '7.5']);
  prose.quotes('voronoi-diagrams',
    ['area spread 0.8447, largest cell 65.6× the smallest', 'total site movement 137.675',
      'movement 137.675 → 14.859, area spread 0.8447 → 0.2956',
      '65.6×, 20.4×, 11.0×, 8.4×, 7.5× … 3.2× at round 12']);
});
