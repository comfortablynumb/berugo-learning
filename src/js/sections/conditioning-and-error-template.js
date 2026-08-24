/** Markup for "Conditioning, stability and error". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ConditioningAndErrorTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ce-size', kind: 'range', label: 'system size', value: 8, min: 3, max: 20, step: 1 },
    { id: 'ce-condition', kind: 'select', label: 'condition number to build', value: '1000000',
      options: [
        { value: '1', label: '1 — perfectly conditioned' },
        { value: '10000', label: '10⁴' },
        { value: '1000000', label: '10⁶' },
        { value: '100000000', label: '10⁸' },
        { value: '10000000000000', label: '10¹³ — half the digits gone' },
        { value: '10000000000000000', label: '10¹⁶ — past what a double can carry' }
      ] },
    { id: 'ce-seed', kind: 'range', label: 'seed', value: 11, min: 1, max: 40, step: 1 }
  ];

  const METRICS = [
    { id: 'ce-residual', label: 'Relative residual', note: 'does the answer satisfy the equations' },
    { id: 'ce-error', label: 'Relative solution error', note: 'is it the answer' },
    { id: 'ce-gap', label: 'How far apart they are', note: 'error divided by residual' },
    { id: 'ce-digits', label: 'Decimal digits lost', note: 'log₁₀ of the condition number' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Build a system with a chosen condition number',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The residual stays; the error does not</div>' +
      '<div class="card-body"><div id="ce-chart" class="chart-host"></div>' +
      '<div id="ce-legend"></div><p class="note" id="ce-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">One system, swept across nine orders of conditioning</div>' +
      '<div class="card-body"><table class="ref-table" id="ce-sweep"><thead><tr>' +
      '<th>Condition number</th><th>Relative residual</th><th>Relative solution error</th>' +
      '<th>What the condition number allows</th><th>Inside the bound</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ce-sweep-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The Hilbert matrix — innocuous, and hopeless by n = 13</div>' +
      '<div class="card-body"><table class="ref-table" id="ce-hilbert"><thead><tr>' +
      '<th>Size</th><th>Condition number</th><th>Relative residual</th>' +
      '<th>Relative solution error</th><th>Digits lost</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ce-hilbert-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
