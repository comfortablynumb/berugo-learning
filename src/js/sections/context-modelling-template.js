/** Markup for "Context modelling and prediction". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ContextModellingTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ctx-corpus', kind: 'select', label: 'corpus', value: 'English text',
      options: [
        { value: 'English text', label: 'English text' },
        { value: 'source code', label: 'source code' },
        { value: 'JSON logs', label: 'JSON logs' },
        { value: 'mixed prose', label: 'mixed prose' }
      ] },
    { id: 'ctx-size', kind: 'range', label: 'bytes', value: 1500, min: 500, max: 3000,
      step: 500 },
    { id: 'ctx-order', kind: 'select', label: 'highest order', value: '4',
      options: [
        { value: '3', label: 'order 3' },
        { value: '4', label: 'order 4' },
        { value: '5', label: 'order 5' }
      ] }
  ];

  const METRICS = [
    { id: 'ctx-order0', label: 'Order-0 model', note: 'bits per symbol, no context at all' },
    { id: 'ctx-best', label: 'Best plain order-k model', note: 'and where the sparsity turns it around' },
    { id: 'ctx-ppm', label: 'PPM with escapes', note: 'the same orders, with a fallback path' },
    { id: 'ctx-mixed', label: 'Mixing four orders', note: 'against the best single one' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'What to model', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Three ways to use context, at rising order</div>' +
      '<div class="card-body"><div id="ctx-chart" class="chart-host"></div>' +
      '<p class="note" id="ctx-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Plain order-k models: where more context stops helping</div>' +
      '<div class="card-body"><table class="ref-table" id="ctx-orders"><thead><tr>' +
      '<th>Order</th><th>Bits per symbol</th><th>Distinct contexts</th>' +
      '<th>Symbols per context</th><th>Against order 0</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ctx-orders-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">PPM: the same orders, with an escape to fall back on</div>' +
      '<div class="card-body"><table class="ref-table" id="ctx-escapes"><thead><tr>' +
      '<th>Maximum order</th><th>Bits per symbol</th><th>Escapes per symbol</th>' +
      '<th>Against the plain model at the same order</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ctx-escapes-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Mixing: the weights move as the file goes past</div>' +
      '<div class="card-body"><table class="ref-table" id="ctx-mix"><thead><tr>' +
      '<th>Symbols coded</th><th>Bits per symbol so far</th><th>Weight on order 0</th>' +
      '<th>order 1</th><th>order 2</th><th>order 3</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ctx-mix-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
