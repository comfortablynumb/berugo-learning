/** Markup for "Shortest paths II: negative weights and all pairs". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.NegativeWeightsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'neg-currencies', kind: 'select', label: 'exchange-rate table', value: 'arbitrage',
      options: [{ value: 'arbitrage', label: 'four currencies with an arbitrage loop' },
        { value: 'fair', label: 'four currencies, no profit available' },
        { value: 'wide', label: 'six currencies, one deep loop' }] },
    { id: 'neg-nodes', kind: 'range', label: 'nodes in the all-pairs graph', value: 40, min: 6, max: 160, step: 2 },
    { id: 'neg-density', kind: 'range', label: 'edges per node', value: 3, min: 1, max: 8, step: 1 },
    { id: 'neg-seed', kind: 'range', label: 'instance seed', value: 9, min: 1, max: 40, step: 1 }
  ];

  const METRICS = [
    { id: 'neg-cycle', label: 'Negative cycle found', note: 'extracted, not merely detected' },
    { id: 'neg-profit', label: 'Round-trip multiplier', note: 'above 1.0 is a real profit' },
    { id: 'neg-rounds', label: 'Bellman-Ford rounds', note: 'with an early exit when nothing changes' },
    { id: 'neg-apsp', label: 'All-pairs cells', note: 'n squared, whatever the edge count' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Rate table and all-pairs graph', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The arbitrage loop, if one exists</div>' +
      '<div class="card-body"><div id="neg-arbitrage"></div>' +
      '<p class="note" id="neg-arbitrage-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Detecting the cycle against extracting it</div>' +
      '<div class="card-body"><table class="ref-table" id="neg-extract"><thead><tr>' +
      '<th>Step</th><th>Result</th><th>What it is worth</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="neg-extract-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The Floyd-Warshall loop order is not a style choice</div>' +
      '<div class="card-body"><table class="ref-table" id="neg-floyd"><thead><tr>' +
      '<th>Loop order</th><th>Cells differing from the truth</th><th>Relaxations</th>' +
      '<th>Terminates?</th><th>Correct?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="neg-floyd-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">All pairs: three routes to the same matrix</div>' +
      '<div class="card-body"><table class="ref-table" id="neg-allpairs"><thead><tr>' +
      '<th>Method</th><th>Complexity</th><th>Relaxations</th><th>Handles negative edges?</th>' +
      '<th>Agrees?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="neg-allpairs-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Johnson\'s potentials, making every edge non-negative</div>' +
      '<div class="card-body"><table class="ref-table" id="neg-johnson"><thead><tr>' +
      '<th>Edge</th><th>Original weight</th><th>h(u)</th><th>h(v)</th><th>Reweighted</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="neg-johnson-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
