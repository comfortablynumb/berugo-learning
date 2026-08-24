/** Markup for "Monte Carlo estimation and variance reduction". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MonteCarloEstimationTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'mce-target', kind: 'select', label: 'the quantity being estimated', value: 'exponential',
      options: [
        { value: 'exponential', label: '∫₀¹ eˣ dx — monotone, so antithetic pairs work' },
        { value: 'quarter-circle', label: '∫₀¹ 4√(1 − x²) dx = π — monotone, steep at the end' },
        { value: 'oscillating', label: '∫₀¹ sin²(10x) dx — oscillating, so most tricks fail' }
      ] },
    { id: 'mce-samples', kind: 'select', label: 'sample budget', value: '4000',
      options: [
        { value: '1000', label: '1 000' },
        { value: '4000', label: '4 000' },
        { value: '16000', label: '16 000' }
      ] },
    { id: 'mce-threshold', kind: 'select', label: 'the rare event', value: '4',
      options: [
        { value: '3', label: 'P(Z > 3) — about 1 in 741' },
        { value: '4', label: 'P(Z > 4) — about 1 in 31 574' },
        { value: '5', label: 'P(Z > 5) — about 1 in 3.5 million' }
      ] }
  ];

  const METRICS = [
    { id: 'mce-plain', label: 'Plain estimator', note: 'error against the exact value' },
    { id: 'mce-best', label: 'Best reduction here', note: 'and by how much it beat plain' },
    { id: 'mce-crossover', label: 'Grid beats sampling up to', note: 'dimensions, at the same point budget' },
    { id: 'mce-hits', label: 'Plain sampling of the rare event', note: 'hits in the whole budget' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A quantity, a budget and a tail', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Error against sample count, both axes logarithmic</div>' +
      '<div class="card-body"><div id="mce-chart" class="chart-host"></div>' +
      '<div id="mce-legend"></div><p class="note" id="mce-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Five estimators, one sample budget</div>' +
      '<div class="card-body"><table class="ref-table" id="mce-methods"><thead><tr>' +
      '<th>Method</th><th>Estimate</th><th>Error</th><th>Sample variance</th>' +
      '<th>Variance reduction</th><th>Error reduction</th><th>95% interval coverage over 200 seeds</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mce-methods-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The 1/√N rate, and what a low-discrepancy set does to it</div>' +
      '<div class="card-body"><table class="ref-table" id="mce-series"><thead><tr>' +
      '<th>Samples</th><th>Mean error over 40 seeds</th><th>1/√N from the first row</th>' +
      '<th>Van der Corput error</th><th>Star discrepancy</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mce-series-note"></p></div></div>' +
      '<div class="grid-2" style="margin-top:.875rem">' +
      '<div class="card"><div class="card-header">Dimension, at a fixed point budget</div>' +
      '<div class="card-body"><table class="ref-table" id="mce-dimension"><thead><tr>' +
      '<th>d</th><th>Nodes per axis</th><th>Grid points</th><th>Grid error</th>' +
      '<th>Sampling error</th><th>Winner</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mce-dimension-note"></p></div></div>' +
      '<div class="card"><div class="card-header">Importance sampling, and the shift that ruins it</div>' +
      '<div class="card-body"><table class="ref-table" id="mce-rare-table"><thead><tr>' +
      '<th>Proposal shift</th><th>Estimate</th><th>Relative error</th><th>Draws past the threshold</th>' +
      '<th>Effective sample size of the weights</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mce-rare-note"></p></div></div>' +
      '</div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
