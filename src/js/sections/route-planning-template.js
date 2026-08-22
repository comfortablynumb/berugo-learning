/** Markup for "Route planning at scale". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RoutePlanningTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'rte-shape', kind: 'select', label: 'network', value: 'road-like',
      options: [{ value: 'road-like', label: 'road-like — a grid with a few fast roads' },
        { value: 'weighted-grid', label: 'weighted grid — every step costs 1 to 9' },
        { value: 'grid', label: 'uniform grid — every step costs 1' },
        { value: 'random', label: 'random — no geometry at all' },
        { value: 'path', label: 'path — nothing to contract around' },
        { value: 'barbell', label: 'barbell — two cliques and one link' }] },
    { id: 'rte-side', kind: 'range', label: 'grid side (nodes = side squared)', value: 6, min: 4, max: 10, step: 1 },
    { id: 'rte-seed', kind: 'range', label: 'network seed', value: 11, min: 1, max: 40, step: 1 },
    { id: 'rte-witness', kind: 'select', label: 'witness search', value: 'bounded',
      options: [{ value: 'bounded', label: 'bounded — correct' },
        { value: 'none', label: 'none — shortcut every pair, slow but correct' },
        { value: 'ignore-contracted', label: 'through contracted nodes — the bug' }] },
    { id: 'rte-hops', kind: 'range', label: 'witness hop limit', value: 5, min: 2, max: 8, step: 1 }
  ];

  const METRICS = [
    { id: 'rte-shortcuts', label: 'Shortcuts added', note: 'what preprocessing cost in edges' },
    { id: 'rte-growth', label: 'Edge growth', note: 'the query graph against the original' },
    { id: 'rte-settled', label: 'Settled: Dijkstra to CH', note: 'the query saving, in nodes' },
    { id: 'rte-wrong', label: 'Wrong pairs', note: 'every pair, checked against Dijkstra' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The network and its preprocessing', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The network, with the top of the hierarchy marked</div>' +
      '<div class="card-body"><div id="rte-map"></div>' +
      '<p class="note" id="rte-map-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">One query, three searches</div>' +
      '<div class="card-body"><table class="ref-table" id="rte-query"><thead><tr>' +
      '<th>Search</th><th>Distance</th><th>Nodes settled</th><th>Against plain Dijkstra</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rte-query-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The witness search, and the two ways to get it wrong</div>' +
      '<div class="card-body"><table class="ref-table" id="rte-modes"><thead><tr>' +
      '<th>Witness search</th><th>Shortcuts</th><th>Edge growth</th><th>Witness steps</th>' +
      '<th>Wrong pairs</th><th>Reported unreachable</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rte-modes-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every pair of every fixture, against Dijkstra</div>' +
      '<div class="card-body"><table class="ref-table" id="rte-fixtures"><thead><tr>' +
      '<th>Fixture</th><th>Nodes</th><th>Edges</th><th>Shortcuts</th><th>Pairs checked</th>' +
      '<th>Wrong</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rte-fixtures-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What preprocessing buys as the network grows</div>' +
      '<div class="card-body"><table class="ref-table" id="rte-scale"><thead><tr>' +
      '<th>Network</th><th>Nodes</th><th>Shortcuts</th><th>Witness steps</th>' +
      '<th>Dijkstra settles</th><th>Bidirectional</th><th>CH</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rte-scale-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Truncating the witness search, which is safe in one direction only</div>' +
      '<div class="card-body"><div id="rte-truncation"></div>' +
      '<p class="note" id="rte-truncation-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
