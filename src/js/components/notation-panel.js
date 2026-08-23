/**
 * Keeps a notation chip's explanation panel on the page.
 *
 * The panel is pure CSS and hangs from the chip's left edge, which is right for
 * every chip except the ones near the end of a line - there it would run past
 * the content column and, on a phone, off the document. Nothing in CSS can
 * measure that, so this does: one pass after a section mounts and one on
 * resize, flipping the late chips to hang from the right instead.
 *
 * It is a layout pass and nothing else. If a browser gives no geometry - jsdom
 * in the render audit, for one - every chip simply keeps the default side.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.NotationPanel = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const END_CLASS = 'notation-end';
  const PANEL_REM = 22;
  const VIEWPORT_SHARE = 0.7;

  function panelWidth() {
    const rem = 16;
    const viewport = scope && scope.innerWidth ? scope.innerWidth : 0;
    if (!viewport) return PANEL_REM * rem;
    return Math.min(PANEL_REM * rem, viewport * VIEWPORT_SHARE);
  }

  function rectOf(element) {
    if (!element || typeof element.getBoundingClientRect !== 'function') return null;
    const rect = element.getBoundingClientRect();
    return rect && rect.width ? rect : null;
  }

  /** Flips chips with less than a panel's width of room to their right. */
  function place(container) {
    if (!container || typeof container.querySelectorAll !== 'function') return 0;
    const bounds = rectOf(container);
    if (!bounds) return 0;

    const chips = container.querySelectorAll('abbr.notation');
    const needed = panelWidth();
    let flipped = 0;

    Array.prototype.forEach.call(chips, function (chip) {
      const rect = rectOf(chip);
      if (!rect) return;
      const room = bounds.right - rect.left;
      const end = room < needed;
      chip.classList.toggle(END_CLASS, end);
      if (end) flipped += 1;
    });

    return flipped;
  }

  function placeAll() {
    return place(scope && scope.document ? scope.document.body : null);
  }

  /* One listener for the whole app rather than one per section: the pass is
     cheap, and re-running it over every mounted section on resize is simpler
     than tracking which of them are currently on screen. */
  let listening = false;

  function watch() {
    if (listening || !scope || !scope.addEventListener) return false;
    listening = true;
    scope.addEventListener('resize', scope.Helpers.debounce(placeAll, 150));
    return true;
  }

  return {
    place: place,
    placeAll: placeAll,
    watch: watch,
    endClass: END_CLASS
  };
}));
