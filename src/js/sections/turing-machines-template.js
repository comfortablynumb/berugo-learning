/** Markup for "Turing machines". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TuringTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'tur-program', kind: 'select', label: 'the machine', value: 'anbncn',
      options: [
        { value: 'anbncn', label: 'a to the n, b to the n, c to the n — not context-free' },
        { value: 'increment', label: 'binary increment' },
        { value: 'palindrome', label: 'binary palindromes' },
        { value: 'doubler', label: 'unary doubling' },
        { value: 'looper', label: 'a machine that never halts' }
      ] },
    { id: 'tur-input', kind: 'text', label: 'the input tape', value: 'aaabbbccc',
      maxLength: 20 },
    { id: 'tur-budget', kind: 'range', label: 'step budget', value: 500, min: 10, max: 2000,
      step: 10 }
  ];

  const METRICS = [
    { id: 'tur-outcome', label: 'Outcome', note: 'halted, rejected, or the budget ran out' },
    { id: 'tur-steps', label: 'Steps taken', note: 'transitions applied' },
    { id: 'tur-space', label: 'Tape cells used', note: 'the span the head ever visited' },
    { id: 'tur-agrees', label: 'Agrees with the definition', note: 'checked over every short input' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Machine, input and budget', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The tape, and where the head stopped</div>' +
      '<div class="card-body"><div id="tur-tape" class="mono" style="font-size:.9rem"></div>' +
      '<p class="note" id="tur-tape-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The configuration, step by step</div>' +
      '<div class="card-body"><table class="ref-table" id="tur-trace"><thead><tr>' +
      '<th>Step</th><th>State</th><th>Reads</th><th>Tape</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tur-trace-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The transition function</div>' +
      '<div class="card-body"><table class="ref-table" id="tur-delta"><thead><tr>' +
      '<th>State</th><th>Reads</th><th>Writes</th><th>Moves</th><th>Goes to</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tur-delta-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Checked against the definition, exhaustively</div>' +
      '<div class="card-body"><table class="ref-table" id="tur-check"><thead><tr>' +
      '<th>Input</th><th>The machine says</th><th>The definition says</th><th>Agree</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tur-check-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Cost against input size</div>' +
      '<div class="card-body"><table class="ref-table" id="tur-growth"><thead><tr>' +
      '<th>Input</th><th>Length</th><th>Steps</th><th>Cells</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tur-growth-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
