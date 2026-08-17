/**
 * HeapView - the array and the tree, drawn together.
 *
 * The point of the dual view is that they are the same thing: index i in the
 * strip is the same node as the circle at depth ⌊log_d i⌋ below it, and a sift
 * highlights the same cells in both. An implicit heap is the one structure
 * where the array *is* the tree, and a picture that shows only one of the two
 * hides the idea.
 *
 * Built on ChartBase, like every other renderer here.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HeapView = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  /** Level offsets for a d-ary heap: level L starts at (d^L − 1)/(d − 1). */
  function levelsOf(count, arity) {
    const levels = [];
    let start = 0;
    let width = 1;
    while (start < count) {
      levels.push({ start: start, end: Math.min(start + width, count) });
      start += width;
      width *= arity;
    }
    return levels;
  }

  function drawStrip(ctx, options) {
    const keys = options.keys;
    const highlight = options.highlight;
    const cell = Math.max(6, Math.min(34, Math.floor(ctx.width / Math.max(1, keys.length))));
    const top = 4;

    keys.forEach(function (key, index) {
      const x = index * cell;
      const lit = highlight.has(index);
      ctx.plot.append('rect')
        .attr('x', x).attr('y', top)
        .attr('width', Math.max(2, cell - 1)).attr('height', 22)
        .attr('fill', lit ? scope.Palette.hue('amber') : scope.Palette.hue('blue'))
        .attr('opacity', lit ? 1 : 0.75);

      if (cell < 18) return;
      ctx.plot.append('text')
        .attr('x', x + cell / 2).attr('y', top + 15)
        .attr('text-anchor', 'middle')
        .attr('class', 'tree-key')
        .text(String(key));
    });

    return top + 30;
  }

  function drawTree(ctx, options, top) {
    const keys = options.keys;
    const arity = options.arity;
    const highlight = options.highlight;
    const levels = levelsOf(keys.length, arity);
    const rowHeight = Math.max(24, Math.min(46, (ctx.height - top) / Math.max(1, levels.length)));
    const radius = Math.max(5, Math.min(13, rowHeight / 3));
    const positions = [];

    levels.forEach(function (level, depth) {
      const width = level.end - level.start;
      for (let i = level.start; i < level.end; i += 1) {
        positions[i] = {
          x: ((i - level.start) + 0.5) * (ctx.width / width),
          y: top + depth * rowHeight + radius + 2
        };
      }
    });

    keys.forEach(function (key, index) {
      if (!index) return;
      const parent = Math.floor((index - 1) / arity);
      ctx.plot.append('line')
        .attr('x1', positions[parent].x).attr('y1', positions[parent].y)
        .attr('x2', positions[index].x).attr('y2', positions[index].y)
        .attr('stroke', highlight.has(index) && highlight.has(parent)
          ? scope.Palette.hue('amber') : scope.Palette.token('border-strong'))
        .attr('stroke-width', highlight.has(index) && highlight.has(parent) ? 2.5 : 1);
    });

    keys.forEach(function (key, index) {
      const lit = highlight.has(index);
      ctx.plot.append('circle')
        .attr('cx', positions[index].x).attr('cy', positions[index].y)
        .attr('r', radius)
        .attr('fill', lit ? scope.Palette.hue('amber') : scope.Palette.hue('blue'))
        .attr('stroke', scope.Palette.token('border-strong'))
        .attr('stroke-width', lit ? 2 : 1);

      if (radius < 9) return;
      ctx.plot.append('text')
        .attr('x', positions[index].x).attr('y', positions[index].y + 4)
        .attr('text-anchor', 'middle')
        .attr('class', 'tree-key')
        .text(String(key));
    });
  }

  /** Renders the array strip above and the tree below, sharing a highlight. */
  function render(host, options) {
    const settings = options || {};
    const chart = scope.ChartBase.create({
      host: host,
      lazyLib: settings.lazyLib,
      height: settings.height || 280,
      margin: { top: 10, right: 8, bottom: 10, left: 8 },
      summary: settings.summary
    });

    chart.render(function (ctx) {
      const keys = settings.keys || [];
      if (!keys.length) return;

      const shared = {
        keys: keys,
        arity: settings.arity || 2,
        highlight: new Set(settings.highlight || [])
      };
      const top = drawStrip(ctx, shared);
      drawTree(ctx, shared, top);
    });

    return chart;
  }

  return { render: render, levelsOf: levelsOf };
}));
