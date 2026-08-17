/**
 * ForestView - the disjoint-set forest, drawn as parent links.
 *
 * The picture is the point of the section: a find with path compression makes
 * the forest visibly flatter, and a find without it does not. Nodes are laid
 * out in columns by component and rows by depth, so "depth" is a distance you
 * can see rather than a number in a table.
 *
 * Built on ChartBase like every other renderer here.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ForestView = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  /** Groups the elements by root, then assigns a column per element within its
   *  component and a row from its depth. */
  function layout(forest) {
    const parent = forest.parent;
    const depth = forest.depth;
    const groups = new Map();

    for (let i = 0; i < parent.length; i += 1) {
      let node = i;
      while (parent[node] !== node) node = parent[node];
      if (!groups.has(node)) groups.set(node, []);
      groups.get(node).push(i);
    }

    const placed = [];
    let column = 0;
    groups.forEach(function (members, componentRoot) {
      members.sort(function (a, b) { return depth[a] - depth[b] || a - b; });
      members.forEach(function (member) {
        placed.push({ id: member, column: column, depth: depth[member], root: componentRoot });
        column += 1;
      });
      column += 1;
    });
    return { nodes: placed, columns: column, groups: groups.size };
  }

  function drawLinks(ctx, points, forest) {
    points.forEach(function (point) {
      const up = forest.parent[point.node.id];
      if (up === point.node.id) return;
      const target = points.get(up);
      if (!target) return;
      ctx.plot.append('line')
        .attr('x1', point.x).attr('y1', point.y)
        .attr('x2', target.x).attr('y2', target.y)
        .attr('stroke', scope.Palette.token('border-strong'))
        .attr('stroke-width', 1.25);
    });
  }

  function drawNodes(ctx, points, options) {
    const highlight = new Set(options.highlight || []);
    points.forEach(function (point) {
      const isRoot = options.forest.parent[point.node.id] === point.node.id;
      ctx.plot.append('circle')
        .attr('cx', point.x).attr('cy', point.y)
        .attr('r', options.radius)
        .attr('fill', isRoot ? scope.Palette.hue('green') : scope.Palette.hue('blue'))
        .attr('stroke', highlight.has(point.node.id) ? scope.Palette.hue('amber') : scope.Palette.token('border-strong'))
        .attr('stroke-width', highlight.has(point.node.id) ? 3 : 1);

      if (options.radius < 9) return;
      ctx.plot.append('text')
        .attr('x', point.x).attr('y', point.y + 4)
        .attr('text-anchor', 'middle')
        .attr('class', 'tree-key')
        .text(String(point.node.id));
    });
  }

  function render(host, options) {
    const settings = options || {};
    const chart = scope.ChartBase.create({
      host: host,
      lazyLib: settings.lazyLib,
      height: settings.height || 240,
      margin: { top: 18, right: 14, bottom: 18, left: 14 },
      summary: settings.summary
    });

    chart.render(function (ctx) {
      const forest = settings.forest;
      const placed = layout(forest);
      if (!placed.nodes.length) return;

      const maxDepth = placed.nodes.reduce(function (best, node) { return Math.max(best, node.depth); }, 0);
      const radius = Math.max(4, Math.min(14, Math.floor(ctx.width / Math.max(2, placed.columns) / 2.4)));
      const x = ctx.d3.scalePoint()
        .domain(placed.nodes.map(function (node) { return node.id; }))
        .range([radius, Math.max(radius * 2, ctx.width - radius)]);
      const y = ctx.d3.scaleLinear()
        .domain([0, Math.max(1, maxDepth)])
        .range([radius, Math.max(radius * 2, ctx.height - radius)]);

      const points = new Map();
      placed.nodes.forEach(function (node) {
        points.set(node.id, { x: x(node.id), y: y(node.depth), node: node });
      });

      drawLinks(ctx, points, forest);
      drawNodes(ctx, points, { radius: radius, forest: forest, highlight: settings.highlight });
    });

    return chart;
  }

  return { render: render, layout: layout };
}));
