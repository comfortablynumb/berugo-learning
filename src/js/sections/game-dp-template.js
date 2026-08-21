/** Markup for "Game DP and combinatorial games". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GameDpTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'gdp-game', kind: 'select', label: 'impartial game', value: 'nim',
      options: [{ value: 'nim', label: 'Nim — take any number from one heap' },
        { value: 'sub134', label: 'subtraction game {1, 3, 4}' },
        { value: 'sub12', label: 'subtraction game {1, 2}' },
        { value: 'sub235', label: 'subtraction game {2, 3, 5}' }] },
    { id: 'gdp-heaps', kind: 'range', label: 'heap size (three equal heaps)', value: 7, min: 1, max: 14, step: 1 },
    { id: 'gdp-limit', kind: 'range', label: 'Grundy table size', value: 40, min: 10, max: 120, step: 5 },
    { id: 'gdp-order', kind: 'select', label: 'alpha-beta move ordering', value: 'centre',
      options: [{ value: 'centre', label: 'centre, then corners, then edges' },
        { value: 'none', label: 'none — board order' },
        { value: 'reverse', label: 'board order reversed' },
        { value: 'edges', label: 'edges, then corners, then centre' }] }
  ];

  const METRICS = [
    { id: 'gdp-minimax', label: 'Minimax nodes', note: 'the whole tic-tac-toe tree' },
    { id: 'gdp-ab', label: 'Alpha-beta nodes', note: 'the same value, under the selected ordering' },
    { id: 'gdp-saving', label: 'Saving', note: 'entirely at the mercy of move ordering' },
    { id: 'gdp-grundy', label: 'Grundy of the sum', note: 'zero means the player to move loses' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Game and search settings', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Move ordering decides how much alpha-beta is worth</div>' +
      '<div class="card-body"><table class="ref-table" id="gdp-ordering"><thead><tr>' +
      '<th>Ordering</th><th>Value</th><th>Nodes</th><th>Branches pruned</th><th>Against minimax</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="gdp-ordering-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The Grundy table, and the period it settles into</div>' +
      '<div class="card-body"><div id="gdp-table"></div>' +
      '<p class="note" id="gdp-table-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Sprague–Grundy against the joint state space</div>' +
      '<div class="card-body"><table class="ref-table" id="gdp-sum"><thead><tr>' +
      '<th>Method</th><th>States examined</th><th>Verdict</th><th>Agrees?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="gdp-sum-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Retrograde analysis: labelling a game backwards from its ends</div>' +
      '<div class="card-body"><table class="ref-table" id="gdp-retro"><thead><tr>' +
      '<th>Label</th><th>Positions</th><th>Meaning</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="gdp-retro-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
