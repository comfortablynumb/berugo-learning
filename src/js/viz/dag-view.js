/**
 * DagView - the shared-structure renderer.
 *
 * Two consecutive versions of a persistent structure differ by one path, and
 * that sentence is much more convincing as a picture than as a number. This
 * draws a version's tree with every node coloured by whether the previous
 * version already had it: inherited nodes in the muted tone, the ones this
 * update had to build in the accent. On a path-copying tree the accent picks
 * out a single root-to-leaf line through a field of grey, which is the whole
 * idea of structural sharing in one image.
 *
 * Canvas rather than SVG, because a version DAG over a few hundred updates is
 * thousands of nodes and an element per node makes the page unusable exactly
 * when the picture starts being interesting.
 *
 * Two entry points:
 *   `tree`   one version, nodes coloured shared / copied
 *   `dag`    one row per version, split into copied and inherited - the same
 *            information as a series rather than as a shape
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DagView = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const PADDING = 10;
  const NODE_LIMIT = 4000;

  function palette() {
    return scope.Palette;
  }

  function surfaceFor(host, config) {
    return scope.CanvasSurface.create({
      host: host,
      height: config.height || 300,
      ariaLabel: config.ariaLabel || config.summary || 'structural sharing view'
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

  /**
   * In-order x, depth y. An in-order layout is the one that makes a search
   * tree readable - keys increase left to right - and it is also the layout in
   * which a copied path is a visible diagonal rather than a scatter.
   */
  function layout(structure) {
    const children = new Map();
    structure.edges.forEach(function (edge) {
      if (!children.has(edge.from)) children.set(edge.from, {});
      children.get(edge.from)[edge.side] = edge.to;
    });

    const byId = new Map();
    structure.nodes.forEach(function (node) { byId.set(node.id, node); });
    const targets = new Set(structure.edges.map(function (edge) { return edge.to; }));
    const rootNode = structure.nodes.filter(function (node) { return !targets.has(node.id); })[0];

    const placed = new Map();
    let order = 0;
    let maxDepth = 0;

    (function walk(id, depth) {
      if (id === undefined || !byId.has(id)) return;
      const kids = children.get(id) || {};
      walk(kids.left, depth + 1);
      placed.set(id, { x: order, y: depth });
      order += 1;
      if (depth > maxDepth) maxDepth = depth;
      walk(kids.right, depth + 1);
    }(rootNode && rootNode.id, 0));

    return { placed: placed, width: Math.max(1, order), depth: maxDepth + 1, children: children, byId: byId };
  }

  function project(box, dims) {
    const usableWidth = dims.width - 2 * PADDING;
    const usableHeight = dims.height - 2 * PADDING;
    return {
      x: function (value) { return PADDING + (box.width <= 1 ? usableWidth / 2 : (value / (box.width - 1)) * usableWidth); },
      y: function (value) { return PADDING + (box.depth <= 1 ? usableHeight / 2 : (value / (box.depth - 1)) * usableHeight); }
    };
  }

  function drawEdges(ctx, state) {
    ctx.strokeStyle = state.colours.token('border-color');
    ctx.lineWidth = 1;
    ctx.beginPath();
    state.box.children.forEach(function (kids, from) {
      const parent = state.box.placed.get(from);
      if (!parent) return;
      ['left', 'right'].forEach(function (side) {
        const child = state.box.placed.get(kids[side]);
        if (!child) return;
        ctx.moveTo(state.map.x(parent.x), state.map.y(parent.y));
        ctx.lineTo(state.map.x(child.x), state.map.y(child.y));
      });
    });
    ctx.stroke();
  }

  function drawNodes(ctx, state) {
    const shared = state.colours.hue('gray');
    const copied = state.colours.hue('orange');
    let drawn = 0;

    state.box.placed.forEach(function (position, id) {
      if (drawn >= NODE_LIMIT) return;
      drawn += 1;
      ctx.fillStyle = state.inherited.has(id) ? shared : copied;
      ctx.beginPath();
      ctx.arc(state.map.x(position.x), state.map.y(position.y), state.radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /**
   * tree(host, { structure, previous, height, summary })
   * `previous` is the earlier version's structure; anything whose id appears
   * in it is drawn as inherited.
   */
  function tree(host, config) {
    const surface = surfaceFor(host, config);
    let current = config;

    function paint(ctx, dims) {
      const colours = palette();
      ctx.fillStyle = colours.token('surface-sunken');
      ctx.fillRect(0, 0, dims.width, dims.height);

      const box = layout(current.structure);
      const inherited = new Set((current.previous ? current.previous.nodes : [])
        .map(function (node) { return node.id; }));
      const state = {
        colours: colours, box: box, map: project(box, dims), inherited: inherited,
        radius: Math.max(1.5, Math.min(5, 260 / Math.max(8, box.width)))
      };
      drawEdges(ctx, state);
      drawNodes(ctx, state);
    }

    surface.render(paint);
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

  /**
   * dag(host, { rows: [{ version, copied, total }], height, summary })
   * One column per version: the height is the whole structure and the accent
   * band at the bottom is what that version had to build.
   */
  function dag(host, config) {
    const surface = surfaceFor(host, config);
    let current = config;

    function paint(ctx, dims) {
      const colours = palette();
      ctx.fillStyle = colours.token('surface-sunken');
      ctx.fillRect(0, 0, dims.width, dims.height);

      const rows = current.rows;
      if (!rows.length) return;
      const peak = Math.max.apply(null, rows.map(function (row) { return row.total; })) || 1;
      const usableWidth = dims.width - 2 * PADDING;
      const usableHeight = dims.height - 2 * PADDING;
      const step = usableWidth / rows.length;
      const barWidth = Math.max(1, step * 0.8);

      rows.forEach(function (row, index) {
        const x = PADDING + index * step;
        const totalHeight = (row.total / peak) * usableHeight;
        const copiedHeight = (Math.min(row.copied, row.total) / peak) * usableHeight;
        ctx.fillStyle = colours.soft('gray');
        ctx.fillRect(x, PADDING + usableHeight - totalHeight, barWidth, totalHeight);
        ctx.fillStyle = colours.hue('orange');
        ctx.fillRect(x, PADDING + usableHeight - copiedHeight, barWidth, copiedHeight);
      });
    }

    surface.render(paint);
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

  return { tree: tree, dag: dag, layout: layout, NODE_LIMIT: NODE_LIMIT };
}));
