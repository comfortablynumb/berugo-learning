/**
 * TreeView - the SVG tree renderer shared by every M04 section.
 *
 * The layout is the textbook one and it is the right one for teaching: x from
 * the in-order position, y from the depth. That makes the drawing agree with
 * the invariant - a node is left of its parent exactly when its key is
 * smaller - so a broken tree looks broken.
 *
 * Built on ChartBase, so margins, resize and theme colours are decided once.
 * Trees past a few hundred nodes are not drawn: the snapshot is capped by
 * depth and the caption says how many nodes were left out, because a picture
 * of 4 000 overlapping circles teaches nothing.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TreeView = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const RADIUS = 13;

  /** In-order x, depth y. Returns placed nodes and the edges between them.
   *  Edges carry the placed objects rather than keys, because a truncated
   *  subtree renders as "…" and several of those would collide on key. */
  function layout(node) {
    const nodes = [];
    const edges = [];
    let order = 0;

    (function walk(current, depth, parentPlaced) {
      if (!current) return;
      const placed = {
        key: current.key,
        note: current.note,
        truncated: Boolean(current.truncated),
        depth: depth,
        order: -1
      };
      walk(current.left, depth + 1, placed);
      placed.order = order;
      order += 1;
      nodes.push(placed);
      if (parentPlaced) edges.push({ from: parentPlaced, to: placed });
      walk(current.right, depth + 1, placed);
    }(node, 0, null));

    return { nodes: nodes, edges: edges, columns: order };
  }

  function positions(placed, x, y) {
    const points = new Map();
    placed.nodes.forEach(function (node) {
      points.set(node, { x: x(node.order), y: y(node.depth), node: node });
    });
    return points;
  }

  function colourFor(node, options) {
    if (options.colour) {
      const chosen = options.colour(node);
      if (chosen) return chosen;
    }
    if (node.note === 'red') return scope.Palette.hue('red');
    if (node.note === 'black') return scope.Palette.token('text-primary');
    return scope.Palette.hue('blue');
  }

  function drawEdges(ctx, placed, points, highlight) {
    placed.edges.forEach(function (edge) {
      const from = points.get(edge.from);
      const to = points.get(edge.to);
      if (!from || !to) return;
      const lit = highlight.has(edge.to.key);
      ctx.plot.append('line')
        .attr('x1', from.x).attr('y1', from.y)
        .attr('x2', to.x).attr('y2', to.y)
        .attr('stroke', lit ? scope.Palette.hue('amber') : scope.Palette.token('border-strong'))
        .attr('stroke-width', lit ? 2.5 : 1.25);
    });
  }

  function drawNode(ctx, point, options, highlight) {
    const node = point.node;
    const group = ctx.plot.append('g');

    group.append('circle')
      .attr('cx', point.x).attr('cy', point.y)
      .attr('r', options.radius)
      .attr('fill', node.truncated ? scope.Palette.token('surface-sunken') : colourFor(node, options))
      .attr('stroke', highlight.has(node.key) ? scope.Palette.hue('amber') : scope.Palette.token('border-strong'))
      .attr('stroke-width', highlight.has(node.key) ? 3 : 1);

    group.append('text')
      .attr('x', point.x).attr('y', point.y + 4)
      .attr('text-anchor', 'middle')
      .attr('class', 'tree-key')
      .text(String(node.key));

    if (!node.note || node.note === 'red' || node.note === 'black') return;
    group.append('text')
      .attr('x', point.x).attr('y', point.y - options.radius - 4)
      .attr('text-anchor', 'middle')
      .attr('class', 'tree-note')
      .text(String(node.note));
  }

  /** Renders `snapshot` into `host`. Returns the ChartBase handle, so the
   *  caller redraws on theme change like every other chart. */
  function render(host, options) {
    const settings = options || {};
    const chart = scope.ChartBase.create({
      host: host,
      lazyLib: settings.lazyLib,
      height: settings.height || 260,
      margin: { top: 26, right: 16, bottom: 18, left: 16 },
      summary: settings.summary
    });

    chart.render(function (ctx) {
      const placed = layout(settings.snapshot);
      if (!placed.nodes.length) return;

      const depth = placed.nodes.reduce(function (best, node) { return Math.max(best, node.depth); }, 0);
      const radius = Math.max(6, Math.min(settings.radius || RADIUS,
        Math.floor(ctx.width / Math.max(2, placed.columns) / 2.2)));
      const x = ctx.d3.scalePoint()
        .domain(placed.nodes.map(function (node) { return node.order; }))
        .range([radius, Math.max(radius * 2, ctx.width - radius)]);
      const y = ctx.d3.scaleLinear()
        .domain([0, Math.max(1, depth)])
        .range([radius, Math.max(radius * 2, ctx.height - radius)]);

      const points = positions(placed, x, y);
      const highlight = new Set(settings.highlight || []);
      drawEdges(ctx, placed, points, highlight);
      points.forEach(function (point) {
        drawNode(ctx, point, { radius: radius, colour: settings.colour }, highlight);
      });
    });

    return chart;
  }

  return { render: render, layout: layout, RADIUS: RADIUS };
}));
