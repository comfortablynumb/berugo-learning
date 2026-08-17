/** Markup for "B-trees and B+ trees". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BTreesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'bt-page', kind: 'select', label: 'page size', value: '4096',
      options: [{ value: '512', label: '512 B — an old sector' },
        { value: '4096', label: '4 KB — the usual page' },
        { value: '16384', label: '16 KB — InnoDB' },
        { value: '65536', label: '64 KB — a large analytics page' }] },
    { id: 'bt-keybytes', kind: 'range', label: 'bytes per key', value: 8, min: 4, max: 64, step: 4,
      note: 'Order is not a tuning knob: it is (page + key) / (key + pointer), so the storage decides it.' },
    { id: 'bt-count', kind: 'range', label: 'keys', value: 100000, min: 1000, max: 1000000, step: 1000 },
    { id: 'bt-order-mode', kind: 'select', label: 'insertion order', value: 'sequential',
      options: [{ value: 'sequential', label: 'sequential — an ordered bulk load' },
        { value: 'random', label: 'random' }] },
    { id: 'bt-scan', kind: 'range', label: 'range scan length', value: 1000, min: 10, max: 20000, step: 10 }
  ];

  const METRICS = [
    { id: 'bt-order', label: 'Order', note: 'children per page, computed from the page size' },
    { id: 'bt-reads', label: 'Page reads per lookup', note: 'measured, against the prediction' },
    { id: 'bt-height', label: 'Height', note: 'levels from the root to a leaf' },
    { id: 'bt-fill', label: 'Page fill', note: 'how full the pages actually are' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Storage and workload', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Page reads as the index grows</div>' +
      '<div class="card-body"><div id="bt-chart"></div><div id="bt-legend"></div></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The same million keys on four storage geometries</div>' +
      '<div class="card-body"><table class="ref-table" id="bt-pages"><thead><tr>' +
      '<th>Page</th><th>Order</th><th>Height</th><th>Reads per lookup</th><th>Pages held</th><th>Fill</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bt-pages-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The range scan: one descent, then the leaf chain</div>' +
      '<div class="card-body"><table class="ref-table" id="bt-scan"><thead><tr>' +
      '<th>Keys scanned</th><th>Page reads</th><th>Reads per 1 000 keys</th><th>What it is</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bt-scan-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
