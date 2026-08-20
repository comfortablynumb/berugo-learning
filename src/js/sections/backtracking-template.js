/** Markup for "Backtracking". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BacktrackingTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'bkt-puzzle', kind: 'select', label: 'puzzle', value: 'inkala',
      options: [{ value: 'easy', label: 'an ordinary puzzle' },
        { value: 'escargot', label: '"escargot"' },
        { value: 'inkala', label: 'Inkala\'s "world\'s hardest"' },
        { value: 'antibrute', label: 'built to defeat first-cell order' },
        { value: 'platinum', label: '"platinum blonde" — where MRV loses' }] },
    { id: 'bkt-heuristic', kind: 'select', label: 'heuristics', value: 'mrv',
      options: [{ value: 'naive', label: 'none — first empty cell, legal digits' },
        { value: 'mrv', label: 'MRV — fewest remaining values first' },
        { value: 'forward', label: 'MRV + forward checking' },
        { value: 'ac3', label: 'MRV + forward checking + propagation' }] },
    { id: 'bkt-budget', kind: 'range', label: 'node budget (thousands)', value: 500, min: 50, max: 2000, step: 50 },
    { id: 'bkt-colour', kind: 'range', label: 'colours for the graph instance', value: 3, min: 2, max: 6, step: 1 }
  ];

  const METRICS = [
    { id: 'bkt-nodes', label: 'Nodes visited', note: 'partial assignments built' },
    { id: 'bkt-backtracks', label: 'Backtracks', note: 'assignments undone' },
    { id: 'bkt-propagations', label: 'Propagated assignments', note: 'cells filled without a guess' },
    { id: 'bkt-solved', label: 'Solved', note: 'inside the node budget' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Puzzle and heuristics', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The grid, with the clues in bold</div>' +
      '<div class="card-body"><div id="bkt-grid"></div>' +
      '<p class="note" id="bkt-grid-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Four heuristic stacks on the same puzzle</div>' +
      '<div class="card-body"><table class="ref-table" id="bkt-heuristics"><thead><tr>' +
      '<th>Heuristics</th><th>Nodes</th><th>Backtracks</th><th>Propagations</th><th>Solved?</th>' +
      '<th>Against no heuristics</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bkt-heuristics-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The same four across every puzzle</div>' +
      '<div class="card-body"><table class="ref-table" id="bkt-matrix"><thead><tr>' +
      '<th>Puzzle</th><th>none</th><th>MRV</th><th>+ forward</th><th>+ propagation</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bkt-matrix-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Graph colouring: the same search, a different constraint</div>' +
      '<div class="card-body"><table class="ref-table" id="bkt-colouring"><thead><tr>' +
      '<th>Vertex order</th><th>Colours</th><th>Nodes</th><th>Backtracks</th><th>Coloured?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bkt-colouring-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
