/** Markup for "Heapsort and heap-based selection". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HeapsortTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'hs-count', kind: 'range', label: 'elements', value: 10000, min: 100, max: 200000, step: 100 },
    { id: 'hs-seed', kind: 'range', label: 'seed', value: 8, min: 1, max: 40, step: 1 },
    { id: 'hs-k', kind: 'range', label: 'top-k: k', value: 20, min: 1, max: 1000, step: 1,
      note: 'A bounded heap holds k elements, so peak memory is k rather than n — whatever n is.' },
    { id: 'hs-stream', kind: 'range', label: 'stream length for top-k', value: 1000000, min: 10000, max: 2000000, step: 10000 }
  ];

  const METRICS = [
    { id: 'hs-comparisons', label: 'Heapsort comparisons', note: 'against n·log₂ n' },
    { id: 'hs-swaps', label: 'Heapsort swaps', note: 'every one is a scattered write' },
    { id: 'hs-extra', label: 'Extra memory', note: 'heapsort sorts in place' },
    { id: 'hs-topk', label: 'Top-k peak memory', note: 'against sorting the whole stream' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Input and top-k', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The array mid-sort: heap on the left, sorted suffix on the right</div>' +
      '<div class="card-body"><div id="hs-view"></div>' +
      '<p class="note" id="hs-view-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Heapsort against the sorts it is compared with</div>' +
      '<div class="card-body"><table class="ref-table" id="hs-sorts"><thead><tr>' +
      '<th>Sort</th><th>Comparisons</th><th>Extra memory</th><th>Stable</th><th>Worst case</th><th>Where it is used</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="hs-sorts-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Top-k over a stream against sorting it</div>' +
      '<div class="card-body"><table class="ref-table" id="hs-topk-table"><thead><tr>' +
      '<th>Approach</th><th>Comparisons</th><th>Peak memory</th><th>Elements ever admitted</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="hs-topk-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
