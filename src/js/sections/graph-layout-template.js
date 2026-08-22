/** Markup for "Planarity, layout and drawing". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GraphLayoutTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'lay-shape', kind: 'select', label: 'graph', value: 'planar-grid',
      options: [{ value: 'planar-grid', label: 'grid — planar, and it can be drawn that way' },
        { value: 'random', label: 'random — no structure to find' },
        { value: 'clustered', label: 'clustered — dense groups, few bridges' },
        { value: 'scale-free', label: 'scale-free — a few very busy vertices' },
        { value: 'wheel', label: 'wheel — a rim and a hub' },
        { value: 'bipartite', label: 'bipartite — two sides' }] },
    { id: 'lay-nodes', kind: 'range', label: 'vertices', value: 24, min: 8, max: 48, step: 2 },
    { id: 'lay-seed', kind: 'range', label: 'graph and start-position seed', value: 1, min: 1, max: 20, step: 1 },
    { id: 'lay-pick', kind: 'select', label: 'layout drawn on the map', value: 'force',
      options: [{ value: 'force', label: 'force-directed — Fruchterman-Reingold' },
        { value: 'circular', label: 'circular — every vertex on a ring' },
        { value: 'layered', label: 'layered — Sugiyama, with dummy vertices' }] },
    { id: 'lay-steps', kind: 'range', label: 'force-model iterations', value: 200, min: 20, max: 400, step: 20 }
  ];

  const METRICS = [
    { id: 'lay-crossings', label: 'Edge crossings', note: 'in the layout drawn above' },
    { id: 'lay-best', label: 'Best of the three', note: 'and by how much it wins' },
    { id: 'lay-planar', label: 'Planarity by counting', note: 'Euler rules out; it never rules in' },
    { id: 'lay-energy', label: 'Final energy', note: 'and whether the descent was monotone' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The graph and the layout', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The drawing, with crossings counted rather than judged</div>' +
      '<div class="card-body"><div id="lay-map"></div>' +
      '<p class="note" id="lay-map-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The same graph, three layouts, one objective measure</div>' +
      '<div class="card-body"><table class="ref-table" id="lay-compare"><thead><tr>' +
      '<th>Layout</th><th>Crossings</th><th>Of how many candidate pairs</th><th>Rate</th>' +
      '<th>What it costs</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lay-compare-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The energy the force model is descending, iteration by iteration</div>' +
      '<div class="card-body"><div id="lay-chart"></div><div id="lay-legend"></div>' +
      '<p class="note" id="lay-curve-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Counting arguments prove non-planarity and never prove planarity</div>' +
      '<div class="card-body"><table class="ref-table" id="lay-kuratowski"><thead><tr>' +
      '<th>Graph</th><th>Vertices</th><th>Edges</th><th>Euler bound 3V − 6</th>' +
      '<th>Bipartite bound 2V − 4</th><th>Verdict</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lay-kuratowski-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What the layered algorithm does before it places anything</div>' +
      '<div class="card-body"><div id="lay-sugiyama"></div>' +
      '<p class="note" id="lay-sugiyama-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
