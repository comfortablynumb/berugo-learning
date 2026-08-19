/** Markup for "Selection and order statistics". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SelectionAndOrderTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'sel-method', kind: 'select', label: 'method', value: 'quickselect',
      options: [{ value: 'quickselect', label: 'quickselect — expected linear' },
        { value: 'median-of-medians', label: 'median of medians — guaranteed linear' },
        { value: 'introselect', label: 'introselect — quickselect with a fallback' },
        { value: 'sort-then-index', label: 'sort, then index' }] },
    { id: 'sel-shape', kind: 'select', label: 'input shape', value: 'random',
      options: [{ value: 'random', label: 'random' },
        { value: 'sorted', label: 'already sorted' },
        { value: 'few-unique', label: 'few unique' },
        { value: 'adversarial', label: 'adversarial' }] },
    { id: 'sel-size', kind: 'range', label: 'elements', value: 20000, min: 2000, max: 100000, step: 2000 },
    { id: 'sel-k', kind: 'range', label: 'k as a percentile', value: 50, min: 0, max: 100, step: 5 }
  ];

  const METRICS = [
    { id: 'sel-comparisons', label: 'Comparisons', note: 'to find this one element' },
    { id: 'sel-per-element', label: 'Per element', note: 'the constant the analysis is about' },
    { id: 'sel-discarded', label: 'Elements discarded', note: 'the reason it is linear' },
    { id: 'sel-wrong', label: 'Disagreements', note: 'against a sorted reference' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The method, the shape, the size and k', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">One partition of a select: the shaded side is thrown away</div>' +
      '<div class="card-body"><div id="sel-array"></div>' +
      '<p class="note" id="sel-array-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Four ways to answer "the k-th smallest", measured</div>' +
      '<div class="card-body"><table class="ref-table" id="sel-methods"><thead><tr>' +
      '<th>Method</th><th>Comparisons</th><th>Per element</th><th>Bound</th><th>Wrong</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="sel-methods-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">How the gap grows with n</div>' +
      '<div class="card-body"><table class="ref-table" id="sel-growth"><thead><tr>' +
      '<th>n</th><th>Quickselect</th><th>Median of medians</th><th>Sort then index</th>' +
      '<th>Sort ÷ select</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="sel-growth-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Top-k: a heap of k against a select of n</div>' +
      '<div class="card-body"><table class="ref-table" id="sel-topk"><thead><tr>' +
      '<th>k</th><th>Heap of k</th><th>Quickselect + sort of k</th><th>Full sort</th><th>Agree</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="sel-topk-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
