/** Markup for "LP relaxation and rounding". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LpRelaxationTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'lpr-n', kind: 'range', label: 'vertices per random instance', value: 12, min: 8,
      max: 16, step: 2 },
    { id: 'lpr-instances', kind: 'select', label: 'instances measured', value: '150',
      options: [
        { value: '50', label: '50' },
        { value: '150', label: '150' },
        { value: '300', label: '300' }
      ] },
    { id: 'lpr-complete', kind: 'range', label: 'complete graph shown', value: 9, min: 3, max: 15,
      step: 2 },
    { id: 'lpr-clauses', kind: 'select', label: 'MAX-SAT clauses per formula', value: '30',
      options: [
        { value: '20', label: '20' },
        { value: '30', label: '30' },
        { value: '45', label: '45' }
      ] }
  ];

  const METRICS = [
    { id: 'lpr-gap', label: 'Integrality gap', note: 'measured mean over the random instances' },
    { id: 'lpr-half', label: 'Half-integral solutions', note: 'basic solutions with x in {0, ½, 1}' },
    { id: 'lpr-rounding', label: 'LP rounding on MAX-SAT', note: 'mean fraction of the optimum' },
    { id: 'lpr-worst', label: 'Worst gap seen', note: 'on the complete graphs, where it approaches 2' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Instances and formulas', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">One instance, fractionally</div>' +
      '<div class="card-body"><table class="ref-table" id="lpr-fractional"><thead><tr>' +
      '<th>Vertex</th><th>LP value</th><th>Rounded at ½</th><th>In the exact optimum</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lpr-fractional-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The relaxation, the roundings and the optimum</div>' +
      '<div class="card-body"><table class="ref-table" id="lpr-methods"><thead><tr>' +
      '<th>Method</th><th>Uses an LP?</th><th>Mean ratio</th><th>Median</th><th>Worst</th>' +
      '<th>Proven bound</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lpr-methods-note"></p></div></div>' +
      '<div class="grid-even" style="margin-top:.875rem">' +
      '<div class="card"><div class="card-header">The gap on complete graphs, where it is worst</div>' +
      '<div class="card-body"><table class="ref-table" id="lpr-complete-table"><thead><tr>' +
      '<th>Graph</th><th>LP optimum</th><th>Integer optimum</th><th>Gap</th><th>2 − 2/n</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lpr-complete-note"></p></div></div>' +
      '<div class="card"><div class="card-header">Where the gap landed on random instances</div>' +
      '<div class="card-body"><div id="lpr-chart" class="chart-host"></div>' +
      '<p class="note" id="lpr-chart-note"></p></div></div>' +
      '</div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">MAX-SAT — a coin, an LP, the better of the two, and no coin at all</div>' +
      '<div class="card-body"><table class="ref-table" id="lpr-sat-table"><thead><tr>' +
      '<th>Method</th><th>Mean fraction of optimum</th><th>Median</th><th>Worst</th>' +
      '<th>Proven bound</th><th>Randomness used</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lpr-sat-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
