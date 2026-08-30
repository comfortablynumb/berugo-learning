/** Markup for "The control unit". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ControlTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ctl-instruction', kind: 'select', label: 'instruction to decode', value: 'lw a0, 8(a1)',
      options: [
        { value: 'add a0, a1, a2', label: 'add — the plainest vector there is' },
        { value: 'addi a0, a1, 8', label: 'addi — one bit different' },
        { value: 'lw a0, 8(a1)', label: 'lw — the only class that uses everything' },
        { value: 'sw a0, 8(a1)', label: 'sw — writes memory, writes no register' },
        { value: 'beq a0, a1, 8', label: 'beq — the comparison decides the next PC' },
        { value: 'jal ra, 8', label: 'jal — write the link, redirect the PC' },
        { value: 'lui a0, 0x10000', label: 'lui — the immediate goes straight to the register' }] },
    { id: 'ctl-break', kind: 'select', label: 'force a signal, everywhere', value: 'none',
      options: [
        { value: 'none', label: 'nothing forced — the machine is correct' },
        { value: 'regWrite=0', label: 'regWrite stuck low — nothing is ever written' },
        { value: 'aluSrc=1', label: 'aluSrc stuck high — every operand is the immediate' },
        { value: 'branch=0', label: 'branch stuck low — no branch is ever taken' },
        { value: 'memWrite=1', label: 'memWrite stuck high — everything is a store' },
        { value: 'writeBack=1', label: 'writeBack stuck at "memory" — every result is a load' }] }
  ];

  const METRICS = [
    { id: 'ctl-asserted', label: 'Signals asserted', note: 'of the whole vector' },
    { id: 'ctl-agree', label: 'Gates against the table', note: 'over every instruction' },
    { id: 'ctl-size', label: 'Decoder size', note: 'gates, and its depth' },
    { id: 'ctl-broken', label: 'With that signal forced', note: 'what the program produces' },
    { id: 'ctl-correct', label: 'What it should produce', note: 'the same program, unforced' },
    { id: 'ctl-undefined', label: 'Undefined opcode', note: 'must write nothing' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Decode an instruction, then break it',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The control vector</div>' +
      '<div class="card-body"><table class="ref-table" id="ctl-vector"><thead><tr>' +
      '<th>Signal</th><th>From the table</th><th>From the gates</th><th>Agree?</th>' +
      '<th>What it does</th></tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ctl-vector-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('ctl-break-table', 'What each forced signal does to four programs',
        ['Forced signal', 'sum', 'array max', 'string length', 'What went wrong']) +
      card('ctl-table', 'The control table, one row per opcode',
        ['Opcode', 'regWrite', 'aluSrc', 'memRead', 'memWrite', 'branch', 'jump',
          'write back']) +
      chartCard() +
      card('ctl-styles', 'Hardwired against microcoded control',
        ['Property', 'Hardwired', 'Microcoded', 'Which machines chose it']) +
      card('ctl-safety', 'What a decoder must do with input it does not recognise',
        ['Case', 'This decoder', 'Why it matters']);
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">How many signals each instruction class asserts</div>' +
      '<div class="card-body"><div id="ctl-chart" class="chart-host"></div>' +
      '<p class="note" id="ctl-chart-note"></p></div></div>';
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
