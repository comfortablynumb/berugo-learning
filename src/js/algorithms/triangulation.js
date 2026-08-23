/**
 * Polygon triangulation by ear clipping, and Delaunay triangulation by
 * incremental insertion with edge flips.
 *
 * The two halves answer different questions. Ear clipping takes a polygon and
 * cuts it into triangles - any valid set will do, and the O(n²) is the price
 * of re-scanning for an ear after each cut. Delaunay takes a point set and
 * produces the triangulation that MAXIMISES THE MINIMUM ANGLE, which is why it
 * is the default mesh for interpolation and terrain: skinny triangles are what
 * make an interpolated surface look wrong, and Delaunay is the arrangement
 * that has as few of them as the points allow.
 *
 * The empty-circle property is the definition and the test. A triangulation is
 * Delaunay exactly when no triangle's circumcircle contains another vertex,
 * and `checkDelaunay` verifies that directly against every vertex rather than
 * trusting the flip loop that produced it. That check is quadratic and it is
 * the only reason the flip loop can be believed.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Triangulation = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const G = scope && scope.GeometryCore ? scope.GeometryCore : require('./geometry-core.js');
  const P = scope && scope.Polygon ? scope.Polygon : require('./polygon.js');

  function report() {
    return { orient: 0, orientExact: 0, inCircle: 0, inCircleExact: 0,
      earTests: 0, ears: 0, flips: 0, inserted: 0, badTriangles: 0 };
  }

  /* --------------------------------------------------- ear clipping */

  function isEar(ring, indices, k, stats) {
    const n = indices.length;
    const prev = ring[indices[(k - 1 + n) % n]];
    const at = ring[indices[k]];
    const next = ring[indices[(k + 1) % n]];

    stats.earTests += 1;
    if (G.orient2d(prev, at, next, stats) <= 0) return false;

    for (let i = 0; i < n; i += 1) {
      if (i === k || i === (k - 1 + n) % n || i === (k + 1) % n) continue;
      const p = ring[indices[i]];
      if (insideTriangle(prev, at, next, p, stats)) return false;
    }
    return true;
  }

  function insideTriangle(a, b, c, p, stats) {
    return G.orient2d(a, b, p, stats) >= 0 &&
      G.orient2d(b, c, p, stats) >= 0 &&
      G.orient2d(c, a, p, stats) >= 0;
  }

  /**
   * Ear clipping: find a vertex whose triangle with its neighbours lies inside
   * the polygon and contains no other vertex, cut it off, repeat. Requires a
   * simple polygon - a self-intersecting one has no ears to find and the loop
   * stalls, which is reported rather than hidden.
   */
  function earClip(polygon, options) {
    const settings = options || {};
    const stats = settings.report || report();
    const ring = P.isCounterClockwise(polygon) ? polygon.slice() : polygon.slice().reverse();
    const indices = ring.map(function (p, i) { return i; });
    const triangles = [];
    const ears = [];

    let guard = ring.length * ring.length + 16;
    while (indices.length > 3 && guard > 0) {
      guard -= 1;
      let cut = -1;

      for (let k = 0; k < indices.length; k += 1) {
        if (!isEar(ring, indices, k, stats)) continue;
        cut = k;
        break;
      }
      if (cut < 0) break;

      const n = indices.length;
      const a = indices[(cut - 1 + n) % n];
      const b = indices[cut];
      const c = indices[(cut + 1) % n];
      triangles.push([a, b, c]);
      ears.push(b);
      stats.ears += 1;
      indices.splice(cut, 1);
    }

    if (indices.length === 3) triangles.push([indices[0], indices[1], indices[2]]);
    const expected = Math.max(0, ring.length - 2);

    return {
      ring: ring,
      triangles: triangles,
      ears: ears,
      complete: triangles.length === expected,
      expected: expected,
      report: stats
    };
  }

  /* ------------------------------------------------------- Delaunay */

  function circumcentre(a, b, c) {
    const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
    if (d === 0) return null;
    const a2 = a.x * a.x + a.y * a.y;
    const b2 = b.x * b.x + b.y * b.y;
    const c2 = c.x * c.x + c.y * c.y;

    return G.point(
      (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
      (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d
    );
  }

  function circumradius(a, b, c) {
    const centre = circumcentre(a, b, c);
    return centre ? G.distance(centre, a) : Infinity;
  }

  /** The smallest angle of a triangle, in degrees. Delaunay maximises it. */
  function minimumAngle(a, b, c) {
    const sides = [G.distance(b, c), G.distance(a, c), G.distance(a, b)];
    const angles = [];

    for (let i = 0; i < 3; i += 1) {
      const opposite = sides[i];
      const p = sides[(i + 1) % 3];
      const q = sides[(i + 2) % 3];
      if (p === 0 || q === 0) return 0;
      const cosine = (p * p + q * q - opposite * opposite) / (2 * p * q);
      angles.push(Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI);
    }
    return Math.min.apply(null, angles);
  }

  function edgeKey(i, j) {
    return i < j ? i + ':' + j : j + ':' + i;
  }

  /** A super-triangle large enough to contain every point. */
  function superTriangle(points) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach(function (p) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });
    const dx = Math.max(1, maxX - minX);
    const dy = Math.max(1, maxY - minY);
    const span = Math.max(dx, dy) * 20;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    return [
      G.point(cx - span, cy - span),
      G.point(cx + span, cy - span),
      G.point(cx, cy + span)
    ];
  }

  /**
   * Bowyer-Watson: insert each point, delete every triangle whose circumcircle
   * contains it, and re-triangulate the hole from its boundary. The deletion
   * test IS the in-circle predicate, which is why a non-robust one produces a
   * hole that is not a simple polygon and a mesh with overlapping triangles.
   */
  function delaunay(points, options) {
    const settings = options || {};
    const stats = settings.report || report();
    const unique = dedupe(points);
    if (unique.length < 3) return { points: unique, triangles: [], report: stats };

    const frame = superTriangle(unique);
    const verts = unique.concat(frame);
    const frameStart = unique.length;
    let triangles = [[frameStart, frameStart + 1, frameStart + 2]];

    unique.forEach(function (p, index) {
      stats.inserted += 1;
      triangles = insertPoint(triangles, verts, index, p, stats);
    });

    const kept = triangles.filter(function (t) {
      return t.every(function (i) { return i < frameStart; });
    });
    return { points: unique, triangles: kept, report: stats };
  }

  function insertPoint(triangles, verts, index, p, stats) {
    const bad = [];
    const good = [];

    triangles.forEach(function (t) {
      const a = verts[t[0]], b = verts[t[1]], c = verts[t[2]];
      const ccw = G.orient2d(a, b, c, stats) > 0;
      const inside = ccw ? G.inCircle(a, b, c, p, stats) : G.inCircle(a, c, b, p, stats);
      if (inside > 0) bad.push(t);
      else good.push(t);
    });
    stats.badTriangles += bad.length;

    const counts = new Map();
    bad.forEach(function (t) {
      [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]].forEach(function (e) {
        const id = edgeKey(e[0], e[1]);
        counts.set(id, (counts.get(id) || 0) + 1);
      });
    });

    bad.forEach(function (t) {
      [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]].forEach(function (e) {
        if (counts.get(edgeKey(e[0], e[1])) !== 1) return;
        stats.flips += 1;
        good.push(orientTriangle(verts, [e[0], e[1], index], stats));
      });
    });
    return good;
  }

  function orientTriangle(verts, t, stats) {
    if (G.orient2d(verts[t[0]], verts[t[1]], verts[t[2]], stats) >= 0) return t;
    return [t[0], t[2], t[1]];
  }

  function dedupe(points) {
    const seen = new Set();
    const out = [];
    points.forEach(function (p) {
      const id = p.x + ':' + p.y;
      if (seen.has(id)) return;
      seen.add(id);
      out.push(p);
    });
    return out;
  }

  /**
   * The oracle. For every triangle and every vertex not in it, the vertex must
   * not be strictly inside the circumcircle. Quadratic in the triangle count
   * and independent of the flip loop, which is the point.
   */
  function checkDelaunay(points, triangles, options) {
    const settings = options || {};
    const stats = settings.report || report();
    const violations = [];

    triangles.forEach(function (t, ti) {
      const a = points[t[0]], b = points[t[1]], c = points[t[2]];
      const ccw = G.orient2d(a, b, c, stats) > 0;

      for (let i = 0; i < points.length; i += 1) {
        if (i === t[0] || i === t[1] || i === t[2]) continue;
        const inside = ccw
          ? G.inCircle(a, b, c, points[i], stats)
          : G.inCircle(a, c, b, points[i], stats);
        if (inside > 0) violations.push({ triangle: ti, vertex: i });
      }
    });

    return { ok: violations.length === 0, violations: violations, report: stats };
  }

  /** Angle statistics for a triangulation, which is what Delaunay improves. */
  function angleProfile(points, triangles) {
    if (!triangles.length) return { minimum: 0, mean: 0, worst: 0, skinny: 0 };
    const minima = triangles.map(function (t) {
      return minimumAngle(points[t[0]], points[t[1]], points[t[2]]);
    });
    const skinny = minima.filter(function (a) { return a < 20; }).length;
    const total = minima.reduce(function (s, a) { return s + a; }, 0);

    return {
      minimum: Math.min.apply(null, minima),
      mean: total / minima.length,
      worst: Math.min.apply(null, minima),
      skinny: skinny
    };
  }

  /**
   * A deliberately non-Delaunay triangulation of the same points, for
   * comparison: fan every point off the first one inside the hull. It is a
   * valid triangulation and its angles are far worse, which is the measurement
   * the section quotes.
   */
  function fanTriangulation(points) {
    const unique = dedupe(points);
    if (unique.length < 3) return { points: unique, triangles: [] };
    const order = unique.map(function (p, i) { return i; });
    const centre = unique[0];

    order.sort(function (i, j) {
      if (i === 0) return -1;
      if (j === 0) return 1;
      return Math.atan2(unique[i].y - centre.y, unique[i].x - centre.x) -
        Math.atan2(unique[j].y - centre.y, unique[j].x - centre.x);
    });

    const triangles = [];
    for (let k = 1; k + 1 < order.length; k += 1) {
      triangles.push([order[0], order[k], order[k + 1]]);
    }
    return { points: unique, triangles: triangles };
  }

  return {
    report: report,
    earClip: earClip,
    isEar: isEar,
    insideTriangle: insideTriangle,
    circumcentre: circumcentre,
    circumradius: circumradius,
    minimumAngle: minimumAngle,
    superTriangle: superTriangle,
    delaunay: delaunay,
    checkDelaunay: checkDelaunay,
    angleProfile: angleProfile,
    fanTriangulation: fanTriangulation
  };
}));
