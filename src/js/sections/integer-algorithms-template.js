/** Markup for "Integer algorithms in practice". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.IntegerAlgorithmsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ia-count', kind: 'range', label: 'identifiers generated', value: 20000,
      min: 4000, max: 60000, step: 2000 },
    { id: 'ia-rate', kind: 'range', label: 'identifiers issued per millisecond', value: 3,
      min: 1, max: 40, step: 1 },
    { id: 'ia-window', kind: 'range', label: 'index pages the buffer pool can hold', value: 64,
      min: 8, max: 512, step: 8 },
    { id: 'ia-pages', kind: 'select', label: 'pages in the index', value: '4096',
      options: [
        { value: '1024', label: '1 024 pages' },
        { value: '4096', label: '4 096 pages' },
        { value: '16384', label: '16 384 pages' }
      ] },
    { id: 'ia-step', kind: 'range', label: 'how far the clock steps backwards, in ms', value: 40,
      min: 5, max: 200, step: 5 }
  ];

  const METRICS = [
    { id: 'ia-monotonic', label: 'Schemes sorting in creation order', note: 'of the five' },
    { id: 'ia-random-ws', label: 'Random UUID working set', note: 'pages touched in the window' },
    { id: 'ia-ordered-ws', label: 'Time-ordered working set', note: 'the same window, same data' },
    { id: 'ia-duplicates', label: 'Duplicates under a clock regression', note: 'across both policies' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A workload, an index and a clock', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Working set against buffer-pool window</div>' +
      '<div class="card-body"><div id="ia-chart" class="chart-host"></div>' +
      '<div id="ia-legend"></div><p class="note" id="ia-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Five schemes, on the properties that actually differ</div>' +
      '<div class="card-body"><table class="ref-table" id="ia-schemes"><thead><tr>' +
      '<th>Scheme</th><th>Example</th><th>Bits</th><th>Random bits</th>' +
      '<th>Out of order across milliseconds</th><th>Out of order within one</th>' +
      '<th>Peak pages in window</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ia-schemes-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">A Snowflake bit layout, and what each field gives away</div>' +
      '<div class="card-body"><div id="ia-word"></div>' +
      '<p class="note" id="ia-word-note"></p></div></div>' +
      '<div class="grid-even" style="margin-top:.875rem">' +
      '<div class="card"><div class="card-header">When the clock steps backwards</div>' +
      '<div class="card-body"><table class="ref-table" id="ia-clock"><thead><tr>' +
      '<th>Policy</th><th>Issued</th><th>Dropped</th><th>Duplicates</th><th>Still monotonic</th>' +
      '<th>Waits</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ia-clock-note"></p></div></div>' +
      '<div class="card"><div class="card-header">What a holder of one identifier learns</div>' +
      '<div class="card-body"><table class="ref-table" id="ia-leak"><thead><tr>' +
      '<th>Scheme</th><th>Creation time</th><th>Ordering</th><th>Volume</th><th>Machine</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ia-leak-note"></p></div></div>' +
      '</div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
