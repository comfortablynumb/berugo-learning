/** Markup for "Contiguous memory, addresses and strides". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MemoryLayoutTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'mem-layout', kind: 'select', label: 'layout', value: 'aos',
      options: [{ value: 'aos', label: 'Array of structs (interleaved)' },
        { value: 'soa', label: 'Struct of arrays (columnar)' }] },
    { id: 'mem-field', kind: 'select', label: 'query reads', value: 'score',
      options: [{ value: 'id', label: 'id (i32)' }, { value: 'flag', label: 'flag (u8)' },
        { value: 'score', label: 'score (f64)' }, { value: 'rank', label: 'rank (i16)' }] },
    { id: 'mem-count', kind: 'range', label: 'records', value: 256, min: 16, max: 1024, step: 16 },
    { id: 'mem-reorder', kind: 'checkbox', label: 'order fields widest-first', value: false,
      note: 'Reordering by decreasing size removes the padding, for free.' }
  ];

  const METRICS = [
    { id: 'mem-stride', label: 'Record stride', note: 'bytes per record, padding included' },
    { id: 'mem-padding', label: 'Padding per record', note: 'bytes the alignment rules waste' },
    { id: 'mem-needed', label: 'Bytes needed', note: 'the field the query actually wants' },
    { id: 'mem-read', label: 'Bytes touched', note: 'what the memory system had to move' },
    { id: 'mem-lines', label: 'Cache lines touched', note: '64-byte lines, the real unit of cost' },
    { id: 'mem-waste', label: 'Wasted fraction', note: 'touched but not wanted' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Record and query', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Field placement in one record</div>' +
      '<div class="card-body"><div id="mem-fields"></div>' +
      '<div id="mem-map" style="margin-top:.75rem"></div>' +
      '<p class="note">Each cell is 64 bytes of memory; shading shows how much of the line the ' +
      'query needed.</p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS);
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
