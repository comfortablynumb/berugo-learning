/** Markup for "The binary heap". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BinaryHeapsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'bh-count', kind: 'range', label: 'elements', value: 31, min: 3, max: 100000, step: 1 },
    { id: 'bh-order', kind: 'select', label: 'input order', value: 'random',
      options: [{ value: 'random', label: 'random' },
        { value: 'ascending', label: 'ascending — already heap-ordered' },
        { value: 'descending', label: 'descending — the worst case for push' }] },
    { id: 'bh-seed', kind: 'range', label: 'seed', value: 4, min: 1, max: 40, step: 1 },
    { id: 'bh-method', kind: 'select', label: 'how it was built', value: 'build',
      options: [{ value: 'build', label: 'build-heap — sift down from the last parent' },
        { value: 'push', label: 'push one at a time — sift up from the end' }] },
    { id: 'bh-pop', kind: 'button', label: 'Pop the minimum', primary: true },
    { id: 'bh-rebuild', kind: 'button', label: 'Rebuild' }
  ];

  const METRICS = [
    { id: 'bh-comparisons', label: 'Comparisons to build', note: 'and what that is per element' },
    { id: 'bh-swaps', label: 'Swaps to build', note: 'against the sum-of-heights bound' },
    { id: 'bh-height', label: 'Height', note: 'levels, which is the sift distance' },
    { id: 'bh-valid', label: 'Heap order holds', note: 'every child outranked by its parent' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Elements and build method', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The array on top, the same nodes as a tree below</div>' +
      '<div class="card-body"><div id="bh-view"></div>' +
      '<p class="note" id="bh-view-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Build-heap against push-one-at-a-time, on three input orders</div>' +
      '<div class="card-body"><table class="ref-table" id="bh-methods"><thead><tr>' +
      '<th>Input</th><th>build comparisons</th><th>push comparisons</th><th>Ratio</th><th>What it shows</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bh-methods-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Why the build is linear: the work per level</div>' +
      '<div class="card-body"><table class="ref-table" id="bh-levels"><thead><tr>' +
      '<th>Height above the leaves</th><th>Nodes at that height</th><th>Each can sink</th><th>Work</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bh-levels-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
