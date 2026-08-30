/** Markup for "Instruction set design". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.IsaDesignTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'isd-model', kind: 'select', label: 'machine model', value: 'register',
      options: [
        { value: 'register', label: 'register — operands named explicitly' },
        { value: 'stack', label: 'stack — operands implied by position' },
        { value: 'accumulator', label: 'accumulator — one implied destination' }] },
    { id: 'isd-a', kind: 'range', label: 'a', value: 7, min: 0, max: 20, step: 1 },
    { id: 'isd-b', kind: 'range', label: 'b', value: 5, min: 0, max: 20, step: 1 },
    { id: 'isd-c', kind: 'range', label: 'c', value: 4, min: 0, max: 20, step: 1 },
    { id: 'isd-width', kind: 'select', label: 'instruction width for the packing table',
      value: '16',
      options: [{ value: '16', label: '16 bits' }, { value: '24', label: '24 bits' },
        { value: '32', label: '32 bits' }] },
    { id: 'isd-registers', kind: 'select', label: 'registers', value: '8',
      options: [{ value: '8', label: '8' }, { value: '16', label: '16' },
        { value: '32', label: '32' }] }
  ];

  const METRICS = [
    { id: 'isd-answer', label: 'What the program computes', note: 'all three models, same input' },
    { id: 'isd-instructions', label: 'Instructions', note: 'for the selected model' },
    { id: 'isd-bytes', label: 'Bytes', note: 'and the bytes per instruction' },
    { id: 'isd-immediate', label: 'Immediate bits left', note: 'after opcode and registers' },
    { id: 'isd-range', label: 'Immediate range', note: 'what that many bits can express' },
    { id: 'isd-agree', label: 'Models agreeing', note: 'a comparison needs one computation' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'One expression, three machines',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The program, in the selected model</div>' +
      '<div class="card-body"><table class="ref-table" id="isd-program"><thead><tr>' +
      '<th>#</th><th>Instruction</th><th>Bytes</th><th>What it leaves behind</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="isd-program-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('isd-models', 'The same computation on all three machines',
        ['Model', 'How operands are named', 'Instructions', 'Bytes each', 'Total bytes',
          'Result']) +
      chartCard() +
      card('isd-packing', 'What is left for an immediate, once the fields are paid for',
        ['Width', 'Registers', 'Operand fields', 'Opcode bits', 'Register bits',
          'Immediate bits', 'Range']) +
      card('isd-tradeoffs', 'The design decisions, and what each one costs',
        ['Decision', 'What it buys', 'What it costs', 'Who chose it']);
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Instructions against bytes, per model</div>' +
      '<div class="card-body"><div id="isd-chart" class="chart-host"></div>' +
      '<p class="note" id="isd-chart-note"></p></div></div>';
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
