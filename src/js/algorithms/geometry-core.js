/**
 * Vectors, the two predicates everything else is built on, and the primitives
 * that only need them.
 *
 * `orient2d(a, b, c)` is the foundation of computational geometry: it answers
 * whether c lies to the left of the directed line a to b, to its right, or
 * exactly on it. Convex hulls, point-in-polygon, segment intersection,
 * triangulation and Delaunay flips are all that one question asked repeatedly.
 * `inCircle(a, b, c, d)` is the second: is d inside the circle through a, b
 * and c?
 *
 * Both are computed adaptively. The fast path is the obvious floating-point
 * determinant plus an error bound that says how far the rounding could
 * possibly have moved it; when the value is larger than that bound its sign is
 * certain and the answer is returned immediately. Only when the value falls
 * inside the bound - which means the points are close to collinear or
 * co-circular, and the sign genuinely cannot be read off the rounded number -
 * does it escalate to `geometry-exact.js`. On ordinary data the filter settles
 * essentially every call, so the exact path costs nothing at all in practice.
 *
 * The naive versions are here too, and they are not a straw man: they are what
 * the section demonstrates failing. A naive predicate does not merely round
 * badly, it returns ANSWERS THAT CONTRADICT EACH OTHER - "left" for (a, b, c)
 * and "left" again for (a, c, b), which is geometrically impossible - and
 * every hull that crashed and every polygon with a hole in it traces back to
 * exactly that.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GeometryCore = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const Exact = scope && scope.GeometryExact
    ? scope.GeometryExact
    : require('./geometry-exact.js');

  /* Machine epsilon for a double, and Shewchuk's error bounds derived from it.
     The A bounds are the ones a first-pass filter uses: if the computed value
     exceeds the bound times the sum of the absolute terms, no amount of
     rounding could have flipped its sign. */
  const EPS = Math.pow(2, -53);
  const ORIENT_BOUND = (3 + 16 * EPS) * EPS;
  const INCIRCLE_BOUND = (10 + 96 * EPS) * EPS;

  function point(x, y) {
    return { x: x, y: y };
  }

  function sub(a, b) {
    return point(a.x - b.x, a.y - b.y);
  }

  function add(a, b) {
    return point(a.x + b.x, a.y + b.y);
  }

  function scale(a, k) {
    return point(a.x * k, a.y * k);
  }

  /** The z-component of the 3-D cross product, which in 2-D is the signed area. */
  function cross(a, b) {
    return a.x * b.y - a.y * b.x;
  }

  function dot(a, b) {
    return a.x * b.x + a.y * b.y;
  }

  function length2(a) {
    return a.x * a.x + a.y * a.y;
  }

  function length(a) {
    return Math.sqrt(length2(a));
  }

  function distance(a, b) {
    return length(sub(a, b));
  }

  function distance2(a, b) {
    return length2(sub(a, b));
  }

  function equal(a, b) {
    return a.x === b.x && a.y === b.y;
  }

  /* Counters are a reported field rather than a side effect: the section shows
     how often the filter settled the question and how often it could not. */
  function report() {
    return { orient: 0, orientExact: 0, inCircle: 0, inCircleExact: 0 };
  }

  function count(stats, key) {
    if (stats && typeof stats[key] === 'number') stats[key] += 1;
  }

  /** The determinant as a plain double. Fast, and sometimes wrong. */
  function orient2dValue(a, b, c) {
    return (a.x - c.x) * (b.y - c.y) - (a.y - c.y) * (b.x - c.x);
  }

  /** What every implementation does before it learns better. */
  function orient2dNaive(a, b, c) {
    const value = orient2dValue(a, b, c);
    if (value > 0) return 1;
    if (value < 0) return -1;
    return 0;
  }

  /** An epsilon comparison, which looks like a fix and is not one. */
  function orient2dEpsilon(a, b, c, epsilon) {
    const value = orient2dValue(a, b, c);
    const tolerance = epsilon === undefined ? 1e-12 : epsilon;
    if (value > tolerance) return 1;
    if (value < -tolerance) return -1;
    return 0;
  }

  /**
   * The adaptive predicate. Returns 1 for a left turn, −1 for a right turn and
   * 0 for exactly collinear, and never contradicts itself under any
   * permutation of its arguments.
   */
  function orient2d(a, b, c, stats) {
    count(stats, 'orient');
    const left = (a.x - c.x) * (b.y - c.y);
    const right = (a.y - c.y) * (b.x - c.x);
    const value = left - right;
    const magnitude = Math.abs(left) + Math.abs(right);

    if (Math.abs(value) > ORIENT_BOUND * magnitude) {
      return value > 0 ? 1 : -1;
    }
    count(stats, 'orientExact');
    return Exact.orient2d(a, b, c);
  }

  function inCircleValue(a, b, c, d) {
    const ax = a.x - d.x, ay = a.y - d.y;
    const bx = b.x - d.x, by = b.y - d.y;
    const cx = c.x - d.x, cy = c.y - d.y;

    return (ax * ax + ay * ay) * (bx * cy - by * cx) -
      (bx * bx + by * by) * (ax * cy - ay * cx) +
      (cx * cx + cy * cy) * (ax * by - ay * bx);
  }

  function inCircleNaive(a, b, c, d) {
    const value = inCircleValue(a, b, c, d);
    if (value > 0) return 1;
    if (value < 0) return -1;
    return 0;
  }

  /** The magnitude the rounding error is measured against. */
  function inCirclePermanent(a, b, c, d) {
    const ax = a.x - d.x, ay = a.y - d.y;
    const bx = b.x - d.x, by = b.y - d.y;
    const cx = c.x - d.x, cy = c.y - d.y;

    return (Math.abs(bx * cy) + Math.abs(by * cx)) * (ax * ax + ay * ay) +
      (Math.abs(cx * ay) + Math.abs(cy * ax)) * (bx * bx + by * by) +
      (Math.abs(ax * by) + Math.abs(ay * bx)) * (cx * cx + cy * cy);
  }

  /**
   * 1 when d is strictly inside the circle through a, b, c (given a, b, c
   * counter-clockwise), −1 when strictly outside, 0 when exactly on it.
   */
  function inCircle(a, b, c, d, stats) {
    count(stats, 'inCircle');
    const value = inCircleValue(a, b, c, d);
    const permanent = inCirclePermanent(a, b, c, d);

    if (Math.abs(value) > INCIRCLE_BOUND * permanent) {
      return value > 0 ? 1 : -1;
    }
    count(stats, 'inCircleExact');
    return Exact.inCircle(a, b, c, d);
  }

  /**
   * Is p further from the line a-b than q is? Exact, and needed wherever an
   * algorithm ranks candidates by distance to a line rather than merely asking
   * which side they are on.
   */
  function fartherFromLine(a, b, p, q, stats) {
    count(stats, 'orient');
    const value = (b.x - a.x) * (p.y - q.y) - (b.y - a.y) * (p.x - q.x);
    const magnitude = Math.abs((b.x - a.x) * (p.y - q.y)) + Math.abs((b.y - a.y) * (p.x - q.x));

    if (Math.abs(value) > ORIENT_BOUND * magnitude) return value > 0 ? 1 : -1;
    count(stats, 'orientExact');
    return Exact.fartherFromLine(a, b, p, q);
  }

  /* ------------------------------------------------------- primitives */

  /** Twice the signed area of the triangle, as a magnitude rather than a sign. */
  function signedArea2(a, b, c) {
    return orient2dValue(a, b, c);
  }

  function collinear(a, b, c, stats) {
    return orient2d(a, b, c, stats) === 0;
  }

  /** Is p on the segment a-b, endpoints included? Requires collinearity. */
  function onSegment(a, b, p, stats) {
    if (orient2d(a, b, p, stats) !== 0) return false;
    return Math.min(a.x, b.x) <= p.x && p.x <= Math.max(a.x, b.x) &&
      Math.min(a.y, b.y) <= p.y && p.y <= Math.max(a.y, b.y);
  }

  /**
   * Do the closed segments a1-a2 and b1-b2 share a point? The four orientation
   * tests handle the general case; the collinear-overlap case is the one that
   * a "signs differ" test alone gets wrong, so it is checked explicitly.
   */
  function segmentsIntersect(a1, a2, b1, b2, stats) {
    const d1 = orient2d(a1, a2, b1, stats);
    const d2 = orient2d(a1, a2, b2, stats);
    const d3 = orient2d(b1, b2, a1, stats);
    const d4 = orient2d(b1, b2, a2, stats);

    if (d1 !== d2 && d3 !== d4) return true;
    if (d1 === 0 && onSegment(a1, a2, b1, stats)) return true;
    if (d2 === 0 && onSegment(a1, a2, b2, stats)) return true;
    if (d3 === 0 && onSegment(b1, b2, a1, stats)) return true;
    return d4 === 0 && onSegment(b1, b2, a2, stats);
  }

  /** The crossing point of two segments known to cross, or null if parallel. */
  function segmentIntersection(a1, a2, b1, b2) {
    const r = sub(a2, a1);
    const s = sub(b2, b1);
    const denominator = cross(r, s);
    if (denominator === 0) return null;

    const t = cross(sub(b1, a1), s) / denominator;
    return add(a1, scale(r, t));
  }

  return {
    point: point,
    add: add,
    sub: sub,
    scale: scale,
    cross: cross,
    dot: dot,
    length: length,
    length2: length2,
    distance: distance,
    distance2: distance2,
    equal: equal,
    report: report,
    orient2d: orient2d,
    orient2dNaive: orient2dNaive,
    orient2dEpsilon: orient2dEpsilon,
    orient2dValue: orient2dValue,
    inCircle: inCircle,
    inCircleNaive: inCircleNaive,
    inCircleValue: inCircleValue,
    fartherFromLine: fartherFromLine,
    signedArea2: signedArea2,
    collinear: collinear,
    onSegment: onSegment,
    segmentsIntersect: segmentsIntersect,
    segmentIntersection: segmentIntersection,
    EPS: EPS
  };
}));
