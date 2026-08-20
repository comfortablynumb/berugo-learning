/** Markup for "Branch and bound". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BranchAndBoundTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'bnb-bound', kind: 'select', label: 'bounding function', value: 'fractional',
      options: [{ value: 'fractional', label: 'fractional relaxation — the LP optimum' },
        { value: 'density', label: 'best remaining density — admissible, loose' },
        { value: 'inadmissible', label: '90% of the relaxation — WRONG on purpose' }] },
    { id: 'bnb-items', kind: 'range', label: 'items', value: 22, min: 8, max: 24, step: 1 },
    { id: 'bnb-fill', kind: 'range', label: 'capacity as % of total weight', value: 40, min: 10, max: 90, step: 5 },
    { id: 'bnb-seed', kind: 'range', label: 'instance seed', value: 13, min: 1, max: 40, step: 1 },
    { id: 'bnb-cities', kind: 'range', label: 'cities in the TSP instance', value: 9, min: 5, max: 11, step: 1 }
  ];

  const METRICS = [
    { id: 'bnb-nodes', label: 'Nodes explored', note: 'with the selected bound' },
    { id: 'bnb-pruned', label: 'Subtrees pruned', note: 'each one is a subtree never built' },
    { id: 'bnb-value', label: 'Best value found', note: 'the incumbent when the search ended' },
    { id: 'bnb-exhaustive', label: 'Exhaustive search', note: 'all 2^n subsets, for comparison' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The bound, and the instance', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The search tree — orange nodes were cut by the bound</div>' +
      '<div class="card-body"><div id="bnb-tree"></div>' +
      '<p class="note" id="bnb-tree-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Three bounds on the same instance</div>' +
      '<div class="card-body"><table class="ref-table" id="bnb-bounds"><thead><tr>' +
      '<th>Bound</th><th>Admissible?</th><th>Nodes</th><th>Pruned</th><th>Value found</th><th>Optimal?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bnb-bounds-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">How the incumbent and the bound close on each other</div>' +
      '<div class="card-body"><table class="ref-table" id="bnb-gap"><thead><tr>' +
      '<th>Items considered</th><th>Fractional optimum</th><th>Best integral found</th><th>Gap</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bnb-gap-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The travelling salesman, with the bound and without it</div>' +
      '<div class="card-body"><table class="ref-table" id="bnb-tsp"><thead><tr>' +
      '<th>Search</th><th>Nodes</th><th>Complete tours reached</th><th>Tour length</th><th>Same answer?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bnb-tsp-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
