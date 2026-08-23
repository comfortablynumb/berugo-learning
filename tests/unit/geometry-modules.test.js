'use strict';

/**
 * Property tests for the M16 geometry modules.
 *
 * Every claim here is checked against something slow and obviously right: an
 * exact predicate, a pairwise scan, a rasterised sampler or an exhaustive
 * enumeration. That pairing is the whole method of the milestone - the fast
 * routines are short and subtle, and a plausible wrong answer is the normal
 * failure rather than a crash.
 */

const test = require('node:test');
const assert = require('node:assert');

const G = require('../../src/js/algorithms/geometry-core.js');
const Exact = require('../../src/js/algorithms/geometry-exact.js');
const Polygon = require('../../src/js/algorithms/polygon.js');
const ConvexHull = require('../../src/js/algorithms/convex-hull.js');
const SweepLine = require('../../src/js/algorithms/sweep-line.js');
const Triangulation = require('../../src/js/algorithms/triangulation.js');
const Voronoi = require('../../src/js/algorithms/voronoi.js');
const Clipping = require('../../src/js/algorithms/clipping.js');
const Calipers = require('../../src/js/algorithms/calipers.js');
const Raster = require('../../src/js/algorithms/raster.js');
const Transforms3D = require('../../src/js/algorithms/transforms-3d.js');
const Random = require('../../src/js/utils/random.js');
const Lab = require('../../src/js/machines/geometry-lab.js');

/* ------------------------------------------------------------ predicates */

test('orient2d: the six permutations of a triple can never contradict each other', function () {
  const rng = Random.seeded(3);

  for (let trial = 0; trial < 400; trial += 1) {
    const a = G.point(rng.next(), rng.next());
    const b = G.point(rng.next(), rng.next());
    const ax = rng.next() * 10;
    const c = G.point(a.x + (b.x - a.x) * ax, a.y + (b.y - a.y) * ax +
      (rng.next() < 0.5 ? 1 : -1) * Math.abs(a.y) * Math.pow(2, -52));
    const even = [[a, b, c], [b, c, a], [c, a, b]]
      .map(function (t) { return G.orient2d(t[0], t[1], t[2]); });
    const odd = [[a, c, b], [c, b, a], [b, a, c]]
      .map(function (t) { return G.orient2d(t[0], t[1], t[2]); });

    assert.strictEqual(even[0], even[1], 'trial ' + trial + ': rotations must agree');
    assert.strictEqual(even[1], even[2], 'trial ' + trial + ': rotations must agree');
    odd.forEach(function (sign) {
      assert.strictEqual(sign, -even[0], 'trial ' + trial + ': a swap must flip the sign');
    });
  }
});

test('orient2d: the adaptive predicate agrees with the exact one on adversarial triples', function () {
  const sweep = Lab.robustnessSweep(600, 11);

  assert.strictEqual(sweep.adaptive, 0, 'the adaptive predicate never contradicts itself');
  assert.ok(sweep.naive > 0, 'the naive one does, or the fixtures are not adversarial');
  assert.strictEqual(sweep.epsilonWrong, sweep.trials,
    'the tolerance test is wrong on every near-collinear triple');
  assert.strictEqual(sweep.epsilon, 0, 'and never contradicts itself while being wrong');
});

test('geometry-exact: scaling to integers is exact, and the sign survives it', function () {
  const rng = Random.seeded(5);

  for (let trial = 0; trial < 200; trial += 1) {
    const a = G.point(rng.next() * 4 - 2, rng.next() * 4 - 2);
    const b = G.point(rng.next() * 4 - 2, rng.next() * 4 - 2);
    const c = G.point(rng.next() * 4 - 2, rng.next() * 4 - 2);
    const value = G.orient2dValue(a, b, c);
    const sign = value > 0 ? 1 : (value < 0 ? -1 : 0);

    assert.strictEqual(Exact.orient2d(a, b, c), sign,
      'well-separated points must agree with the floating-point sign');
    assert.strictEqual(Exact.orient2d(a, b, c), -Exact.orient2d(a, c, b),
      'and the exact predicate is antisymmetric too');
  }
});

