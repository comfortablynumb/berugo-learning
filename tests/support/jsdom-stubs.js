'use strict';

/**
 * The browser surface jsdom does not have.
 *
 * jsdom has no layout engine and no canvas, and the app must not try to fetch
 * the vendored D3 or mermaid over a network that is not there. These stubs are
 * the minimum that lets every renderer run to completion without asserting
 * anything about what was drawn.
 *
 * Shared by `render-audit.js` (which boots the source tree) and
 * `bundle-audit.js` (which boots the published bundle) so the two audits
 * cannot disagree about what the environment provides — a difference there
 * would show up as a bundle "failure" that is really a stub difference.
 */

/** Enough of a 2D context that a canvas renderer runs to completion. Nothing
 *  here checks what was drawn - only that drawing did not throw. */
function canvasContext() {
  const noop = function () {};
  const context = {
    canvas: { width: 800, height: 400 },
    measureText: function (text) { return { width: String(text).length * 6 }; },
    createLinearGradient: function () { return { addColorStop: noop }; },
    getImageData: function () { return { data: new Uint8ClampedArray(4) }; },
    setTransform: noop, save: noop, restore: noop
  };
  ['clearRect', 'fillRect', 'strokeRect', 'beginPath', 'closePath', 'moveTo', 'lineTo',
    'arc', 'arcTo', 'rect', 'ellipse', 'quadraticCurveTo', 'bezierCurveTo', 'fill', 'stroke',
    'clip', 'fillText', 'strokeText', 'translate', 'scale', 'rotate', 'drawImage',
    'setLineDash', 'putImageData'].forEach(function (name) { context[name] = noop; });
  return context;
}

function installStubs(window) {
  const noop = function () {};

  window.ResizeObserver = function () {
    return { observe: noop, unobserve: noop, disconnect: noop };
  };
  window.IntersectionObserver = window.ResizeObserver;
  window.matchMedia = function (query) {
    return { matches: false, media: query, addListener: noop, removeListener: noop,
      addEventListener: noop, removeEventListener: noop, onchange: null };
  };
  window.scrollTo = noop;
  window.HTMLCanvasElement.prototype.getContext = function () {
    return canvasContext();
  };
  window.SVGElement.prototype.getBBox = function () {
    return { x: 0, y: 0, width: 0, height: 0 };
  };
  window.Worker = undefined;
}

module.exports = { installStubs: installStubs, canvasContext: canvasContext };
