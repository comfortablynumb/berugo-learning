/** Markup for "Colouring, cliques and independent sets". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GraphColoringTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'clr-shape', kind: 'select', label: 'graph', value: 'random',
      options: [{ value: 'random', label: 'random — no structure' },
        { value: 'interval', label: 'interval — overlapping bookings' },
        { value: 'planar-grid', label: 'grid — planar and 2-colourable' },
        { value: 'bipartite', label: 'bipartite — two sides, no odd cycle' },
        { value: 'wheel', label: 'wheel — an odd rim and a hub' },
        { value: 'clustered', label: 'clustered — dense groups, few bridges' },
        { value: 'scale-free', label: 'scale-free — a few very busy vertices' }] },
    { id: 'clr-nodes', kind: 'range', label: 'vertices', value: 18, min: 8, max: 30, step: 1 },
    { id: 'clr-seed', kind: 'range', label: 'graph seed', value: 1, min: 1, max: 40, step: 1 },
    { id: 'clr-order', kind: 'select', label: 'ordering drawn on the map', value: 'degeneracy',
      options: [{ value: 'degeneracy', label: 'degeneracy — smallest-last' },
        { value: 'degree', label: 'degree — Welsh-Powell, largest first' },
        { value: 'natural', label: 'natural — whatever order they arrived in' }] },
    { id: 'clr-registers', kind: 'range', label: 'registers available to the allocator', value: 3, min: 2, max: 8, step: 1 }
  ];

  const METRICS = [
    { id: 'clr-colours', label: 'Colours used', note: 'by the ordering selected above' },
    { id: 'clr-bound', label: 'Degeneracy bound', note: 'greedy in this order never needs more' },
    { id: 'clr-exact', label: 'Chromatic number', note: 'exhaustive, and exponential' },
    { id: 'clr-clique', label: 'Largest clique', note: 'a lower bound on any colouring' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The graph and the allocator', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The colouring, one hue per colour class</div>' +
      '<div class="card-body"><div id="clr-map"></div>' +
      '<p class="note" id="clr-map-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The same graph, three orderings, three answers</div>' +
      '<div class="card-body"><table class="ref-table" id="clr-orders"><thead><tr>' +
      '<th>Ordering</th><th>Colours</th><th>Above the optimum by</th><th>Colour checks</th>' +
      '<th>Conflicts</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="clr-orders-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">One computation, three names</div>' +
      '<div class="card-body"><div id="clr-triple"></div>' +
      '<p class="note" id="clr-triple-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What the pivot saves in the clique search</div>' +
      '<div class="card-body"><table class="ref-table" id="clr-pivot"><thead><tr>' +
      '<th>Search</th><th>Recursion nodes</th><th>Maximal cliques found</th>' +
      '<th>Largest clique</th><th>Saving</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="clr-pivot-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Register allocation, which is this with an escape hatch</div>' +
      '<div class="card-body"><table class="ref-table" id="clr-spill"><thead><tr>' +
      '<th>Registers</th><th>Spilled to memory</th><th>Allocated</th><th>Conflicts</th>' +
      '<th>Enough?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="clr-spill-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
