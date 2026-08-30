/** Markup for "Data hazards and forwarding". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ForwardingTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'dhz-fixture', kind: 'select', label: 'dependency shape', value: 'double',
      options: [
        { value: 'chain', label: 'a chain — every instruction reads the one before it' },
        { value: 'double', label: 'the double hazard — two writes to the same register' },
        { value: 'loaduse', label: 'load-use — the one forwarding cannot fix' },
        { value: 'scheduled', label: 'load-use, with the slot filled by the compiler' },
        { value: 'independent', label: 'no dependences at all' }] },
    { id: 'dhz-forwarding', kind: 'select', label: 'forwarding unit', value: 'full',
      options: [
        { value: 'full', label: 'full: the most recent producer wins' },
        { value: 'naive', label: 'naive: MEM/WB checked first — the classic bug' },
        { value: 'none', label: 'none: every dependence stalls' }] },
    { id: 'dhz-cycles', kind: 'range', label: 'cycles shown in the diagram', value: 16,
      min: 8, max: 32, step: 1 }
  ];

  const METRICS = [
    { id: 'dhz-cycles-total', label: 'Cycles', note: 'for this fixture' },
    { id: 'dhz-stalls', label: 'Stalls', note: 'cycles nothing retired' },
    { id: 'dhz-forwards', label: 'Forwards used', note: 'operands that skipped the register file' },
    { id: 'dhz-answer', label: 'What it computes', note: 'and what it should' },
    { id: 'dhz-correct', label: 'Correct?', note: 'against the behavioural simulator' },
    { id: 'dhz-cost', label: 'Against full forwarding', note: 'extra cycles' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Pick a dependency shape and a forwarding unit',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Where each operand came from</div>' +
      '<div class="card-body"><table class="ref-table" id="dhz-operands"><thead><tr>' +
      '<th>Instruction</th><th>rs1</th><th>from</th><th>rs2</th><th>from</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dhz-operands-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      diagramCard() +
      card('dhz-source', 'The fixture', ['Address', 'Instruction', 'Depends on', 'What it costs']) +
      card('dhz-units', 'Three forwarding units on all five fixtures',
        ['Fixture', 'Full', 'Naive', 'None', 'Does naive get the right answer?']) +
      chartCard() +
      card('dhz-kinds', 'Three kinds of dependence, and which can happen here',
        ['Kind', 'What it is', 'In an in-order pipeline', 'Where it does happen']) +
      card('dhz-fixes', 'What can and cannot be forwarded away',
        ['Case', 'Forwarding', 'Stall', 'Compiler']);
  }

  function diagramCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The stage diagram for this fixture</div>' +
      '<div class="card-body"><div id="dhz-diagram"></div>' +
      '<p class="note" id="dhz-diagram-note"></p></div></div>';
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Cycles per fixture, with and without forwarding</div>' +
      '<div class="card-body"><div id="dhz-chart" class="chart-host"></div>' +
      '<p class="note" id="dhz-chart-note"></p></div></div>';
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
