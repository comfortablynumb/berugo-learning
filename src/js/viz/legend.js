/**
 * Legend - series swatches rendered as HTML beside a chart.
 *
 * HTML rather than SVG so the text wraps, stays selectable and inherits the
 * theme's text colour. Colour is never the only carrier of meaning: each entry
 * also carries its label, and callers may add a shape hint.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Legend = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  function markup(entries) {
    return '<div class="chart-legend">' + entries.map(function (entry) {
      const shape = entry.shape ? ' <span class="note">(' + escapeHtml(entry.shape) + ')</span>' : '';
      return '<span><span class="swatch" style="background:' + escapeHtml(entry.color) + '"></span>' +
        escapeHtml(entry.label) + shape + '</span>';
    }).join('') + '</div>';
  }

  function render(host, entries) {
    if (!host) return null;
    host.innerHTML = markup(entries || []);
    return host;
  }

  return { render: render, markup: markup };
}));
