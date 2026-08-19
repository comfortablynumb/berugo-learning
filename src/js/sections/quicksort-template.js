/** Markup for "Quicksort: partitions, pivots and the quiet quadratic". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.QuicksortTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'qks-partition', kind: 'select', label: 'partition scheme', value: 'hoare',
      options: [{ value: 'lomuto', label: 'Lomuto — one forward scan' },
        { value: 'hoare', label: 'Hoare — two pointers inwards' },
        { value: 'three-way', label: 'three-way — Dutch national flag' }] },
    { id: 'qks-pivot', kind: 'select', label: 'pivot rule', value: 'median-of-three',
      options: [{ value: 'first', label: 'first element' },
        { value: 'last', label: 'last element' },
        { value: 'middle', label: 'middle element' },
        { value: 'median-of-three', label: 'median of three' },
        { value: 'ninther', label: 'ninther — median of three medians' },
        { value: 'random', label: 'random' }] },
    { id: 'qks-shape', kind: 'select', label: 'input shape', value: 'random',
      options: [{ value: 'random', label: 'random' },
        { value: 'sorted', label: 'already sorted' },
        { value: 'few-unique', label: 'few unique (3 distinct values)' },
        { value: 'organ-pipe', label: 'organ pipe' },
        { value: 'adversarial', label: 'adversarial — built against median-of-three' }] },
    { id: 'qks-size', kind: 'range', label: 'elements', value: 2000, min: 500, max: 4000, step: 500 },
    { id: 'qks-limit', kind: 'select', label: 'depth limit', value: 'off',
      options: [{ value: 'off', label: 'none — plain quicksort' },
        { value: 'intro', label: '2·log₂ n, then heapsort (introsort)' }] }
  ];

  const METRICS = [
    { id: 'qks-comparisons', label: 'Comparisons', note: 'for the selected configuration' },
    { id: 'qks-depth', label: 'Recursion depth', note: 'against the 2·log₂ n a good pivot gives' },
    { id: 'qks-quadratic', label: 'Against n²/4', note: 'the line a quadratic run crosses' },
    { id: 'qks-fallbacks', label: 'Heapsort escapes', note: 'times the depth limit fired' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The scheme, the pivot, the input and the escape', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">One partition, drawn: less, equal, greater</div>' +
      '<div class="card-body"><div id="qks-array"></div>' +
      '<p class="note" id="qks-array-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every scheme against every shape — the row that goes quadratic is the point</div>' +
      '<div class="card-body"><table class="ref-table" id="qks-matrix"><thead><tr>' +
      '<th>Configuration</th><th>random</th><th>sorted</th><th>few unique</th>' +
      '<th>organ pipe</th><th>adversarial</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="qks-matrix-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The same input, with and without the depth limit</div>' +
      '<div class="card-body"><table class="ref-table" id="qks-intro"><thead><tr>' +
      '<th>Configuration</th><th>Comparisons</th><th>Recursion depth</th>' +
      '<th>Partitions</th><th>Heapsort escapes</th><th>Wrong</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="qks-intro-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
