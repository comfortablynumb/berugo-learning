/** Markup for "Indexed priority queues and decrease-key in practice". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.IndexedPriorityQueuesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ipq-side', kind: 'range', label: 'grid side (nodes = side²)', value: 150, min: 30, max: 250, step: 10 },
    { id: 'ipq-seed', kind: 'range', label: 'seed', value: 5, min: 1, max: 40, step: 1 },
    { id: 'ipq-runs', kind: 'range', label: 'timed runs', value: 5, min: 1, max: 15, step: 1,
      note: 'Both strategies compute identical distances. Only the queue behaviour differs.' }
  ];

  const METRICS = [
    { id: 'ipq-pushes', label: 'Pushes: indexed', note: 'one per node, ever' },
    { id: 'ipq-lazy-pushes', label: 'Pushes: lazy', note: 'one per improvement' },
    { id: 'ipq-queue', label: 'Peak queue size', note: 'indexed against lazy' },
    { id: 'ipq-time', label: 'Faster in practice', note: 'median wall clock' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Graph and timing', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The three parallel arrays an indexed heap keeps</div>' +
      '<div class="card-body"><pre class="step-work" id="ipq-arrays"></pre>' +
      '<p class="note" id="ipq-arrays-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Dijkstra, twice: real decrease-key against lazy insertion</div>' +
      '<div class="card-body"><table class="ref-table" id="ipq-table"><thead><tr>' +
      '<th>Strategy</th><th>Pushes</th><th>Stale pops</th><th>Peak queue</th><th>Comparisons</th><th>Median time</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ipq-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What each strategy asks of you</div>' +
      '<div class="card-body"><table class="ref-table" id="ipq-tradeoff"><thead><tr>' +
      '<th></th><th>Indexed heap</th><th>Lazy insertion</th>' +
      '</tr></thead><tbody></tbody></table></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
