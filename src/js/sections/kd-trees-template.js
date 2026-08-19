/** Markup for "k-d trees and nearest neighbours". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.KdTreesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'kdt-kind', kind: 'select', label: 'point distribution', value: 'clustered',
      options: [{ value: 'clustered', label: 'clustered' }, { value: 'uniform', label: 'uniform' },
        { value: 'collinear', label: 'collinear — one axis is useless' },
        { value: 'grid', label: 'lattice' }] },
    { id: 'kdt-prune', kind: 'select', label: 'pruning bound', value: 'plane',
      options: [{ value: 'plane', label: 'splitting plane — the textbook bound' },
        { value: 'box', label: 'subtree bounding box — tighter' },
        { value: 'descent', label: 'none — the descent alone (wrong)' }] },
    { id: 'kdt-k', kind: 'range', label: 'neighbours (k)', value: 1, min: 1, max: 20, step: 1 },
    { id: 'kdt-leaf', kind: 'range', label: 'leaf size', value: 8, min: 1, max: 32, step: 1 }
  ];

  const METRICS = [
    { id: 'kdt-distances', label: 'Distances per query', note: 'against a brute-force scan of every point' },
    { id: 'kdt-wrong', label: 'Wrong answers', note: 'checked against brute force on every verified query' },
    { id: 'kdt-nodes', label: 'Nodes visited', note: 'and how many subtrees the bound pruned' },
    { id: 'kdt-reported', label: 'Mean reported distance', note: 'what the structure says the nearest neighbour is' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The tree, the bound and the query', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The splitting planes, and one nearest-neighbour query</div>' +
      '<div class="card-body"><div id="kdt-map"></div>' +
      '<p class="note" id="kdt-map-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Three bounds: the descent, the plane and the box</div>' +
      '<div class="card-body"><table class="ref-table" id="kdt-bounds"><thead><tr>' +
      '<th>Bound</th><th>Distances / query</th><th>Nodes visited</th><th>Leaves visited</th>' +
      '<th>Fraction of the data</th><th>Wrong answers</th><th>Mean reported distance</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="kdt-bounds-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The curse of dimensionality, measured rather than asserted</div>' +
      '<div class="card-body"><div id="kdt-dims-chart"></div>' +
      '<div id="kdt-dims-legend"></div>' +
      '<p class="note" id="kdt-dims-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The same query in more dimensions</div>' +
      '<div class="card-body"><table class="ref-table" id="kdt-dims-table"><thead><tr>' +
      '<th>Dimensions</th><th>Distances / query</th><th>Fraction of 4 000 points</th>' +
      '<th>Subtrees pruned / query</th><th>Nodes</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="kdt-dims-table-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
