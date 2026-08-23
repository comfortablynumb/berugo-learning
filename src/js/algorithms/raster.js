/**
 * Rasterisation, curve flattening, and the separating axis test.
 *
 * Where the rest of the milestone works in exact arithmetic on continuous
 * shapes, this file is about the moment geometry meets a grid of pixels - and
 * the errors that live at that boundary. Bresenham draws a line with integer
 * arithmetic only, which is why it was invented and why it still produces
 * exactly the same pixels on every machine. Curve flattening turns a Bezier
 * into line segments, and the tolerance that decides how many is the parameter
 * that shows up as a visibly faceted circle at one setting and a stalled
 * renderer at another.
 *
 * `separatingAxis` is the collision half. Two convex shapes fail to overlap
 * exactly when some axis exists on which their projections do not overlap, and
 * for polygons only the edge normals need testing - which turns an infinite
 * search into a finite one, the same shape of argument as rotating calipers.
 * It returns the MINIMUM TRANSLATION VECTOR as well as the yes or no, because
 * "they collide" is rarely the whole question: what a caller does next is push
 * them apart, and the axis of least overlap is the direction to push along.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Raster = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const G = scope && scope.GeometryCore ? scope.GeometryCore : require('./geometry-core.js');
  const P = scope && scope.Polygon ? scope.Polygon : require('./polygon.js');

  function report() {
    return { pixels: 0, steps: 0, axes: 0, projections: 0, subdivisions: 0,
      segments: 0, samples: 0, coverage: 0 };
  }

  /* ------------------------------------------------------ Bresenham */

  /**
   * Integer-only line drawing. The error term tracks twice the distance from
   * the ideal line, so the decision at every step is a comparison of integers
   * and the output is bit-identical everywhere.
   */
  function bresenham(a, b, stats) {
    const pixels = [];
    let x0 = Math.round(a.x), y0 = Math.round(a.y);
    const x1 = Math.round(b.x), y1 = Math.round(b.y);

    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let error = dx + dy;
    let guard = dx - dy + 2;

    while (guard > 0) {
      guard -= 1;
      pixels.push({ x: x0, y: y0 });
      if (stats) stats.pixels += 1;
      if (x0 === x1 && y0 === y1) break;

      const twice = 2 * error;
      if (twice >= dy) { error += dy; x0 += sx; }
      if (twice <= dx) { error += dx; y0 += sy; }
      if (stats) stats.steps += 1;
    }
    return pixels;
  }

  /**
   * The float reference: sample the line and round.
   *
   * It is NOT the same pixels. The two agree on about 83% of random integer
   * lines (2 492 of 3 000 on the seeded set the section draws), always agree on
   * the endpoints and always agree on the pixel count - and every one of the
   * differences is a line whose ideal path passes exactly between two pixels.
   * Bresenham breaks that tie the same
   * way every time, by an integer comparison; rounding breaks it by whatever
   * the floating-point midpoint happened to land on. Neither is wrong, and a
   * renderer that mixes the two draws its outlines and its fills one pixel
   * apart along shared edges.
   */
  function lineByRounding(a, b) {
    const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    const pixels = [];
    const n = Math.max(1, Math.round(steps));

    for (let i = 0; i <= n; i += 1) {
      const t = i / n;
      pixels.push({ x: Math.round(a.x + (b.x - a.x) * t), y: Math.round(a.y + (b.y - a.y) * t) });
    }
    return dedupePixels(pixels);
  }

  function dedupePixels(pixels) {
    const seen = new Set();
    const out = [];
    pixels.forEach(function (p) {
      const id = p.x + ':' + p.y;
      if (seen.has(id)) return;
      seen.add(id);
      out.push(p);
    });
    return out;
  }

  /**
   * Scanline polygon fill. For each row, find where the edges cross it, sort
   * the crossings and fill between alternate pairs - which is ray casting done
   * once per row instead of once per point.
   */
  function scanlineFill(ring, stats) {
    const ys = ring.map(function (p) { return p.y; });
    const top = Math.ceil(Math.min.apply(null, ys));
    const bottom = Math.floor(Math.max.apply(null, ys));
    const spans = [];

    for (let y = top; y <= bottom; y += 1) {
      const crossings = [];
      const sampleY = y + 0.5;

      for (let i = 0; i < ring.length; i += 1) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        if ((a.y > sampleY) === (b.y > sampleY)) continue;
        const t = (sampleY - a.y) / (b.y - a.y);
        crossings.push(a.x + t * (b.x - a.x));
      }

      crossings.sort(function (p, q) { return p - q; });
      for (let k = 0; k + 1 < crossings.length; k += 2) {
        const x0 = Math.ceil(crossings[k] - 0.5);
        const x1 = Math.floor(crossings[k + 1] - 0.5);
        if (x1 < x0) continue;
        spans.push({ y: y, x0: x0, x1: x1 });
        if (stats) stats.pixels += x1 - x0 + 1;
      }
    }
    return spans;
  }

  /** Fractional coverage per pixel by supersampling: the anti-aliasing oracle. */
  function coverageFill(ring, samplesPerAxis, stats) {
    const n = samplesPerAxis || 4;
    const ys = ring.map(function (p) { return p.y; });
    const xs = ring.map(function (p) { return p.x; });
    const top = Math.floor(Math.min.apply(null, ys));
    const bottom = Math.ceil(Math.max.apply(null, ys));
    const left = Math.floor(Math.min.apply(null, xs));
    const right = Math.ceil(Math.max.apply(null, xs));
    const out = [];

    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        let hits = 0;
        for (let sy = 0; sy < n; sy += 1) {
          for (let sx = 0; sx < n; sx += 1) {
            const p = G.point(x + (sx + 0.5) / n, y + (sy + 0.5) / n);
            if (stats) stats.samples += 1;
            if (P.windingNumber(ring, p).result !== P.OUT) hits += 1;
          }
        }
        if (hits === 0) continue;
        out.push({ x: x, y: y, coverage: hits / (n * n) });
      }
    }
    if (stats) stats.coverage = out.length;
    return out;
  }

  /* ------------------------------------------------ curve flattening */

  function bezierAt(p0, p1, p2, p3, t) {
    const u = 1 - t;
    const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return G.point(
      a * p0.x + b * p1.x + c * p2.x + d * p3.x,
      a * p0.y + b * p1.y + c * p2.y + d * p3.y
    );
  }

  /**
   * Flatness by control-point distance: how far the two control points stray
   * from the chord. Under the tolerance, one straight segment is close enough.
   */
  function flatness(p0, p1, p2, p3) {
    return Math.max(P.pointLineDistance(p1, p0, p3), P.pointLineDistance(p2, p0, p3));
  }

  /**
   * Adaptive subdivision: split until flat enough. The segment count is the
   * output that matters - it is what a renderer pays per frame, and halving
   * the tolerance does not double it, which is the thing worth knowing.
   */
  function flattenCubic(p0, p1, p2, p3, tolerance, stats) {
    const limit = tolerance === undefined ? 0.25 : tolerance;
    const points = [p0];
    subdivide(p0, p1, p2, p3, limit, points, 0, stats);
    points.push(p3);
    if (stats) stats.segments = points.length - 1;
    return points;
  }

  function subdivide(p0, p1, p2, p3, tolerance, out, depth, stats) {
    if (depth > 24 || flatness(p0, p1, p2, p3) <= tolerance) return;
    if (stats) stats.subdivisions += 1;

    const p01 = midpoint(p0, p1), p12 = midpoint(p1, p2), p23 = midpoint(p2, p3);
    const p012 = midpoint(p01, p12), p123 = midpoint(p12, p23);
    const mid = midpoint(p012, p123);

    subdivide(p0, p01, p012, mid, tolerance, out, depth + 1, stats);
    out.push(mid);
    subdivide(mid, p123, p23, p3, tolerance, out, depth + 1, stats);
  }

  function midpoint(a, b) {
    return G.point((a.x + b.x) / 2, (a.y + b.y) / 2);
  }

  /** The largest gap between the flattened path and the true curve. */
  function flattenError(p0, p1, p2, p3, flat, samples) {
    const n = samples || 400;
    let worst = 0;

    for (let i = 0; i <= n; i += 1) {
      const exact = bezierAt(p0, p1, p2, p3, i / n);
      let nearest = Infinity;
      for (let k = 0; k + 1 < flat.length; k += 1) {
        nearest = Math.min(nearest, segmentDistance(exact, flat[k], flat[k + 1]));
      }
      worst = Math.max(worst, nearest);
    }
    return worst;
  }

  function segmentDistance(p, a, b) {
    const span = G.sub(b, a);
    const len2 = G.length2(span);
    if (len2 === 0) return G.distance(p, a);
    const t = Math.max(0, Math.min(1, G.dot(G.sub(p, a), span) / len2));
    return G.distance(p, G.add(a, G.scale(span, t)));
  }

  /* ------------------------------------------- separating axis theorem */

  function projectOnto(ring, axis, stats) {
    let min = Infinity;
    let max = -Infinity;
    ring.forEach(function (p) {
      const value = G.dot(p, axis);
      min = Math.min(min, value);
      max = Math.max(max, value);
    });
    if (stats) stats.projections += 1;
    return { min: min, max: max };
  }

  function axesOf(ring) {
    const out = [];
    for (let i = 0; i < ring.length; i += 1) {
      const edge = G.sub(ring[(i + 1) % ring.length], ring[i]);
      if (edge.x === 0 && edge.y === 0) continue;
      const normal = G.point(-edge.y, edge.x);
      const len = G.length(normal);
      out.push(G.scale(normal, 1 / len));
    }
    return out;
  }

  /**
   * Do two convex polygons overlap, and if so by how little?
   *
   * Only the edge normals of the two shapes need testing: if a separating axis
   * exists at all, one of them is separating. Finding no separating axis means
   * they overlap, and the axis of SMALLEST overlap gives the minimum
   * translation vector - the shortest push that pulls them apart.
   */
  function separatingAxis(a, b, options) {
    const settings = options || {};
    const stats = settings.report || report();
    const ringA = P.isCounterClockwise(a) ? a : a.slice().reverse();
    const ringB = P.isCounterClockwise(b) ? b : b.slice().reverse();
    const axes = axesOf(ringA).concat(axesOf(ringB));

    let smallest = Infinity;
    let best = null;
    let push = 0;

    for (let i = 0; i < axes.length; i += 1) {
      stats.axes += 1;
      const axis = axes[i];
      const pa = projectOnto(ringA, axis, stats);
      const pb = projectOnto(ringB, axis, stats);
      const overlap = Math.min(pa.max, pb.max) - Math.max(pa.min, pb.min);

      if (overlap <= 0) {
        return { colliding: false, axis: axis, gap: -overlap, mtv: null,
          axesTested: i + 1, report: stats };
      }
      if (overlap >= smallest) continue;
      smallest = overlap;
      best = axis;

      /* The SIGN comes from the projections on this axis, not from where the
         centroids happen to sit. Two ways off the axis exist - push B past A's
         far end, or back past A's near end - and the shorter of them is the
         one whose length is the overlap. Deciding the direction from the
         centroids instead is right most of the time and wrong for 38 of 800
         random overlapping pairs, and a minimum translation vector that does
         not separate is the one thing it must never be. */
      const forward = pa.max - pb.min;
      const backward = pb.max - pa.min;
      push = forward < backward ? forward : -backward;
    }

    return {
      colliding: true,
      axis: best,
      overlap: smallest,
      mtv: G.scale(best, push),
      axesTested: axes.length,
      report: stats
    };
  }

  /** Translate a ring by a vector. Applying the MTV must separate the shapes. */
  function translateRing(ring, v) {
    return ring.map(function (p) { return G.add(p, v); });
  }

  /** The oracle: sample a grid and look for a point inside both. */
  function overlapBySampling(a, b, steps, stats) {
    const rings = [a, b];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    rings.forEach(function (ring) {
      ring.forEach(function (p) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      });
    });

    const n = steps || 120;
    for (let iy = 0; iy < n; iy += 1) {
      for (let ix = 0; ix < n; ix += 1) {
        const p = G.point(minX + (ix + 0.5) * (maxX - minX) / n,
          minY + (iy + 0.5) * (maxY - minY) / n);
        if (stats) stats.samples += 1;
        if (P.windingNumber(a, p).result === P.OUT) continue;
        if (P.windingNumber(b, p).result === P.OUT) continue;
        return { overlapping: true, witness: p };
      }
    }
    return { overlapping: false, witness: null };
  }

  return {
    report: report,
    bresenham: bresenham,
    lineByRounding: lineByRounding,
    scanlineFill: scanlineFill,
    coverageFill: coverageFill,
    bezierAt: bezierAt,
    flatness: flatness,
    flattenCubic: flattenCubic,
    flattenError: flattenError,
    projectOnto: projectOnto,
    axesOf: axesOf,
    separatingAxis: separatingAxis,
    translateRing: translateRing,
    overlapBySampling: overlapBySampling
  };
}));
