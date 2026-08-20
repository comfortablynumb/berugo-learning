/** Markup for "Exhaustive search and the art of pruning". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ExhaustiveSearchTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'xs-size', kind: 'range', label: 'board size n', value: 8, min: 4, max: 10, step: 1 },
    { id: 'xs-early', kind: 'select', label: 'when is the diagonal checked?', value: 'placement',
      options: [{ value: 'placement', label: 'at placement — prune the subtree' },
        { value: 'leaf', label: 'at the leaf — enumerate, then reject' }] },
    { id: 'xs-symmetry', kind: 'select', label: 'symmetry breaking', value: 'off',
      options: [{ value: 'off', label: 'off — search the whole first row' },
        { value: 'on', label: 'on — first row restricted to the left half' }] },
    { id: 'xs-goal', kind: 'select', label: 'goal', value: 'all',
      options: [{ value: 'all', label: 'every solution' },
        { value: 'first', label: 'the first solution' }] },
    { id: 'xs-order', kind: 'select', label: 'column order', value: 'natural',
      options: [{ value: 'natural', label: 'left to right' },
        { value: 'constrained', label: 'most-constrained column first' }] }
  ];

  const METRICS = [
    { id: 'xs-nodes', label: 'Nodes visited', note: 'partial boards the search actually built' },
    { id: 'xs-rejects', label: 'Branches rejected', note: 'placements the pruning refused' },
    { id: 'xs-ratio', label: 'Against the leaf-only control', note: 'the same search, check moved' },
    { id: 'xs-solutions', label: 'Solutions found', note: 'must not change when a pruning is added' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Which prunings are switched on', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The search tree — grey is rejected, blue is explored</div>' +
      '<div class="card-body"><div id="xs-tree"></div>' +
      '<p class="note" id="xs-tree-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every configuration on the same board</div>' +
      '<div class="card-body"><table class="ref-table" id="xs-configs"><thead><tr>' +
      '<th>Configuration</th><th>Nodes</th><th>Rejected</th><th>Solutions</th><th>Against the control</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="xs-configs-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Nodes per depth</div>' +
      '<div class="card-body"><div id="xs-levels"></div>' +
      '<p class="note" id="xs-levels-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Two prunings multiply</div>' +
      '<div class="card-body"><table class="ref-table" id="xs-multiply"><thead><tr>' +
      '<th>Prunings on</th><th>Nodes</th><th>Fraction of the control</th><th>Predicted by multiplying</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="xs-multiply-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
