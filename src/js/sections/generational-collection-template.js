/** Markup for "Copying and generational collection". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GenerationalTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'gen-survival', kind: 'range', label: 'survival rate of the workload', value: 15,
      min: 0, max: 60, step: 5, note: 'per cent of new objects linked into something long-lived' },
    { id: 'gen-nursery', kind: 'range', label: 'nursery size (bytes)', value: 1536,
      min: 256, max: 4096, step: 256, note: 'how full it gets before a minor collection' },
    { id: 'gen-barrier', kind: 'select', label: 'write barrier', value: 'card',
      options: [
        { value: 'card', label: 'card table — one byte per span of heap' },
        { value: 'remembered', label: 'remembered set — the exact object' },
        { value: 'none', label: 'none — and watch the oracle fail it' }
      ] },
    { id: 'gen-card', kind: 'range', label: 'card size (bytes)', value: 128,
      min: 32, max: 512, step: 32, note: 'bigger cards, cheaper table, more to rescan' }
  ];

  const METRICS = [
    { id: 'gen-survival-rate', label: 'Objects surviving their first collection',
      note: 'measured on this trace, not quoted' },
    { id: 'gen-p99', label: 'p99 pause against a full collection',
      note: 'objects touched, at the same heap' },
    { id: 'gen-scanned', label: 'Objects scanned to find the extra roots',
      note: 'what the barrier bought, and what it cost' },
    { id: 'gen-wrong', label: 'Reachable objects freed',
      note: 'the number a missing barrier makes non-zero' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A nursery, a barrier and a survival rate',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Work per collection as the heap grows</div>' +
      '<div class="card-body"><div id="gen-chart" class="chart-host"></div>' +
      '<div id="gen-legend"></div><p class="note" id="gen-chart-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The heap, coloured by age</div>' +
      '<div class="card-body"><div id="gen-map"></div>' +
      '<p class="note" id="gen-map-caption"></p></div></div>' +
      card('gen-heapsize', 'Cost per collection against heap size',
        ['Heap', 'Collector', 'Collections', 'Work per collection', 'p99 pause', 'Live bytes']) +
      card('gen-curve', 'The generational hypothesis, measured on this trace',
        ['Allocations', 'Born', 'Still live when the window ends', 'A window later',
          'Survival rate', 'Bytes born']) +
      card('gen-nursery-table', 'What the nursery size buys and costs',
        ['Nursery', 'Minor', 'Major', 'p50 pause', 'p99 pause', 'Total GC work', 'Throughput']) +
      card('gen-barrier-table', 'Three barriers, one workload',
        ['Barrier', 'Cost per store', 'Total store cost', 'Recorded', 'Objects scanned',
          'Table bytes', 'Reachable objects freed']);
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
