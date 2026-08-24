/** Markup for "Using solvers instead of algorithms". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.UsingSolversTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'slv-n', kind: 'range', label: 'tasks', value: 18, min: 12, max: 24, step: 2 },
    { id: 'slv-clique', kind: 'range', label: 'mutually conflicting group', value: 7, min: 4,
      max: 8, step: 1 },
    { id: 'slv-slots', kind: 'range', label: 'slots offered', value: 6, min: 3, max: 9, step: 1 },
    { id: 'slv-group', kind: 'select', label: 'commander group size', value: '3',
      options: [
        { value: '2', label: '2' },
        { value: '3', label: '3' },
        { value: '5', label: '5' }
      ] }
  ];

  const METRICS = [
    { id: 'slv-answer', label: 'The answer', note: 'and whether every encoding agrees on it' },
    { id: 'slv-clauses', label: 'Clauses, smallest to largest', note: 'the same constraint, three ways' },
    { id: 'slv-symmetry', label: 'Symmetry breaking', note: 'search nodes saved by a handful of unit clauses' },
    { id: 'slv-direct', label: 'A hand-written search', note: 'the same question, no encoding at all' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Assign tasks to slots without a conflict',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">What "at most one of these" costs to write down</div>' +
      '<div class="card-body"><div id="slv-chart" class="chart-host"></div>' +
      '<p class="note" id="slv-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Six models of one problem, and the answer they must all give</div>' +
      '<div class="card-body"><table class="ref-table" id="slv-models"><thead><tr>' +
      '<th>At-most-one encoding</th><th>Symmetry breaking</th><th>Variables</th>' +
      '<th>Of which auxiliary</th><th>Clauses</th><th>Answer</th><th>Search nodes</th>' +
      '<th>Propagations</th><th>Agrees with the direct search</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="slv-models-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">At-most-one over n literals, priced exactly</div>' +
      '<div class="card-body"><table class="ref-table" id="slv-scaling"><thead><tr>' +
      '<th>Literals</th><th>Pairwise clauses</th><th>Commander clauses</th>' +
      '<th>Commander variables</th><th>Sequential clauses</th><th>Sequential variables</th>' +
      '<th>Pairwise ÷ sequential</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="slv-scaling-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The slot count swept across the boundary</div>' +
      '<div class="card-body"><table class="ref-table" id="slv-sweep"><thead><tr>' +
      '<th>Slots</th><th>Answer</th><th>Nodes, plain</th><th>Nodes, symmetry broken</th>' +
      '<th>Factor</th><th>2·slots! − 1</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="slv-sweep-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
