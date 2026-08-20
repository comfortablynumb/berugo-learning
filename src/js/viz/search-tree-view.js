/**
 * SearchTreeView - the explored search tree, with the pruned branches shown
 * rather than omitted.
 *
 * The picture a pruning argument needs is not "here is the tree that was
 * searched" but "here is the tree, and here is the part that was cut". A node
 * the search rejected is drawn in the muted tone at the position it would have
 * occupied, so the ratio between kept and cut is visible as area. Omitting the
 * pruned nodes would draw the same picture for a good pruning and a useless
 * one.
 *
 * Canvas rather than SVG: the interesting configurations reach the tree limit
 * of a few hundred nodes, and the *uninteresting* ones - the control with no
 * pruning at all - reach a hundred thousand. An element per node makes the
 * page unusable exactly when the comparison starts to matter.
 *
 * Two entry points:
 *   `tree`   the explored tree, nodes coloured open / infeasible / bounded
 *   `levels` nodes per depth as a bar chart, which is the same information
 *            when the tree is too wide to read
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SearchTreeView = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const PADDING = 12;
  const NODE_LIMIT = 4000;

  function palette() {
    return scope.Palette;
  }

  function surfaceFor(host, config) {
    return scope.CanvasSurface.create({
      host: host,
      height: config.height || 260,
      ariaLabel: config.ariaLabel || config.summary || 'search tree'
    });
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

  /** Depth for y, order of first visit for x. Visit order is the right x axis
   *  here because it is the order the search actually took, so a left-to-right
   *  read of the picture is a read of the search. */
  function layout(tree) {
    const byDepth = new Map();
    const placed = new Map();
    let maxDepth = 0;

    tree.nodes.forEach(function (node) {
      const row = byDepth.get(node.depth) || [];
      row.push(node.id);
      byDepth.set(node.depth, row);
      maxDepth = Math.max(maxDepth, node.depth);
    });

    let widest = 1;
    byDepth.forEach(function (row) { widest = Math.max(widest, row.length); });
    byDepth.forEach(function (row, depth) {
      row.forEach(function (id, index) {
        placed.set(id, { x: (index + 0.5) / row.length, y: depth });
      });
    });

    return { placed: placed, depth: maxDepth + 1, widest: widest };
  }

  function project(box, dims) {
    const usableWidth = dims.width - 2 * PADDING;
    const usableHeight = dims.height - 2 * PADDING;
    return {
      x: function (value) { return PADDING + value * usableWidth; },
      y: function (value) {
        return PADDING + (box.depth <= 1 ? usableHeight / 2 : (value / (box.depth - 1)) * usableHeight);
      }
    };
  }

  function colourFor(colours, kind) {
    if (kind === 'infeasible') return colours.hue('gray');
    if (kind === 'bounded') return colours.hue('orange');
    return colours.hue('blue');
  }

  function drawEdges(ctx, state) {
    ctx.strokeStyle = state.colours.token('border-color');
    ctx.lineWidth = 1;
    ctx.beginPath();
    state.tree.edges.forEach(function (edge) {
      const from = state.box.placed.get(edge.from);
      const to = state.box.placed.get(edge.to);
      if (!from || !to) return;
      ctx.moveTo(state.map.x(from.x), state.map.y(from.y));
      ctx.lineTo(state.map.x(to.x), state.map.y(to.y));
    });
    ctx.stroke();
  }

  function drawNodes(ctx, state) {
    let drawn = 0;
    state.tree.nodes.forEach(function (node) {
      if (drawn >= NODE_LIMIT) return;
      drawn += 1;
      const at = state.box.placed.get(node.id);
      if (!at) return;
      ctx.fillStyle = colourFor(state.colours, node.kind);
      ctx.beginPath();
      ctx.arc(state.map.x(at.x), state.map.y(at.y), state.radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /**
   * tree(host, { tree: { nodes, edges }, height, summary })
   *
   * `nodes` carry `{ id, depth, kind }` where kind is 'open', 'infeasible' or
   * 'bounded' - exactly what `SearchTreeLab.explore` returns.
   */
  function tree(host, config) {
    const surface = surfaceFor(host, config);
    let current = config;

    surface.render(function (ctx, dims) {
      const data = current.tree || { nodes: [], edges: [] };
      if (!data.nodes.length) return;
      const box = layout(data);
      const state = {
        tree: data, box: box, colours: palette(),
        map: project(box, dims),
        radius: Math.max(1.5, Math.min(5, dims.width / (box.widest * 4)))
      };
      drawEdges(ctx, state);
      drawNodes(ctx, state);
    });

    summarise(host, config.summary);
    return {
      redraw: function () { return surface.redraw(); },
      update: function (next) {
        current = Object.assign({}, current, next);
        summarise(host, current.summary);
        return surface.redraw();
      },
      destroy: function () { surface.destroy(); }
    };
  }

  function countsByDepth(data) {
    const counts = [];
    data.nodes.forEach(function (node) {
      counts[node.depth] = (counts[node.depth] || 0) + 1;
    });
    for (let i = 0; i < counts.length; i += 1) counts[i] = counts[i] || 0;
    return counts;
  }

  /**
   * levels(host, { tree, height, summary })
   *
   * Nodes per depth. A search that explodes does so at one depth, and this is
   * the view that says which one.
   */
  function levels(host, config) {
    const surface = surfaceFor(host, config);
    let current = config;

    surface.render(function (ctx, dims) {
      const counts = countsByDepth(current.tree || { nodes: [] });
      if (!counts.length) return;
      const colours = palette();
      const widest = Math.max.apply(null, counts);
      const rowHeight = (dims.height - 2 * PADDING) / counts.length;

      ctx.fillStyle = colours.hue('blue');
      counts.forEach(function (count, depth) {
        const width = (dims.width - 2 * PADDING) * (count / Math.max(1, widest));
        ctx.fillRect(PADDING, PADDING + depth * rowHeight, width, Math.max(1, rowHeight - 2));
      });
    });

    summarise(host, config.summary);
    return {
      redraw: function () { return surface.redraw(); },
      update: function (next) {
        current = Object.assign({}, current, next);
        summarise(host, current.summary);
        return surface.redraw();
      },
      destroy: function () { surface.destroy(); }
    };
  }

  return { tree: tree, levels: levels, layout: layout, countsByDepth: countsByDepth, NODE_LIMIT: NODE_LIMIT };
}));
