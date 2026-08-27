/**
 * CfgView — control-flow graphs, drawn, with the overlays the analyses need.
 *
 * A CFG is small and layered: a handful of blocks, edges that mostly go
 * downward, and a few that go back. That makes a layered layout by depth from
 * the entry the right one — it puts the back edge visibly backwards, which is
 * the single most useful thing a picture of a CFG can do.
 *
 * Three overlays, because three sections need the same picture annotated
 * differently: loop nesting shades the blocks, the dominator overlay draws the
 * tree edges beside the control edges, and a dataflow overlay puts a set size
 * on each block. All three take the same layout, so switching between them
 * does not move anything — which is what makes them comparable.
 *
 * Drawn with `ChartBase` for the frame and the theme colours, in SVG rather
 * than canvas: a CFG has tens of nodes, not thousands, and SVG text stays
 * selectable and scales with the text control.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CfgView = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const NODE_WIDTH = 96;
  const NODE_HEIGHT = 34;
  const LEVEL_GAP = 68;
  const COLUMN_GAP = 26;

  /* ---------------------------------------------------------------- layout */

  /**
   * A block's row is its distance from the entry along the shortest path, so
   * a back edge always points at a row above its source and is visibly a back
   * edge. Blocks sharing a row are spread across columns in id order, which
   * keeps the picture stable when a pass adds a block.
   */
  function layout(graph) {
    const depth = depths(graph);
    const rows = groupByRow(graph, depth);
    const placed = {};

    rows.forEach(function (ids, row) {
      ids.forEach(function (id, column) {
        placed[id] = { id: id, row: row, column: column,
          x: column * (NODE_WIDTH + COLUMN_GAP) + NODE_WIDTH / 2 + 8,
          y: row * (NODE_HEIGHT + LEVEL_GAP) + NODE_HEIGHT / 2 + 8 };
      });
    });
    return { nodes: placed, rows: rows,
      width: widestRow(rows) * (NODE_WIDTH + COLUMN_GAP) + 16,
      height: rows.length * (NODE_HEIGHT + LEVEL_GAP) + 16 };
  }

  function depths(graph) {
    const depth = {};
    const queue = [graph.entry];

    depth[graph.entry] = 0;
    while (queue.length) {
      const id = queue.shift();

      (graph.succs[id] || []).forEach(function (next) {
        if (depth[next] !== undefined) return;
        depth[next] = depth[id] + 1;
        queue.push(next);
      });
    }
    graph.blocks.forEach(function (id) {
      if (depth[id] === undefined) depth[id] = 0;
    });
    return depth;
  }

  function groupByRow(graph, depth) {
    const rows = [];

    graph.blocks.slice().sort().forEach(function (id) {
      const row = depth[id];

      if (!rows[row]) rows[row] = [];
      rows[row].push(id);
    });
    return rows.map(function (ids) { return ids || []; });
  }

  function widestRow(rows) {
    return rows.reduce(function (best, ids) { return Math.max(best, ids.length); }, 1);
  }

  /* -------------------------------------------------------------- drawing */

  function colourFor(node, options) {
    const settings = options || {};
    const shade = (settings.depth && settings.depth[node.id]) || 0;

    if (settings.highlight === node.id) return scope.Palette.hue('amber');
    if (settings.unreachable && settings.unreachable.indexOf(node.id) !== -1) {
      return scope.Palette.token('surface-sunken');
    }
    if (shade > 0) return scope.Palette.soft(scope.Palette.hue('purple'), 0.12 + shade * 0.16);
    return scope.Palette.token('surface-card');
  }

  function render(host, spec) {
    if (!host || !scope || !scope.ChartBase) return null;
    const settings = spec || {};
    const placed = layout(settings.graph);
    const chart = scope.ChartBase.create({ host: host, lazyLib: settings.lazyLib,
      height: Math.max(160, placed.height + 24),
      margin: { top: 10, right: 10, bottom: 10, left: 10 },
      summary: settings.summary });

    chart.render(function (ctx) {
      drawEdges(ctx, placed, settings);
      drawNodes(ctx, placed, settings);
    });
    return { host: host, chart: chart, layout: placed };
  }

  /**
   * A back edge is drawn as a curve to the left of the column, so it cannot be
   * mistaken for a forward edge that happens to cross. Dominator-tree edges,
   * when shown, are dashed and drawn under the control edges.
   */
  function drawEdges(ctx, placed, settings) {
    const back = new Set((settings.backEdges || []).map(function (edge) {
      return edge.from + '->' + edge.to;
    }));

    if (settings.dominators) drawDominatorEdges(ctx, placed, settings);
    settings.graph.edges.forEach(function (edge) {
      const from = placed.nodes[edge.from];
      const to = placed.nodes[edge.to];

      if (!from || !to) return;
      ctx.plot.append('path')
        .attr('d', edgePath(from, to, back.has(edge.from + '->' + edge.to)))
        .attr('fill', 'none')
        .attr('stroke', back.has(edge.from + '->' + edge.to)
          ? scope.Palette.hue('amber') : scope.Palette.token('border-strong'))
        .attr('stroke-width', back.has(edge.from + '->' + edge.to) ? 2 : 1.2);
    });
  }

  function drawDominatorEdges(ctx, placed, settings) {
    Object.keys(settings.dominators).forEach(function (id) {
      const parent = settings.dominators[id];
      const from = placed.nodes[parent];
      const to = placed.nodes[id];

      if (!from || !to || parent === id) return;
      ctx.plot.append('line')
        .attr('x1', from.x).attr('y1', from.y)
        .attr('x2', to.x).attr('y2', to.y)
        .attr('stroke', scope.Palette.hue('blue'))
        .attr('stroke-dasharray', '3 3')
        .attr('stroke-width', 1);
    });
  }

  function edgePath(from, to, isBack) {
    if (!isBack) {
      return 'M' + from.x + ',' + (from.y + NODE_HEIGHT / 2) +
        'L' + to.x + ',' + (to.y - NODE_HEIGHT / 2);
    }
    const bend = Math.min(from.x, to.x) - NODE_WIDTH * 0.7;

    return 'M' + (from.x - NODE_WIDTH / 2) + ',' + from.y +
      'C' + bend + ',' + from.y + ' ' + bend + ',' + to.y + ' ' +
      (to.x - NODE_WIDTH / 2) + ',' + to.y;
  }

  function drawNodes(ctx, placed, settings) {
    Object.keys(placed.nodes).forEach(function (id) {
      const node = placed.nodes[id];
      const group = ctx.plot.append('g');

      group.append('rect')
        .attr('x', node.x - NODE_WIDTH / 2).attr('y', node.y - NODE_HEIGHT / 2)
        .attr('width', NODE_WIDTH).attr('height', NODE_HEIGHT)
        .attr('rx', 5)
        .attr('fill', colourFor(node, settings))
        .attr('stroke', scope.Palette.token('border-strong'))
        .attr('stroke-width', settings.highlight === id ? 2 : 1);
      label(group, node, settings);
    });
  }

  function label(group, node, settings) {
    const note = settings.notes ? settings.notes[node.id] : '';

    group.append('text')
      .attr('x', node.x).attr('y', node.y - (note ? 3 : 0))
      .attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .attr('fill', scope.Palette.token('text-primary'))
      .text(node.id);
    if (!note) return;
    group.append('text')
      .attr('x', node.x).attr('y', node.y + 11)
      .attr('text-anchor', 'middle')
      .attr('font-size', 9)
      .attr('fill', scope.Palette.token('text-muted'))
      .text(note);
  }

  /* -------------------------------------------------------------- markup */

  /** The IR as text, which is what most of the demos actually need. */
  function listing(fn, options) {
    const settings = options || {};
    const highlight = settings.highlight || null;

    return '<pre class="ir-listing">' + fn.blocks.map(function (block) {
      return blockListing(block, highlight === block.id, settings);
    }).join('\n') + '</pre>';
  }

  function blockListing(block, marked, settings) {
    const head = '<span class="ir-block' + (marked ? ' is-marked' : '') + '">' +
      escapeHtml(block.id) + ':</span>' + noteFor(block, settings);

    return head + '\n' + block.instructions.map(function (inst) {
      return '  ' + escapeHtml(settings.show(inst));
    }).concat(block.terminator ? ['  ' + escapeHtml(settings.show(block.terminator))] : [])
      .join('\n');
  }

  function noteFor(block, settings) {
    const note = settings.notes ? settings.notes[block.id] : '';

    return note ? '  <span class="ir-note">' + escapeHtml(note) + '</span>' : '';
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  return {
    NODE_WIDTH: NODE_WIDTH, NODE_HEIGHT: NODE_HEIGHT,
    layout: layout, depths: depths, render: render, listing: listing,
    escapeHtml: escapeHtml
  };
}));
