/** Markup for "Memory interface and I/O". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MemoryIoTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'mmi-address', kind: 'select', label: 'address', value: '0x10000000',
      options: [
        { value: '0x10000000', label: '0x10000000 — RAM, word aligned' },
        { value: '0x10000001', label: '0x10000001 — RAM, one byte along' },
        { value: '0x10000002', label: '0x10000002 — RAM, half-word aligned' },
        { value: '0x20000000', label: '0x20000000 — the console data register' },
        { value: '0x20001000', label: '0x20001000 — the timer counter' },
        { value: '0x30000000', label: '0x30000000 — nothing is mapped here' }] },
    { id: 'mmi-width', kind: 'select', label: 'access width', value: '4',
      options: [
        { value: '1', label: 'byte — lb or lbu' },
        { value: '2', label: 'half word — lh or lhu' },
        { value: '4', label: 'word — lw' }] },
    { id: 'mmi-signed', kind: 'checkbox', label: 'sign-extend the loaded value', value: true },
    { id: 'mmi-pattern', kind: 'select', label: 'byte pattern stored first', value: '0xfeedbe80',
      options: [
        { value: '0xfeedbe80', label: '0xfeedbe80 — every byte has its top bit set' },
        { value: '0x000000ff', label: '0x000000ff — one byte of ones at the low address' },
        { value: '0x12345678', label: '0x12345678 — nothing negative anywhere' },
        { value: '0x80008000', label: '0x80008000 — the sign bit of each half word' }] }
  ];

  const METRICS = [
    { id: 'mmi-result', label: 'What the load returns', note: 'from the byte pattern below' },
    { id: 'mmi-region', label: 'Region', note: 'which side of the address map' },
    { id: 'mmi-fault', label: 'Fault', note: 'or the value, never both' },
    { id: 'mmi-extension', label: 'Same bytes, other opcode', note: 'signed against unsigned' },
    { id: 'mmi-combinations', label: 'Combinations checked', note: 'width x alignment x region' },
    { id: 'mmi-console', label: 'Console output', note: 'from the device program' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'One access, and what the interface makes of it',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The bytes, and how this load reads them</div>' +
      '<div class="card-body"><table class="ref-table" id="mmi-bytes"><thead><tr>' +
      '<th>Address</th><th>Byte</th><th>Read by this access?</th><th>Contributes</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mmi-bytes-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('mmi-matrix', 'Every width against every alignment, driven',
        ['Address', 'Byte', 'Half word', 'Word', 'What decides it']) +
      card('mmi-extension-table', 'The same bytes through the signed and unsigned opcodes',
        ['Bytes', 'Width', 'lb / lh (signed)', 'lbu / lhu (unsigned)', 'Why they differ']) +
      chartCard() +
      card('mmi-map', 'The address map, small enough to hold in your head',
        ['Region', 'Base', 'Size', 'Kind', 'What it is for']) +
      card('mmi-mmio', 'What makes a device register not memory',
        ['Property', 'Ordinary memory', 'A device register', 'What breaks if you forget']);
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The same 32 bits read as 1, 2 and 4 bytes, signed and unsigned' +
      '</div><div class="card-body"><div id="mmi-chart" class="chart-host"></div>' +
      '<p class="note" id="mmi-chart-note"></p></div></div>';
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