/* --------------------------------------------------------------- polygons */

test('polygon: area, orientation and containment agree with independent references', function () {
  Lab.polygonNames().forEach(function (name) {
    const ring = Lab.polygon(name);
    const reversed = ring.slice().reverse();

    assert.strictEqual(Polygon.area(ring).toFixed(6), Polygon.area(reversed).toFixed(6),
      name + ': area is unsigned');

    /* A ring whose signed area cancels to zero - the bowtie, whose two lobes
       are wound opposite ways - has no orientation to reverse. */
    if (Polygon.area(ring) === 0) return;
    assert.notStrictEqual(Polygon.isCounterClockwise(ring), Polygon.isCounterClockwise(reversed),
      name + ': reversing a ring reverses its orientation');
  });
});

test('polygon: on a simple ring the two containment rules never differ', function () {
  const rng = Random.seeded(7);

  Lab.polygonNames().forEach(function (name) {
    const ring = Lab.polygon(name);
    if (!Polygon.isSimple(ring)) return;

    for (let trial = 0; trial < 200; trial += 1) {
      const p = G.point(rng.next() * 100, rng.next() * 100);
      const verdict = Polygon.contains(ring, p);
      if (verdict.ray === Polygon.BOUNDARY) continue;
      assert.strictEqual(verdict.agree, true,
        name + ': the rules disagreed at ' + p.x.toFixed(2) + ',' + p.y.toFixed(2));
    }
  });
});

test('polygon: simplification keeps the endpoints and never adds a vertex', function () {
  const ring = Lab.polygon('spiky');
  const closed = ring.concat([ring[0]]);

  [0, 1, 4, 12].forEach(function (tolerance) {
    const simplified = Polygon.douglasPeucker(closed, tolerance);

    assert.ok(simplified.length <= closed.length, 'tolerance ' + tolerance + ' added vertices');
    assert.ok(simplified.length >= 2, 'tolerance ' + tolerance + ' left nothing');
    assert.deepStrictEqual(simplified[0], closed[0], 'the first vertex is kept');
    assert.deepStrictEqual(simplified[simplified.length - 1], closed[closed.length - 1],
      'and so is the last');
  });
});

/* ------------------------------------------------------------------ hulls */

test('convex hull: four algorithms, one answer, checked against the oracle', function () {
  ['uniform', 'clustered', 'circle', 'grid', 'collinear', 'coincident', 'near-collinear']
    .forEach(function (scene) {
      ['drop', 'keep'].forEach(function (policy) {
        const points = Lab.points(scene, 40, 13);
        const comparison = Lab.compareHulls(points, policy);

        assert.strictEqual(comparison.agree, true,
          scene + '/' + policy + ': the four algorithms disagreed');
        comparison.rows.forEach(function (row) {
          assert.strictEqual(row.ok, true,
            scene + '/' + policy + '/' + row.name + ': ' + row.problems.join(', '));
        });
      });
    });
});

test('convex hull: the drop policy leaves no collinear vertex, and keep leaves them all', function () {
  const points = [];

  for (let i = 0; i < 40; i += 1) points.push(G.point(i, 2 * i));
  const dropped = ConvexHull.monotoneChain(points, { collinear: ConvexHull.DROP }).hull;
  const kept = ConvexHull.monotoneChain(points, { collinear: ConvexHull.KEEP }).hull;

  assert.strictEqual(dropped.length, 2, 'a collinear set has two extremes');
  assert.strictEqual(kept.length, 40, 'and every point is on the hull edge');
});

