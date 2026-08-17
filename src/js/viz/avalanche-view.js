/**
 * AvalancheView - the 32x32 bit-change heat map.
 *
 * Row i, column j is the fraction of samples where flipping input bit i
 * flipped output bit j. A good mixer is a uniform field at 0.5; a bad one has
 * visible structure, and the structure tells you which bits it failed to mix.
 *
 * Canvas rather than SVG: 1024 cells redrawn on every control change.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AvalancheView = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const BITS = 32;

  /** 0.5 is neutral; distance from 0.5 in either direction is the defect. */
  function cellColour(value) {
    const deviation = Math.min(1, Math.abs(value - 0.5) * 2);
    const good = scope.Palette.hue('green');
    const bad = scope.Palette.hue('red');
    return deviation < 0.2 ? good : deviation < 0.5 ? scope.Palette.hue('amber') : bad;
  }

  function render(host, options) {
    const surface = scope.CanvasSurface.create({
      host: host,
      height: options.height || 260,
      ariaLabel: 'Avalanche matrix: how often each output bit changes when each input bit is flipped'
    });

    surface.render(function (ctx, dims) {
      const size = Math.min(dims.height - 18, dims.width - 18);
      const cell = size / BITS;
      const left = 14;
      const top = 14;

      drawCells({ ctx: ctx, matrix: options.matrix, cell: cell, origin: { left: left, top: top } });
      drawFrame({ ctx: ctx, size: size, origin: { left: left, top: top }, cell: cell });
    });

    return surface;
  }

  function drawCells(request) {
    const ctx = request.ctx;
    const cell = request.cell;

    request.matrix.forEach(function (row, inBit) {
      row.forEach(function (value, outBit) {
        ctx.fillStyle = cellColour(value);
        ctx.globalAlpha = 0.35 + Math.min(1, Math.abs(value - 0.5) * 2) * 0.65;
        ctx.fillRect(request.origin.left + outBit * cell, request.origin.top + inBit * cell,
          Math.max(1, cell - 0.5), Math.max(1, cell - 0.5));
      });
    });
    ctx.globalAlpha = 1;
  }

  function drawFrame(request) {
    const ctx = request.ctx;
    ctx.strokeStyle = scope.Palette.token('border');
    ctx.strokeRect(request.origin.left, request.origin.top, request.size, request.size);

    ctx.fillStyle = scope.Palette.token('text-muted');
    ctx.font = '9px system-ui';
    ctx.fillText('output bit →', request.origin.left, 10);
    ctx.save();
    ctx.translate(9, request.origin.top + request.size);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('input bit →', 0, 0);
    ctx.restore();
  }

  /** A short legend the section can drop next to the map. */
  function legend() {
    return scope.Legend.markup([
      { color: scope.Palette.hue('green'), label: 'within 10 points of 0.5', shape: 'well mixed' },
      { color: scope.Palette.hue('amber'), label: '10-25 points away' },
      { color: scope.Palette.hue('red'), label: 'more than 25 points away', shape: 'fails avalanche' }
    ]);
  }

  return { render: render, legend: legend, cellColour: cellColour, BITS: BITS };
}));
