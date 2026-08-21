/** Markup for "Probability and expectation DP". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ExpectationDpTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'exp-size', kind: 'range', label: 'board squares', value: 20, min: 5, max: 60, step: 1 },
    { id: 'exp-faces', kind: 'range', label: 'die faces', value: 6, min: 2, max: 12, step: 1 },
    { id: 'exp-snakes', kind: 'select', label: 'snakes and ladders', value: 'snakes',
      options: [{ value: 'none', label: 'none — only the overshoot rule' },
        { value: 'snakes', label: 'two snakes — genuine cycles' },
        { value: 'ladders', label: 'two ladders — shortcuts forward' }] },
    { id: 'exp-trials', kind: 'range', label: 'Monte Carlo trials (thousands)', value: 40, min: 5, max: 200, step: 5 }
  ];

  const METRICS = [
    { id: 'exp-expected', label: 'Expected rolls from the start', note: 'solved exactly' },
    { id: 'exp-method', label: 'Method chosen', note: 'decided by detecting a cycle, not by being told' },
    { id: 'exp-mc', label: 'Monte Carlo mean', note: 'the model checked, not the algebra' },
    { id: 'exp-inside', label: 'Inside the interval?', note: 'at 95% confidence' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Board and simulation', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Exact against simulated</div>' +
      '<div class="card-body"><table class="ref-table" id="exp-compare"><thead><tr>' +
      '<th>Quantity</th><th>Value</th><th>Note</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="exp-compare-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Where the recursion stops working</div>' +
      '<div class="card-body"><table class="ref-table" id="exp-cycles"><thead><tr>' +
      '<th>Board</th><th>Acyclic?</th><th>Recursion</th><th>Linear solve</th><th>Expected rolls</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="exp-cycles-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">One equation per state</div>' +
      '<div class="card-body"><div id="exp-system"></div>' +
      '<p class="note" id="exp-system-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Optimal stopping: the secretary problem</div>' +
      '<div class="card-body"><table class="ref-table" id="exp-secretary"><thead><tr>' +
      '<th>Observe the first k</th><th>Probability of picking the best</th><th>k / n</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="exp-secretary-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
