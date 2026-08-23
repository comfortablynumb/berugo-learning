/**
 * Polygons: area, orientation, convexity, containment, simplification and
 * self-intersection.
 *
 * Every routine here goes through `geometry-core`'s orientation predicate
 * rather than comparing floating-point values itself, which is what makes the
 * boundary cases answerable at all. The interesting content of this file is
 * not the shoelace formula - it is that ray casting and the winding number
 * DISAGREE on a self-intersecting polygon, and that which one is "right"
 * depends on a fill rule the polygon itself does not carry. GIS chose one and
 * SVG chose the other, and code that assumes there is a single answer breaks
 * when it meets the other convention.
 *
 * Containment returns 'in', 'out' or 'boundary'. Collapsing 'boundary' into
 * either of the other two is a decision, and making it silently is how two
 * adjacent polygons come to disagree about who owns the edge between them -
 * a point on a shared edge belonging to both, or to neither.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Polygon = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const G = scope && scope.GeometryCore ? scope.GeometryCore : require('./geometry-core.js');

  const IN = 'in';
  const OUT = 'out';
  const BOUNDARY = 'boundary';

  function at(ring, i) {
    return ring[((i % ring.length) + ring.length) % ring.length];
  }

  /**
   * Twice the signed area. Positive when the ring is counter-clockwise. The
   * doubling is deliberate: it keeps the value an integer for integer
   * coordinates, so an area comparison stays exact.
   */
  function signedArea2(ring) {
    let total = 0;
    for (let i = 0; i < ring.length; i += 1) {
      const a = ring[i];
      const b = at(ring, i + 1);
      total += a.x * b.y - b.x * a.y;
    }
    return total;
  }

  function area(ring) {
    return Math.abs(signedArea2(ring)) / 2;
  }

  function isCounterClockwise(ring) {
    return signedArea2(ring) > 0;
  }

  function perimeter(ring) {
    let total = 0;
    for (let i = 0; i < ring.length; i += 1) total += G.distance(ring[i], at(ring, i + 1));
    return total;
  }

  function centroid(ring) {
    const twice = signedArea2(ring);
    if (twice === 0) return null;
    let cx = 0;
    let cy = 0;

    for (let i = 0; i < ring.length; i += 1) {
      const a = ring[i];
      const b = at(ring, i + 1);
      const w = a.x * b.y - b.x * a.y;
      cx += (a.x + b.x) * w;
      cy += (a.y + b.y) * w;
    }
    return G.point(cx / (3 * twice), cy / (3 * twice));
  }

  /**
   * How many complete turns the ring makes as you walk it, as a signed count.
   * A simple polygon turns exactly once; a pentagram turns twice.
   */
  function turningNumber(ring) {
    if (ring.length < 3) return 0;
    let total = 0;

    for (let i = 0; i < ring.length; i += 1) {
      const into = G.sub(at(ring, i + 1), at(ring, i));
      const outOf = G.sub(at(ring, i + 2), at(ring, i + 1));
      total += Math.atan2(G.cross(into, outOf), G.dot(into, outOf));
    }
    return Math.round(total / (2 * Math.PI));
  }

  /**
   * Convex when every turn has the same sign AND the ring closes after exactly
   * one full turn.
   *
   * The sign test alone is the familiar one and it is not enough: a pentagram
   * turns the same way at all five vertices and is emphatically not convex -
   * it goes round twice. Testing only the signs reported the pentagram as
   * convex, which is how a self-intersecting star ends up handed to a routine
   * that assumes convexity and quietly produces nonsense.
   */
  function isConvex(ring, stats) {
    if (ring.length < 3) return false;
    let seen = 0;

    for (let i = 0; i < ring.length; i += 1) {
      const turn = G.orient2d(at(ring, i), at(ring, i + 1), at(ring, i + 2), stats);
      if (turn === 0) continue;
      if (seen === 0) seen = turn;
      else if (turn !== seen) return false;
    }
    return seen !== 0 && Math.abs(turningNumber(ring)) === 1;
  }

  /** Is the point exactly on one of the ring's edges? */
  function onBoundary(ring, p, stats) {
    for (let i = 0; i < ring.length; i += 1) {
      if (G.onSegment(at(ring, i), at(ring, i + 1), p, stats)) return true;
    }
    return false;
  }

  /**
   * Ray casting: shoot a ray in +x and count crossings, odd meaning inside.
   * The half-open rule on the y-comparison - one endpoint counted, the other
   * not - is what stops a vertex the ray grazes being counted twice, which is
   * the classic source of a point flickering in and out along a horizontal.
   */
  function rayCasting(ring, p, stats) {
    if (onBoundary(ring, p, stats)) return { result: BOUNDARY, crossings: 0 };
    let crossings = 0;

    for (let i = 0; i < ring.length; i += 1) {
      const a = at(ring, i);
      const b = at(ring, i + 1);
      if ((a.y > p.y) === (b.y > p.y)) continue;

      const t = (p.y - a.y) / (b.y - a.y);
      if (p.x < a.x + t * (b.x - a.x)) crossings += 1;
    }
    return { result: crossings % 2 === 1 ? IN : OUT, crossings: crossings };
  }

  /**
   * Winding number: how many times the ring travels around the point. Non-zero
   * means inside under the non-zero fill rule, which is what SVG's default and
   * most GIS libraries use - and which differs from ray casting exactly on the
   * self-overlapping parts of a self-intersecting polygon.
   */
  function windingNumber(ring, p, stats) {
    if (onBoundary(ring, p, stats)) return { result: BOUNDARY, winding: 0 };
    let winding = 0;

    for (let i = 0; i < ring.length; i += 1) {
      const a = at(ring, i);
      const b = at(ring, i + 1);

      if (a.y <= p.y) {
        if (b.y > p.y && G.orient2d(a, b, p, stats) > 0) winding += 1;
      } else if (b.y <= p.y && G.orient2d(a, b, p, stats) < 0) winding -= 1;
    }
    return { result: winding !== 0 ? IN : OUT, winding: winding };
  }

  /** Both tests on one point, with a flag for whether they agreed. */
  function contains(ring, p, stats) {
    const ray = rayCasting(ring, p, stats);
    const wind = windingNumber(ring, p, stats);
    return {
      ray: ray.result,
      winding: wind.result,
      crossings: ray.crossings,
      windingCount: wind.winding,
      agree: ray.result === wind.result
    };
  }

  /**
   * Every pair of non-adjacent edges tested. Quadratic and exact, which is
   * what a sweep is checked against in 16.4.
   */
  function selfIntersections(ring, stats) {
    const hits = [];
    const n = ring.length;

    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        const adjacent = j === i + 1 || (i === 0 && j === n - 1);
        if (adjacent) continue;
        if (!G.segmentsIntersect(at(ring, i), at(ring, i + 1), at(ring, j), at(ring, j + 1), stats)) continue;
        hits.push({ a: i, b: j });
      }
    }
    return hits;
  }

  function isSimple(ring, stats) {
    return selfIntersections(ring, stats).length === 0;
  }

  /** Perpendicular distance from p to the line through a and b. */
  function pointLineDistance(p, a, b) {
    const span = G.sub(b, a);
    const len = G.length(span);
    if (len === 0) return G.distance(p, a);
    return Math.abs(G.cross(span, G.sub(p, a))) / len;
  }

  function douglasPeuckerRange(points, first, last, tolerance, keep) {
    let worst = 0;
    let index = -1;

    for (let i = first + 1; i < last; i += 1) {
      const d = pointLineDistance(points[i], points[first], points[last]);
      if (d <= worst) continue;
      worst = d;
      index = i;
    }

    if (worst <= tolerance || index < 0) return;
    keep[index] = true;
    douglasPeuckerRange(points, first, index, tolerance, keep);
    douglasPeuckerRange(points, index, last, tolerance, keep);
  }

  /**
   * Douglas-Peucker keeps whatever is furthest from the current chord, so it
   * preserves spikes and can move the line anywhere within the tolerance.
   */
  function douglasPeucker(points, tolerance) {
    if (points.length <= 2) return points.slice();
    const keep = new Array(points.length).fill(false);
    keep[0] = true;
    keep[points.length - 1] = true;
    douglasPeuckerRange(points, 0, points.length - 1, tolerance, keep);
    return points.filter(function (p, i) { return keep[i]; });
  }

  /**
   * Visvalingam removes the vertex whose triangle with its neighbours has the
   * smallest area, repeatedly. It gives up spikes before it gives up shape,
   * which is why cartographers prefer it and why it is the wrong choice when
   * the spikes are the data.
   */
  function visvalingam(points, keepCount) {
    if (points.length <= 2 || keepCount >= points.length) return points.slice();
    const live = points.map(function (p, i) { return i; });

    while (live.length > Math.max(2, keepCount)) {
      let smallest = Infinity;
      let victim = -1;

      for (let k = 1; k < live.length - 1; k += 1) {
        const t = Math.abs(G.orient2dValue(points[live[k - 1]], points[live[k]], points[live[k + 1]])) / 2;
        if (t >= smallest) continue;
        smallest = t;
        victim = k;
      }
      if (victim < 0) break;
      live.splice(victim, 1);
    }
    return live.map(function (i) { return points[i]; });
  }

  return {
    IN: IN,
    OUT: OUT,
    BOUNDARY: BOUNDARY,
    at: at,
    signedArea2: signedArea2,
    area: area,
    perimeter: perimeter,
    centroid: centroid,
    isCounterClockwise: isCounterClockwise,
    turningNumber: turningNumber,
    isConvex: isConvex,
    onBoundary: onBoundary,
    rayCasting: rayCasting,
    windingNumber: windingNumber,
    contains: contains,
    selfIntersections: selfIntersections,
    isSimple: isSimple,
    pointLineDistance: pointLineDistance,
    douglasPeucker: douglasPeucker,
    visvalingam: visvalingam
  };
}));
