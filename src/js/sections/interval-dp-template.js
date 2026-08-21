/** Markup for "Interval DP". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.IntervalDpTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ivl-chain', kind: 'range', label: 'matrices in the chain', value: 6, min: 3, max: 14, step: 1 },
    { id: 'ivl-seed', kind: 'range', label: 'dimension seed', value: 3, min: 1, max: 40, step: 1 },
    { id: 'ivl-length', kind: 'range', label: 'show the sweep through interval length', value: 3, min: 2, max: 14, step: 1 },
    { id: 'ivl-keys', kind: 'range', label: 'keys in the optimal BST', value: 9, min: 3, max: 40, step: 1 }
  ];

  const METRICS = [
    { id: 'ivl-cost', label: 'Matrix-chain cost', note: 'scalar multiplications, checked exhaustively' },
    { id: 'ivl-splits', label: 'Split points tested', note: 'the k loop, summed over every interval' },
    { id: 'ivl-knuth', label: 'Knuth split tests', note: 'the same optimum from a narrowed range' },
    { id: 'ivl-saving', label: 'Saving', note: 'what the quadrangle inequality is worth' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Chain and BST instance', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The table, filled by increasing interval length</div>' +
      '<div class="card-body"><div id="ivl-table"></div>' +
      '<p class="note" id="ivl-table-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The evaluation order, as data</div>' +
      '<div class="card-body"><table class="ref-table" id="ivl-order"><thead><tr>' +
      '<th>Interval length</th><th>Cells settled</th><th>Depends on lengths</th><th>Running total</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ivl-order-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Knuth\'s optimisation, and the precondition it needs</div>' +
      '<div class="card-body"><table class="ref-table" id="ivl-knuth-table"><thead><tr>' +
      '<th>Weights</th><th>Quadrangle inequality</th><th>Plain cost</th><th>Knuth cost</th>' +
      '<th>Plain split tests</th><th>Knuth split tests</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ivl-knuth-table-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Three more interval problems on the same evaluation order</div>' +
      '<div class="card-body"><table class="ref-table" id="ivl-family"><thead><tr>' +
      '<th>Problem</th><th>State</th><th>Answer</th><th>Checked against</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ivl-family-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
