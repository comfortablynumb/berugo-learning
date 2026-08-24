/** Markup for "Equivalent models of computation". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ModelsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'mod-function', kind: 'select', label: 'the function', value: 'doubling',
      options: [
        { value: 'doubling', label: 'double a number' },
        { value: 'addition', label: 'add two numbers' }
      ] },
    { id: 'mod-input', kind: 'range', label: 'input value', value: 5, min: 0, max: 12, step: 1 },
    { id: 'mod-rule', kind: 'select', label: 'cellular automaton rule', value: '110',
      options: [
        { value: '110', label: 'Rule 110 — Turing complete' },
        { value: '30', label: 'Rule 30 — chaotic' },
        { value: '90', label: 'Rule 90 — the Sierpinski triangle' },
        { value: '184', label: 'Rule 184 — traffic flow' }
      ] },
    { id: 'mod-ski', kind: 'text', label: 'an SKI term to reduce', value: 'S(K(SI))Kxy',
      maxLength: 24 }
  ];

  const METRICS = [
    { id: 'mod-agree', label: 'All models agree', note: 'the same function, run in each' },
    { id: 'mod-ram', label: 'RAM steps', note: 'arithmetic in one instruction' },
    { id: 'mod-counter', label: 'Counter machine steps', note: 'increment and decrement only' },
    { id: 'mod-turing', label: 'Turing machine steps', note: 'one cell at a time' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Function, input and models', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">One function, three machines</div>' +
      '<div class="card-body"><table class="ref-table" id="mod-compare"><thead><tr>' +
      '<th>Model</th><th>Answer</th><th>Steps</th><th>What one step is</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mod-compare-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Cost against input size, in each model</div>' +
      '<div class="card-body"><table class="ref-table" id="mod-growth"><thead><tr>' +
      '<th>Input</th><th>RAM</th><th>Counter machine</th><th>Turing machine</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mod-growth-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">A cellular automaton, evolving</div>' +
      '<div class="card-body"><div id="mod-cells" class="mono" ' +
      'style="font-size:.75rem;line-height:1.05"></div>' +
      '<p class="note" id="mod-cells-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Combinatory logic: three rules and no variables</div>' +
      '<div class="card-body"><table class="ref-table" id="mod-ski-trace"><thead><tr>' +
      '<th>Step</th><th>Term</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mod-ski-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Equal power, unequal efficiency</div>' +
      '<div class="card-body"><table class="ref-table" id="mod-models"><thead><tr>' +
      '<th>Model</th><th>Primitive step</th><th>Simulates a Turing machine with</th>' +
      '<th>What it is good for</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mod-models-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
