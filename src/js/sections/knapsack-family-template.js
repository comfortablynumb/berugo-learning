/** Markup for "The knapsack family". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.KnapsackFamilyTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'knp-items', kind: 'range', label: 'items', value: 12, min: 4, max: 18, step: 1 },
    { id: 'knp-capacity', kind: 'range', label: 'capacity', value: 60, min: 10, max: 400, step: 10 },
    { id: 'knp-seed', kind: 'range', label: 'instance seed', value: 5, min: 1, max: 40, step: 1 },
    { id: 'knp-copies', kind: 'range', label: 'copies per item (bounded knapsack)', value: 40, min: 1, max: 200, step: 1 }
  ];

  const METRICS = [
    { id: 'knp-value', label: 'Optimal value', note: 'checked against exhaustive enumeration' },
    { id: 'knp-cells', label: 'Full-table cells', note: '(items + 1) x (capacity + 1)' },
    { id: 'knp-row', label: 'One-row cells', note: 'the same answer, no traceback' },
    { id: 'knp-bits', label: 'Capacity in bits', note: 'the input length the complexity is polynomial in' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Instance', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The table, and the two cells each entry came from</div>' +
      '<div class="card-body"><div id="knp-table"></div>' +
      '<p class="note" id="knp-table-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Space reduction: same value, and what it costs</div>' +
      '<div class="card-body"><table class="ref-table" id="knp-space"><thead><tr>' +
      '<th>Variant</th><th>Value</th><th>Cells held</th><th>Reconstruction</th><th>Chosen set verified</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="knp-space-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Bounded knapsack: three expansions of the same instance</div>' +
      '<div class="card-body"><table class="ref-table" id="knp-bounded"><thead><tr>' +
      '<th>Method</th><th>Value</th><th>Items after expansion</th><th>Transitions</th><th>Agrees?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="knp-bounded-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Pseudo-polynomial: what happens when the capacity gains a digit</div>' +
      '<div class="card-body"><table class="ref-table" id="knp-bitcost"><thead><tr>' +
      '<th>Capacity</th><th>Digits</th><th>Bits</th><th>Table cells</th><th>Growth per added digit</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="knp-bitcost-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Subset sum and equal partition on the same weights</div>' +
      '<div class="card-body"><table class="ref-table" id="knp-subset"><thead><tr>' +
      '<th>Question</th><th>Answer</th><th>Witness</th><th>Checked</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="knp-subset-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
