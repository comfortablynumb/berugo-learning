/** Markup for "Sequential logic: latches, flip-flops and registers". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StoreTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CELLS = {
    sr: { label: 'SR latch — two cross-coupled NOR gates',
      about: 'the smallest thing that remembers, and it has a forbidden input' },
    d: { label: 'D latch — one data input, one enable',
      about: 'no forbidden state, but transparent while the enable is high' },
    dff: { label: 'D flip-flop — master and slave, edge triggered',
      about: 'never transparent: the value at the edge is the value that is kept' }
  };

  const CONTROLS = [
    { id: 'sto-cell', kind: 'select', label: 'storage element', value: 'dff',
      options: Object.keys(CELLS).map(function (id) {
        return { value: id, label: CELLS[id].label };
      }) },
    { id: 'sto-d', kind: 'checkbox', label: 'data in (set, for the SR latch)', value: true },
    { id: 'sto-clock', kind: 'checkbox', label: 'enable or clock (reset, for the SR latch)',
      value: false },
    { id: 'sto-width', kind: 'range', label: 'register width for the tables below',
      value: 4, min: 1, max: 8, step: 1 }
  ];

  const METRICS = [
    { id: 'sto-q', label: 'Stored value', note: 'q, and its complement' },
    { id: 'sto-legal', label: 'Complementary?', note: 'q and not-q must disagree' },
    { id: 'sto-gates', label: 'Gates in the cell', note: 'and the transistors' },
    { id: 'sto-settle', label: 'Settling time', note: 'from the last input change' },
    { id: 'sto-transparent', label: 'Transparent?', note: 'does the output follow d right now' },
    { id: 'sto-register', label: 'Register cost', note: 'per bit, at the width below' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Drive the inputs and watch what is remembered',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The cell, wired as the simulator runs it</div>' +
      '<div class="card-body"><div id="sto-graph" class="mermaid-host"></div>' +
      '<p class="note" id="sto-graph-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      waveCard() +
      card('sto-sequence', 'A driven sequence, one input change at a time',
        ['Step', 'Inputs', 'q after', 'What happened', 'Settling time']) +
      card('sto-cells', 'The three cells, measured side by side',
        ['Cell', 'Gates', 'Transistors', 'Transparent when', 'Forbidden input', 'Used for']) +
      card('sto-register-table', 'A register, cycle by cycle, against its reference',
        ['Cycle', 'd', 'write enable', 'q before the edge', 'q after the edge', 'Reference']) +
      card('sto-timing', 'Setup, hold, and the failure that has no fix',
        ['Constraint', 'What it means', 'What violating it does', 'Where it bites']);
  }

  function waveCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The waveform through one clock edge</div>' +
      '<div class="card-body"><div id="sto-wave" class="chart-host"></div>' +
      '<p class="note" id="sto-wave-note"></p></div></div>';
  }

  function card(id, title, columns) {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">' + title + '</div>' +
      '<div class="card-body"><table class="ref-table" id="' + id + '"><thead><tr>' +
      columns.map(function (name) { return '<th>' + name + '</th>'; }).join('') +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="' + id + '-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, CELLS: CELLS };
}));
