/** Markup for "Fixed point, decimal and rational arithmetic". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.FixedAndDecimalTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'fd-count', kind: 'range', label: 'transactions in the ledger', value: 200000,
      min: 20000, max: 500000, step: 20000 },
    { id: 'fd-rate', kind: 'select', label: 'rate applied to every line', value: '875',
      options: [
        { value: '875', label: '8.75% — a sales-tax rate' },
        { value: '1750', label: '17.5%' },
        { value: '2000', label: '20.0%' },
        { value: '825', label: '8.25%' },
        { value: '500', label: '5.0%' }
      ] },
    { id: 'fd-policy', kind: 'select', label: 'rounding policy for the ledger', value: 'half-even',
      options: [
        { value: 'half-even', label: 'half to even — the accounting default' },
        { value: 'half-up', label: 'half away from zero — what people mean by rounding' },
        { value: 'half-down', label: 'half towards zero' },
        { value: 'floor', label: 'floor' },
        { value: 'ceil', label: 'ceiling' },
        { value: 'truncate', label: 'truncate' }
      ] },
    { id: 'fd-seed', kind: 'range', label: 'seed', value: 23, min: 1, max: 40, step: 1 }
  ];

  const METRICS = [
    { id: 'fd-error', label: 'Double total, error in cents', note: 'against the exact rational total' },
    { id: 'fd-equal', label: 'Double total compares equal', note: 'to the exact value, as a double' },
    { id: 'fd-rate-wrong', label: 'Line items taxed to the wrong cent', note: 'double against exact' },
    { id: 'fd-drift', label: 'Policy spread over the batch', note: 'best policy against worst, in cents' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A ledger, a rate and a policy', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Where the double total actually breaks</div>' +
      '<div class="card-body"><table class="ref-table" id="fd-divergence"><thead><tr>' +
      '<th>Transactions</th><th>Error, in cents</th><th>Crosses half a cent</th>' +
      '<th>Rounds to the right cent</th><th>Compares equal</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="fd-divergence-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Applying a rate — where the cent really is lost</div>' +
      '<div class="card-body"><table class="ref-table" id="fd-rate-table"><thead><tr>' +
      '<th>Line amount</th><th>Product in doubles</th><th>Rounded in doubles</th>' +
      '<th>Rounded exactly</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="fd-rate-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Six rounding policies over the same batch</div>' +
      '<div class="card-body"><table class="ref-table" id="fd-policies"><thead><tr>' +
      '<th>Policy</th><th>Total, in cents</th><th>Drift from the unrounded total</th>' +
      '<th>Exact ties encountered</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="fd-policies-note"></p></div></div>' +
      '<div class="grid-2" style="margin-top:.875rem">' +
      '<div class="card"><div class="card-header">What an exact rational costs</div>' +
      '<div class="card-body"><div id="fd-chart" class="chart-host"></div>' +
      '<div id="fd-legend"></div><p class="note" id="fd-chart-note"></p></div></div>' +
      '<div class="card"><div class="card-header">Choosing a representation</div>' +
      '<div class="card-body"><table class="ref-table" id="fd-choice"><thead><tr>' +
      '<th>Representation</th><th>Exact decimals</th><th>Exact halving</th><th>Unbounded</th>' +
      '<th>Cost per operation</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="fd-choice-note"></p></div></div>' +
      '</div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
