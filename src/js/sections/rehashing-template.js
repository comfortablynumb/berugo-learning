/** Markup for "Resizing and rehashing". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RehashingTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'rs-inserts', kind: 'range', label: 'insertions', value: 20000, min: 2000, max: 60000, step: 2000 },
    { id: 'rs-move', kind: 'range', label: 'buckets moved per operation', value: 4, min: 1, max: 32, step: 1,
      note: 'Higher means the migration finishes sooner and each operation costs more.' },
    { id: 'rs-maxload', kind: 'range', label: 'grow at load', value: 70, min: 40, max: 90, step: 5, suffix: '%' }
  ];

  const METRICS = [
    { id: 'rs-peak-sync', label: 'Worst insert, synchronous', note: 'slot writes in one call' },
    { id: 'rs-peak-inc', label: 'Worst insert, incremental', note: 'the same call, spread out' },
    { id: 'rs-p999', label: 'p99.9 comparison', note: 'synchronous → incremental' },
    { id: 'rs-total', label: 'Total work', note: 'what the flat tail costs overall' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Insert stream', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Work per insertion</div>' +
      '<div class="card-body"><div id="rs-trace"></div><div id="rs-trace-legend"></div>' +
      '<p class="note">Every insertion, in order, plotted by the work it did. The spikes are ' +
      'rehashes; each one is a single call that moved the whole table.</p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="grid-2" style="margin-top:.875rem">' +
      '<div class="card"><div class="card-header">Latency distribution</div>' +
      '<div class="card-body"><div id="rs-percentiles"></div></div></div>' +
      '<div class="card"><div class="card-header">Migration state</div>' +
      '<div class="card-body"><div id="rs-migration" class="mono" style="font-size:.8125rem"></div>' +
      '<p class="note">During an incremental migration both tables are live: a lookup checks the ' +
      'old table first, so memory is doubled until the last bucket moves.</p></div></div>' +
      '</div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
