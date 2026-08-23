/**
 * GeometryView - the scene renderer every M16 section draws through.
 *
 * Canvas rather than SVG: a Delaunay mesh over a few hundred points is a few
 * hundred triangles, a Voronoi diagram is a few hundred rings, and a scanline
 * fill is thousands of cells. One node per shape makes the page unusable
 * exactly when the picture starts being worth looking at.
 *
 * The renderer knows nothing about any particular algorithm. A caller hands it
 * layers - filled regions, rings, segments, points, circles, labels - and the
 * drawing order is fixed and is the whole reason this is one component:
 *
 *   fills, then construction lines, then rings, then segments, then points,
 *   then highlights, then labels.
 *
 * A section that draws its highlight before its points buries the thing the
 * reader is meant to look at, and the fix belongs here rather than in ten
 * section controllers.
 *
 * One mapping from world coordinates to pixels is shared by every layer, so a
 * circumcircle and the triangle that produced it cannot disagree about where
 * they are. Colours come from Palette, so a redraw after a theme change is
 * correct without the caller knowing which theme is on.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GeometryView = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const PADDING = 10;
  const POINT_LIMIT = 8000;
  const SHAPE_LIMIT = 6000;

  function palette() {
    return scope.Palette;
  }

  function surfaceFor(host, config) {
    return scope.CanvasSurface.create({
      host: host,
      height: config.height || 340,
      ariaLabel: config.ariaLabel || config.summary || 'geometry scene'
    });
  }

  /** The bounds every layer is measured against, padded so nothing clips. */
  function boundsOf(scene) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    function see(p) {
      if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') return;
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }

    (scene.fills || []).forEach(function (f) { (f.ring || []).forEach(see); });
    (scene.rings || []).forEach(function (r) { (r.points || r).forEach(see); });
    (scene.segments || []).forEach(function (s) { see(s.a); see(s.b); });
    (scene.points || []).forEach(function (p) { see(p.point || p); });
    (scene.circles || []).forEach(function (c) {
      see({ x: c.centre.x - c.radius, y: c.centre.y - c.radius });
      see({ x: c.centre.x + c.radius, y: c.centre.y + c.radius });
    });
    (scene.labels || []).forEach(function (l) { see(l.point || l); });

    if (minX === Infinity) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    if (minX === maxX) { minX -= 1; maxX += 1; }
    if (minY === maxY) { minY -= 1; maxY += 1; }
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }

  /** World to pixels, shared by every layer of one scene. */
  function projection(bounds, dims) {
    const width = Math.max(1e-9, bounds.maxX - bounds.minX);
    const height = Math.max(1e-9, bounds.maxY - bounds.minY);
    const scale = Math.min((dims.width - 2 * PADDING) / width, (dims.height - 2 * PADDING) / height);
    const offsetX = PADDING + ((dims.width - 2 * PADDING) - width * scale) / 2;
    const offsetY = PADDING + ((dims.height - 2 * PADDING) - height * scale) / 2;

    return {
      scale: scale,
      x: function (value) { return offsetX + (value - bounds.minX) * scale; },
      y: function (value) { return offsetY + (bounds.maxY - value) * scale; },
      length: function (value) { return value * scale; }
    };
  }

  /* Every colour resolves through Palette so a theme switch is correct without
     the caller knowing which theme is on. A named hue wins; otherwise a theme
     token, which is what an unlabelled line or point should use. No literal
     ever appears here - a colour written into a renderer is a colour that
     stays light when the page goes dark. */
  function colourOf(name, tokenName) {
    if (name) return palette().hue(name);
    return palette().token(tokenName || 'text-primary');
  }

  function ink(kind) {
    return palette().token(kind === 'muted' ? 'text-muted' : 'text-primary');
  }

  function tracePath(ctx, view, ring, close) {
    if (!ring.length) return;
    ctx.beginPath();
    ctx.moveTo(view.x(ring[0].x), view.y(ring[0].y));
    for (let i = 1; i < ring.length; i += 1) ctx.lineTo(view.x(ring[i].x), view.y(ring[i].y));
    if (close) ctx.closePath();
  }

  function drawFills(ctx, view, fills) {
    (fills || []).slice(0, SHAPE_LIMIT).forEach(function (fill) {
      const ring = fill.ring || [];
      if (ring.length < 3) return;
      tracePath(ctx, view, ring, true);
      ctx.globalAlpha = fill.alpha === undefined ? 0.18 : fill.alpha;
      ctx.fillStyle = colourOf(fill.hue, 'accent');
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  function drawRings(ctx, view, rings) {
    (rings || []).slice(0, SHAPE_LIMIT).forEach(function (entry) {
      const ring = entry.points || entry;
      if (!ring.length) return;
      tracePath(ctx, view, ring, entry.open !== true);
      ctx.lineWidth = entry.width || 1.5;
      ctx.strokeStyle = colourOf(entry.hue);
      if (entry.dashed) ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }

  function drawSegments(ctx, view, segments) {
    (segments || []).slice(0, SHAPE_LIMIT).forEach(function (s) {
      ctx.beginPath();
      ctx.moveTo(view.x(s.a.x), view.y(s.a.y));
      ctx.lineTo(view.x(s.b.x), view.y(s.b.y));
      ctx.lineWidth = s.width || 1.25;
      ctx.strokeStyle = colourOf(s.hue, 'text-muted');
      if (s.dashed) ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }

  function drawCircles(ctx, view, circles) {
    (circles || []).slice(0, SHAPE_LIMIT).forEach(function (c) {
      ctx.beginPath();
      ctx.arc(view.x(c.centre.x), view.y(c.centre.y), Math.max(0, view.length(c.radius)), 0, Math.PI * 2);
      ctx.lineWidth = c.width || 1;
      ctx.strokeStyle = colourOf(c.hue, 'text-muted');
      if (c.dashed !== false) ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }

  function drawPoints(ctx, view, points) {
    (points || []).slice(0, POINT_LIMIT).forEach(function (entry) {
      const p = entry.point || entry;
      const radius = entry.radius || 3;
      ctx.beginPath();
      ctx.arc(view.x(p.x), view.y(p.y), radius, 0, Math.PI * 2);
      ctx.fillStyle = colourOf(entry.hue, 'accent');
      ctx.fill();
      if (!entry.outline) return;
      ctx.lineWidth = 1;
      ctx.strokeStyle = ink('default');
      ctx.stroke();
    });
  }

  function drawLabels(ctx, view, labels) {
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    (labels || []).slice(0, 400).forEach(function (entry) {
      const p = entry.point || entry;
      ctx.fillStyle = colourOf(entry.hue);
      ctx.fillText(String(entry.text), view.x(p.x) + (entry.dx || 0), view.y(p.y) + (entry.dy || -9));
    });
  }

  /* Cells rather than shapes: the rasterisation section draws thousands of
     them and needs them filled by coverage rather than stroked. */
  function drawCells(ctx, view, cells, size) {
    const side = Math.max(1, view.length(size || 1));
    (cells || []).slice(0, POINT_LIMIT).forEach(function (cell) {
      ctx.globalAlpha = cell.coverage === undefined ? 1 : Math.max(0.06, cell.coverage);
      ctx.fillStyle = colourOf(cell.hue, 'accent');
      ctx.fillRect(view.x(cell.x), view.y(cell.y + 1), side, side);
    });
    ctx.globalAlpha = 1;
  }

  /**
   * Draw one scene. Every layer is optional; the ORDER is not, because it is
   * what keeps a highlight on top of the thing it highlights.
   */
  function render(host, scene) {
    if (!host) return null;
    const config = scene || {};
    const surface = surfaceFor(host, config);
    const bounds = config.bounds || boundsOf(config);

    surface.render(function (ctx, dims) {
      const view = projection(bounds, dims);
      drawCells(ctx, view, config.cells, config.cellSize);
      drawFills(ctx, view, config.fills);
      drawSegments(ctx, view, config.construction);
      drawCircles(ctx, view, config.circles);
      drawRings(ctx, view, config.rings);
      drawSegments(ctx, view, config.segments);
      drawPoints(ctx, view, config.points);
      drawPoints(ctx, view, config.highlights);
      drawLabels(ctx, view, config.labels);
    });
    return surface;
  }

  /** Triangles as rings, which is what every triangulation view wants. */
  function trianglesToRings(points, triangles, options) {
    const settings = options || {};
    return (triangles || []).map(function (t) {
      return { points: [points[t[0]], points[t[1]], points[t[2]]],
        hue: settings.hue, width: settings.width || 1 };
    });
  }

  /** A sweep line drawn as a full-height segment at x. */
  function sweepLineAt(x, bounds) {
    return { a: { x: x, y: bounds.minY }, b: { x: x, y: bounds.maxY }, dashed: true, width: 1.5 };
  }

  return {
    render: render,
    projection: projection,
    boundsOf: boundsOf,
    trianglesToRings: trianglesToRings,
    sweepLineAt: sweepLineAt,
    POINT_LIMIT: POINT_LIMIT,
    SHAPE_LIMIT: SHAPE_LIMIT
  };
}));
