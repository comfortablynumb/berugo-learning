/**
 * MetricGrid - the readout tiles every demo uses to report what it measured.
 *
 * Each tile carries a label, a value and a note. The note is not decoration:
 * it is where the unit or the counter name lives, which is the platform's
 * standing rule about never showing a bare number.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MetricGrid = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function esc(value) {
    return scope.Helpers.escapeHtml(value);
  }

  function tile(metric) {
    return '<div class="metric">' +
      '<span class="metric-label">' + esc(metric.label) + '</span>' +
      '<span class="metric-value" id="' + metric.id + '">' + esc(metric.value === undefined ? '—' : metric.value) + '</span>' +
      '<span class="metric-note" id="' + metric.id + '-note">' + esc(metric.note || '') + '</span>' +
      '</div>';
  }

  function markup(metrics, options) {
    const settings = options || {};
    const minWidth = settings.minWidth || 150;
    return '<div class="grid-2" style="grid-template-columns:repeat(auto-fit,minmax(' + minWidth +
      'px,1fr));margin-top:.875rem">' + metrics.map(tile).join('') + '</div>';
  }

  /** update({ id: value }) or update({ id: { value, note } }). */
  function update(values) {
    const $ = scope.jQuery;
    Object.keys(values).forEach(function (id) {
      const entry = values[id];
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        if (entry.value !== undefined) $('#' + id).text(String(entry.value));
        if (entry.note !== undefined) $('#' + id + '-note').text(String(entry.note));
        return;
      }
      $('#' + id).text(String(entry));
    });
  }

  return { markup: markup, update: update };
}));
