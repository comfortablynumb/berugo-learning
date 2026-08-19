/** Markup for "Compressed bitmaps: Roaring containers against word-aligned runs". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CompressedBitmapsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'cbm-kind', kind: 'select', label: 'value distribution', value: 'sparse',
      options: [{ value: 'sparse', label: 'sparse — 20 000 values over 5 000 000' },
        { value: 'dense', label: 'dense — half of a small universe' },
        { value: 'runs', label: 'runs — long consecutive stretches' }] },
    { id: 'cbm-count', kind: 'range', label: 'values in the set', value: 20000, min: 5000, max: 50000, step: 5000 },
    { id: 'cbm-seed', kind: 'range', label: 'sample seed', value: 37, min: 1, max: 60, step: 1 }
  ];

  const METRICS = [
    { id: 'cbm-bytes', label: 'Bytes', note: 'the containers this distribution chose' },
    { id: 'cbm-bits', label: 'Bits per value', note: 'against 32 for a sorted array' },
    { id: 'cbm-raw', label: 'Against a flat bitmap', note: 'one bit per position in the universe' },
    { id: 'cbm-wah', label: 'Against WAH', note: 'word-aligned run-length encoding' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The set and how it is shaped', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Five representations of the same set</div>' +
      '<div class="card-body"><div id="cbm-bars"></div>' +
      '<p class="note" id="cbm-bars-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Three distributions, one encoder, and no row that wins every column</div>' +
      '<div class="card-body"><table class="ref-table" id="cbm-kinds"><thead><tr>' +
      '<th>Distribution</th><th>Containers</th><th>Bytes</th><th>After runOptimize</th>' +
      '<th>WAH</th><th>Flat bitmap</th><th>Sorted array</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="cbm-kinds-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Intersection: the algorithm is chosen per container pair</div>' +
      '<div class="card-body"><table class="ref-table" id="cbm-paths"><thead><tr>' +
      '<th>Pairing</th><th>Path taken</th><th>Words touched</th><th>Elements touched</th>' +
      '<th>Probes</th><th>Result size</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="cbm-paths-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
