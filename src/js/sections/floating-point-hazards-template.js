/** Markup for "Floating-point hazards". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.FloatingPointHazardsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'fpz-dataset', kind: 'select', label: 'what to sum', value: 'positive-small',
      options: [
        { value: 'positive-small', label: 'one huge value, then many small positives' },
        { value: 'uniform', label: 'uniform values in [0, 1)' },
        { value: 'alternating', label: 'values that alternate in sign' },
        { value: 'geometric', label: 'a geometric series over twenty orders of magnitude' },
        { value: 'clustered', label: 'values clustered far from zero' }
      ] },
    { id: 'fpz-count', kind: 'range', label: 'how many values', value: 200000,
      min: 20000, max: 500000, step: 20000 },
    { id: 'fpz-seed', kind: 'range', label: 'seed', value: 17, min: 1, max: 40, step: 1 },
    { id: 'fpz-quadratic', kind: 'range', label: 'b in the quadratic x² + bx + 1 (as a power of ten)',
      value: 8, min: 1, max: 15, step: 1 }
  ];

  const METRICS = [
    { id: 'fpz-naive', label: 'Naive relative error', note: 'against the exact sum of these doubles' },
    { id: 'fpz-kahan', label: 'Kahan relative error', note: 'the same data, four more operations each' },
    { id: 'fpz-spread', label: 'Spread across orders', note: 'four orderings of one array' },
    { id: 'fpz-variance', label: 'Naive variance error', note: 'the one-pass sum-of-squares formula' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A million values and a quadratic', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Error against the number of values summed</div>' +
      '<div class="card-body"><div id="fpz-chart" class="chart-host"></div>' +
      '<div id="fpz-legend"></div><p class="note" id="fpz-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Five ways to add up the same array</div>' +
      '<div class="card-body"><table class="ref-table" id="fpz-methods"><thead><tr>' +
      '<th>Method</th><th>Sum</th><th>Relative error</th><th>Absolute error</th>' +
      '<th>Operations</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="fpz-methods-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The same values, four orders</div>' +
      '<div class="card-body"><table class="ref-table" id="fpz-orders"><thead><tr>' +
      '<th>Order</th><th>Naive sum</th><th>Doubles away from exact</th>' +
      '<th>Kahan sum</th><th>Doubles away</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="fpz-orders-note"></p></div></div>' +
      '<div class="grid-2" style="margin-top:.875rem">' +
      '<div class="card"><div class="card-header">Variance, three ways</div>' +
      '<div class="card-body"><table class="ref-table" id="fpz-var-table"><thead><tr>' +
      '<th>Method</th><th>Variance</th><th>Relative error</th><th>Negative</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="fpz-var-note"></p></div></div>' +
      '<div class="card"><div class="card-header">Cancellation, and the reformulation that removes it</div>' +
      '<div class="card-body"><table class="ref-table" id="fpz-cancel"><thead><tr>' +
      '<th>Formula</th><th>Root</th><th>Residual when substituted back</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="fpz-cancel-note"></p></div></div>' +
      '</div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Absorption — the point where adding a value does nothing</div>' +
      '<div class="card-body"><table class="ref-table" id="fpz-absorb"><thead><tr>' +
      '<th>Sum</th><th>Result</th><th>Changed</th><th>Addend as a fraction of the local gap</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="fpz-absorb-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
