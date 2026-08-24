/** Markup for "Linear systems". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LinearSystemsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ls-epsilon', kind: 'select', label: 'the tiny leading pivot', value: '1e-18',
      options: [
        { value: '1e-4', label: '1e-4 — small, and survivable' },
        { value: '1e-10', label: '1e-10' },
        { value: '1e-18', label: '1e-18 — and never exactly zero' }
      ] },
    { id: 'ls-size', kind: 'range', label: 'iterative system size', value: 40,
      min: 8, max: 96, step: 8 },
    { id: 'ls-scaled', kind: 'checkbox', label: 'scale the rows, so the diagonal varies',
      value: false, note: 'Jacobi preconditioning does nothing on a uniform diagonal' },
    { id: 'ls-omega', kind: 'range', label: 'relaxation factor for SOR (÷100)', value: 180,
      min: 100, max: 195, step: 5 }
  ];

  const METRICS = [
    { id: 'ls-growth', label: 'Growth without pivoting', note: 'every rounding error is multiplied by this' },
    { id: 'ls-pivot-error', label: 'Solution error without pivoting', note: 'against the exact answer' },
    { id: 'ls-cg', label: 'Conjugate gradient iterations', note: 'on the current system' },
    { id: 'ls-precond', label: 'After Jacobi preconditioning', note: 'the same system, rescaled' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A pivot, a system size and a relaxation factor',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Residual per iteration, against the bound</div>' +
      '<div class="card-body"><div id="ls-chart" class="chart-host"></div>' +
      '<div id="ls-legend"></div><p class="note" id="ls-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The same elimination, with pivoting and without</div>' +
      '<div class="card-body"><table class="ref-table" id="ls-pivot"><thead><tr>' +
      '<th>Pivoting</th><th>Row swaps</th><th>Growth factor</th><th>Answer</th>' +
      '<th>Relative residual</th><th>Relative error</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ls-pivot-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Wilkinson’s matrix — partial pivoting never swaps, and the growth is 2ⁿ⁻¹</div>' +
      '<div class="card-body"><table class="ref-table" id="ls-wilkinson"><thead><tr>' +
      '<th>Size</th><th>Row swaps</th><th>Growth factor</th><th>2ⁿ⁻¹</th><th>Matches</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ls-wilkinson-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Iterative methods on the same system</div>' +
      '<div class="card-body"><table class="ref-table" id="ls-iterative"><thead><tr>' +
      '<th>Method</th><th>Iterations</th><th>Final residual</th><th>Outcome</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ls-iterative-note"></p></div></div>' +
      '<div class="grid-2" style="margin-top:.875rem">' +
      '<div class="card"><div class="card-header">Finding the relaxation factor by sweeping it</div>' +
      '<div class="card-body"><table class="ref-table" id="ls-omega-table"><thead><tr>' +
      '<th>ω</th><th>Iterations</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ls-omega-note"></p></div></div>' +
      '<div class="card"><div class="card-header">Factor once, or invert — and why one of these is a rule</div>' +
      '<div class="card-body"><table class="ref-table" id="ls-reuse"><thead><tr>' +
      '<th>Approach</th><th>Factorisations</th><th>Worst relative error</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ls-reuse-note"></p></div></div>' +
      '</div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
