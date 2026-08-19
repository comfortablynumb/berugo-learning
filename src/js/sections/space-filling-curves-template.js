/** Markup for "Space-filling curves: Morton, Hilbert and geohash". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SpaceFillingCurvesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'sfc-curve', kind: 'select', label: 'curve', value: 'hilbert',
      options: [{ value: 'hilbert', label: 'Hilbert' }, { value: 'morton', label: 'Morton (Z-order)' }] },
    { id: 'sfc-order', kind: 'range', label: 'grid order (2^n per side)', value: 6, min: 3, max: 7, step: 1 },
    { id: 'sfc-x', kind: 'range', label: 'window left edge', value: 9, min: 0, max: 100, step: 1 },
    { id: 'sfc-y', kind: 'range', label: 'window bottom edge', value: 5, min: 0, max: 100, step: 1 },
    { id: 'sfc-side', kind: 'range', label: 'window side', value: 18, min: 2, max: 48, step: 1 },
    { id: 'sfc-budget', kind: 'range', label: 'range budget', value: 8, min: 1, max: 64, step: 1 }
  ];

  const METRICS = [
    { id: 'sfc-ranges', label: 'Ranges the window needs', note: 'each one is a separate scan' },
    { id: 'sfc-scanned', label: 'Cells scanned at the budget', note: 'against the cells the window contains' },
    { id: 'sfc-waste', label: 'False positives', note: 'cells read that the window never held' },
    { id: 'sfc-locality', label: 'Cells per range', note: 'how much useful data one scan returns' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The curve, the window and the budget', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The curve over the grid, with the window and what a scan reads</div>' +
      '<div class="card-body"><div id="sfc-map"></div>' +
      '<p class="note" id="sfc-map-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Merging ranges down to a budget: round trips against wasted reads</div>' +
      '<div class="card-body"><table class="ref-table" id="sfc-budget-table"><thead><tr>' +
      '<th>Budget</th><th>Morton ranges</th><th>Morton cells scanned</th><th>Morton waste</th>' +
      '<th>Hilbert ranges</th><th>Hilbert cells scanned</th><th>Hilbert waste</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="sfc-budget-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Two metrics that both mean "locality", pointing opposite ways</div>' +
      '<div class="card-body"><table class="ref-table" id="sfc-locality-table"><thead><tr>' +
      '<th>Measurement</th><th>Morton</th><th>Hilbert</th><th>Which wins</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="sfc-metrics-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Geohash: Z-order with an alphabet, and a prefix that is a bounding box</div>' +
      '<div class="card-body"><pre class="step-work" id="sfc-geohash"></pre>' +
      '<p class="note" id="sfc-geohash-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
