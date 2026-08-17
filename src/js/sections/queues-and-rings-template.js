/** Markup for "Queues, deques and ring buffers". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.QueuesAndRingsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ring-capacity', kind: 'range', label: 'requested capacity', value: 12, min: 2, max: 64, step: 1,
      note: 'Rounded up to a power of two so the wrap is a mask, not a modulo.' },
    { id: 'ring-policy', kind: 'select', label: 'when full', value: 'reject',
      options: [{ value: 'reject', label: 'reject the new item (backpressure)' },
        { value: 'overwrite', label: 'overwrite the oldest (drop)' }] },
    { id: 'ring-produce', kind: 'range', label: 'producer rate', value: 6, min: 1, max: 12, step: 1 },
    { id: 'ring-consume', kind: 'range', label: 'consumer rate', value: 4, min: 0, max: 12, step: 1 },
    { id: 'ring-step', kind: 'button', label: 'Run 20 ticks', primary: true },
    { id: 'ring-reset', kind: 'button', label: 'Reset' }
  ];

  const METRICS = [
    { id: 'ring-size', label: 'Occupancy', note: 'usable slots are capacity − 1' },
    { id: 'ring-dropped', label: 'Items lost', note: 'rejected or overwritten' },
    { id: 'ring-mask', label: 'Wrap arithmetic', note: 'mask instead of modulo' },
    { id: 'ring-state', label: 'Head / tail', note: 'equal means empty, not full' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Ring buffer', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Slots, head and tail</div>' +
      '<div class="card-body"><div id="ring-slots" class="mono" style="font-size:.75rem"></div>' +
      '<div id="ring-history" style="margin-top:.75rem"></div></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS);
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
