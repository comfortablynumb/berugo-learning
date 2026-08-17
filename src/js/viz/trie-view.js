/**
 * TrieView - the edge-labelled tree renderer for every prefix and suffix
 * structure in M06.
 *
 * Different from `TreeView` in the one way that matters: the label lives on
 * the *edge*, not in the node. A radix trie's whole point is that an edge can
 * carry `nection` rather than six nodes, and a renderer that puts the
 * character in the circle cannot show that at all.
 *
 * The layout is a tidy top-down walk: leaves take consecutive columns, an
 * internal node sits above the mean of its children. Node counts past a few
 * hundred are not drawn - the caller truncates the snapshot and the caption
 * says how many were left out, because a picture of 2 500 overlapping circles
 * is not a picture of a trie.
 *
 * A snapshot node is `{ label, terminal, note, truncated, children: [] }`.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TrieView = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const RADIUS = 11;

  /** Places every node: x from the leaf order, y from the depth. */
  function layout(node) {
    const nodes = [];
    const edges = [];
    let column = 0;

    const place = function (current, depth, parent) {
      const placed = {
        label: current.label === undefined ? '' : current.label,
        terminal: Boolean(current.terminal),
        note: current.note,
        truncated: Boolean(current.truncated),
        depth: depth,
        column: 0
      };
      nodes.push(placed);
      if (parent) edges.push({ from: parent, to: placed });

      const children = current.children || [];
      if (!children.length) {
        placed.column = column;
        column += 1;
        return placed;
      }

      const placedChildren = children.map(function (child) { return place(child, depth + 1, placed); });
      placed.column = placedChildren.reduce(function (sum, child) {
        return sum + child.column;
      }, 0) / placedChildren.length;
      return placed;
    };

    place(node, 0, null);
    return { nodes: nodes, edges: edges, columns: Math.max(1, column) };
  }

  function edgeColour(edge, highlight) {
    if (highlight.has(edge.to)) return scope.Palette.hue('amber');
    return scope.Palette.token('border-strong');
  }

  function nodeColour(node) {
    if (node.truncated) return scope.Palette.token('surface-sunken');
    if (node.terminal) return scope.Palette.hue('green');
    return scope.Palette.hue('blue');
  }

  /** The set of placed nodes on a highlighted path, found by spelling. The
   *  caller passes strings, because it does not hold the placed objects. */
  function highlightSet(placed, spellings) {
    const wanted = new Set(spellings || []);
    const found = new Set();
    if (!wanted.size) return found;

    const spell = new Map();
    placed.nodes.forEach(function (node) { spell.set(node, ''); });
    placed.edges.forEach(function (edge) {
      spell.set(edge.to, spell.get(edge.from) + edge.to.label);
    });
    placed.nodes.forEach(function (node) {
      if (wanted.has(spell.get(node))) found.add(node);
    });
    return found;
  }

  function drawEdge(ctx, edge, points, highlight, radius) {
    const from = points.get(edge.from);
    const to = points.get(edge.to);
    if (!from || !to) return;

    const lit = highlight.has(edge.to);
    ctx.plot.append('line')
      .attr('x1', from.x).attr('y1', from.y + radius)
      .attr('x2', to.x).attr('y2', to.y - radius)
      .attr('stroke', edgeColour(edge, highlight))
      .attr('stroke-width', lit ? 2.5 : 1.1);

    if (!edge.to.label) return;
    ctx.plot.append('text')
      .attr('x', (from.x + to.x) / 2 + 6)
      .attr('y', (from.y + to.y) / 2)
      .attr('class', 'trie-edge-label')
      .attr('fill', lit ? scope.Palette.hue('amber') : scope.Palette.token('text-secondary'))
      .text(edge.to.label);
  }

  function drawNode(ctx, point, highlight, radius) {
    const node = point.node;
    const group = ctx.plot.append('g');

    group.append('circle')
      .attr('cx', point.x).attr('cy', point.y).attr('r', radius)
      .attr('fill', nodeColour(node))
      .attr('stroke', highlight.has(node) ? scope.Palette.hue('amber') : scope.Palette.token('border-strong'))
      .attr('stroke-width', highlight.has(node) ? 3 : 1);

    if (node.truncated) {
      group.append('text')
        .attr('x', point.x).attr('y', point.y + 4)
        .attr('text-anchor', 'middle')
        .attr('class', 'trie-node-label')
        .text('…');
      return;
    }
    if (!node.note) return;
    group.append('text')
      .attr('x', point.x).attr('y', point.y - radius - 5)
      .attr('text-anchor', 'middle')
      .attr('class', 'trie-note')
      .text(String(node.note));
  }

  function render(host, options) {
    const settings = options || {};
    const chart = scope.ChartBase.create({
      host: host,
      lazyLib: settings.lazyLib,
      height: settings.height || 280,
      margin: { top: 24, right: 20, bottom: 22, left: 20 },
      summary: settings.summary
    });

    chart.render(function (ctx) {
      const placed = layout(settings.snapshot);
      if (!placed.nodes.length) return;

      const depth = placed.nodes.reduce(function (best, node) { return Math.max(best, node.depth); }, 0);
      const radius = Math.max(5, Math.min(settings.radius || RADIUS,
        Math.floor(ctx.width / Math.max(2, placed.columns) / 2.4)));

      const x = ctx.d3.scaleLinear()
        .domain([0, Math.max(1, placed.columns - 1)])
        .range([radius + 8, Math.max(radius * 2, ctx.width - radius - 8)]);
      const y = ctx.d3.scaleLinear()
        .domain([0, Math.max(1, depth)])
        .range([radius, Math.max(radius * 2, ctx.height - radius)]);

      const points = new Map();
      placed.nodes.forEach(function (node) {
        points.set(node, { x: x(node.column), y: y(node.depth), node: node });
      });

      const highlight = highlightSet(placed, settings.highlight);
      placed.edges.forEach(function (edge) { drawEdge(ctx, edge, points, highlight, radius); });
      points.forEach(function (point) { drawNode(ctx, point, highlight, radius); });
    });

    return chart;
  }

  return { render: render, layout: layout, highlightSet: highlightSet, RADIUS: RADIUS };
}));
