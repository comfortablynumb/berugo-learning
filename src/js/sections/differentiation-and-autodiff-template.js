/** Markup for "Differentiation, integration and autodiff". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DifferentiationAndAutodiffTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ad-panels', kind: 'range', label: 'panels for the quadrature rules', value: 8,
      min: 2, max: 64, step: 2 },
    { id: 'ad-fixture', kind: 'select', label: 'function for the computation graph',
      value: 'trigonometric',
      options: [
        { value: 'polynomial', label: 'x² + 3xy + y³' },
        { value: 'trigonometric', label: 'sin(xy) + eˣ' },
        { value: 'rosenbrock', label: '(1 − x)² + 100(y − x²)²' }
      ] },
    { id: 'ad-at', kind: 'range', label: 'point to differentiate sin at (÷10)', value: 10,
      min: 1, max: 30, step: 1 }
  ];

  const METRICS = [
    { id: 'ad-forward-h', label: 'Best step for a forward difference', note: 'measured, not derived' },
    { id: 'ad-central-h', label: 'Best step for a central difference', note: 'a different optimum' },
    { id: 'ad-complex', label: 'Complex-step error', note: 'no subtraction, so no cancellation' },
    { id: 'ad-ratio', label: 'Reverse mode’s cost advantage', note: 'on the widest fixture' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A step size, a rule and a function',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The V curve: truncation on the right, rounding on the left</div>' +
      '<div class="card-body"><div id="ad-chart" class="chart-host"></div>' +
      '<div id="ad-legend"></div><p class="note" id="ad-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Where each rule bottoms out, against what the theory predicts</div>' +
      '<div class="card-body"><table class="ref-table" id="ad-step"><thead><tr>' +
      '<th>Rule</th><th>Best step measured</th><th>Predicted optimum</th><th>Error there</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ad-step-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Quadrature — the only fair comparison is error per evaluation</div>' +
      '<div class="card-body"><table class="ref-table" id="ad-quadrature"><thead><tr>' +
      '<th>Rule</th><th>Value</th><th>Error</th><th>Function evaluations</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ad-quadrature-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Gauss–Legendre is exact to degree 2n − 1, and not to 2n</div>' +
      '<div class="card-body"><table class="ref-table" id="ad-gauss"><thead><tr>' +
      '<th>Points</th><th>Exact up to degree</th><th>Error at that degree</th>' +
      '<th>Error one degree higher</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ad-gauss-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Autodiff — exact gradients, and the cost that made training possible</div>' +
      '<div class="card-body"><table class="ref-table" id="ad-race"><thead><tr>' +
      '<th>Function</th><th>Inputs</th><th>Forward-mode error</th><th>Reverse-mode error</th>' +
      '<th>Central-difference error</th><th>Forward passes</th><th>Reverse passes</th>' +
      '<th>Operation ratio</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ad-race-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The tape, with the reverse sweep’s adjoints beside each value</div>' +
      '<div class="card-body"><table class="ref-table" id="ad-tape"><thead><tr>' +
      '<th>Node</th><th>Built from</th><th>Value</th><th>Local partials</th><th>Adjoint</th>' +
      '<th>Role</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ad-tape-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
