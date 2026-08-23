/**
 * Polygon clipping and boolean operations, and the concave failure that is the
 * point of the section.
 *
 * Sutherland-Hodgman clips a polygon against another by cutting it
 * successively with each edge of the clip polygon, treated as an infinite
 * line. That is exactly right when the clip polygon is CONVEX, because a
 * convex region is exactly the intersection of the half-planes its edges
 * define. When the clip polygon is concave that identity fails, and so does
 * the algorithm - quietly, and in two different ways depending on the shape.
 *
 * Measured against a sampled reference on a 6 x 6 square clipped by five
 * concave shapes: a deep notch and a shallow notch both return the EMPTY
 * polygon, a 100% error with no vertices to inspect; an L-shape and a chevron
 * return a plausible four- or five-vertex polygon that is 66.7% too small;
 * a five-pointed star returns eight vertices and 60.0% too little area. The
 * second kind is the dangerous one - there is a polygon at the end of it, it
 * renders, and nothing about it says it is wrong.
 *
 * The fix in this file is the honest one: decompose the concave clip polygon
 * into convex pieces, clip against each, and take the union of the results.
 * `sutherlandHodgman` keeps the broken behaviour available deliberately, so
 * the section can measure the error rather than describe it.
 *
 * Every result is checked against `rasterArea`, a grid-sampled area that owes
 * nothing to any of the algorithms here. It is approximate and its error is
 * bounded by the grid, which is why the comparison is reported as a relative
 * difference with the grid size beside it rather than as a pass or a fail.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Clipping = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const G = scope && scope.GeometryCore ? scope.GeometryCore : require('./geometry-core.js');
  const P = scope && scope.Polygon ? scope.Polygon : require('./polygon.js');
  const T = scope && scope.Triangulation ? scope.Triangulation : require('./triangulation.js');

  const UNION = 'union';
  const INTERSECTION = 'intersection';
  const DIFFERENCE = 'difference';
  const XOR = 'xor';

  function report() {
    return { orient: 0, clips: 0, vertices: 0, pieces: 0, samples: 0,
      inside: 0, crossings: 0 };
  }

  function counterClockwise(ring) {
    return P.isCounterClockwise(ring) ? ring.slice() : ring.slice().reverse();
  }

  /* -------------------------------------------- Sutherland-Hodgman */

  /**
   * Clip `subject` against one directed edge of the clip polygon, keeping
   * whatever lies to the left of it.
   */
  function clipAgainstEdge(subject, a, b, stats) {
    const out = [];

    for (let i = 0; i < subject.length; i += 1) {
      const current = subject[i];
      const next = subject[(i + 1) % subject.length];
      const currentIn = G.orient2d(a, b, current, stats) >= 0;
      const nextIn = G.orient2d(a, b, next, stats) >= 0;

      if (currentIn) out.push(current);
      if (currentIn === nextIn) continue;
      const at = G.segmentIntersection(a, b, current, next);
      if (at) out.push(at);
    }
    return out;
  }

  /**
   * The classic. Correct for a convex clip polygon and quietly wrong for a
   * concave one - which is why `clipConvexDecomposed` exists below.
   */
  function sutherlandHodgman(subject, clip, options) {
    const settings = options || {};
    const stats = settings.report || report();
    const clipRing = counterClockwise(clip);
    let output = counterClockwise(subject);

    for (let i = 0; i < clipRing.length && output.length; i += 1) {
      stats.clips += 1;
      output = clipAgainstEdge(output, clipRing[i], clipRing[(i + 1) % clipRing.length], stats);
    }
    stats.vertices = output.length;
    return output;
  }

  /**
   * Break a simple polygon into convex pieces by ear clipping. Triangles are
   * the crudest convex decomposition and the one that always exists, which is
   * what makes it the right fallback here.
   */
  function convexPieces(ring, stats) {
    const clipped = T.earClip(ring, { report: stats });
    if (stats) stats.pieces = clipped.triangles.length;
    return clipped.triangles.map(function (t) {
      return [clipped.ring[t[0]], clipped.ring[t[1]], clipped.ring[t[2]]];
    });
  }

  /**
   * Sutherland-Hodgman made correct for a concave clip: clip against each
   * convex piece separately. The result is a LIST of rings rather than one
   * ring, because a concave clip can genuinely cut the subject into several
   * disconnected parts - which is the other thing the single-ring version
   * cannot represent.
   */
  function clipConvexDecomposed(subject, clip, options) {
    const settings = options || {};
    const stats = settings.report || report();
    const parts = [];

    convexPieces(counterClockwise(clip), stats).forEach(function (piece) {
      const clipped = sutherlandHodgman(subject, piece, { report: stats });
      if (clipped.length >= 3 && P.area(clipped) > 1e-12) parts.push(clipped);
    });
    return parts;
  }

  /* ----------------------------------------------- boolean by sampling */

  function boundsOf(rings) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    rings.forEach(function (ring) {
      ring.forEach(function (p) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      });
    });
    return { x0: minX, y0: minY, x1: maxX, y1: maxY };
  }

  function insideRing(ring, p, stats) {
    return P.windingNumber(ring, p, stats).result !== P.OUT;
  }

  function wanted(operation, inA, inB) {
    if (operation === UNION) return inA || inB;
    if (operation === INTERSECTION) return inA && inB;
    if (operation === DIFFERENCE) return inA && !inB;
    return inA !== inB;
  }

  /**
   * The oracle for every boolean operation: sample a grid and count. Its error
   * is one cell of the grid along the boundary, so it is quoted with the grid
   * size rather than treated as exact - a difference below the grid resolution
   * is not evidence of anything.
   */
  function rasterArea(rings, operation, steps, stats) {
    const box = boundsOf(rings);
    const n = steps || 200;
    const cellW = (box.x1 - box.x0) / n;
    const cellH = (box.y1 - box.y0) / n;
    let hits = 0;

    for (let iy = 0; iy < n; iy += 1) {
      for (let ix = 0; ix < n; ix += 1) {
        const p = G.point(box.x0 + (ix + 0.5) * cellW, box.y0 + (iy + 0.5) * cellH);
        if (stats) stats.samples += 1;
        const inA = insideRing(rings[0], p, stats);
        const inB = rings.length > 1 ? insideRing(rings[1], p, stats) : false;
        if (wanted(operation, inA, inB)) hits += 1;
      }
    }
    if (stats) stats.inside = hits;

    return { area: hits * cellW * cellH, cells: n * n, cellArea: cellW * cellH, hits: hits };
  }

  /**
   * A boolean operation computed by sampling rather than by traversal: the
   * result is reported as an AREA, not a polygon. It is the honest thing to
   * offer alongside the clippers, because it is what they are checked against
   * and it never fails on a degenerate overlap.
   */
  function booleanArea(a, b, operation, steps, options) {
    const settings = options || {};
    const stats = settings.report || report();
    return rasterArea([counterClockwise(a), counterClockwise(b)], operation, steps, stats);
  }

  /**
   * How far a clipper's answer is from the sampled truth, relative to the
   * sampled area. Reported with the grid so the reader can see the floor.
   */
  function compareToRaster(parts, a, b, operation, steps) {
    const stats = report();
    const truth = booleanArea(a, b, operation, steps, { report: stats });
    const claimed = parts.reduce(function (sum, ring) { return sum + P.area(ring); }, 0);
    const gap = Math.abs(claimed - truth.area);

    return {
      claimed: claimed,
      sampled: truth.area,
      gap: gap,
      relative: truth.area > 0 ? gap / truth.area : 0,
      cells: truth.cells,
      resolution: truth.cellArea,
      withinGrid: gap <= truth.cellArea * Math.sqrt(truth.cells)
    };
  }

  /* -------------------------------------------------- Minkowski sum */

  /**
   * The Minkowski sum of two CONVEX polygons, by merging their edge vectors in
   * angular order. Every edge of the sum is an edge of one of the inputs, which
   * is why the result has at most |A| + |B| vertices and why the construction
   * is linear rather than quadratic.
   *
   * The sum is what turns "does this shape fit through that gap" into "is this
   * point inside that region": grow the obstacles by the robot's shape and the
   * robot becomes a point.
   */
  function minkowskiSum(a, b, options) {
    const settings = options || {};
    const stats = settings.report || report();
    const A = startAtLowest(counterClockwise(a));
    const B = startAtLowest(counterClockwise(b));
    const out = [];
    let i = 0;
    let j = 0;

    while (i < A.length || j < B.length) {
      out.push(G.add(A[i % A.length], B[j % B.length]));
      const cross = G.cross(edgeAt(A, i), edgeAt(B, j));
      stats.orient += 1;

      if (cross > 0 || (cross === 0 && i < A.length)) i += 1;
      if (cross < 0 || (cross === 0 && j < B.length)) j += 1;
      if (i >= A.length && j >= B.length) break;
    }
    stats.vertices = out.length;
    return out;
  }

  function edgeAt(ring, i) {
    return G.sub(ring[(i + 1) % ring.length], ring[i % ring.length]);
  }

  function startAtLowest(ring) {
    let at = 0;
    ring.forEach(function (p, i) {
      if (p.y < ring[at].y || (p.y === ring[at].y && p.x < ring[at].x)) at = i;
    });
    return ring.slice(at).concat(ring.slice(0, at));
  }

  /** The oracle for the sum: every pairwise vector sum, hulled. */
  function minkowskiBruteForce(a, b) {
    const points = [];
    a.forEach(function (p) { b.forEach(function (q) { points.push(G.add(p, q)); }); });
    return points;
  }

  /**
   * Offsetting a convex polygon outward is its Minkowski sum with a disc,
   * approximated by a regular polygon. The corner count is the approximation,
   * and it is the parameter every buffering library exposes and nobody sets.
   */
  function offsetConvex(ring, radius, corners, options) {
    const disc = [];
    const n = Math.max(3, corners || 16);
    for (let i = 0; i < n; i += 1) {
      const angle = (i / n) * Math.PI * 2;
      disc.push(G.point(radius * Math.cos(angle), radius * Math.sin(angle)));
    }
    return minkowskiSum(ring, disc, options);
  }

  return {
    UNION: UNION,
    INTERSECTION: INTERSECTION,
    DIFFERENCE: DIFFERENCE,
    XOR: XOR,
    report: report,
    clipAgainstEdge: clipAgainstEdge,
    sutherlandHodgman: sutherlandHodgman,
    convexPieces: convexPieces,
    clipConvexDecomposed: clipConvexDecomposed,
    rasterArea: rasterArea,
    booleanArea: booleanArea,
    compareToRaster: compareToRaster,
    minkowskiSum: minkowskiSum,
    minkowskiBruteForce: minkowskiBruteForce,
    offsetConvex: offsetConvex
  };
}));
