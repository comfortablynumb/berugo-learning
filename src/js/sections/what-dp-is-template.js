/** Markup for "What dynamic programming actually is". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.WhatDpIsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'wdp-problem', kind: 'select', label: 'problem', value: 'fibonacci',
      options: [{ value: 'fibonacci', label: 'Fibonacci — a path of subproblems' },
        { value: 'binomial', label: 'binomial coefficient — a lattice' },
        { value: 'grid', label: 'grid paths — two transitions per state' }] },
    { id: 'wdp-n', kind: 'range', label: 'n', value: 25, min: 4, max: 30, step: 1 },
    { id: 'wdp-k', kind: 'range', label: 'k (binomial and grid second axis)', value: 10, min: 1, max: 20, step: 1 },
    { id: 'wdp-budget', kind: 'range', label: 'call budget for the naive run (thousands)', value: 4000, min: 50, max: 4000, step: 50 }
  ];

  const METRICS = [
    { id: 'wdp-calls', label: 'Naive calls', note: 'every subproblem, every time it is needed' },
    { id: 'wdp-states', label: 'Distinct states', note: 'what the memo actually stores' },
    { id: 'wdp-hits', label: 'Memo hits', note: 'calls answered without recomputing' },
    { id: 'wdp-shared', label: 'Shared subproblems', note: 'states with more than one parent' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Problem and size', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Three evaluations of one recurrence</div>' +
      '<div class="card-body"><table class="ref-table" id="wdp-compare"><thead><tr>' +
      '<th>Method</th><th>Answer</th><th>Calls</th><th>States</th><th>Transitions</th><th>Hits</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="wdp-compare-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">States × transitions — the complexity, before any code</div>' +
      '<div class="card-body"><table class="ref-table" id="wdp-predict"><thead><tr>' +
      '<th>Problem</th><th>State</th><th>States</th><th>Transitions each</th>' +
      '<th>Predicted</th><th>Measured</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="wdp-predict-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The subproblem DAG — how often each state is needed</div>' +
      '<div class="card-body"><table class="ref-table" id="wdp-dag"><thead><tr>' +
      '<th>State</th><th>Value</th><th>Parents</th><th>Depth first reached</th><th>Base case?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="wdp-dag-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Tabulation in the wrong order reads cells that are not there yet</div>' +
      '<div class="card-body"><table class="ref-table" id="wdp-order"><thead><tr>' +
      '<th>Evaluation order</th><th>Answer</th><th>States</th><th>Cells read before they were written</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="wdp-order-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
