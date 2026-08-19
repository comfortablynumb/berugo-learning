/**
 * SpatialView - the partition structure drawn over the data it partitions.
 *
 * Canvas rather than SVG, because the interesting cases here are thousands of
 * points and thousands of node boxes at once and an SVG node per box makes the
 * page unusable exactly when the picture becomes worth looking at.
 *
 * The renderer knows nothing about any particular index. A caller hands it
 * boxes (grid cells, quadtree nodes, MBRs, BVH bounds), segments (k-d
 * splitting planes), points and a query shape, and the drawing order is fixed:
 * partition, then scanned cells, then points, then results, then the query.
 * That order is the whole reason this is one component - a section that draws
 * the query first buries it under ten thousand points.
 *
 * Three entry points, because M08 has three shapes to show:
 *   `render`  a partition over points, with a query and its scanned region
 *   `curve`   a space-filling curve over a grid, with decomposed ranges
 *   `graph`   a proximity graph with links, for HNSW's layers
 *
 * Colours come from Palette, so a redraw after a theme change is correct
 * without the caller knowing which theme is on.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SpatialView = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const PADDING = 6;
  const POINT_LIMIT = 12000;
  const BOX_LIMIT = 6000;

  function palette() {
    return scope.Palette;
  }

  function surfaceFor(host, config) {
    return scope.CanvasSurface.create({
      host: host,
      height: config.height || 320,
      ariaLabel: config.ariaLabel || config.summary || 'spatial index view'
    });
  }

  /** One mapping from world coordinates to pixels, shared by every layer, so
   *  a box and the points inside it cannot disagree about where they are. */
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

  function summarise(host, text) {
    if (!text || !host.parentNode) return;
    let node = host.parentNode.querySelector('.viz-summary');
    if (!node) {
      node = document.createElement('p');
      node.className = 'viz-summary';
      host.parentNode.appendChild(node);
    }
    node.textContent = text;
  }

  function drawBoxes(ctx, project, boxes, style) {
    ctx.lineWidth = style.width || 1;
    ctx.strokeStyle = style.stroke;
    boxes.slice(0, BOX_LIMIT).forEach(function (box) {
      const x = project.x(box.minX);
      const y = project.y(box.maxY);
      const w = project.length(box.maxX - box.minX);
      const h = project.length(box.maxY - box.minY);
      if (style.fill) { ctx.fillStyle = style.fill; ctx.fillRect(x, y, w, h); }
      ctx.strokeRect(x, y, w, h);
    });
  }

  function drawPoints(ctx, project, points, style) {
    ctx.fillStyle = style.fill;
    const radius = style.radius || 1.6;
    points.slice(0, POINT_LIMIT).forEach(function (point) {
      ctx.beginPath();
      ctx.arc(project.x(point.x), project.y(point.y), radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawSegments(ctx, project, segments, style) {
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = style.width || 1;
    ctx.beginPath();
    segments.slice(0, BOX_LIMIT).forEach(function (segment) {
      ctx.moveTo(project.x(segment.x1), project.y(segment.y1));
      ctx.lineTo(project.x(segment.x2), project.y(segment.y2));
    });
    ctx.stroke();
  }

  function drawQuery(ctx, project, query, colour) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2;
    if (query.kind === 'circle') {
      ctx.beginPath();
      ctx.arc(project.x(query.x), project.y(query.y), project.length(query.r), 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    ctx.strokeRect(
      project.x(query.minX), project.y(query.maxY),
      project.length(query.maxX - query.minX), project.length(query.maxY - query.minY)
    );
  }

  /**
   * A thousand quadtree nodes want the faintest stroke that still reads as a
   * subdivision; a dozen R-tree bounding rectangles over the same points want
   * the strongest, or they vanish into the data they are supposed to explain.
   * One dial rather than two components.
   */
  function boxStyle(colours, tone) {
    if (tone === 'strong') return { stroke: colours.hue('teal'), width: 2 };
    return { stroke: colours.token('border-color'), width: 1 };
  }

  function paintLayers(ctx, project, config) {
    const colours = palette();
    if (config.scanned) {
      drawBoxes(ctx, project, config.scanned, { stroke: colours.hue('amber'), fill: colours.soft('amber') });
    }
    if (config.boxes) {
      drawBoxes(ctx, project, config.boxes, boxStyle(colours, config.boxTone));
    }
    if (config.segments) {
      drawSegments(ctx, project, config.segments, { stroke: colours.hue('purple') });
    }
    if (config.points) {
      drawPoints(ctx, project, config.points, { fill: colours.hue('gray'), radius: config.pointRadius });
    }
    if (config.results) {
      drawPoints(ctx, project, config.results, { fill: colours.hue('blue'), radius: (config.pointRadius || 1.6) + 1.4 });
    }
    if (config.query) {
      drawQuery(ctx, project, config.query, colours.hue('orange'));
    }
  }

  function render(host, config) {
    const surface = surfaceFor(host, config);
    let current = config;

    function paint(ctx, dims) {
      const project = projection(current.bounds, dims);
      ctx.fillStyle = palette().token('surface-sunken');
      ctx.fillRect(0, 0, dims.width, dims.height);
      paintLayers(ctx, project, current);
    }

    surface.render(paint);
    summarise(host, config.summary);

    return {
      redraw: function () { return surface.redraw(); },
      update: function (next) { current = Object.assign({}, current, next); summarise(host, current.summary); return surface.redraw(); },
      destroy: function () { surface.destroy(); }
    };
  }

  /* ------------------------------------------------------------- curves */

  function drawPath(ctx, project, cells, colour) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    cells.forEach(function (cell, index) {
      const x = project.x(cell.x + 0.5);
      const y = project.y(cell.y + 0.5);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  /**
   * The curve over its grid, with the query rectangle drawn on top and the
   * cells a range decomposition would actually scan shaded. The cells outside
   * the rectangle that still get shaded are the false positives, and being
   * able to point at them is the reason the picture exists.
   */
  function curve(host, config) {
    const surface = surfaceFor(host, config);
    let current = config;

    function paint(ctx, dims) {
      const side = current.side;
      const project = projection({ minX: 0, minY: 0, maxX: side, maxY: side }, dims);
      const colours = palette();
      ctx.fillStyle = colours.token('surface-sunken');
      ctx.fillRect(0, 0, dims.width, dims.height);

      /* The shading goes *over* the curve, half transparent. Underneath it the
         curve at order 6 is dense enough to swallow the tint entirely, and the
         cells a scan reads outside the rectangle are the whole point of the
         picture. */
      drawGrid(ctx, project, side, colours.token('border-color'));
      drawPath(ctx, project, current.cells, colours.hue('purple'));
      ctx.globalAlpha = 0.5;
      shadeCells(ctx, project, current.scanned || [], colours.hue('amber'));
      shadeCells(ctx, project, current.wanted || [], colours.hue('blue'));
      ctx.globalAlpha = 1;
      if (current.rect) {
        drawQuery(ctx, project, Object.assign({ kind: 'rect' }, current.rect), colours.hue('orange'));
      }
    }

    surface.render(paint);
    summarise(host, config.summary);

    return {
      redraw: function () { return surface.redraw(); },
      update: function (next) { current = Object.assign({}, current, next); summarise(host, current.summary); return surface.redraw(); },
      destroy: function () { surface.destroy(); }
    };
  }

  function shadeCells(ctx, project, cells, colour) {
    ctx.fillStyle = colour;
    cells.slice(0, BOX_LIMIT).forEach(function (cell) {
      ctx.fillRect(project.x(cell.x), project.y(cell.y + 1), project.length(1), project.length(1));
    });
  }

  function drawGrid(ctx, project, side, colour) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let i = 0; i <= side; i += 1) {
      ctx.moveTo(project.x(i), project.y(0));
      ctx.lineTo(project.x(i), project.y(side));
      ctx.moveTo(project.x(0), project.y(i));
      ctx.lineTo(project.x(side), project.y(i));
    }
    ctx.stroke();
  }

  /* -------------------------------------------------------------- graph */

  /**
   * A proximity graph: nodes at their first two coordinates, links as lines.
   * The caption has to say that the projection is two coordinates of many,
   * because a link that looks long in the picture may be short in the space.
   */
  function graph(host, config) {
    const surface = surfaceFor(host, config);
    let current = config;

    function paint(ctx, dims) {
      const project = projection(current.bounds, dims);
      const colours = palette();
      const byId = new Map();
      current.nodes.forEach(function (node) { byId.set(node.id, node); });

      ctx.fillStyle = colours.token('surface-sunken');
      ctx.fillRect(0, 0, dims.width, dims.height);
      drawLinks(ctx, project, { nodes: current.nodes, byId: byId }, colours.token('border-strong'));
      drawPoints(ctx, project, current.nodes, { fill: colours.hue('blue'), radius: 2.6 });
      if (current.path) drawPathNodes(ctx, project, current.path, colours.hue('orange'));
    }

    surface.render(paint);
    summarise(host, config.summary);

    return {
      redraw: function () { return surface.redraw(); },
      update: function (next) { current = Object.assign({}, current, next); summarise(host, current.summary); return surface.redraw(); },
      destroy: function () { surface.destroy(); }
    };
  }

  function drawLinks(ctx, project, state, colour) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    state.nodes.forEach(function (node) {
      node.links.forEach(function (id) {
        const other = state.byId.get(id);
        if (!other) return;
        ctx.moveTo(project.x(node.x), project.y(node.y));
        ctx.lineTo(project.x(other.x), project.y(other.y));
      });
    });
    ctx.stroke();
  }

  function drawPathNodes(ctx, project, nodes, colour) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2;
    ctx.beginPath();
    nodes.forEach(function (node, index) {
      const x = project.x(node.x);
      const y = project.y(node.y);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    drawPoints(ctx, project, nodes, { fill: colour, radius: 4 });
  }

  /** k-d splitting planes clipped to their subtree box, as line segments. */
  function planeSegments(planes) {
    return planes.map(function (plane) {
      if (plane.axis === 0) {
        return { x1: plane.value, y1: plane.box.min[1], x2: plane.value, y2: plane.box.max[1] };
      }
      return { x1: plane.box.min[0], y1: plane.value, x2: plane.box.max[0], y2: plane.value };
    });
  }

  return {
    render: render,
    curve: curve,
    graph: graph,
    planeSegments: planeSegments,
    projection: projection,
    POINT_LIMIT: POINT_LIMIT,
    BOX_LIMIT: BOX_LIMIT
  };
}));
