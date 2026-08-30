/** Markup for "The single-cycle datapath". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DatapathTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'dpa-program', kind: 'select', label: 'program', value: 'mixed',
      options: [
        { value: 'mixed', label: 'one of each: arithmetic, load, store, branch, jump' },
        { value: 'arithmetic', label: 'arithmetic only — watch the memory sit idle' },
        { value: 'memory', label: 'loads and stores' }] },
    { id: 'dpa-step', kind: 'range', label: 'instructions executed on the gates',
      value: 3, min: 0, max: 10, step: 1 }
  ];

  const METRICS = [
    { id: 'dpa-instruction', label: 'Instruction', note: 'fetched at the program counter' },
    { id: 'dpa-gates', label: 'Gates in the datapath', note: 'and the transistors' },
    { id: 'dpa-period', label: 'Clock period', note: 'register to register, in gate delays' },
    { id: 'dpa-idle', label: 'Blocks idle this cycle', note: 'and paid for anyway' },
    { id: 'dpa-agree', label: 'Against the reference', note: 'architectural state, every step' },
    { id: 'dpa-cost', label: 'Cost of one gate-level step', note: 'wire changes to settle' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Step the gates, one instruction at a time',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The datapath, with this instruction on it' +
      '</div><div class="card-body"><div id="dpa-graph" class="mermaid-host"></div>' +
      '<p class="note" id="dpa-graph-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('dpa-signals', 'The control signals driving it right now',
        ['Signal', 'Value', 'What it does', 'Effect here']) +
      card('dpa-differential', 'The gate machine against the behavioural reference',
        ['Step', 'PC', 'Instruction', 'Registers that changed', 'Agree?']) +
      chartCard() +
      card('dpa-classes', 'What each instruction class actually uses',
        ['Class', 'Register file', 'ALU', 'Data memory', 'Write back', 'Idle']) +
      card('dpa-cost-table', 'Where the gates are',
        ['Block', 'Gates', 'Share', 'Longest path through it', 'Why it is that size']);
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Gates and delay, block by block</div>' +
      '<div class="card-body"><div id="dpa-chart" class="chart-host"></div>' +
      '<p class="note" id="dpa-chart-note"></p></div></div>';
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
