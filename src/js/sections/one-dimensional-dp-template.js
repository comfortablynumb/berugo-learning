/** Markup for "One-dimensional DP". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.OneDimensionalDpTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'odp-size', kind: 'range', label: 'sequence length', value: 2000, min: 50, max: 8000, step: 50 },
    { id: 'odp-seed', kind: 'range', label: 'sequence seed', value: 3, min: 1, max: 40, step: 1 },
    { id: 'odp-spread', kind: 'range', label: 'value range', value: 1000, min: 10, max: 5000, step: 10 },
    { id: 'odp-amount', kind: 'range', label: 'coin-change amount', value: 5, min: 1, max: 60, step: 1 }
  ];

  const METRICS = [
    { id: 'odp-lis', label: 'LIS length', note: 'both algorithms, one answer' },
    { id: 'odp-quad', label: 'Quadratic transitions', note: 'the O(n²) table' },
    { id: 'odp-patience', label: 'Patience transitions', note: 'binary-search steps' },
    { id: 'odp-ratio', label: 'Ratio', note: 'what the log factor is worth here' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Sequence and coin-change instance', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Longest increasing subsequence, two ways</div>' +
      '<div class="card-body"><table class="ref-table" id="odp-lis-table"><thead><tr>' +
      '<th>Method</th><th>Length</th><th>States</th><th>Transitions</th><th>Reconstructed?</th>' +
      '<th>Genuine subsequence?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="odp-lis-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The piles, and why they are not the answer</div>' +
      '<div class="card-body"><div id="odp-piles"></div>' +
      '<p class="note" id="odp-piles-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Coin change: the loop order is the question being asked</div>' +
      '<div class="card-body"><table class="ref-table" id="odp-coins"><thead><tr>' +
      '<th>Loop order</th><th>Counts</th><th>Answer</th><th>Brute force</th><th>Agrees?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="odp-coins-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Four one-dimensional recurrences on the same sequence</div>' +
      '<div class="card-body"><table class="ref-table" id="odp-family"><thead><tr>' +
      '<th>Problem</th><th>State</th><th>Answer</th><th>Reconstruction</th>' +
      '<th>Checked against</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="odp-family-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
