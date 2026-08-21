/** Markup for "Shortest paths I: BFS, 0-1 BFS and Dijkstra". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ShortestPathsBasicsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'spb-rows', kind: 'range', label: 'grid side', value: 30, min: 6, max: 90, step: 2 },
    { id: 'spb-seed', kind: 'range', label: 'terrain seed', value: 7, min: 1, max: 40, step: 1 },
    { id: 'spb-range', kind: 'range', label: 'weight range (1 means unweighted)', value: 9, min: 1, max: 30, step: 1 },
    { id: 'spb-target', kind: 'range', label: 'target, as a percentage along the grid', value: 100, min: 5, max: 100, step: 5 }
  ];

  const METRICS = [
    { id: 'spb-distance', label: 'Shortest distance', note: 'checked against Bellman-Ford' },
    { id: 'spb-settled', label: 'Nodes settled', note: 'Dijkstra, running to the target' },
    { id: 'spb-stale', label: 'Stale heap entries skipped', note: 'the cost of a lazy heap' },
    { id: 'spb-pathcost', label: 'Path re-walked', note: 'the reported path, costed edge by edge' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Terrain and query', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Settled nodes, and the path found</div>' +
      '<div class="card-body"><div id="spb-canvas"></div>' +
      '<p class="note" id="spb-canvas-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Four algorithms, one query</div>' +
      '<div class="card-body"><table class="ref-table" id="spb-methods"><thead><tr>' +
      '<th>Algorithm</th><th>Distance</th><th>Nodes settled</th><th>Relaxations</th>' +
      '<th>Disagreements with Bellman-Ford</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="spb-methods-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The invariant, and the edge that breaks it</div>' +
      '<div class="card-body"><div id="spb-negative"></div>' +
      '<p class="note" id="spb-negative-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">A lazy heap against an indexed one</div>' +
      '<div class="card-body"><table class="ref-table" id="spb-heap"><thead><tr>' +
      '<th>Quantity</th><th>Count</th><th>What it costs</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="spb-heap-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">When the weights are only 0 and 1</div>' +
      '<div class="card-body"><table class="ref-table" id="spb-zeroone"><thead><tr>' +
      '<th>Method</th><th>Structure</th><th>Comparisons</th><th>Complexity</th><th>Same answer?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="spb-zeroone-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