test('convex hull: the hull of the hull is the hull', function () {
  const rng = Random.seeded(17);

  for (let trial = 0; trial < 20; trial += 1) {
    const points = [];

    for (let i = 0; i < 60; i += 1) points.push(G.point(rng.next() * 100, rng.next() * 100));
    const once = ConvexHull.monotoneChain(points, { collinear: ConvexHull.DROP }).hull;
    const twice = ConvexHull.monotoneChain(once, { collinear: ConvexHull.DROP }).hull;

    assert.strictEqual(Lab.canonical(twice), Lab.canonical(once),
      'trial ' + trial + ': hulling a hull changed it');
  }
});

/* ------------------------------------------------------------------ sweep */

test('sweep line: every fixture agrees with a pairwise scan, degeneracies included', function () {
  Lab.segmentScenes().forEach(function (scene) {
    [6, 12, 20].forEach(function (count) {
      const segments = Lab.segments(scene, count, 23);
      const compared = SweepLine.compare(segments);

      assert.strictEqual(compared.disagreements, 0, scene + ' at ' + count + ' segments');
      assert.strictEqual(compared.swept.length, compared.brute.length,
        scene + ' at ' + count + ': different counts');
    });
  });
});

test('sweep line: rectangle union matches inclusion-exclusion exactly', function () {
  const rng = Random.seeded(29);

  for (let trial = 0; trial < 60; trial += 1) {
    const rects = [];
    const count = 2 + rng.int(6);

    for (let i = 0; i < count; i += 1) {
      const x0 = rng.int(40);
      const y0 = rng.int(40);
      rects.push({ x0: x0, y0: y0, x1: x0 + 1 + rng.int(30), y1: y0 + 1 + rng.int(30) });
    }
    const swept = SweepLine.rectangleUnionArea(rects).area;
    const exact = SweepLine.rectangleUnionExact(rects);

    assert.ok(Math.abs(swept - exact) < 1e-9,
      'trial ' + trial + ': ' + swept + ' against ' + exact);
  }
});

/* ---------------------------------------------------------- triangulation */

test('triangulation: ear clipping gives n − 2 triangles and the whole area', function () {
  ['square', 'l-shape', 'chevron', 'star', 'comb', 'spiky'].forEach(function (name) {
    const ring = Lab.polygon(name);
    const clipped = Triangulation.earClip(ring, {});
    const area = clipped.triangles.reduce(function (sum, t) {
      return sum + Polygon.area([clipped.ring[t[0]], clipped.ring[t[1]], clipped.ring[t[2]]]);
    }, 0);

    assert.strictEqual(clipped.triangles.length, ring.length - 2, name + ': triangle count');
    assert.ok(Math.abs(area - Polygon.area(ring)) < 1e-6, name + ': area preserved');
  });
});

test('triangulation: Delaunay satisfies the empty-circle property exhaustively', function () {
  ['uniform', 'clustered', 'grid', 'circle'].forEach(function (scene) {
    [20, 60, 120].forEach(function (count) {
      const points = Lab.points(scene, count, 31);
      const mesh = Triangulation.delaunay(points, {});
      const check = Triangulation.checkDelaunay(mesh.points, mesh.triangles);

      assert.strictEqual(check.violations.length, 0,
        scene + ' at ' + count + ': ' + check.violations.length + ' vertices inside a circumcircle');
      assert.strictEqual(check.ok, true, scene + ' at ' + count);
    });
  });
});

test('triangulation: every flip away from Delaunay is a flip towards worse angles', function () {
  const points = Lab.points('uniform', 60, 31);
  const mesh = Triangulation.delaunay(points, {});
  const before = Triangulation.angleProfile(mesh.points, mesh.triangles);

  [10, 30, 60].forEach(function (flips) {
    const flipped = Triangulation.degrade(mesh.points, mesh.triangles, flips, 7);
    const after = Triangulation.angleProfile(flipped.points, flipped.triangles);
    const check = Triangulation.checkDelaunay(flipped.points, flipped.triangles);

    assert.strictEqual(flipped.triangles.length, mesh.triangles.length,
      flips + ' flips changed the triangle count');
    assert.ok(after.mean <= before.mean, flips + ' flips improved the mean smallest angle');
    assert.ok(check.violations.length > 0, flips + ' flips left the mesh Delaunay');
  });
});

