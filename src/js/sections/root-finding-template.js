/** Markup for "Root finding". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RootFindingTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'rf-function', kind: 'select', label: 'function', value: 'cubic',
      options: [
        { value: 'cubic', label: 'x³ − 2x − 5 — the textbook cubic' },
        { value: 'exponential', label: 'eˣ − 4 — convex, and false position stalls on it' },
        { value: 'arctan', label: 'arctan(x) — Newton diverges past |x| ≈ 1.39' },
        { value: 'multiroot', label: 'x³ − 2x — three roots, and Newton picks the wrong one' },
        { value: 'cycling', label: 'x³ − 2x + 2 — Newton cycles forever from 0' }
      ] },
    { id: 'rf-start', kind: 'range', label: 'starting point for the open methods', value: 30,
      min: -30, max: 50, step: 1,
      note: 'divided by ten, so 30 means 3.0' },
    { id: 'rf-tolerance', kind: 'select', label: 'tolerance', value: '1e-12',
      options: [
        { value: '1e-6', label: '1e-6' },
        { value: '1e-9', label: '1e-9' },
        { value: '1e-12', label: '1e-12' },
        { value: '1e-15', label: '1e-15 — near the floor a double allows' }
      ] }
  ];

  const METRICS = [
    { id: 'rf-fastest', label: 'Fewest function evaluations', note: 'the cost that is actually paid' },
    { id: 'rf-newton-order', label: 'Newton’s measured order', note: 'fitted from the iterates' },
    { id: 'rf-secant-order', label: 'Secant’s measured order', note: 'the golden ratio, 1.618' },
    { id: 'rf-failures', label: 'Methods that did not converge', note: 'of the five' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A function and a starting point', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The error at each iteration</div>' +
      '<div class="card-body"><div id="rf-chart" class="chart-host"></div>' +
      '<div id="rf-legend"></div><p class="note" id="rf-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Five methods on one function</div>' +
      '<div class="card-body"><table class="ref-table" id="rf-race"><thead><tr>' +
      '<th>Method</th><th>Brackets</th><th>Iterations</th><th>Evaluations</th>' +
      '<th>Convergence order</th><th>Bracket contraction</th><th>Outcome</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rf-race-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Newton from nine starting points, on a function with three roots</div>' +
      '<div class="card-body"><table class="ref-table" id="rf-basins"><thead><tr>' +
      '<th>Start</th><th>Root found</th><th>Nearest root</th><th>Iterations</th><th>Outcome</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rf-basins-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The same equation rearranged two ways</div>' +
      '<div class="card-body"><table class="ref-table" id="rf-fixed"><thead><tr>' +
      '<th>Iteration</th><th>|g′| at the root</th><th>Contraction</th><th>Outcome</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rf-fixed-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
