/** Markup for "Structural hazards". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StructuralTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'sth-program', kind: 'select', label: 'program', value: 'arrayMax',
      options: [
        { value: 'arrayMax', label: 'array maximum — a load every iteration' },
        { value: 'strlen', label: 'string length — a byte load every iteration' },
        { value: 'factorial', label: 'factorial — loads and stores around every call' },
        { value: 'sum', label: 'sum 1..10 — no memory access at all' }] },
    { id: 'sth-unified', kind: 'checkbox', label: 'one memory for instructions and data',
      value: true },
    { id: 'sth-cycles', kind: 'range', label: 'cycles shown in the diagram', value: 20,
      min: 8, max: 40, step: 1 }
  ];

  const METRICS = [
    { id: 'sth-cycles-total', label: 'Cycles', note: 'to run the whole program' },
    { id: 'sth-structural', label: 'Structural stalls', note: 'fetch waiting for the memory port' },
    { id: 'sth-ipc', label: 'IPC', note: 'instructions retired per cycle' },
    { id: 'sth-split', label: 'With split memories', note: 'the same program, two ports' },
    { id: 'sth-cost', label: 'What the second port buys', note: 'cycles saved' },
    { id: 'sth-accesses', label: 'Memory instructions', note: 'the ones that contend' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'One memory, or two',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Where the cycles went</div>' +
      '<div class="card-body"><table class="ref-table" id="sth-attribution"><thead><tr>' +
      '<th>Cause</th><th>Cycles</th><th>Share</th><th>What it is</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="sth-attribution-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      diagramCard() +
      card('sth-compare', 'Every program, with one memory and with two',
        ['Program', 'Memory instructions', 'Unified: cycles', 'Split: cycles', 'Cost of sharing']) +
      chartCard() +
      card('sth-resolutions', 'Three ways to answer a resource conflict',
        ['Resolution', 'What it costs', 'What it buys', 'Where it is the right answer']) +
      card('sth-elsewhere', 'The same decision, at other scales',
        ['Resource', 'Duplicate it', 'Stall for it', 'What decides']);
  }

  function diagramCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The stage diagram, with the contention marked</div>' +
      '<div class="card-body"><div id="sth-diagram"></div>' +
      '<p class="note" id="sth-diagram-note"></p></div></div>';
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Cycles with one memory and with two</div>' +
      '<div class="card-body"><div id="sth-chart" class="chart-host"></div>' +
      '<p class="note" id="sth-chart-note"></p></div></div>';
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
