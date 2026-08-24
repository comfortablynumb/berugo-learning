/** Markup for "PTAS, FPTAS and the limits of approximation". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ApproximationSchemesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'sch-epsilon', kind: 'select', label: 'the accuracy you are asking for', value: '0.5',
      options: [
        { value: '0.5', label: 'ε = 0.5 — promise half the optimum' },
        { value: '0.2', label: 'ε = 0.2' },
        { value: '0.1', label: 'ε = 0.1' },
        { value: '0.05', label: 'ε = 0.05' },
        { value: '0.01', label: 'ε = 0.01 — and the table stops shrinking' }
      ] },
    { id: 'sch-count', kind: 'range', label: 'items', value: 20, min: 12, max: 32, step: 4 },
    { id: 'sch-family', kind: 'select', label: 'instance family', value: 'correlated',
      options: [
        { value: 'correlated', label: 'strongly correlated — profit = weight + 100, the hard case' },
        { value: 'random', label: 'independent profits and weights — the easy case' }
      ] }
  ];

  const METRICS = [
    { id: 'sch-ratio', label: 'Achieved', note: 'fraction of the optimum at the chosen ε' },
    { id: 'sch-guarantee', label: 'Promised', note: 'what the theorem obliges it to reach' },
    { id: 'sch-cells', label: 'Table size', note: 'against the exact DP at the same instance' },
    { id: 'sch-scale', label: 'Scaling divisor K', note: 'below 1 and the scheme stops saving' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'An accuracy and an instance', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Accuracy against table size, across the ε range</div>' +
      '<div class="card-body"><div id="sch-chart" class="chart-host"></div>' +
      '<div id="sch-legend"></div><p class="note" id="sch-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The ε dial, end to end</div>' +
      '<div class="card-body"><table class="ref-table" id="sch-sweep"><thead><tr>' +
      '<th>ε</th><th>Scaling divisor K</th><th>Value</th><th>Fraction of optimum</th>' +
      '<th>Promised at least</th><th>Table cells</th><th>Cheaper than exact?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="sch-sweep-note"></p></div></div>' +
      '<div class="grid-2" style="margin-top:.875rem">' +
      '<div class="card"><div class="card-header">A PTAS at each k, against the FPTAS at the same guarantee</div>' +
      '<div class="card-body"><table class="ref-table" id="sch-compare"><thead><tr>' +
      '<th>k</th><th>Guarantee</th><th>PTAS value</th><th>Subsets enumerated</th>' +
      '<th>FPTAS value</th><th>FPTAS cells</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="sch-compare-note"></p></div></div>' +
      '<div class="card"><div class="card-header">Scaling the wrong axis, and the greedy that has no bound</div>' +
      '<div class="card-body"><table class="ref-table" id="sch-broken"><thead><tr>' +
      '<th>Algorithm</th><th>Value</th><th>Weight against capacity</th><th>Verdict</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="sch-broken-note"></p></div></div>' +
      '</div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What each class of problem admits</div>' +
      '<div class="card-body"><table class="ref-table" id="sch-classes"><thead><tr>' +
      '<th>Problem</th><th>Best known</th><th>Better is impossible unless…</th><th>Class</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="sch-classes-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
