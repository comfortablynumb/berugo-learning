/** Markup for "2-3 finger trees and monoid annotations". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.FingerTreesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ftr-count', kind: 'range', label: 'elements in the sequence', value: 3000, min: 500, max: 6000, step: 500 },
    { id: 'ftr-split', kind: 'range', label: 'split position (% of the sequence)', value: 50, min: 10, max: 90, step: 10 },
    { id: 'ftr-monoid', kind: 'select', label: 'monoid shown in the metrics', value: 'size',
      options: [{ value: 'size', label: 'size — a sequence' },
        { value: 'sum', label: 'sum of values — a running total' },
        { value: 'priority', label: 'max priority — a priority queue' },
        { value: 'intervalEnd', label: 'max interval end — an interval map' }] }
  ];

  const METRICS = [
    { id: 'ftr-measure', label: 'Measure at the root', note: 'the monoid product of every element' },
    { id: 'ftr-spine', label: 'Spine levels', note: 'digits at every level, a tree in the middle' },
    { id: 'ftr-visits', label: 'Nodes visited by a split', note: 'over the whole sequence' },
    { id: 'ftr-concat', label: 'Nodes to rejoin the halves', note: 'concatenation, not a rebuild' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The sequence, the cut and the measure', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Split cost as the sequence grows</div>' +
      '<div class="card-body"><div id="ftr-chart"></div>' +
      '<div id="ftr-chart-legend"></div>' +
      '<p class="note" id="ftr-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Four monoids, one structure: same items, same shape, different facts</div>' +
      '<div class="card-body"><table class="ref-table" id="ftr-monoids"><thead><tr>' +
      '<th>Monoid</th><th>What it measures</th><th>Root measure</th><th>Spine</th>' +
      '<th>Elements in the digits</th><th>Digit widths</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ftr-monoids-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What the generality costs, against the things it replaces</div>' +
      '<div class="card-body"><table class="ref-table" id="ftr-cost"><thead><tr>' +
      '<th>Operation</th><th>Finger tree</th><th>Cons list</th><th>Plain array</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ftr-cost-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
