/** Markup for "Modern collector designs". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ModernTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'mdc-capacity', kind: 'range', label: 'heap the collector may fill (bytes)',
      value: 8192, min: 2048, max: 32768, step: 2048,
      note: 'the same trace in a bigger heap collects less often and pauses for longer' },
    { id: 'mdc-budget', kind: 'range', label: 'evacuation budget (bytes copied)', value: 768,
      min: 128, max: 4096, step: 128, note: 'the pause a region collector is aiming at' },
    { id: 'mdc-policy', kind: 'select', label: 'region selection', value: 'garbage-first',
      options: [
        { value: 'garbage-first', label: 'garbage first — most garbage per byte copied' },
        { value: 'emptiest-first', label: 'emptiest first — fewest survivors' },
        { value: 'optimal', label: 'the knapsack optimum — not shippable, but the denominator' }
      ] },
    { id: 'mdc-mode', kind: 'select', label: 'histogram this design', value: 'generational',
      options: [
        { value: 'mark-sweep', label: 'stop-the-world mark-sweep' },
        { value: 'copying', label: 'semi-space copying' },
        { value: 'generational', label: 'generational copying' },
        { value: 'incremental', label: 'incremental marking' },
        { value: 'regions', label: 'region evacuation' }
      ] }
  ];

  const METRICS = [
    { id: 'mdc-latency', label: 'Best p99 pause', note: 'and the design that posts it' },
    { id: 'mdc-throughput', label: 'Best throughput', note: 'a different design, every time' },
    { id: 'mdc-footprint', label: 'Lowest peak memory', note: 'a third one' },
    { id: 'mdc-correct', label: 'Designs that freed no reachable object',
      note: 'the column that is not a trade-off' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Eight designs, one trace', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Pause distribution, not the average</div>' +
      '<div class="card-body"><div id="mdc-chart" class="chart-host"></div>' +
      '<p class="note" id="mdc-chart-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('mdc-compare', 'The whole milestone in one table',
        ['Design', 'Collections', 'p50', 'p90', 'p99', 'Max', 'Throughput', 'Peak bytes',
          'Dead at the end', 'Freed a live object']) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The heap, by region</div>' +
      '<div class="card-body"><div id="mdc-map"></div>' +
      '<p class="note" id="mdc-map-caption"></p></div></div>' +
      card('mdc-regions', 'Every region, ranked by what it returns per byte copied',
        ['Region', 'Objects', 'Live bytes', 'Garbage bytes', 'Garbage per byte copied',
          'In the collection set']) +
      card('mdc-gap', 'Garbage-first against the optimum it is a heuristic for',
        ['Heap', 'Policy', 'Regions chosen', 'Bytes copied', 'Bytes reclaimed',
          'Optimal', 'Share of optimal']) +
      card('mdc-designs', 'Reading a published collector as a combination of these parts',
        ['Collector', 'Partitioning', 'Moves objects', 'Concurrency', 'The pause it still has']);
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
