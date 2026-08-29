/**
 * Icons - a small set of inline SVGs, one per kind of block.
 *
 * Inline rather than a font or a sprite sheet: the app runs offline from
 * vendored files, an icon font is a network request and a flash of nothing, and
 * a sprite needs a fetch that `file://` and the service worker both complicate.
 * These are a few hundred bytes each and cost nothing.
 *
 * They are decoration in the accessibility sense and carry `aria-hidden`: every
 * one of them sits next to a heading that already says the same thing in words,
 * so announcing them would just repeat it. Their job is to give a long page
 * landmarks the eye can find without reading - which is the whole reason the
 * Description tab needed them.
 *
 * `currentColor` throughout, so they follow the heading colour and the theme
 * without a single colour literal.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Icons = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const PATHS = {
    /* Concepts: stacked layers, the thing being taken apart. */
    concepts: '<path d="M12 3 3 7.5 12 12l9-4.5L12 3Z"/><path d="M3 12l9 4.5L21 12"/>' +
      '<path d="M3 16.5 12 21l9-4.5"/>',
    /* Diagram: nodes and an edge. */
    diagram: '<rect x="3" y="4" width="7" height="5" rx="1"/>' +
      '<rect x="14" y="15" width="7" height="5" rx="1"/><path d="M6.5 9v4a2 2 0 0 0 2 2h5.5"/>',
    /* Insight: a lamp. */
    insight: '<path d="M9 18h6"/><path d="M10 21h4"/>' +
      '<path d="M12 3a6 6 0 0 0-3.5 10.9c.5.4.8 1 .8 1.6v.5h5.4v-.5c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3Z"/>',
    /* Demo: a play control. */
    demo: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5 16 12l-6 3.5v-7Z"/>',
    /* Worked examples: a page of working. */
    examples: '<path d="M5 3h9l5 5v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/>' +
      '<path d="M14 3v5h5"/><path d="M8 13h8"/><path d="M8 17h5"/>',
    /* Code lab: a prompt. */
    lab: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3"/><path d="M13 15h4"/>',
    /* Reference: a book. */
    reference: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z"/><path d="M4 19a2 2 0 0 1 2-2h13"/>'
  };

  /**
   * @param {string} name one of the keys above
   * @returns {string} an <svg> string, or '' when the name is unknown - an
   *   unknown icon is a missing decoration, never a broken heading.
   */
  function svg(name) {
    const body = PATHS[name];
    if (!body) return '';
    return '<svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" ' +
      'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true" focusable="false">' + body + '</svg>';
  }

  /** A block heading with its icon: `<h3><svg…>Concepts</h3>`. */
  function heading(name, text, escape) {
    const label = typeof escape === 'function' ? escape(text) : text;
    return '<h3 class="with-icon">' + svg(name) + '<span>' + label + '</span></h3>';
  }

  return { svg: svg, heading: heading, names: function () { return Object.keys(PATHS); } };
}));
