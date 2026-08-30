/** Markup for "Advanced branch prediction". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AdvancedPredictorTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'abp-trace', kind: 'select', label: 'pattern', value: 'correlated',
      options: [
        { value: 'correlated', label: 'correlated — a branch decided by two earlier ones' },
        { value: 'alternating', label: 'alternating — needs one bit of history' },
        { value: 'nested', label: 'a nested loop' },
        { value: 'loop', label: 'one loop branch' },
        { value: 'random', label: 'coin flips — the floor' }] },
    { id: 'abp-bits', kind: 'range', label: 'index bits (table is 2^n entries)', value: 10,
      min: 4, max: 14, step: 1 },
    { id: 'abp-penalty', kind: 'range', label: 'misprediction penalty, in cycles', value: 12,
      min: 1, max: 25, step: 1 }
  ];

  const METRICS = [
    { id: 'abp-best', label: 'Best predictor here', note: 'and its accuracy' },
    { id: 'abp-bimodal', label: 'Bimodal', note: 'the per-site baseline' },
    { id: 'abp-gshare', label: 'gshare', note: 'the same table, indexed with history' },
    { id: 'abp-separation', label: 'What history buys', note: 'on the correlated site' },
    { id: 'abp-mpki', label: 'Mispredicts per 1 000', note: 'at a branch every five instructions' },
    { id: 'abp-cost', label: 'Share of runtime lost', note: 'at the chosen penalty' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Five predictors, one pattern',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The tournament</div>' +
      '<div class="card-body"><table class="ref-table" id="abp-tournament"><thead><tr>' +
      '<th>Predictor</th><th>Accuracy</th><th>Misses</th><th>Per 1 000 instructions</th>' +
      '<th>What it does</th></tr></thead><tbody></tbody></table>' +
      '<p class="note" id="abp-tournament-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('abp-sites', 'The correlated site alone, where the average hides the difference',
        ['Predictor', 'Site 0x300', 'Site 0x304', 'Site 0x308 (the correlated one)', 'Overall']) +
      chartCard() +
      card('abp-matrix', 'Every predictor on every pattern',
        ['Pattern', 'Bimodal', 'gshare', 'Tournament', 'TAGE-lite', 'Best']) +
      card('abp-designs', 'What each design adds, and what it costs',
        ['Predictor', 'The idea', 'What it fixes', 'What it costs']) +
      card('abp-aliasing', 'Aliasing: two sites, one counter',
        ['Index bits', 'Entries', 'Accuracy here', 'What is happening']);
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Accuracy across predictors and patterns</div>' +
      '<div class="card-body"><div id="abp-chart" class="chart-host"></div>' +
      '<p class="note" id="abp-chart-note"></p></div></div>';
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
