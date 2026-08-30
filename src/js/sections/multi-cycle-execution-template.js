/** Markup for "Multi-cycle execution". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MulticycleTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'mcy-program', kind: 'select', label: 'program', value: 'sum',
      options: [
        { value: 'sum', label: 'sum 1..10 — arithmetic and branches, no memory' },
        { value: 'factorial', label: 'factorial — calls, so loads and stores' },
        { value: 'arrayMax', label: 'array maximum — load-heavy' },
        { value: 'strlen', label: 'string length — byte loads in a tight loop' },
        { value: 'console', label: 'console write — stores to a device' }] },
    { id: 'mcy-stage', kind: 'range', label: 'multi-cycle stage period, in gate delays',
      value: 151, min: 20, max: 200, step: 1 }
  ];

  const METRICS = [
    { id: 'mcy-single-period', label: 'Single-cycle period', note: 'the whole datapath, per instruction' },
    { id: 'mcy-multi-period', label: 'Multi-cycle period', note: 'the slowest stage, plus overhead' },
    { id: 'mcy-cpi', label: 'CPI', note: 'measured from the instruction mix' },
    { id: 'mcy-single-time', label: 'Single-cycle time', note: 'instructions x CPI x period' },
    { id: 'mcy-multi-time', label: 'Multi-cycle time', note: 'the same equation, other machine' },
    { id: 'mcy-verdict', label: 'Which wins', note: 'and by how much' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Run one program on two machines',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The performance equation, term by term</div>' +
      '<div class="card-body"><table class="ref-table" id="mcy-equation"><thead><tr>' +
      '<th>Term</th><th>Single cycle</th><th>Multi cycle</th><th>Where it comes from</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mcy-equation-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('mcy-stages', 'The stages, each built as a netlist and walked',
        ['Stage', 'Gates', 'Longest path', 'What happens here']) +
      card('mcy-classes', 'How many cycles each instruction class needs',
        ['Class', 'Stages it visits', 'Cycles', 'What it skips']) +
      card('mcy-mix', 'The instruction mix, counted by running the program',
        ['Class', 'Instructions', 'Share', 'Cycles each', 'Cycles contributed']) +
      chartCard() +
      card('mcy-programs', 'Both machines on all five programs',
        ['Program', 'Instructions', 'CPI', 'Single-cycle time', 'Multi-cycle time', 'Winner']) +
      card('mcy-breakeven', 'What would have to change for multi-cycle to win here',
        ['Lever', 'Now', 'Needed', 'Is that plausible?']);
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Total time in gate delays, both machines, all five programs' +
      '</div><div class="card-body"><div id="mcy-chart" class="chart-host"></div>' +
      '<p class="note" id="mcy-chart-note"></p></div></div>';
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