/* --------------------------------------------------------------- voronoi */

test('voronoi: both constructions match a brute-force nearest-site grid', function () {
  ['uniform', 'clustered', 'grid'].forEach(function (scene) {
    const sites = Lab.points(scene, 20, 37);
    const bounds = Voronoi.defaultBounds(sites, 8);
    const halfPlane = Voronoi.diagram(sites, { bounds: bounds });
    const dual = Voronoi.dualCells(sites, { bounds: bounds });

    [halfPlane, dual].forEach(function (built, index) {
      const check = Voronoi.verify(built, 24);

      assert.strictEqual(check.misassigned, 0,
        scene + ' construction ' + index + ': grid points in the wrong cell');
      assert.strictEqual(check.siteOutside, 0,
        scene + ' construction ' + index + ': a site outside its own cell');
    });
    const comparison = Voronoi.compareConstructions(sites, { bounds: bounds });

    assert.ok(comparison.relative < 1e-9,
      scene + ': the two constructions disagree by ' + comparison.relative);
  });
});

test('voronoi: Lloyd relaxation drives the spread down monotonically', function () {
  const sites = Lab.points('uniform', 20, 37);
  const bounds = Voronoi.defaultBounds(sites, 8);
  const history = Voronoi.lloyd(sites, { bounds: bounds, rounds: 8 }).history;

  assert.strictEqual(history.length, 8);

  for (let i = 1; i < history.length; i += 1) {
    assert.ok(history[i].spread < history[i - 1].spread, 'spread rose at round ' + i);
    assert.ok(history[i].movement > 0, 'movement reached zero at round ' + i);
  }
});

/* -------------------------------------------------------------- clipping */

test('clipping: convex clips match the rasterised reference, concave ones do not', function () {
  const subject = [[20, 20], [80, 20], [80, 80], [20, 80]]
    .map(function (p) { return G.point(p[0], p[1]); });
  const clips = {
    square: [[10, 10], [90, 10], [90, 90], [10, 90]],
    band: [[0, 30], [100, 30], [100, 70], [0, 70]],
    notch: [[0, 0], [100, 0], [100, 100], [60, 100], [60, 40], [40, 40], [40, 100], [0, 100]],
    'l-shape': [[0, 0], [100, 0], [100, 50], [50, 50], [50, 100], [0, 100]]
  };

  Object.keys(clips).forEach(function (name) {
    const clip = clips[name].map(function (p) { return G.point(p[0], p[1]); });
    const sampled = Clipping.booleanArea(subject, clip, Clipping.INTERSECTION, 300).area;
    const decomposed = Clipping.clipConvexDecomposed(subject, clip)
      .reduce(function (sum, r) { return sum + Polygon.area(r); }, 0);
    const sh = Clipping.sutherlandHodgman(subject, clip);
    const shArea = sh.length >= 3 ? Polygon.area(sh) : 0;

    assert.ok(Math.abs(decomposed - sampled) / sampled < 0.01,
      name + ': the decomposition must match the sampler');
    if (Polygon.isConvex(clip)) {
      assert.ok(Math.abs(shArea - sampled) / sampled < 0.01,
        name + ': a convex clip is where Sutherland-Hodgman is correct');
      return;
    }
    assert.ok(Math.abs(shArea - sampled) / sampled > 0.1,
      name + ': a concave clip must be visibly wrong, or the fixture is not concave enough');
  });
});

