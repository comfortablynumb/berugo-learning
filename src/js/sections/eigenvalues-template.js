/** Markup for "Eigenvalues and the QR algorithm". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.EigenvaluesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'eig-gap', kind: 'select', label: 'ratio between the top two eigenvalues', value: '0.9',
      options: [
        { value: '0.1', label: '0.1 — well separated' },
        { value: '0.5', label: '0.5' },
        { value: '0.9', label: '0.9' },
        { value: '0.99', label: '0.99 — nearly a tie' }
      ] },
    { id: 'eig-offset', kind: 'range', label: 'how far the shift misses its target (÷100)',
      value: 20, min: 1, max: 90, step: 1 },
    { id: 'eig-perturbation', kind: 'select', label: 'perturbation to one polynomial coefficient',
      value: '1e-10',
      options: [
        { value: '1e-14', label: '1e-14 — a single rounding' },
        { value: '1e-10', label: '1e-10' },
        { value: '1e-7', label: '1e-7' }
      ] }
  ];

  const METRICS = [
    { id: 'eig-power', label: 'Power iteration steps', note: 'at the chosen gap' },
    { id: 'eig-predicted', label: 'What the gap predicts', note: 'log(tolerance) / log(gap)' },
    { id: 'eig-shift', label: 'Shifted inverse steps', note: 'for any eigenvalue you name' },
    { id: 'eig-qr', label: 'QR algorithm steps', note: 'for the whole spectrum at once' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A spectral gap, a shift and a perturbation',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The subdiagonal, on its way to zero</div>' +
      '<div class="card-body"><div id="eig-chart" class="chart-host"></div>' +
      '<div id="eig-legend"></div><p class="note" id="eig-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Power iteration — the cost is set by the gap, and by nothing else</div>' +
      '<div class="card-body"><table class="ref-table" id="eig-gap-table"><thead><tr>' +
      '<th>λ₂/λ₁</th><th>Iterations</th><th>Predicted</th><th>Eigenvalue found</th>' +
      '<th>Residual</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="eig-gap-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Shifted inverse iteration — name an eigenvalue, get it</div>' +
      '<div class="card-body"><table class="ref-table" id="eig-inverse"><thead><tr>' +
      '<th>Eigenvalue wanted</th><th>Shift used</th><th>Found</th><th>Iterations</th>' +
      '<th>Correct</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="eig-inverse-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Wilkinson’s polynomial — why nobody computes eigenvalues this way</div>' +
      '<div class="card-body"><table class="ref-table" id="eig-polynomial"><thead><tr>' +
      '<th>Degree</th><th>Coefficient perturbed</th><th>Its magnitude</th>' +
      '<th>How far the root moved</th><th>Amplification</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="eig-polynomial-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
