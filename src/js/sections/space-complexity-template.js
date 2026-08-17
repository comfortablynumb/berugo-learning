/** Markup for "Space complexity and working set". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SpaceComplexityTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'space-n', kind: 'range', label: 'items', value: 5000, min: 500, max: 50000, step: 500 },
    { id: 'space-stages', kind: 'range', label: 'pipeline stages', value: 3, min: 1, max: 6, step: 1 },
    { id: 'space-chunk', kind: 'range', label: 'chunk size', value: 256, min: 16, max: 4096, step: 16,
      note: 'Peak memory is what fails in production; total allocation rarely is.' }
  ];

  const METRICS = [
    { id: 'space-materialised', label: 'Materialised peak', note: 'every stage held at once' },
    { id: 'space-chunked', label: 'Chunked peak', note: 'two chunks in flight' },
    { id: 'space-streaming', label: 'Streaming peak', note: 'one item in flight' },
    { id: 'space-ratio', label: 'Materialised ÷ streaming', note: 'the factor you save' },
    { id: 'space-latency', label: 'Time to first result', note: 'in stage-completions' },
    { id: 'space-stack', label: 'Recursion at this depth', note: 'stack frames are space too' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Same computation, three shapes', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Peak memory against input size</div>' +
      '<div class="card-body"><div id="space-chart"></div><div id="space-legend"></div></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS);
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
