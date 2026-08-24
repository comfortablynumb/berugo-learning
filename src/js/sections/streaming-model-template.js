/** Markup for "The streaming model". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StreamingModelTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'stm-budget', kind: 'select', label: 'space budget', value: '8192',
      options: [
        { value: '1024', label: '1 KB' },
        { value: '8192', label: '8 KB' },
        { value: '65536', label: '64 KB' }
      ] },
    { id: 'stm-length', kind: 'select', label: 'stream length', value: '200000',
      options: [
        { value: '50000', label: '50 000' },
        { value: '200000', label: '200 000' },
        { value: '500000', label: '500 000' }
      ] },
    { id: 'stm-universe', kind: 'select', label: 'distinct values available', value: '20000',
      options: [
        { value: '5000', label: '5 000' },
        { value: '20000', label: '20 000' },
        { value: '80000', label: '80 000' }
      ] }
  ];

  const METRICS = [
    { id: 'stm-exact', label: 'The exact set', note: 'where it passed the budget, if it did' },
    { id: 'stm-truth', label: 'Distinct values', note: 'counted offline, as the reference' },
    { id: 'stm-sketch', label: 'Best sketch inside the budget', note: 'error against the truth' },
    { id: 'stm-quantile', label: 'Quantiles inside the budget', note: 'worst rank error' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'One pass, and a budget in bytes', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Space against accuracy, with the budget drawn as a wall</div>' +
      '<div class="card-body"><div id="stm-chart" class="chart-host"></div>' +
      '<p class="note" id="stm-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Counting distinct values under a hard budget</div>' +
      '<div class="card-body"><table class="ref-table" id="stm-distinct"><thead><tr>' +
      '<th>Structure</th><th>Bytes</th><th>Inside the budget</th><th>Answer</th>' +
      '<th>Relative error</th><th>Predicted error</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="stm-distinct-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Quantiles, where the error is a rank rather than a value</div>' +
      '<div class="card-body"><table class="ref-table" id="stm-quantiles"><thead><tr>' +
      '<th>Structure</th><th>Bytes</th><th>Rank returned for p50</th><th>for p90</th>' +
      '<th>for p99</th><th>Worst rank error</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="stm-quantiles-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What one pass can and cannot answer</div>' +
      '<div class="card-body"><table class="ref-table" id="stm-impossible"><thead><tr>' +
      '<th>Question</th><th>Space an exact answer needs</th><th>Approximate answer</th>' +
      '<th>Possible in one pass</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="stm-impossible-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
