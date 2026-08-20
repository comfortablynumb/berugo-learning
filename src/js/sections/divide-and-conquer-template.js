/** Markup for "Divide and conquer". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DivideAndConquerTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'dnc-digits', kind: 'range', label: 'digits per operand', value: 256, min: 16, max: 1024, step: 16 },
    { id: 'dnc-threshold', kind: 'range', label: 'schoolbook cutoff', value: 1, min: 1, max: 64, step: 1 },
    { id: 'dnc-points', kind: 'range', label: 'points in the closest-pair run', value: 2000, min: 200, max: 8000, step: 200 },
    { id: 'dnc-matrix', kind: 'select', label: 'matrix side for Strassen', value: '64',
      options: [{ value: '16', label: '16 × 16' }, { value: '32', label: '32 × 32' },
        { value: '64', label: '64 × 64' }, { value: '128', label: '128 × 128' }] }
  ];

  const METRICS = [
    { id: 'dnc-products', label: 'Digit products, Karatsuba', note: 'three half-size products per level' },
    { id: 'dnc-school', label: 'Digit products, schoolbook', note: 'n² on the same operands' },
    { id: 'dnc-ratio', label: 'Ratio', note: 'the exponent, made of measurements' },
    { id: 'dnc-depth', label: 'Recursion depth', note: 'log₂ of the operand length' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Operands, cutoff and instance sizes', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Digit products against n, with n^1.585 overlaid</div>' +
      '<div class="card-body"><div id="dnc-chart"></div>' +
      '<div id="dnc-chart-legend"></div>' +
      '<p class="note" id="dnc-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The crossover, measured rather than quoted</div>' +
      '<div class="card-body"><table class="ref-table" id="dnc-crossover"><thead><tr>' +
      '<th>Digits</th><th>Schoolbook</th><th>Karatsuba</th><th>Ratio</th><th>n^1.585</th><th>Same answer?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dnc-crossover-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Two more instances of the same shape</div>' +
      '<div class="card-body"><table class="ref-table" id="dnc-instances"><thead><tr>' +
      '<th>Problem</th><th>Divide and conquer</th><th>The obvious algorithm</th><th>Ratio</th>' +
      '<th>Agrees with the oracle?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dnc-instances-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Strassen: seven products, and what they cost numerically</div>' +
      '<div class="card-body"><table class="ref-table" id="dnc-strassen"><thead><tr>' +
      '<th>Side</th><th>Cubic products</th><th>Strassen products</th><th>Ratio</th>' +
      '<th>Worst entry disagreement</th><th>Relative</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dnc-strassen-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
