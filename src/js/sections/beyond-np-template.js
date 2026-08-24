/** Markup for "Beyond NP". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BeyondNpTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'bnp-variables', kind: 'range', label: 'variables', value: 10, min: 6, max: 12, step: 1 },
    { id: 'bnp-clauses', kind: 'range', label: 'clauses', value: 14, min: 8, max: 26, step: 2 },
    { id: 'bnp-pairs', kind: 'range', label: 'game rounds', value: 4, min: 1, max: 6, step: 1 },
    { id: 'bnp-seed', kind: 'select', label: 'matrix seed', value: '5',
      options: [
        { value: '2', label: 'seed 2' },
        { value: '5', label: 'seed 5' },
        { value: '13', label: 'seed 13' }
      ] }
  ];

  const METRICS = [
    { id: 'bnp-sat', label: 'All quantifiers ∃', note: 'the same clauses, read as plain SAT' },
    { id: 'bnp-alternating', label: 'With ∀ in the prefix', note: 'the same clauses, read as a game' },
    { id: 'bnp-expansion', label: 'Written out as one CNF', note: 'clauses after expanding every ∀' },
    { id: 'bnp-strategy', label: 'The certificate', note: 'what a YES answer would have to hand you' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'One matrix, five prefixes', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Expansion cost against alternation depth</div>' +
      '<div class="card-body"><div id="bnp-chart" class="chart-host"></div>' +
      '<p class="note" id="bnp-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The same clauses under five prefixes</div>' +
      '<div class="card-body"><table class="ref-table" id="bnp-prefixes"><thead><tr>' +
      '<th>Prefix</th><th>Alternations</th><th>∀ variables</th><th>QBF answer</th>' +
      '<th>Agrees with the truth-table oracle</th><th>Evaluation nodes</th>' +
      '<th>As plain SAT</th><th>Expanded CNF</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bnp-prefixes-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The same clauses, the quantifiers swapped — a game about who moves first</div>' +
      '<div class="card-body"><table class="ref-table" id="bnp-games"><thead><tr>' +
      '<th>Rounds</th><th>Order</th><th>True?</th><th>Nodes</th>' +
      '<th>A winning strategy is</th><th>Why</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bnp-games-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Where the classes sit, and what each one asks</div>' +
      '<div class="card-body"><table class="ref-table" id="bnp-classes"><thead><tr>' +
      '<th>Class</th><th>The question it asks</th><th>Canonical complete problem</th>' +
      '<th>Certificate for a YES</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bnp-classes-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
