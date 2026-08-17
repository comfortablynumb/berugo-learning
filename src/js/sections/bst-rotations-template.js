/** Markup for "Binary search trees and rotations". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BstRotationsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'bst-order', kind: 'select', label: 'insertion order', value: 'random',
      options: [{ value: 'random', label: 'random (shuffled)' },
        { value: 'sorted', label: 'sorted — a bulk load from an ordered export' },
        { value: 'reverse', label: 'reverse sorted' },
        { value: 'sawtooth', label: 'sawtooth — sorted runs' }] },
    { id: 'bst-count', kind: 'range', label: 'keys', value: 31, min: 7, max: 4000, step: 1 },
    { id: 'bst-seed', kind: 'range', label: 'seed', value: 1, min: 1, max: 40, step: 1 },
    { id: 'bst-rotate', kind: 'number', label: 'rotate the node holding key', value: 0, min: 0, step: 1,
      note: 'A rotation changes the shape and keeps the in-order sequence identical.' },
    { id: 'bst-rotate-go', kind: 'button', label: 'Rotate it above its parent', primary: true },
    { id: 'bst-delete-go', kind: 'button', label: 'Delete that key' }
  ];

  const METRICS = [
    { id: 'bst-height', label: 'Height', note: 'nodes on the longest root-to-leaf path' },
    { id: 'bst-ideal', label: 'Ideal height', note: 'what a perfectly balanced tree would give' },
    { id: 'bst-worst', label: 'Worst lookup', note: 'comparisons for the deepest key' },
    { id: 'bst-mean', label: 'Mean lookup', note: 'comparisons averaged over every key present' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Keys and shape', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The tree, drawn in key order</div>' +
      '<div class="card-body"><div id="bst-tree"></div>' +
      '<p class="note" id="bst-tree-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The same keys, four insertion orders</div>' +
      '<div class="card-body"><table class="ref-table" id="bst-orders"><thead><tr>' +
      '<th>Insertion order</th><th>Height</th><th>Mean lookup</th><th>Total comparisons to build</th>' +
      '<th>What it is</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bst-inorder"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
