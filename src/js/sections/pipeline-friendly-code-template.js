/** Markup for "Writing pipeline-friendly code". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BranchlessTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'pfc-order', kind: 'select', label: 'data order', value: 'shuffled',
      options: [
        { value: 'sorted', label: 'sorted — the branch becomes two long runs' },
        { value: 'shuffled', label: 'shuffled — the same values, a coin flip' }] },
    { id: 'pfc-shape', kind: 'select', label: 'code shape', value: 'branchy',
      options: [
        { value: 'branchy', label: 'branchy — one data-dependent branch per element' },
        { value: 'branchless', label: 'branchless — a mask, and three more instructions' }] },
    { id: 'pfc-penalty', kind: 'range', label: 'misprediction penalty, in cycles', value: 2,
      min: 1, max: 25, step: 1 }
  ];

  const METRICS = [
    { id: 'pfc-answer', label: 'What it computes', note: 'the same number in every case' },
    { id: 'pfc-cycles', label: 'Cycles', note: 'on this five-stage pipeline' },
    { id: 'pfc-instructions', label: 'Instructions', note: 'retired' },
    { id: 'pfc-mispredicts', label: 'Mispredictions', note: 'of the branches predicted' },
    { id: 'pfc-versus', label: 'Against the other shape', note: 'same data order' },
    { id: 'pfc-breakeven', label: 'Break-even penalty', note: 'where branchless starts winning' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Sort the data, or remove the branch',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">All four combinations</div>' +
      '<div class="card-body"><table class="ref-table" id="pfc-matrix"><thead><tr>' +
      '<th>Shape</th><th>Order</th><th>Answer</th><th>Instructions</th><th>Mispredicts</th>' +
      '<th>Cycles</th></tr></thead><tbody></tbody></table>' +
      '<p class="note" id="pfc-matrix-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      chartCard() +
      card('pfc-code', 'The two inner loops, instruction for instruction',
        ['Branchy', 'Branchless', 'What changed']) +
      card('pfc-penalty-table', 'The same measurement on four machines',
        ['Penalty', 'Branchy, shuffled', 'Branchless', 'Which wins', 'Which machine this is']) +
      card('pfc-techniques', 'What actually helps, and when it does not',
        ['Technique', 'What it does', 'When it wins', 'When it loses']) +
      card('pfc-discipline', 'How to know which case you are in',
        ['Question', 'How to answer it', 'What people do instead']);
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Cycles for all four combinations</div>' +
      '<div class="card-body"><div id="pfc-chart" class="chart-host"></div>' +
      '<p class="note" id="pfc-chart-note"></p></div></div>';
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
