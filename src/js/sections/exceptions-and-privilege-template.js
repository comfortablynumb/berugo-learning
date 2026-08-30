/** Markup for "Exceptions, interrupts and privilege". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TrapsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'trp-class', kind: 'select', label: 'what goes wrong', value: 'ecall',
      options: [
        { value: 'ecall', label: 'ecall — a deliberate exception, which is a system call' },
        { value: 'illegal', label: 'an illegal instruction — a word with no opcode' },
        { value: 'misalignedLoad', label: 'a misaligned load — a word at an odd address' },
        { value: 'misalignedStore', label: 'a misaligned store — the same, writing' },
        { value: 'unmapped', label: 'a load from unmapped memory' },
        { value: 'timer', label: 'a timer interrupt — nothing the program did' }] },
    { id: 'trp-handler', kind: 'select', label: 'handler', value: 'aware',
      options: [
        { value: 'aware', label: 'cause-aware: resume after an exception, at an interrupt' },
        { value: 'skip', label: 'always skip four bytes — correct for exceptions only' }] },
    { id: 'trp-step', kind: 'range', label: 'instructions executed', value: 6,
      min: 1, max: 24, step: 1 }
  ];

  const METRICS = [
    { id: 'trp-cause', label: 'mcause', note: 'why control left the program' },
    { id: 'trp-epc', label: 'mepc', note: 'the instruction that trapped, not the next one' },
    { id: 'trp-tval', label: 'mtval', note: 'the offending value, where there is one' },
    { id: 'trp-vector', label: 'Handler entry', note: 'mtvec — one address for everything' },
    { id: 'trp-taken', label: 'Traps taken', note: 'over the whole run' },
    { id: 'trp-outcome', label: 'Did the program finish', note: 'and with what in a3' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Raise a trap, then watch the return',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The control registers, after this trap</div>' +
      '<div class="card-body"><table class="ref-table" id="trp-csrs"><thead><tr>' +
      '<th>CSR</th><th>Number</th><th>Value</th><th>What it holds</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="trp-csrs-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('trp-trace', 'Step by step, through the trap and back',
        ['Step', 'PC', 'Instruction', 'Privilege', 'What happened']) +
      card('trp-classes', 'Every trap class, raised by a real program',
        ['Class', 'Cause', 'mepc', 'mtval', 'Synchronous?', 'Who caused it']) +
      chartCard() +
      card('trp-handlers', 'Two handlers on the same timer interrupt',
        ['Handler', 'Traps taken', 'a3 at the end', 'What went wrong']) +
      card('trp-privilege', 'What privilege actually is at this level',
        ['Question', 'The answer here', 'Where it grows into a kernel']);
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Instructions executed before the trap, per class</div>' +
      '<div class="card-body"><div id="trp-chart" class="chart-host"></div>' +
      '<p class="note" id="trp-chart-note"></p></div></div>';
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
