/** Markup for "Offline and batch processing". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.OfflineProcessingTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ofl-size', kind: 'range', label: 'array length n', value: 4000, min: 500, max: 20000, step: 500 },
    { id: 'ofl-queries', kind: 'range', label: 'queries q', value: 600, min: 50, max: 3000, step: 50 },
    { id: 'ofl-universe', kind: 'range', label: 'distinct values', value: 200, min: 10, max: 1000, step: 10 },
    { id: 'ofl-block', kind: 'select', label: 'block size', value: 'optimal',
      options: [{ value: 'optimal', label: 'n / √q — the minimiser' },
        { value: 'sqrt', label: '√n — the usual choice' },
        { value: 'small', label: '√n / 4' },
        { value: 'large', label: '4√n' }] },
    { id: 'ofl-seed', kind: 'range', label: 'workload seed', value: 9, min: 1, max: 40, step: 1 }
  ];

  const METRICS = [
    { id: 'ofl-moves', label: 'Pointer moves, ordered', note: 'Mo\'s order over the same queries' },
    { id: 'ofl-unsorted', label: 'Pointer moves, as they arrived', note: 'the same sweep, online order' },
    { id: 'ofl-bound', label: '(n + q)·√n', note: 'the bound the ordering argument gives' },
    { id: 'ofl-agree', label: 'Answers matching brute force', note: 'of all q queries' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The workload', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Pointer moves against block size</div>' +
      '<div class="card-body"><div id="ofl-chart"></div>' +
      '<div id="ofl-chart-legend"></div>' +
      '<p class="note" id="ofl-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Four block sizes on the same queries</div>' +
      '<div class="card-body"><table class="ref-table" id="ofl-blocks"><thead><tr>' +
      '<th>Block size</th><th>Value</th><th>Pointer moves</th><th>Predicted q·b + n²/b</th><th>Against the best</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ofl-blocks-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Online against offline, on two different questions</div>' +
      '<div class="card-body"><table class="ref-table" id="ofl-questions"><thead><tr>' +
      '<th>Question</th><th>Online structure</th><th>Its cost per query</th><th>Offline moves</th>' +
      '<th>Worth reordering?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ofl-questions-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The first queries, in the order Mo\'s algorithm answers them</div>' +
      '<div class="card-body"><table class="ref-table" id="ofl-order"><thead><tr>' +
      '<th>Rank</th><th>Block</th><th>Left</th><th>Right</th><th>Arrived as query</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ofl-order-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
