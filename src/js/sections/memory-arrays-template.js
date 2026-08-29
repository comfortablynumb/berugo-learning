/** Markup for "Memory arrays and register files". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MemArrayTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ram-count', kind: 'select', label: 'registers in the file', value: '4',
      options: [{ value: '2', label: '2 registers' }, { value: '4', label: '4 registers' },
        { value: '8', label: '8 registers' }] },
    { id: 'ram-width', kind: 'range', label: 'bits per register', value: 4, min: 1, max: 8,
      step: 1 },
    { id: 'ram-read', kind: 'select', label: 'read port A watches', value: '1',
      options: [{ value: '0', label: 'register 0' }, { value: '1', label: 'register 1' },
        { value: '2', label: 'register 2' }, { value: '3', label: 'register 3' }] },
    { id: 'ram-sameCycle', kind: 'checkbox',
      label: 'read the register being written in the same cycle', value: true }
  ];

  const METRICS = [
    { id: 'ram-cells', label: 'Storage cells', note: 'flip-flops in the array' },
    { id: 'ram-gates', label: 'Gates', note: 'storage, decode and read ports together' },
    { id: 'ram-overhead', label: 'Access logic', note: 'the share that is not storage' },
    { id: 'ram-depth', label: 'Read path depth', note: 'gate delays from the array to a port' },
    { id: 'ram-cycles', label: 'Cycles matching the reference',
      note: 'the model writes on the edge and reads the old value' },
    { id: 'ram-rdw', label: 'Read during write', note: 'measured, both sides of the edge' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A register file, clocked', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Six cycles, against the reference</div>' +
      '<div class="card-body"><table class="ref-table" id="ram-cycles-table"><thead><tr>' +
      '<th>Cycle</th><th>Write</th><th>Read A</th><th>Port A before the edge</th>' +
      '<th>Port A after</th><th>Reference</th><th>Agree?</th></tr></thead><tbody></tbody>' +
      '</table><p class="note" id="ram-cycles-table-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('ram-cost', 'What a register file costs as it grows',
        ['Shape', 'Flip-flops', 'Gates', 'Gates per stored bit', 'Read depth',
          'Share that is access logic']) +
      chartCard() +
      card('ram-ports', 'Why the port count is the expensive dimension',
        ['Ports', 'What it adds', 'Cost shape', 'Where you meet it']) +
      card('ram-tech', 'Flip-flops, SRAM and DRAM, in the same units',
        ['Technology', 'Transistors per bit', 'Access', 'Why it exists', 'Where it sits']);
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Storage against access logic, as the file grows</div>' +
      '<div class="card-body"><div id="ram-chart" class="chart-host"></div>' +
      '<p class="note" id="ram-chart-note"></p></div></div>';
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
