/** Markup for "Applied geometry". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AppliedGeometryTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ag-view', kind: 'select', label: 'what to draw', value: 'fill',
      options: [
        { value: 'fill', label: 'scanline fill, with coverage' },
        { value: 'line', label: 'Bresenham against rounding' },
        { value: 'curve', label: 'curve flattening' },
        { value: 'collision', label: 'separating axis, with the push vector' }
      ] },
    { id: 'ag-tolerance', kind: 'select', label: 'flattening tolerance', value: '0.25',
      options: [
        { value: '4', label: '4 — visibly faceted' },
        { value: '1', label: '1' },
        { value: '0.25', label: '0.25 — the usual default' },
        { value: '0.0625', label: '0.0625' },
        { value: '0.015625', label: '0.015625 — far past what a screen shows' }
      ] },
    { id: 'ag-separation', kind: 'range', label: 'how far apart the two shapes are', value: 6,
      min: 0, max: 24, step: 1 },
    { id: 'ag-samples', kind: 'range', label: 'anti-aliasing samples per axis', value: 4,
      min: 1, max: 8, step: 1 }
  ];

  const METRICS = [
    { id: 'ag-pixels', label: 'Pixels filled', note: 'against the polygon area' },
    { id: 'ag-segments', label: 'Segments after flattening', note: 'at the chosen tolerance' },
    { id: 'ag-colliding', label: 'Shapes overlapping', note: 'by the separating axis test' },
    { id: 'ag-mtv', label: 'Push needed to separate', note: 'the minimum translation vector' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The scene', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Geometry as it meets a grid of pixels</div>' +
      '<div class="card-body"><div id="ag-scene"></div>' +
      '<p class="note" id="ag-scene-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Flattening: what the tolerance actually buys</div>' +
      '<div class="card-body"><table class="ref-table" id="ag-flatten"><thead><tr>' +
      '<th>Tolerance</th><th>Segments</th><th>Subdivisions</th><th>Measured worst error</th>' +
      '<th>Within tolerance</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ag-flatten-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Bresenham against a rounding reference</div>' +
      '<div class="card-body"><table class="ref-table" id="ag-lines"><thead><tr>' +
      '<th>Lines drawn</th><th>Identical pixel sets</th><th>Differing</th>' +
      '<th>Pixel counts always equal</th><th>Endpoints always equal</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ag-lines-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The separating axis test, and whether its push works</div>' +
      '<div class="card-body"><table class="ref-table" id="ag-sat"><thead><tr>' +
      '<th>Separation</th><th>Axes tested</th><th>Overlapping</th><th>Sampling oracle agrees</th>' +
      '<th>Overlap depth</th><th>Applying the push separates them</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ag-sat-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
