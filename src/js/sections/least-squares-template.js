/** Markup for "Least squares, QR and the SVD". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LeastSquaresTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'lsq-degree', kind: 'range', label: 'polynomial degree to read out', value: 10,
      min: 2, max: 14, step: 2 },
    { id: 'lsq-noise', kind: 'select', label: 'noise on the data', value: '0',
      options: [
        { value: '0', label: 'none — the data is exactly eˣ' },
        { value: '0.0001', label: '1e-4' },
        { value: '0.01', label: '1e-2 — visible noise' }
      ] },
    { id: 'lsq-rank', kind: 'range', label: 'rank to truncate the SVD to', value: 6,
      min: 1, max: 12, step: 1 }
  ];

  const METRICS = [
    { id: 'lsq-condition', label: 'Condition number of the fit', note: 'of the design matrix' },
    { id: 'lsq-normal', label: 'Of the normal equations', note: 'the same problem, squared' },
    { id: 'lsq-loss', label: 'Best orthogonality achieved', note: 'Householder, on a degree-9 fit' },
    { id: 'lsq-worst', label: 'Worst', note: 'classical Gram–Schmidt, same matrix' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A fit, some noise and a truncation rank',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Singular values, and what truncating costs</div>' +
      '<div class="card-body"><div id="lsq-chart" class="chart-host"></div>' +
      '<div id="lsq-legend"></div><p class="note" id="lsq-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The normal equations against QR, as the degree rises</div>' +
      '<div class="card-body"><table class="ref-table" id="lsq-fitting"><thead><tr>' +
      '<th>Degree</th><th>κ(A)</th><th>κ(AᵀA)</th><th>Ratio to κ(A)²</th>' +
      '<th>QR residual</th><th>Normal-equations residual</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lsq-fitting-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Three ways to compute the same QR factorisation</div>' +
      '<div class="card-body"><table class="ref-table" id="lsq-orthogonality"><thead><tr>' +
      '<th>Method</th><th>Departure from orthogonality</th><th>Relative to Householder</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lsq-orthogonality-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Low-rank approximation — and the bound depends which norm you asked in</div>' +
      '<div class="card-body"><table class="ref-table" id="lsq-truncation"><thead><tr>' +
      '<th>Rank kept</th><th>σₖ</th><th>Spectral bound (σₖ₊₁)</th><th>Frobenius bound</th>' +
      '<th>Measured (Frobenius)</th><th>Numbers stored</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lsq-truncation-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
