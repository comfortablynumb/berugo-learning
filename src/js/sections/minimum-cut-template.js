/** Markup for "Minimum cut and its applications". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MinimumCutTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'cut-side', kind: 'range', label: 'image side (pixels)', value: 8, min: 4, max: 14, step: 1 },
    { id: 'cut-noise', kind: 'range', label: 'measurement noise (% of pixels flipped)', value: 20, min: 0, max: 45, step: 5 },
    { id: 'cut-smooth', kind: 'range', label: 'smoothness between neighbours', value: 3, min: 0, max: 12, step: 1 },
    { id: 'cut-seed', kind: 'range', label: 'image seed', value: 1, min: 1, max: 40, step: 1 },
    { id: 'cut-projects', kind: 'range', label: 'projects in the selection problem', value: 8, min: 4, max: 14, step: 1 }
  ];

  const METRICS = [
    { id: 'cut-capacity', label: 'Minimum cut', note: 'and the maximum flow it equals' },
    { id: 'cut-wrong', label: 'Pixels misclassified', note: 'against the labels the image was built from' },
    { id: 'cut-profit', label: 'Best project profit', note: 'total positive profit minus the cut' },
    { id: 'cut-oracle', label: 'Agrees with brute force?', note: 'every subset tested for closure' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The image and the projects', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The segmentation the minimum cut chose</div>' +
      '<div class="card-body"><div id="cut-image"></div>' +
      '<p class="note" id="cut-image-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What the smoothness term buys against noise</div>' +
      '<div class="card-body"><table class="ref-table" id="cut-smoothing"><thead><tr>' +
      '<th>Smoothness</th><th>Cut capacity</th><th>Pixels called foreground</th>' +
      '<th>Misclassified</th><th>Share of the image</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="cut-smoothing-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Project selection: which items pay for their prerequisites</div>' +
      '<div class="card-body"><table class="ref-table" id="cut-selection"><thead><tr>' +
      '<th>Instance</th><th>Positive profit available</th><th>Minimum cut</th>' +
      '<th>Profit realised</th><th>Projects taken</th><th>Brute force agrees?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="cut-selection-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Koenig: the vertex cover a matching hands you</div>' +
      '<div class="card-body"><div id="cut-cover"></div>' +
      '<p class="note" id="cut-cover-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Max-flow min-cut, checked on every network shape</div>' +
      '<div class="card-body"><table class="ref-table" id="cut-theorem"><thead><tr>' +
      '<th>Network</th><th>Nodes</th><th>Maximum flow</th><th>Cut capacity</th>' +
      '<th>Arcs crossing</th><th>All saturated?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="cut-theorem-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
