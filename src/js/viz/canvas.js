/**
 * CanvasSurface - device-pixel-correct canvas with a resize hook.
 *
 * Used where the element count goes past a few thousand (memory maps, cache
 * heat maps, particle-scale simulations). D3 scales still do the maths; only
 * the drawing changes.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CanvasSurface = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function create(options) {
    const settings = options || {};
    const host = settings.host;
    if (!host) throw new Error('CanvasSurface.create requires a host element');

    const canvas = document.createElement('canvas');
    canvas.className = 'viz-canvas';
    if (settings.ariaLabel) canvas.setAttribute('aria-label', settings.ariaLabel);
    host.innerHTML = '';
    host.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let drawFn = null;
    let observer = null;

    function size() {
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(160, Math.round(host.getBoundingClientRect().width || 480));
      const height = settings.height || 200;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.height = height + 'px';
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      return { width: width, height: height };
    }

    function paint() {
      const dims = size();
      ctx.clearRect(0, 0, dims.width, dims.height);
      if (drawFn) drawFn(ctx, dims);
      return dims;
    }

    function render(fn) {
      drawFn = fn;
      if (!observer && typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(function () { paint(); });
        observer.observe(host);
      }
      return paint();
    }

    function destroy() {
      if (observer) observer.disconnect();
      observer = null;
      host.innerHTML = '';
    }

    return { render: render, redraw: paint, destroy: destroy, canvas: canvas, ctx: ctx };
  }

  return { create: create };
}));
