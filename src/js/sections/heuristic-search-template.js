/** Markup for "Heuristic search: A* and friends". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HeuristicSearchTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'heu-terrain', kind: 'select', label: 'terrain', value: 'weighted',
      options: [{ value: 'weighted', label: 'weighted grid — steps cost 1 to 9' },
        { value: 'uniform', label: 'uniform grid — every step costs 1' }] },
    { id: 'heu-side', kind: 'range', label: 'grid side', value: 40, min: 10, max: 60, step: 2 },
    { id: 'heu-seed', kind: 'range', label: 'terrain seed', value: 7, min: 1, max: 40, step: 1 },
    { id: 'heu-pick', kind: 'select', label: 'heuristic drawn on the map', value: 'manhattan',
      options: [{ value: 'none', label: 'none — this is plain Dijkstra' },
        { value: 'manhattan', label: 'Manhattan — admissible and consistent' },
        { value: 'euclidean', label: 'Euclidean — admissible and looser' },
        { value: 'alt', label: 'ALT — two landmarks, real distances' },
        { value: 'inflated', label: 'Manhattan x5 — inadmissible on purpose' }] },
    { id: 'heu-scale', kind: 'range', label: 'weighted A*: multiplier on h (x10)', value: 10, min: 10, max: 50, step: 5 },
    { id: 'heu-reopen', kind: 'checkbox', label: 'reopen a closed node when its cost falls', value: true }
  ];

  const METRICS = [
    { id: 'heu-cost', label: 'Path cost', note: 'what the search returned' },
    { id: 'heu-expanded', label: 'Nodes expanded', note: 'the work the heuristic saved or added' },
    { id: 'heu-gap', label: 'Optimality gap', note: 'how far above the true shortest path' },
    { id: 'heu-safe', label: 'Admissible and consistent?', note: 'checked against exact distances' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The query', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The terrain, what was expanded, and the path found</div>' +
      '<div class="card-body"><div id="heu-map"></div>' +
      '<p class="note" id="heu-map-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every heuristic on the same query</div>' +
      '<div class="card-body"><table class="ref-table" id="heu-compare"><thead><tr>' +
      '<th>Search</th><th>Cost</th><th>Expanded</th><th>Reopened</th><th>Gap</th>' +
      '<th>Admissible</th><th>Consistent</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="heu-compare-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Admissible but inconsistent: what the reopen check is worth</div>' +
      '<div class="card-body"><div id="heu-reopening"></div>' +
      '<p class="note" id="heu-reopening-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">ALT: how many landmarks are worth precomputing</div>' +
      '<div class="card-body"><table class="ref-table" id="heu-landmarks"><thead><tr>' +
      '<th>Landmarks</th><th>Cost</th><th>Expanded</th><th>Against Dijkstra</th><th>Admissible</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="heu-landmarks-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Searching from both ends, on four query shapes</div>' +
      '<div class="card-body"><table class="ref-table" id="heu-bidirectional"><thead><tr>' +
      '<th>Query</th><th>Dijkstra settles</th><th>Bidirectional expands</th><th>Saving</th>' +
      '<th>Same distance?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="heu-bidirectional-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">IDA*: what a frontier-free search costs</div>' +
      '<div class="card-body"><div id="heu-memory"></div>' +
      '<p class="note" id="heu-memory-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
