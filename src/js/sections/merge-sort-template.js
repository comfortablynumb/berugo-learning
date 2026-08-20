/** Markup for "Merge sort and its variants". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MergeSortTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'mgs-variant', kind: 'select', label: 'merge schedule', value: 'bottom-up',
      options: [{ value: 'top-down', label: 'top-down — the textbook recursion' },
        { value: 'bottom-up', label: 'bottom-up — widths 1, 2, 4, 8' },
        { value: 'natural', label: 'natural — merge the runs already there' },
        { value: 'in-place', label: 'in place — rotations, no buffer' }] },
    { id: 'mgs-shape', kind: 'select', label: 'input shape', value: 'random',
      options: [{ value: 'random', label: 'random' },
        { value: 'nearly-sorted', label: 'nearly sorted' },
        { value: 'sorted', label: 'already sorted' },
        { value: 'reversed', label: 'reversed' },
        { value: 'organ-pipe', label: 'organ pipe' }] },
    { id: 'mgs-size', kind: 'range', label: 'elements', value: 2000, min: 500, max: 8000, step: 500 },
    { id: 'mgs-order', kind: 'range', label: 'k-way merge order', value: 4, min: 2, max: 16, step: 1 }
  ];

  const METRICS = [
    { id: 'mgs-comparisons', label: 'Comparisons', note: 'for the selected schedule' },
    { id: 'mgs-moves', label: 'Element moves', note: 'the column the schedules disagree about' },
    { id: 'mgs-allocations', label: 'Allocations', note: 'buffers, not elements' },
    { id: 'mgs-runs', label: 'Natural runs found', note: 'ascending stretches already in the data' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The schedule, the shape and the merge order', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The runs already present in this input</div>' +
      '<div class="card-body"><div id="mgs-runs-view"></div>' +
      '<p class="note" id="mgs-runs-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Four schedules, the same merges, different bookkeeping</div>' +
      '<div class="card-body"><table class="ref-table" id="mgs-variants"><thead><tr>' +
      '<th>Schedule</th><th>Comparisons</th><th>Moves</th><th>Swaps</th>' +
      '<th>Allocations</th><th>Stable</th><th>Wrong</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mgs-variants-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Comparisons against moves, per schedule</div>' +
      '<div class="card-body"><div id="mgs-chart"></div>' +
      '<p class="note" id="mgs-chart-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The k-way merge external sorting is built on</div>' +
      '<div class="card-body"><table class="ref-table" id="mgs-kway"><thead><tr>' +
      '<th>Merge order</th><th>Runs consumed per pass</th><th>Passes over the data</th>' +
      '<th>Comparisons per element</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mgs-kway-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
