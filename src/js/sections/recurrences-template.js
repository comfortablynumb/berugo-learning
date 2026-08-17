/** Markup for "Recurrences". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RecurrencesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'rec-a', kind: 'range', label: 'a (subproblems)', value: 2, min: 1, max: 8, step: 1 },
    { id: 'rec-b', kind: 'range', label: 'b (size divisor)', value: 2, min: 2, max: 8, step: 1 },
    { id: 'rec-k', kind: 'range', label: 'k in f(n) = n^k', value: 1, min: 0, max: 3, step: 0.5 },
    { id: 'rec-p', kind: 'range', label: 'p in f(n) = n^k·log^p n', value: 0, min: -2, max: 2, step: 1 },
    { id: 'rec-n', kind: 'range', label: 'n', value: 1024, min: 64, max: 8192, step: 64,
      note: 'Presets: merge sort is a=2, b=2, k=1. Binary search is a=1, b=2, k=0.' }
  ];

  const METRICS = [
    { id: 'rec-case', label: 'Master case', note: 'which part of the tree dominates' },
    { id: 'rec-solution', label: 'Solution', note: 'Θ(...) for this recurrence' },
    { id: 'rec-critical', label: 'Critical exponent', note: 'log_b(a)' },
    { id: 'rec-balance', label: 'Root vs leaves', note: 'work at the top against the bottom' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'T(n) = a·T(n/b) + f(n)', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Work per level</div>' +
      '<div class="card-body"><div id="rec-chart"></div><div id="rec-legend"></div></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem"><div class="card-header">The tree, level by level</div>' +
      '<div class="card-body"><table class="ref-table" id="rec-levels"><thead><tr>' +
      '<th>Level</th><th>Subproblems</th><th>Size</th><th>Work</th><th>Share of total</th>' +
      '</tr></thead><tbody></tbody></table></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
