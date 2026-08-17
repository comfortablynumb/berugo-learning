/** Markup for "Red-black trees". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RedBlackTreesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'rb-order', kind: 'select', label: 'insertion order', value: 'random',
      options: [{ value: 'random', label: 'random (shuffled)' },
        { value: 'sorted', label: 'sorted' },
        { value: 'churn', label: 'churn — inserts, deletes and lookups mixed' }] },
    { id: 'rb-count', kind: 'range', label: 'operations', value: 31, min: 7, max: 20000, step: 1 },
    { id: 'rb-seed', kind: 'range', label: 'seed', value: 1, min: 1, max: 40, step: 1,
      note: 'Red is drawn red and black is drawn dark. Every path from a node to a leaf passes the same number of black nodes.' }
  ];

  const METRICS = [
    { id: 'rb-height', label: 'Height', note: 'against the 2·log₂(n + 1) bound' },
    { id: 'rb-black', label: 'Black height', note: 'black nodes on every root-to-leaf path' },
    { id: 'rb-rotations', label: 'Rotations', note: 'over the whole workload' },
    { id: 'rb-recolours', label: 'Recolourings', note: 'the cheap fixup that does most of the work' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Workload', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The tree, coloured by its invariant</div>' +
      '<div class="card-body"><div id="rb-tree"></div>' +
      '<p class="note" id="rb-tree-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The same tree read as a 2-3-4 tree</div>' +
      '<div class="card-body"><table class="ref-table" id="rb-234"><thead><tr>' +
      '<th>Node type</th><th>Count</th><th>Share</th><th>What it is in red-black terms</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rb-234-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Red-black against AVL on the identical operation stream</div>' +
      '<div class="card-body"><table class="ref-table" id="rb-compare"><thead><tr>' +
      '<th>Family</th><th>Height</th><th>Comparisons</th><th>Rotations</th><th>Rotations per operation</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rb-compare-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