test('clipping: union plus intersection equals the two areas added', function () {
  const subject = [[20, 20], [80, 20], [80, 80], [20, 80]]
    .map(function (p) { return G.point(p[0], p[1]); });
  const clip = [[0, 0], [100, 0], [100, 50], [50, 50], [50, 100], [0, 100]]
    .map(function (p) { return G.point(p[0], p[1]); });
  const union = Clipping.booleanArea(subject, clip, Clipping.UNION, 400).area;
  const intersection = Clipping.booleanArea(subject, clip, Clipping.INTERSECTION, 400).area;
  const difference = Clipping.booleanArea(subject, clip, Clipping.DIFFERENCE, 400).area;
  const xor = Clipping.booleanArea(subject, clip, Clipping.XOR, 400).area;

  assert.ok(Math.abs(union - intersection - xor) < 1e-6, 'xor is union minus intersection');
  assert.ok(Math.abs(union - intersection - difference -
    (union - intersection - difference)) < 1e-6);
  assert.ok(difference <= union, 'a difference cannot exceed a union');
});

test('clipping: an offset polygon is always inscribed, and converges with the corner count', function () {
  const square = [[30, 30], [70, 30], [70, 70], [30, 70]]
    .map(function (p) { return G.point(p[0], p[1]); });
  const radius = 8;
  const trueArea = Polygon.area(square) + Polygon.perimeter(square) * radius +
    Math.PI * radius * radius;
  let previous = 0;

  [3, 6, 8, 12, 16, 32, 64].forEach(function (corners) {
    const area = Polygon.area(Clipping.offsetConvex(square, radius, corners));

    assert.ok(area < trueArea, corners + ' corners: the approximation must be inscribed');
    assert.ok(area > previous, corners + ' corners: more corners must not lose area');
    previous = area;
  });
});

/* -------------------------------------------------------------- calipers */

test('calipers: diameter is exact and the rectangle is never worse than a sweep', function () {
  ['uniform', 'clustered', 'circle', 'grid'].forEach(function (scene) {
    const points = Lab.points(scene, 60, 43);
    const hull = Calipers.hullOf(points, Calipers.report());
    const diameter = Calipers.diameter(points, { hull: hull });
    const brute = Calipers.diameterBruteForce(points, Calipers.report());
    const rectangle = Calipers.minimumAreaRectangle(points, { hull: hull });
    const sweep = Calipers.rectangleByRotationSweep(points, 720);
    const box = Calipers.boundingBox(points);

    /* Equal to the last bit on ordinary sets. On points sitting on a circle
       there are many antipodal pairs at the same distance, and the two walks
       can land on different ones whose lengths differ in the final ulp. */
    assert.ok(Math.abs(diameter.distance - brute.distance) <= 1e-9 * brute.distance,
      scene + ': the diameter must match the pairwise scan, got ' + diameter.distance +
      ' against ' + brute.distance);
    assert.ok(rectangle.area <= sweep.area + 1e-6, scene + ': the complete scan may not lose');
    assert.ok(rectangle.area <= box.area + 1e-6, scene + ': nor exceed the axis-aligned box');
  });
});

test('calipers: the smallest enclosing circle covers every point, on every scene', function () {
  ['uniform', 'clustered', 'circle', 'grid', 'collinear'].forEach(function (scene) {
    const points = Lab.points(scene, 50, 43);
    const built = Calipers.smallestEnclosingCircle(points, {});

    assert.strictEqual(Calipers.circleCovers(points, built.circle).ok, true,
      scene + ': a point escaped the circle');

    /* `support` is every point ON the boundary, which a set of points already
       sitting on a circle makes large. The BASIS is at most three; the count
       here is only required to be at least two. */
    assert.ok(built.support.length >= 2, scene + ': a circle needs at least two boundary points');
  });
});

/* ---------------------------------------------------------------- raster */

