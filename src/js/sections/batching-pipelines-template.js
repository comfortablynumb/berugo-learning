/** Markup for "Batching, chunking and pipelines". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BatchingPipelinesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'batch-items', kind: 'range', label: 'items', value: 20000, min: 1000, max: 200000, step: 1000 },
    { id: 'batch-stages', kind: 'range', label: 'stages', value: 3, min: 1, max: 6, step: 1 },
    { id: 'batch-size', kind: 'range', label: 'batch size', value: 512, min: 1, max: 8192, step: 1 },
    { id: 'batch-overhead', kind: 'range', label: 'per-batch overhead (µs)', value: 40, min: 0, max: 400, step: 10,
      note: 'A batch costs a fixed setup — a round trip, a transaction, a flush.' }
  ];

  const METRICS = [
    { id: 'batch-peak', label: 'Peak memory', note: 'live bytes at the worst moment' },
    { id: 'batch-first', label: 'Time to first result', note: 'items processed before any output' },
    { id: 'batch-total', label: 'Total time', note: 'work plus per-batch overhead' },
    { id: 'batch-best', label: 'Best batch size here', note: 'minimises total time' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Pipeline', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Total time and peak memory against batch size</div>' +
      '<div class="card-body"><div id="batch-chart"></div><div id="batch-legend"></div></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS);
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
