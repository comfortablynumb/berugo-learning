/** Markup for "Approximation algorithms and ratios". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ApproximationRatiosTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'arx-n', kind: 'range', label: 'vertices per random graph', value: 12, min: 8, max: 16,
      step: 2 },
    { id: 'arx-density', kind: 'select', label: 'edge density', value: '0.35',
      options: [
        { value: '0.2', label: '0.2 — sparse' },
        { value: '0.35', label: '0.35' },
        { value: '0.6', label: '0.6 — dense' }
      ] },
    { id: 'arx-instances', kind: 'select', label: 'instances per algorithm', value: '200',
      options: [
        { value: '60', label: '60' },
        { value: '200', label: '200' },
        { value: '400', label: '400' }
      ] },
    { id: 'arx-trap', kind: 'range', label: 'size of the highest-degree trap instance',
      value: 100, min: 20, max: 200, step: 20 }
  ];

  const METRICS = [
    { id: 'arx-matching', label: 'Matching cover', note: 'mean ratio, and the proven bound' },
    { id: 'arx-degree', label: 'Highest-degree greedy', note: 'mean ratio, and no bound at all' },
    { id: 'arx-tour', label: 'Christofides', note: 'mean tour against the exact optimum' },
    { id: 'arx-tight', label: 'Greedy set cover, tight instance', note: 'ratio against H(n)' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Instances, and how many of them', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Where the measured ratios actually landed</div>' +
      '<div class="card-body"><div id="arx-chart" class="chart-host"></div>' +
      '<p class="note" id="arx-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Vertex cover — four algorithms against the exact optimum</div>' +
      '<div class="card-body"><table class="ref-table" id="arx-cover"><thead><tr>' +
      '<th>Algorithm</th><th>Proven ratio</th><th>Mean</th><th>Median</th><th>Worst</th>' +
      '<th>Bound violations</th><th>Infeasible answers</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="arx-cover-note"></p></div></div>' +
      '<div class="grid-even" style="margin-top:.875rem">' +
      '<div class="card"><div class="card-header">The family that defeats highest-degree greedy</div>' +
      '<div class="card-body"><table class="ref-table" id="arx-trap-table"><thead><tr>' +
      '<th>k</th><th>Vertices</th><th>Optimum</th><th>Matching cover</th><th>Degree greedy</th>' +
      '<th>Its ratio</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="arx-trap-note"></p></div></div>' +
      '<div class="card"><div class="card-header">Greedy set cover, and the instance built to hurt it</div>' +
      '<div class="card-body"><table class="ref-table" id="arx-setcover"><thead><tr>' +
      '<th>Universe</th><th>Greedy cost</th><th>Optimum</th><th>Ratio</th><th>H(n)</th><th>ln n</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="arx-setcover-note"></p></div></div>' +
      '</div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Metric TSP — doubling the tree against Christofides</div>' +
      '<div class="card-body"><table class="ref-table" id="arx-tsp-table"><thead><tr>' +
      '<th>Method</th><th>Proven ratio</th><th>Mean measured</th><th>Median</th><th>Worst</th>' +
      '<th>Best</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="arx-tsp-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Two more, with their tight instances</div>' +
      '<div class="card-body"><table class="ref-table" id="arx-other"><thead><tr>' +
      '<th>Problem</th><th>Algorithm</th><th>Proven ratio</th><th>Measured</th><th>Note</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="arx-other-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