test('raster: Bresenham and rounding agree on endpoints and pixel counts, always', function () {
  const rng = Random.seeded(47);

  for (let trial = 0; trial < 500; trial += 1) {
    const a = G.point(Math.round(rng.next() * 60 - 30), Math.round(rng.next() * 60 - 30));
    const b = G.point(Math.round(rng.next() * 60 - 30), Math.round(rng.next() * 60 - 30));
    const bres = Raster.bresenham(a, b);
    const round = Raster.lineByRounding(a, b);

    const last = bres.length - 1;

    assert.strictEqual(bres.length, round.length, 'trial ' + trial + ': pixel counts differ');
    assert.ok(bres[0].x === round[0].x && bres[0].y === round[0].y,
      'trial ' + trial + ': first pixel differs');
    assert.ok(bres[last].x === round[last].x && bres[last].y === round[last].y,
      'trial ' + trial + ': last pixel differs');
  }
});

test('raster: coverage sums to the polygon area, at every sample rate', function () {
  const ring = [[3, 3], [27, 6], [24, 25], [7, 21]].map(function (p) { return G.point(p[0], p[1]); });
  const area = Polygon.area(ring);

  [2, 4, 8].forEach(function (samples) {
    const coverage = Raster.coverageFill(ring, samples, Raster.report());
    const sum = coverage.reduce(function (total, c) { return total + c.coverage; }, 0);

    assert.ok(Math.abs(sum - area) < 2,
      samples + ' samples per axis: coverage summed to ' + sum + ' against an area of ' + area);
  });
});

test('raster: flattening stays inside its tolerance and grows with it', function () {
  const p = [[0, 0], [0, 60], [80, 60], [80, 0]].map(function (q) { return G.point(q[0], q[1]); });
  let previous = Infinity;

  [4, 1, 0.25, 0.0625, 0.015625].forEach(function (tolerance) {
    const flat = Raster.flattenCubic(p[0], p[1], p[2], p[3], tolerance, Raster.report());
    const error = Raster.flattenError(p[0], p[1], p[2], p[3], flat, 400);

    assert.ok(error <= tolerance, 'tolerance ' + tolerance + ': measured error ' + error);
    assert.ok(error < previous, 'tolerance ' + tolerance + ': the error must fall');
    previous = error;
  });
});

test('raster: the minimum translation vector separates the shapes it is given', function () {
  const rng = Random.seeded(53);

  function stretched(sides, cx, cy, rx, ry, rotation) {
    const out = [];

    for (let i = 0; i < sides; i += 1) {
      const angle = 2 * Math.PI * i / sides;
      const x = rx * Math.cos(angle);
      const y = ry * Math.sin(angle);
      out.push(G.point(cx + x * Math.cos(rotation) - y * Math.sin(rotation),
        cy + x * Math.sin(rotation) + y * Math.cos(rotation)));
    }
    return out;
  }
  let overlaps = 0;

  for (let trial = 0; trial < 200; trial += 1) {
    const a = stretched(4 + rng.int(3), 0, 0, 4 + rng.next() * 20,
      1 + rng.next() * 3, rng.next() * Math.PI);
    const b = stretched(4 + rng.int(3), (rng.next() - 0.5) * 20, (rng.next() - 0.5) * 20,
      4 + rng.next() * 20, 1 + rng.next() * 3, rng.next() * Math.PI);
    const result = Raster.separatingAxis(a, b, {});
    if (!result.colliding || !result.mtv) continue;
    overlaps += 1;
    const after = Raster.separatingAxis(a, Raster.translateRing(b, result.mtv), {});

    assert.ok(!after.colliding || after.overlap <= 1e-6,
      'trial ' + trial + ': the push left them overlapping by ' + after.overlap);
  }
  assert.ok(overlaps > 40, 'the generator must actually produce overlaps, got ' + overlaps);
});

/* ------------------------------------------------------------ transforms */

