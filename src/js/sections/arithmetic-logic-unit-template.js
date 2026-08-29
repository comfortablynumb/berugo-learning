/** Markup for "The arithmetic logic unit". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AluTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'alu-op', kind: 'select', label: 'operation', value: '1',
      options: [{ value: '0', label: 'add — a plus b' },
        { value: '1', label: 'subtract — a minus b, through the same adder' },
        { value: '2', label: 'and — bitwise' },
        { value: '3', label: 'xor — bitwise' }] },
    { id: 'alu-width', kind: 'select', label: 'width', value: '8',
      options: [{ value: '4', label: '4 bits — small enough to check exhaustively' },
        { value: '8', label: '8 bits' }, { value: '16', label: '16 bits' }] },
    { id: 'alu-a', kind: 'range', label: 'operand a', value: 200, min: 0, max: 255, step: 1 },
    { id: 'alu-b', kind: 'range', label: 'operand b', value: 100, min: 0, max: 255, step: 1 }
  ];

  const METRICS = [
    { id: 'alu-result', label: 'Result', note: 'unsigned, and as a signed value' },
    { id: 'alu-flags', label: 'Flags out', note: 'zero, negative, carry, overflow' },
    { id: 'alu-gates', label: 'Gates', note: 'and the transistors they cost' },
    { id: 'alu-depth', label: 'Critical path', note: 'operation select is part of it' },
    { id: 'alu-checked', label: 'Cases checked', note: 'against the behavioural reference' },
    { id: 'alu-verdict', label: 'Verdict', note: 'the reference is written from the definitions' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'One block, four operations, four flags',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Every operation on these operands</div>' +
      '<div class="card-body"><table class="ref-table" id="alu-ops"><thead><tr>' +
      '<th>Operation</th><th>Result</th><th>Signed</th><th>Flags set</th>' +
      '<th>Matches the reference?</th></tr></thead><tbody></tbody></table>' +
      '<p class="note" id="alu-ops-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('alu-flagtable', 'The four flags, and the branches that read them',
        ['Flag', 'Set when', 'Computed by', 'The branch it drives', 'The bug it causes']) +
      card('alu-cases', 'The corner cases, each computed and checked',
        ['Case', 'Operands', 'Result', 'Flags', 'What it demonstrates']) +
      chartCard() +
      card('alu-cost', 'Where the gates and the delay go',
        ['Part', 'Gates', 'Depth', 'Share of the ALU', 'Why it is there']) +
      card('alu-isa', 'What this block forces on an instruction set',
        ['Design choice', 'The hardware reason', 'Where you see it']);
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The ALU against a bare adder, as the word widens</div>' +
      '<div class="card-body"><div id="alu-chart" class="chart-host"></div>' +
      '<p class="note" id="alu-chart-note"></p></div></div>';
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
