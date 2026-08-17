/** Markup for "Fibonacci heaps and the theory-practice gap". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.FibonacciHeapsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'fh-side', kind: 'range', label: 'grid side (nodes = side²)', value: 150, min: 30, max: 250, step: 10,
      note: 'Dijkstra over a weighted grid: the workload Fibonacci heaps were designed for.' },
    { id: 'fh-seed', kind: 'range', label: 'seed', value: 5, min: 1, max: 40, step: 1 },
    { id: 'fh-runs', kind: 'range', label: 'timed runs per queue', value: 5, min: 1, max: 15, step: 1 }
  ];

  const METRICS = [
    { id: 'fh-fewest-cmp', label: 'Fewest comparisons', note: 'the queue the theory predicts' },
    { id: 'fh-fastest', label: 'Fastest wall clock', note: 'the queue that actually wins' },
    { id: 'fh-degree', label: 'Max degree', note: 'against the log_φ(n) bound' },
    { id: 'fh-cascades', label: 'Cascading cuts', note: 'the mechanism the bound rests on' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Graph and timing', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The two rankings, side by side</div>' +
      '<div class="card-body"><div id="fh-chart"></div><div id="fh-legend"></div></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Dijkstra on the identical graph, four priority queues</div>' +
      '<div class="card-body"><table class="ref-table" id="fh-table"><thead><tr>' +
      '<th>Queue</th><th>Comparisons</th><th>decrease-key calls</th><th>Median time</th><th>Answers agree</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="fh-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What the amortised bounds actually say</div>' +
      '<div class="card-body"><table class="ref-table" id="fh-bounds"><thead><tr>' +
      '<th>Operation</th><th>Binary heap</th><th>Fibonacci heap</th><th>What it costs in practice</th>' +
      '</tr></thead><tbody></tbody></table></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
