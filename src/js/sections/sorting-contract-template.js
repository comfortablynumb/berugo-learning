/** Markup for "The sorting contract". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SortingContractTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'soc-shape', kind: 'select', label: 'input shape', value: 'random',
      options: [{ value: 'random', label: 'random' },
        { value: 'sorted', label: 'already sorted' },
        { value: 'reversed', label: 'reversed' },
        { value: 'nearly-sorted', label: 'nearly sorted (1 in 64 disturbed)' },
        { value: 'few-unique', label: 'few unique (3 distinct values)' },
        { value: 'organ-pipe', label: 'organ pipe (up then down)' }] },
    { id: 'soc-size', kind: 'range', label: 'elements', value: 1200, min: 200, max: 3000, step: 200 },
    { id: 'soc-comparator', kind: 'select', label: 'comparator handed to the platform sort', value: 'correct',
      options: [{ value: 'correct', label: 'a - b — the contract, satisfied' },
        { value: 'boolean-return', label: 'a > b — returns a boolean' },
        { value: 'default-string', label: 'no comparator at all' },
        { value: 'random-order', label: 'a random verdict per call' },
        { value: 'reversed-on-equal', label: 'returns 1 when equal' }] }
  ];

  const METRICS = [
    { id: 'soc-best', label: 'Fewest comparisons', note: 'on this shape' },
    { id: 'soc-worst', label: 'Most comparisons', note: 'the same input, a different sort' },
    { id: 'soc-spread', label: 'Between them', note: 'the reason the shape is a parameter' },
    { id: 'soc-selection', label: 'Selection sort', note: 'n(n−1)/2, whatever the shape' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The input, the size and the comparator', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The array, and the sorted prefix each sort has built</div>' +
      '<div class="card-body"><div id="soc-array"></div>' +
      '<p class="note" id="soc-array-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Four elementary sorts, one input, four different answers to "what does it cost"</div>' +
      '<div class="card-body"><table class="ref-table" id="soc-elementary"><thead><tr>' +
      '<th>Sort</th><th>Comparisons</th><th>Moves</th><th>Swaps</th>' +
      '<th>Stable</th><th>Adaptive</th><th>Wrong</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="soc-elementary-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The broken comparator, run through the platform\'s own sort</div>' +
      '<div class="card-body"><table class="ref-table" id="soc-comparator"><thead><tr>' +
      '<th>Comparator</th><th>Threw</th><th>Sorted</th><th>Out-of-order pairs</th>' +
      '<th>Axiom violations</th><th>First twelve values</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="soc-comparator-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
