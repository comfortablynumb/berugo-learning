/** Markup for "Information and entropy". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.InformationAndEntropyTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ent-corpus', kind: 'select', label: 'corpus', value: 'English text',
      options: [
        { value: 'English text', label: 'English text' },
        { value: 'source code', label: 'source code' },
        { value: 'JSON logs', label: 'JSON logs' },
        { value: 'mixed prose', label: 'mixed prose' },
        { value: 'image-like', label: 'image-like' },
        { value: 'random bytes', label: 'random bytes' }
      ] },
    { id: 'ent-size', kind: 'range', label: 'bytes', value: 3000, min: 1000, max: 6000,
      step: 1000 },
    { id: 'ent-order', kind: 'select', label: 'highest model order', value: '4',
      options: [
        { value: '2', label: 'order 2' },
        { value: '4', label: 'order 4' },
        { value: '6', label: 'order 6' }
      ] }
  ];

  const METRICS = [
    { id: 'ent-order0', label: 'Order-0 entropy', note: 'bits per byte, symbols in isolation' },
    { id: 'ent-best', label: 'At the highest order', note: 'and whether the estimate is still trustworthy' },
    { id: 'ent-floor', label: 'The order-0 floor', note: 'bytes: no order-0 code can go below it' },
    { id: 'ent-check', label: 'Estimator against closed form', note: 'worst error over six synthetic sources' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'What to measure', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Entropy falls with model order — until the contexts run out</div>' +
      '<div class="card-body"><div id="ent-chart" class="chart-host"></div>' +
      '<p class="note" id="ent-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The entropy profile, with the numbers that say when to stop believing it</div>' +
      '<div class="card-body"><table class="ref-table" id="ent-profile"><thead><tr>' +
      '<th>Model order</th><th>Bits per byte</th><th>Distinct contexts</th>' +
      '<th>Observations per context</th><th>Floor (bytes)</th><th>Trustworthy</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ent-profile-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Seven corpora: the same measurement, seven different answers</div>' +
      '<div class="card-body"><table class="ref-table" id="ent-corpora"><thead><tr>' +
      '<th>Corpus</th><th>Distinct bytes</th><th>Order 0</th><th>Order 2</th>' +
      '<th>Order-2 contexts</th><th>Observations each</th><th>Order-2 estimate usable</th>' +
      '<th>Apparent redundancy</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ent-corpora-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The estimator, checked against sources whose entropy is known exactly</div>' +
      '<div class="card-body"><table class="ref-table" id="ent-truth"><thead><tr>' +
      '<th>Source</th><th>Closed form</th><th>Estimated</th><th>Error</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ent-truth-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
