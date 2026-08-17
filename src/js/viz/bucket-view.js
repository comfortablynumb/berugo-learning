/**
 * BucketView - slot and bucket rendering for the hash-table sections.
 *
 * Two shapes, one module: `slots` draws an open-addressed array as a strip of
 * cells (empty / full / tombstone / probe path), and `buckets` draws a chained
 * table as a column chart of chain lengths. Both are canvas: a table with
 * 4 096 slots is past the point where SVG nodes are sensible.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BucketView = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function stateColour(state) {
    if (state === 1) return scope.Palette.hue('blue');
    if (state === 2) return scope.Palette.hue('red');
    return scope.Palette.token('border');
  }

  /** Lays out `count` cells in as many rows as it takes to fill the width. */
  function grid(count, dims) {
    const target = Math.max(4, Math.floor(Math.sqrt((dims.width * (dims.height - 16)) / count)));
    const columns = Math.max(1, Math.floor(dims.width / target));
    return {
      cell: Math.max(2, Math.min(target, Math.floor(dims.width / columns))),
      columns: columns,
      rows: Math.ceil(count / columns)
    };
  }

  function slots(host, options) {
    const surface = scope.CanvasSurface.create({
      host: host,
      height: options.height || 180,
      ariaLabel: options.ariaLabel || 'Hash table slots: empty, occupied and tombstoned'
    });

    surface.render(function (ctx, dims) {
      const states = options.states;
      const layout = grid(states.length, dims);
      const highlight = new Map((options.probe || []).map(function (step, i) { return [step.index, i]; }));

      states.forEach(function (state, index) {
        const x = (index % layout.columns) * layout.cell;
        const y = Math.floor(index / layout.columns) * layout.cell;
        ctx.fillStyle = stateColour(state);
        ctx.globalAlpha = state === 0 ? 0.45 : 0.9;
        ctx.fillRect(x, y, Math.max(1, layout.cell - 1), Math.max(1, layout.cell - 1));

        if (!highlight.has(index)) return;
        ctx.globalAlpha = 1;
        ctx.strokeStyle = scope.Palette.hue('amber');
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, Math.max(2, layout.cell - 1), Math.max(2, layout.cell - 1));
      });

      ctx.globalAlpha = 1;
      caption(ctx, dims, options.caption);
    });

    return surface;
  }

  function buckets(host, options) {
    const surface = scope.CanvasSurface.create({
      host: host,
      height: options.height || 180,
      ariaLabel: options.ariaLabel || 'Chain length per bucket'
    });

    surface.render(function (ctx, dims) {
      const lengths = options.lengths;
      const max = Math.max(1, lengths.reduce(function (m, l) { return Math.max(m, l); }, 0));
      const width = dims.width / lengths.length;
      const base = dims.height - 16;

      lengths.forEach(function (length, index) {
        const height = (length / max) * (base - 6);
        ctx.fillStyle = options.trees && options.trees[index]
          ? scope.Palette.hue('purple')
          : scope.Palette.hue('blue');
        ctx.fillRect(index * width, base - height, Math.max(1, width - 0.5), height);
      });

      drawExpected(ctx, { dims: dims, base: base, max: max, expected: options.expected });
      caption(ctx, dims, (options.caption || '') + ' · tallest chain ' + max);
    });

    return surface;
  }

  function drawExpected(ctx, request) {
    if (!request.expected) return;
    const y = request.base - (request.expected / request.max) * (request.base - 6);
    ctx.strokeStyle = scope.Palette.hue('orange');
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(request.dims.width, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function caption(ctx, dims, text) {
    if (!text) return;
    ctx.fillStyle = scope.Palette.token('text-muted');
    ctx.font = '10px system-ui';
    ctx.fillText(text, 2, dims.height - 3);
  }

  function legend(entries) {
    return scope.Legend.markup(entries);
  }

  function stateLegend() {
    return legend([
      { color: scope.Palette.hue('blue'), label: 'occupied' },
      { color: scope.Palette.token('border'), label: 'empty' },
      { color: scope.Palette.hue('red'), label: 'tombstone' },
      { color: scope.Palette.hue('amber'), label: 'probe path', shape: 'outlined' }
    ]);
  }

  return { slots: slots, buckets: buckets, legend: legend, stateLegend: stateLegend, grid: grid };
}));
