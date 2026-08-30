/** Markup for "Branch prediction: the basics". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PredictorBasicsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'bpb-trace', kind: 'select', label: 'branch pattern', value: 'nested',
      options: [
        { value: 'loop', label: 'one loop branch, entered five times' },
        { value: 'nested', label: 'a nested loop — the double-miss case' },
        { value: 'alternating', label: 'taken, not taken, taken, not taken' },
        { value: 'random', label: 'coin flips — the floor nothing beats' }] },
    { id: 'bpb-predictor', kind: 'select', label: 'predictor', value: 'bimodal',
      options: [
        { value: 'static-not-taken', label: 'static: never taken' },
        { value: 'static-backward', label: 'static: backward taken' },
        { value: 'one-bit', label: 'one bit per site' },
        { value: 'bimodal', label: 'two-bit saturating counter' }] },
    { id: 'bpb-penalty', kind: 'range', label: 'misprediction penalty, in cycles', value: 2,
      min: 1, max: 20, step: 1 }
  ];

  const METRICS = [
    { id: 'bpb-accuracy', label: 'Accuracy', note: 'on this pattern' },
    { id: 'bpb-misses', label: 'Mispredictions', note: 'of the branches seen' },
    { id: 'bpb-worst', label: 'Worst site', note: 'and its accuracy' },
    { id: 'bpb-cost', label: 'Cycles lost', note: 'misses x penalty' },
    { id: 'bpb-share', label: 'Share of runtime', note: 'at one branch every five instructions' },
    { id: 'bpb-ras', label: 'Returns predicted', note: 'by the return-address stack' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'One pattern, one predictor',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Accuracy per branch site, worst first</div>' +
      '<div class="card-body"><table class="ref-table" id="bpb-sites"><thead><tr>' +
      '<th>Site</th><th>Seen</th><th>Right</th><th>Missed</th><th>Accuracy</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bpb-sites-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('bpb-tournament', 'Four predictors on all four patterns',
        ['Pattern', 'Never taken', 'Backward taken', 'One bit', 'Two bit']) +
      chartCard() +
      card('bpb-counters', 'The counters, after the run',
        ['Slot', 'Value', 'Means', 'What happens on a taken branch']) +
      card('bpb-returns', 'Calls and returns, and why returns are nearly free',
        ['Case', 'What a target buffer does', 'What a return-address stack does', 'Why']) +
      card('bpb-cost-table', 'What the accuracy is worth, at four penalties',
        ['Penalty', 'Cycles lost', 'Share of runtime', 'Which machine has this penalty']);
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Accuracy by predictor and pattern</div>' +
      '<div class="card-body"><div id="bpb-chart" class="chart-host"></div>' +
      '<p class="note" id="bpb-chart-note"></p></div></div>';
  }

  function card(id, title, columns) {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">' + title + '</div>' +
      '<div class="card-body"><table class="ref-table" id="' + id + '"><thead><tr>' +
      columns.map(function (name) { return '<th>' + name + '</th>'; }).join('') +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="' + id + '-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
