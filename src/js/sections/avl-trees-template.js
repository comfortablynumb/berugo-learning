/** Markup for "AVL trees". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AvlTreesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'avl-order', kind: 'select', label: 'insertion order', value: 'sorted',
      options: [{ value: 'sorted', label: 'sorted — the order that destroys a plain BST' },
        { value: 'random', label: 'random (shuffled)' },
        { value: 'sawtooth', label: 'sawtooth — sorted runs' }] },
    { id: 'avl-count', kind: 'range', label: 'keys', value: 31, min: 7, max: 20000, step: 1 },
    { id: 'avl-seed', kind: 'range', label: 'seed', value: 1, min: 1, max: 40, step: 1 },
    { id: 'avl-deletes', kind: 'range', label: 'then delete this share', value: 0, min: 0, max: 90, step: 5,
      suffix: '%', note: 'Insertion needs at most one rotation. Deletion is the operation that can need one per level.' }
  ];

  const METRICS = [
    { id: 'avl-height', label: 'Height', note: 'against the AVL bound' },
    { id: 'avl-bst', label: 'Plain BST height', note: 'the same keys with no balance rule' },
    { id: 'avl-single', label: 'Single rotations', note: 'the LL and RR cases' },
    { id: 'avl-double', label: 'Double rotations', note: 'the LR and RL cases, two rotations each' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Keys and workload', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The tree, with each node\'s balance factor above it</div>' +
      '<div class="card-body"><div id="avl-tree"></div>' +
      '<p class="note" id="avl-tree-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Height against the bound, as the tree grows</div>' +
      '<div class="card-body"><div id="avl-chart"></div><div id="avl-legend"></div></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Rotations per operation: insertion against deletion</div>' +
      '<div class="card-body"><table class="ref-table" id="avl-rotations"><thead><tr>' +
      '<th>Operation</th><th>Count</th><th>Rotations</th><th>Per operation</th><th>Worst seen</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="avl-rotation-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
