/** Markup for "Hardness in practice". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HardnessInPracticeTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'hip-variables', kind: 'range', label: 'variables', value: 44, min: 28, max: 52,
      step: 4 },
    { id: 'hip-instances', kind: 'select', label: 'instances per ratio', value: '60',
      options: [
        { value: '20', label: '20' },
        { value: '60', label: '60' },
        { value: '120', label: '120' }
      ] },
    { id: 'hip-noise', kind: 'select', label: 'WalkSAT noise', value: '0.5',
      options: [
        { value: '0.2', label: '0.2 — greedy' },
        { value: '0.5', label: '0.5' },
        { value: '0.8', label: '0.8 — nearly random' }
      ] }
  ];

  const METRICS = [
    { id: 'hip-peak', label: 'The hardness peak', note: 'clause ratio with the highest median cost' },
    { id: 'hip-crossing', label: 'Where half are satisfiable', note: 'the satisfiability crossover' },
    { id: 'hip-tail', label: 'Heavy tail', note: 'worst run over the median, no restarts' },
    { id: 'hip-restart', label: 'Best restart cutoff', note: 'and what it does to the mean' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Random 3-SAT across the clause ratio', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Satisfiable fraction and solve cost, against the ratio</div>' +
      '<div class="card-body"><div id="hip-chart" class="chart-host"></div>' +
      '<p class="note" id="hip-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The phase transition, measured</div>' +
      '<div class="card-body"><table class="ref-table" id="hip-phase"><thead><tr>' +
      '<th>Clause ratio</th><th>Clauses</th><th>Satisfiable</th><th>Median nodes</th>' +
      '<th>Upper quartile</th><th>Mean</th><th>Worst</th><th>Worst ÷ median</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="hip-phase-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">One instance, many seeds: the runtime distribution of a stochastic solver</div>' +
      '<div class="card-body"><table class="ref-table" id="hip-restarts"><thead><tr>' +
      '<th>Strategy</th><th>Solved</th><th>Median flips</th><th>Mean flips</th>' +
      '<th>90th percentile</th><th>Worst</th><th>Worst ÷ median</th><th>Restarts taken</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="hip-restarts-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Why industrial instances with millions of variables solve in seconds</div>' +
      '<div class="card-body"><table class="ref-table" id="hip-structure"><thead><tr>' +
      '<th>Property</th><th>Random instance at the threshold</th><th>Industrial instance</th>' +
      '<th>What the solver gets out of it</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="hip-structure-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
