/** Markup for "Online algorithms and competitive analysis". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CompetitiveAnalysisTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'cmp-price', kind: 'range', label: 'buying costs', value: 10, min: 2, max: 30, step: 1 },
    { id: 'cmp-trials', kind: 'select', label: 'randomised trials', value: '2000',
      options: [
        { value: '500', label: '500' },
        { value: '2000', label: '2 000' },
        { value: '6000', label: '6 000' }
      ] },
    { id: 'cmp-list', kind: 'range', label: 'list length', value: 20, min: 10, max: 40, step: 5 }
  ];

  const METRICS = [
    { id: 'cmp-worst', label: 'Break-even, worst ratio', note: 'over every season length' },
    { id: 'cmp-bound', label: 'The proved bound', note: '2 − 1/B, and whether it is attained' },
    { id: 'cmp-random', label: 'Randomised, oblivious adversary', note: 'against e/(e − 1) = 1.582' },
    { id: 'cmp-adaptive', label: 'Randomised, adaptive adversary', note: 'the same strategy, a stronger opponent' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A purchase price and a season nobody can see',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Cost against season length, and the optimum that saw it coming</div>' +
      '<div class="card-body"><div id="cmp-chart" class="chart-host"></div>' +
      '<p class="note" id="cmp-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Three deterministic strategies, scored on the worst case rather than the average</div>' +
      '<div class="card-body"><table class="ref-table" id="cmp-strategies"><thead><tr>' +
      '<th>Strategy</th><th>Worst ratio</th><th>Season length that produced it</th>' +
      '<th>Mean ratio</th><th>What it is</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="cmp-strategies-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The bound at every purchase price, and whether the rule attains it</div>' +
      '<div class="card-body"><table class="ref-table" id="cmp-prices"><thead><tr>' +
      '<th>Buying costs</th><th>Worst ratio measured</th><th>2 − 1/B</th><th>Attained exactly</th>' +
      '<th>Worst at day</th><th>Mean ratio</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="cmp-prices-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">List update: three request families, and the policy each one favours</div>' +
      '<div class="card-body"><table class="ref-table" id="cmp-lists"><thead><tr>' +
      '<th>Request family</th><th>Do nothing</th><th>Transpose</th><th>Move to front</th>' +
      '<th>Frequency count</th><th>Best static order</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="cmp-lists-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
