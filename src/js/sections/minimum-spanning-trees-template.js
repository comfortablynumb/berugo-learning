/** Markup for "Minimum spanning trees". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MinimumSpanningTreesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'mst-shape', kind: 'select', label: 'network', value: 'random',
      options: [{ value: 'random', label: 'random — no geometry' },
        { value: 'grid', label: 'weighted grid' },
        { value: 'road-like', label: 'road-like — a grid with fast roads' },
        { value: 'scale-free', label: 'scale-free — a few enormous hubs' }] },
    { id: 'mst-nodes', kind: 'range', label: 'nodes', value: 60, min: 20, max: 200, step: 10 },
    { id: 'mst-density', kind: 'range', label: 'edges per node (x10)', value: 30, min: 12, max: 80, step: 2 },
    { id: 'mst-seed', kind: 'range', label: 'network seed', value: 3, min: 1, max: 40, step: 1 },
    { id: 'mst-weights', kind: 'select', label: 'weights', value: '20',
      options: [{ value: '3', label: '1 to 3 — duplicates everywhere' },
        { value: '20', label: '1 to 20 — some duplicates' },
        { value: '100000', label: '1 to 100 000 — effectively distinct' }] }
  ];

  const METRICS = [
    { id: 'mst-weight', label: 'Tree weight', note: 'the same for all three, or one of them is wrong' },
    { id: 'mst-same', label: 'Identical edge sets?', note: 'equal weight does not mean equal tree' },
    { id: 'mst-work', label: 'Cheapest algorithm here', note: 'measured, not asserted' },
    { id: 'mst-minimax', label: 'Minimax queries wrong', note: 'MST path against a threshold oracle' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The network', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The network, with the spanning tree drawn over it</div>' +
      '<div class="card-body"><div id="mst-map"></div>' +
      '<p class="note" id="mst-map-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Three algorithms, one graph</div>' +
      '<div class="card-body"><table class="ref-table" id="mst-algorithms"><thead><tr>' +
      '<th>Algorithm</th><th>Weight</th><th>Edges</th><th>Work</th><th>Rounds</th>' +
      '<th>Spanning forest?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mst-algorithms-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The cut property, one edge at a time</div>' +
      '<div class="card-body"><table class="ref-table" id="mst-cut"><thead><tr>' +
      '<th>Tree so far</th><th>Next edge</th><th>Nodes inside the cut</th>' +
      '<th>Lightest edge crossing it</th><th>Safe?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mst-cut-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">When is the tree unique?</div>' +
      '<div class="card-body"><div id="mst-uniqueness"></div>' +
      '<p class="note" id="mst-uniqueness-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The minimax path you already computed</div>' +
      '<div class="card-body"><table class="ref-table" id="mst-bottleneck"><thead><tr>' +
      '<th>Query</th><th>Minimax hop via the MST</th><th>Threshold oracle</th>' +
      '<th>Shortest path costs</th><th>Its worst hop</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mst-bottleneck-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The second-best spanning tree</div>' +
      '<div class="card-body"><div id="mst-runner-up"></div>' +
      '<p class="note" id="mst-runner-up-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Where the work goes as the graph fills in</div>' +
      '<div class="card-body"><table class="ref-table" id="mst-cost-curve"><thead><tr>' +
      '<th>Edges</th><th>Kruskal</th><th>Prim</th><th>Borůvka</th><th>Borůvka rounds</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mst-cost-curve-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
