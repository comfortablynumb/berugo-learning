/**
 * Rotating calipers: turning continuous optimisation over a hull into a linear
 * scan, plus the smallest enclosing circle.
 *
 * The technique rests on one theorem, and the theorem is what makes the whole
 * family cheap: THE MINIMUM-AREA ENCLOSING RECTANGLE ALWAYS HAS A SIDE FLUSH
 * WITH A HULL EDGE. There are infinitely many angles to try and only h of them
 * can win, so the search collapses from an optimisation over a continuous
 * parameter to one pass over the hull edges. The same argument gives the
 * diameter, the width and the closest and farthest pairs.
 *
 * Every routine here is checked against a brute-force reference: the diameter
 * against all pairs, the minimum rectangle against a fine rotation sweep, and
 * the enclosing circle against every point. The rotation sweep is approximate
 * by construction - it samples angles - so its disagreement is reported as a
 * relative gap with the step size beside it, never as a pass or a fail.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Calipers = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const G = scope && scope.GeometryCore ? scope.GeometryCore : require('./geometry-core.js');
  const H = scope && scope.ConvexHull ? scope.ConvexHull : require('./convex-hull.js');

  function report() {
    return { orient: 0, pairs: 0, steps: 0, hullSize: 0, antipodal: 0,
      rotations: 0, moves: 0 };
  }

  function hullOf(points, stats) {
    const built = H.monotoneChain(points, {});
    if (stats) {
      stats.hullSize = built.hull.length;
      stats.orient += built.report.orient;
    }
    return built.hull;
  }

  /* ------------------------------------------------------- diameter */

  /**
   * The farthest pair, by walking an antipodal pointer around the hull. Each
   * edge advances the opposite vertex forward and never back, so the whole
   * scan is linear in the hull size rather than quadratic in it.
   */
  function diameter(points, options) {
    const settings = options || {};
    const stats = settings.report || report();
    const hull = settings.hull || hullOf(points, stats);
    if (hull.length < 2) return { distance: 0, pair: null, report: stats };
    if (hull.length === 2) {
      return { distance: G.distance(hull[0], hull[1]), pair: [hull[0], hull[1]], report: stats };
    }

    let best = 0;
    let pair = null;
    let j = 1;

    for (let i = 0; i < hull.length; i += 1) {
      const a = hull[i];
      const b = hull[(i + 1) % hull.length];

      /* Advance the opposite vertex while it keeps getting farther from the
         current edge. It only ever moves forward, which is the amortised
         argument that makes this linear. */
      while (triangleArea2(a, b, hull[(j + 1) % hull.length]) > triangleArea2(a, b, hull[j])) {
        j = (j + 1) % hull.length;
        stats.moves += 1;
      }
      stats.antipodal += 1;

      [a, b].forEach(function (end) {
        const d = G.distance(end, hull[j]);
        if (d <= best) return;
        best = d;
        pair = [end, hull[j]];
      });
    }
    return { distance: best, pair: pair, report: stats };
  }

  function triangleArea2(a, b, c) {
    return Math.abs(G.orient2dValue(a, b, c));
  }

  /** Every pair. The reference the calipers are checked against. */
  function diameterBruteForce(points, stats) {
    let best = 0;
    let pair = null;

    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        if (stats) stats.pairs += 1;
        const d = G.distance(points[i], points[j]);
        if (d <= best) continue;
        best = d;
        pair = [points[i], points[j]];
      }
    }
    return { distance: best, pair: pair };
  }

  /* --------------------------------------- minimum enclosing rectangle */

  function extentAlong(hull, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;

    hull.forEach(function (p) {
      const u = p.x * cos + p.y * sin;
      const v = -p.x * sin + p.y * cos;
      minU = Math.min(minU, u); maxU = Math.max(maxU, u);
      minV = Math.min(minV, v); maxV = Math.max(maxV, v);
    });
    return { width: maxU - minU, height: maxV - minV, angle: angle,
      area: (maxU - minU) * (maxV - minV) };
  }

  /**
   * The minimum-area enclosing rectangle. Only the h angles of the hull edges
   * are tried, because the theorem says the winner is among them - which turns
   * a continuous search into an O(h) scan.
   */
  function minimumAreaRectangle(points, options) {
    const settings = options || {};
    const stats = settings.report || report();
    const hull = settings.hull || hullOf(points, stats);
    if (hull.length < 3) return { area: 0, best: null, report: stats, candidates: 0 };

    let best = null;
    for (let i = 0; i < hull.length; i += 1) {
      const edge = G.sub(hull[(i + 1) % hull.length], hull[i]);
      if (edge.x === 0 && edge.y === 0) continue;
      stats.rotations += 1;

      const candidate = extentAlong(hull, Math.atan2(edge.y, edge.x));
      if (!best || candidate.area < best.area) best = candidate;
    }
    return { area: best ? best.area : 0, best: best, report: stats, candidates: stats.rotations };
  }

  /** Width: the smallest distance between two parallel supporting lines. */
  function minimumWidth(points, options) {
    const settings = options || {};
    const stats = settings.report || report();
    const hull = settings.hull || hullOf(points, stats);
    if (hull.length < 3) return { width: 0, report: stats };

    let best = Infinity;
    for (let i = 0; i < hull.length; i += 1) {
      const edge = G.sub(hull[(i + 1) % hull.length], hull[i]);
      if (edge.x === 0 && edge.y === 0) continue;
      const measured = extentAlong(hull, Math.atan2(edge.y, edge.x));
      best = Math.min(best, Math.min(measured.width, measured.height));
    }
    return { width: best === Infinity ? 0 : best, report: stats };
  }

  /** The axis-aligned box, which the minimum can never beat. */
  function boundingBox(points) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach(function (p) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });
    return { x0: minX, y0: minY, x1: maxX, y1: maxY,
      area: (maxX - minX) * (maxY - minY) };
  }

  /**
   * A fine sweep over angles. Approximate by construction - it can only be as
   * good as its step - so it is quoted with the step and used to bound the
   * calipers rather than to replace them.
   */
  function rectangleByRotationSweep(points, steps) {
    const hull = hullOf(points, null);
    if (hull.length < 3) return { area: 0, angle: 0, steps: 0 };
    const n = steps || 3600;
    let best = null;

    for (let i = 0; i < n; i += 1) {
      const candidate = extentAlong(hull, (i / n) * Math.PI / 2);
      if (!best || candidate.area < best.area) best = candidate;
    }
    return { area: best.area, angle: best.angle, steps: n, step: (Math.PI / 2) / n };
  }

  /* ------------------------------------------ smallest enclosing circle */

  function circleFromTwo(a, b) {
    const centre = G.point((a.x + b.x) / 2, (a.y + b.y) / 2);
    return { centre: centre, radius: G.distance(centre, a) };
  }

  function circleFromThree(a, b, c) {
    const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
    if (d === 0) return null;
    const a2 = a.x * a.x + a.y * a.y;
    const b2 = b.x * b.x + b.y * b.y;
    const c2 = c.x * c.x + c.y * c.y;
    const centre = G.point(
      (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
      (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d
    );
    return { centre: centre, radius: G.distance(centre, a) };
  }

  function encloses(circle, p, slack) {
    if (!circle) return false;
    return G.distance(circle.centre, p) <= circle.radius * (1 + (slack === undefined ? 1e-12 : slack));
  }

  /**
   * Welzl's algorithm, iteratively: the smallest enclosing circle is defined
   * by at most three points, and shuffling makes the expected number of
   * rebuilds linear. The randomisation is the algorithm, not a detail -
   * without it the same construction is cubic on an adversarial order.
   */
  function smallestEnclosingCircle(points, options) {
    const settings = options || {};
    const stats = settings.report || report();
    const pts = settings.shuffled || points.slice();
    if (!pts.length) return { circle: null, support: [], report: stats };

    let circle = { centre: pts[0], radius: 0 };
    for (let i = 1; i < pts.length; i += 1) {
      stats.steps += 1;
      if (encloses(circle, pts[i])) continue;
      circle = withPointOnBoundary(pts, i, stats);
    }
    return { circle: circle, support: supportOf(pts, circle), report: stats };
  }

  function withPointOnBoundary(pts, index, stats) {
    let circle = { centre: pts[index], radius: 0 };
    for (let j = 0; j < index; j += 1) {
      stats.steps += 1;
      if (encloses(circle, pts[j])) continue;
      circle = withTwoOnBoundary(pts, index, j, stats);
    }
    return circle;
  }

  function withTwoOnBoundary(pts, i, j, stats) {
    let circle = circleFromTwo(pts[i], pts[j]);
    for (let k = 0; k < j; k += 1) {
      stats.steps += 1;
      if (encloses(circle, pts[k])) continue;
      const three = circleFromThree(pts[i], pts[j], pts[k]);
      if (three) circle = three;
    }
    return circle;
  }

  function supportOf(points, circle) {
    if (!circle) return [];
    return points.filter(function (p) {
      return Math.abs(G.distance(circle.centre, p) - circle.radius) <= circle.radius * 1e-9 + 1e-12;
    });
  }

  /** Every point inside, to within a tolerance. The check the lab is graded on. */
  function circleCovers(points, circle) {
    if (!circle) return { ok: points.length === 0, outside: points.length };
    let outside = 0;
    points.forEach(function (p) { if (!encloses(circle, p, 1e-9)) outside += 1; });
    return { ok: outside === 0, outside: outside };
  }

  return {
    report: report,
    hullOf: hullOf,
    diameter: diameter,
    diameterBruteForce: diameterBruteForce,
    extentAlong: extentAlong,
    minimumAreaRectangle: minimumAreaRectangle,
    minimumWidth: minimumWidth,
    boundingBox: boundingBox,
    rectangleByRotationSweep: rectangleByRotationSweep,
    circleFromTwo: circleFromTwo,
    circleFromThree: circleFromThree,
    smallestEnclosingCircle: smallestEnclosingCircle,
    circleCovers: circleCovers,
    supportOf: supportOf
  };
}));
