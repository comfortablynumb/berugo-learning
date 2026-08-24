/** Markup for "Optimisation". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.OptimisationTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'opt-surface', kind: 'select', label: 'surface', value: 'rosenbrock',
      options: [
        { value: 'rosenbrock', label: 'Rosenbrock’s banana — the classic hard case' },
        { value: 'valley', label: 'an elongated valley, κ = 100' },
        { value: 'rotated', label: 'the same valley, rotated 45°' },
        { value: 'quadratic', label: 'a round bowl, κ = 1' }
      ] },
    { id: 'opt-step', kind: 'select', label: 'fixed step size', value: '0.001',
      options: [
        { value: '0.01', label: '0.01 — diverges on Rosenbrock' },
        { value: '0.003', label: '0.003' },
        { value: '0.001', label: '0.001 — survives, and crawls' }
      ] },
    { id: 'opt-paths', kind: 'checkbox', label: 'draw the optimiser paths on the contours',
      value: true }
  ];

  const METRICS = [
    { id: 'opt-fixed', label: 'Fixed step', note: 'iterations, and whether it survived' },
    { id: 'opt-search', label: 'With a line search', note: 'the same descent, no step to tune' },
    { id: 'opt-bfgs', label: 'BFGS', note: 'curvature learned from the gradients' },
    { id: 'opt-newton', label: 'Newton', note: 'curvature computed exactly' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A surface and a step rule', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Contours, with each optimiser’s path</div>' +
      '<div class="card-body"><div id="opt-chart" class="chart-host"></div>' +
      '<div id="opt-legend"></div><p class="note" id="opt-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Five ways down the same surface</div>' +
      '<div class="card-body"><table class="ref-table" id="opt-race"><thead><tr>' +
      '<th>Method</th><th>Iterations</th><th>Gradient evaluations</th><th>Final objective</th>' +
      '<th>Distance to the minimum</th><th>Monotone</th><th>Outcome</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="opt-race-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The step size, either side of the stability limit</div>' +
      '<div class="card-body"><table class="ref-table" id="opt-stability"><thead><tr>' +
      '<th>Step, as a fraction of the limit</th><th>Step</th><th>Iterations</th>' +
      '<th>Final objective</th><th>Outcome</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="opt-stability-note"></p></div></div>' +
      '<div class="grid-2" style="margin-top:.875rem">' +
      '<div class="card"><div class="card-header">Conditioning — what descent pays and Newton does not</div>' +
      '<div class="card-body"><table class="ref-table" id="opt-condition"><thead><tr>' +
      '<th>κ</th><th>Gradient descent</th><th>Newton</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="opt-condition-note"></p></div></div>' +
      '<div class="card"><div class="card-header">Coordinate descent, and what a rotation costs it</div>' +
      '<div class="card-body"><table class="ref-table" id="opt-coordinate"><thead><tr>' +
      '<th>Surface</th><th>Iterations</th><th>Evaluations</th><th>Converged</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="opt-coordinate-note"></p></div></div>' +
      '</div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