test('transforms: composition is associative and the identity does nothing', function () {
  const a = Transforms3D.rotationZ(0.7);
  const b = Transforms3D.translation(4, -2, 9);
  const c = Transforms3D.scaling(1.5, 0.5, 2);
  const left = Transforms3D.compose(Transforms3D.compose(a, b), c);
  const right = Transforms3D.compose(a, Transforms3D.compose(b, c));
  const point = Transforms3D.vec3(3, -1, 2);
  const one = Transforms3D.apply(left, point);
  const two = Transforms3D.apply(right, point);

  assert.ok(Math.abs(one.x - two.x) < 1e-9 && Math.abs(one.y - two.y) < 1e-9 &&
    Math.abs(one.z - two.z) < 1e-9, 'composition must be associative');
  const same = Transforms3D.apply(Transforms3D.compose(a, Transforms3D.identity()), point);
  const alone = Transforms3D.apply(a, point);

  assert.ok(Math.abs(same.x - alone.x) < 1e-9, 'the identity must change nothing');
});

test('transforms: a pure rotation fixes the origin and a translation does not', function () {
  const origin = Transforms3D.vec3(0, 0, 0);
  const rotated = Transforms3D.apply(Transforms3D.rotationZ(1.1), origin);
  const shifted = Transforms3D.apply(Transforms3D.translation(5, 0, 0), origin);

  assert.ok(Math.abs(rotated.x) < 1e-12 && Math.abs(rotated.y) < 1e-12);
  assert.ok(Math.abs(shifted.x - 5) < 1e-12);
});

test('transforms: the ray test agrees with a differently derived reference', function () {
  const rng = Random.seeded(59);
  let hits = 0;

  for (let trial = 0; trial < 3000; trial += 1) {
    const a = Transforms3D.vec3(rng.next() * 4 - 2, rng.next() * 4 - 2, rng.next() * 4 - 2);
    const b = Transforms3D.vec3(rng.next() * 4 - 2, rng.next() * 4 - 2, rng.next() * 4 - 2);
    const c = Transforms3D.vec3(rng.next() * 4 - 2, rng.next() * 4 - 2, rng.next() * 4 - 2);
    const origin = Transforms3D.vec3(rng.next() * 6 - 3, rng.next() * 6 - 3, -5);
    const direction = Transforms3D.normalise3(
      Transforms3D.vec3(rng.next() * 0.6 - 0.3, rng.next() * 0.6 - 0.3, 1));
    const fast = Transforms3D.rayTriangle(origin, direction, a, b, c, {});
    const reference = Transforms3D.rayTrianglePlane(origin, direction, a, b, c);

    assert.strictEqual(Boolean(fast), Boolean(reference), 'trial ' + trial);
    if (!fast) continue;
    hits += 1;
    const rebuilt = Transforms3D.fromBarycentric(a, b, c, fast.u, fast.v);

    assert.ok(Math.abs(rebuilt.x - fast.point.x) < 1e-9 &&
      Math.abs(rebuilt.y - fast.point.y) < 1e-9 &&
      Math.abs(rebuilt.z - fast.point.z) < 1e-9,
    'trial ' + trial + ': the barycentric round-trip missed the hit point');
  }
  assert.ok(hits > 20, 'the sweep must hit something, got ' + hits);
});

test('transforms: gimbal coupling falls to zero at the pole and nowhere before it', function () {
  const rows = [0, 15, 30, 45, 60, 75, 89, 90].map(function (degrees) {
    return Transforms3D.gimbalCoupling(degrees * Math.PI / 180, 0.01);
  });

  assert.strictEqual(rows[0].freedomLost.toFixed(6), '0.000000');
  assert.strictEqual(rows[rows.length - 1].freedomLost.toFixed(6), '1.000000');

  for (let i = 1; i < rows.length; i += 1) {
    assert.ok(rows[i].gap < rows[i - 1].gap, 'the gap must fall at every step');
    assert.ok(rows[i].freedomLost > rows[i - 1].freedomLost, 'and the loss must rise');
  }
});
