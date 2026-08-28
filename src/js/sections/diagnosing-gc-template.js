/** Markup for "Diagnosing GC in production". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DiagnoseTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'dgn-leak', kind: 'range', label: 'leak rate', value: 15,
      min: 0, max: 25, step: 5,
      note: 'per cent of allocations pushed onto a list nothing ever empties' },
    { id: 'dgn-heap', kind: 'range', label: 'heap the collector may fill (bytes)', value: 16384,
      min: 4096, max: 49152, step: 4096, note: 'too small collects constantly; too large pauses' },
    { id: 'dgn-collector', kind: 'select', label: 'collector', value: 'generational',
      options: [
        { value: 'generational', label: 'generational copying' },
        { value: 'mark-sweep', label: 'stop-the-world mark-sweep' },
        { value: 'incremental', label: 'incremental marking' },
        { value: 'regions', label: 'region evacuation' }
      ] }
  ];

  const METRICS = [
    { id: 'dgn-slope', label: 'Retained bytes gained per sample',
      note: 'over the second half of the run, where the warm-up is over' },
    { id: 'dgn-stable', label: 'Heap stabilises', note: 'the assertion the leak lab is graded on' },
    { id: 'dgn-path', label: 'Longest retaining path', note: 'hops from a GC root' },
    { id: 'dgn-promotion', label: 'Promotion rate against allocation rate',
      note: 'the ratio that says whether the nursery is working' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A workload whose heap grows', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Retained bytes at each snapshot</div>' +
      '<div class="card-body"><div id="dgn-chart" class="chart-host"></div>' +
      '<div id="dgn-legend"></div><p class="note" id="dgn-chart-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('dgn-log', 'The GC log, which is the first thing anybody actually reads',
        ['#', 'Reason', 'What it did', 'Bytes before', 'Bytes after', 'Reclaimed',
          'Work']) +
      card('dgn-retained', 'The dominator tree: what comes back if you drop one reference',
        ['Object', 'Site', 'Own bytes', 'Retained bytes', 'Immediate dominator',
          'Directly dominated']) +
      card('dgn-growth', 'What grew between two snapshots, by allocation site',
        ['Site', 'Objects then', 'Objects now', 'Retained then', 'Retained now', 'Gained']) +
      card('dgn-path-table', 'The retaining path from a GC root to the leaked object',
        ['Hop', 'Object', 'Site', 'Own bytes', 'Retained bytes']) +
      card('dgn-sizing', 'Heap sizing: the cost at both ends',
        ['Heap', 'Collections', 'p50 pause', 'p99 pause', 'Throughput', 'Peak bytes',
          'Dead at the end']) +
      card('dgn-leaks', 'The four managed leaks, and what each one looks like in a dump',
        ['Shape', 'What retains it', 'In the dominator tree', 'The fix']);
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
