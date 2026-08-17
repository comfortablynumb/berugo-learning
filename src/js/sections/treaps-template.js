/** Markup for "Treaps and randomised BSTs". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TreapsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'treap-count', kind: 'range', label: 'keys', value: 31, min: 7, max: 20000, step: 1 },
    { id: 'treap-seed', kind: 'range', label: 'priority seed', value: 1, min: 1, max: 40, step: 1,
      note: 'The seed decides every priority, so it decides the shape. Insertion order does not.' },
    { id: 'treap-order', kind: 'select', label: 'insertion order', value: 'sorted',
      options: [{ value: 'sorted', label: 'sorted' },
        { value: 'random', label: 'random (shuffled)' },
        { value: 'reverse', label: 'reverse sorted' }] },
    { id: 'treap-split', kind: 'number', label: 'split at key', value: 16, min: 1, step: 1 },
    { id: 'treap-split-go', kind: 'button', label: 'Split here', primary: true },
    { id: 'treap-merge-go', kind: 'button', label: 'Merge the halves back' }
  ];

  const METRICS = [
    { id: 'treap-height', label: 'Height', note: 'against the 3·log₂ n a random BST gives' },
    { id: 'treap-order-check', label: 'Both orders hold', note: 'BST by key, heap by priority' },
    { id: 'treap-splits', label: 'Split steps', note: 'nodes touched by the last split' },
    { id: 'treap-writes', label: 'Link writes', note: 'pointer writes for the last operation' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Keys, priorities and split', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The treap: key order left to right, priority order top to bottom</div>' +
      '<div class="card-body"><div id="treap-tree"></div>' +
      '<p class="note" id="treap-tree-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The same keys in three insertion orders, and across seeds</div>' +
      '<div class="card-body"><table class="ref-table" id="treap-shapes"><thead><tr>' +
      '<th>What changed</th><th>Height</th><th>Root key</th><th>Comparisons to build</th><th>What it shows</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="treap-shape-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Height across 40 seeds, against the bounds</div>' +
      '<div class="card-body"><div id="treap-chart"></div><div id="treap-legend"></div></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
