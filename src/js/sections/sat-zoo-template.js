/** Markup for "SAT and the NP-complete zoo". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SatZooTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'saz-variables', kind: 'range', label: 'variables per family', value: 42, min: 20,
      max: 60, step: 2 },
    { id: 'saz-holes', kind: 'range', label: 'pigeonhole size', value: 6, min: 4, max: 8, step: 1 },
    { id: 'saz-seed', kind: 'select', label: 'instance seed', value: '3',
      options: [
        { value: '1', label: 'seed 1' },
        { value: '3', label: 'seed 3' },
        { value: '11', label: 'seed 11' }
      ] }
  ];

  const METRICS = [
    { id: 'saz-horn', label: 'Horn-SAT, by propagation', note: 'clause visits — no branching at all' },
    { id: 'saz-random', label: 'Random 3-SAT at 4.27', note: 'DPLL search nodes on the same size' },
    { id: 'saz-php', label: 'Pigeonhole', note: 'DPLL search nodes, and it is exactly 2·h! − 1' },
    { id: 'saz-islands', label: 'Polynomial islands', note: 'fragments of SAT with real algorithms' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Four clause families, one size', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The pigeonhole family, hole by hole</div>' +
      '<div class="card-body"><div id="saz-chart" class="chart-host"></div>' +
      '<p class="note" id="saz-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Six clause families of comparable size, and what each costs</div>' +
      '<div class="card-body"><table class="ref-table" id="saz-families"><thead><tr>' +
      '<th>Family</th><th>Horn?</th><th>Variables</th><th>Clauses</th>' +
      '<th>Linear-time steps</th><th>DPLL nodes</th><th>Conflicts</th><th>Answer</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="saz-families-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The pigeonhole principle: a one-sentence fact, and an exponential proof</div>' +
      '<div class="card-body"><table class="ref-table" id="saz-sweep"><thead><tr>' +
      '<th>Holes</th><th>Pigeons</th><th>Variables</th><th>Clauses</th><th>DPLL nodes</th>' +
      '<th>Conflicts</th><th>Nodes ÷ 2·h!</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="saz-sweep-note"></p></div></div>' +
      '<div class="grid-2" style="margin-top:.875rem">' +
      '<div class="card"><div class="card-header">Karp’s chain, one link at a time</div>' +
      '<div class="card-body"><table class="ref-table" id="saz-chain"><thead><tr>' +
      '<th>From</th><th>To</th><th>The gadget</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="saz-chain-note"></p></div></div>' +
      '<div class="card"><div class="card-header">The islands, and why each one is easy</div>' +
      '<div class="card-body"><table class="ref-table" id="saz-island-table"><thead><tr>' +
      '<th>Fragment</th><th>Restriction</th><th>Algorithm</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="saz-island-note"></p></div></div>' +
      '</div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
