/** Markup for "General and weighted matching". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GeneralMatchingTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'gmt-source', kind: 'select', label: 'graph', value: 'fixture',
      options: [{ value: 'fixture', label: 'the six-vertex counter-example' },
        { value: 'random', label: 'random, with a planted five-cycle' },
        { value: 'bipartite', label: 'random with no odd cycle at all' }] },
    { id: 'gmt-order', kind: 'select', label: 'neighbour order', value: 'failing',
      options: [{ value: 'failing', label: 'as found — the order that breaks the naive search' },
        { value: 'sorted', label: 'sorted ascending — the same graph, a lucky order' }] },
    { id: 'gmt-nodes', kind: 'range', label: 'vertices, random graph', value: 12, min: 6, max: 14, step: 1 },
    { id: 'gmt-edges', kind: 'range', label: 'edges, random graph', value: 16, min: 8, max: 30, step: 1 },
    { id: 'gmt-seed', kind: 'range', label: 'graph seed', value: 1, min: 1, max: 40, step: 1 },
    { id: 'gmt-size', kind: 'range', label: 'workers in the assignment problem', value: 6, min: 3, max: 8, step: 1 },
    { id: 'gmt-cost', kind: 'range', label: 'largest cost', value: 20, min: 4, max: 60, step: 1 }
  ];

  const METRICS = [
    { id: 'gmt-blossom', label: 'Maximum matching', note: 'Edmonds, with blossom contraction' },
    { id: 'gmt-naive', label: 'Without contraction', note: 'the bipartite argument, on a graph that breaks it' },
    { id: 'gmt-optimal', label: 'Matches brute force?', note: 'exhaustive search over every pairing' },
    { id: 'gmt-assignment', label: 'Assignment cost', note: 'Hungarian, against the greedy answer' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The graph and the cost matrix', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The matching, with the odd cycle drawn out</div>' +
      '<div class="card-body"><div id="gmt-map"></div>' +
      '<p class="note" id="gmt-map-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Three methods on the same graph</div>' +
      '<div class="card-body"><table class="ref-table" id="gmt-compare"><thead><tr>' +
      '<th>Method</th><th>Matching size</th><th>Augmenting paths</th><th>Blossoms contracted</th>' +
      '<th>Edges examined</th><th>Correct?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="gmt-compare-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">How often the shortcut is wrong, and by how much</div>' +
      '<div class="card-body"><table class="ref-table" id="gmt-rate"><thead><tr>' +
      '<th>Edges in the random graph</th><th>Trials</th><th>Naive falls short on</th>' +
      '<th>Total edges missed</th><th>Failure rate</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="gmt-rate-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The assignment problem: a cost matrix, and three ways to read it</div>' +
      '<div class="card-body"><div id="gmt-matrix"></div>' +
      '<p class="note" id="gmt-matrix-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Hungarian against greedy against exhaustive search</div>' +
      '<div class="card-body"><table class="ref-table" id="gmt-assign"><thead><tr>' +
      '<th>Workers</th><th>Hungarian cost</th><th>Greedy cost</th><th>Greedy excess</th>' +
      '<th>Hungarian comparisons</th><th>Permutations it did not enumerate</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="gmt-assign-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
