/** Markup for "DRAM and the memory controller". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DramTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'dram-workload', kind: 'select', label: 'request stream', value: 'twoStreams',
      options: [
        { value: 'sequential', label: 'sequential — every line in order' },
        { value: 'twoStreams', label: 'two streams — interleaved, far apart' },
        { value: 'bankConflict', label: 'bank conflict — a stride that hits one bank' },
        { value: 'random', label: 'random — uniform over 4 MiB' }] },
    { id: 'dram-policy', kind: 'select', label: 'scheduling policy', value: 'frfcfs',
      options: [{ value: 'fcfs', label: 'FCFS — arrival order, whatever it costs' },
        { value: 'frfcfs', label: 'FR-FCFS — prefer a request that hits the open row' }] },
    { id: 'dram-interleave', kind: 'select', label: 'address interleaving', value: 'bankFirst',
      options: [{ value: 'bankFirst', label: 'bank first — consecutive lines spread out' },
        { value: 'rowFirst', label: 'row first — a whole row before the next bank' }] },
    { id: 'dram-banks', kind: 'select', label: 'banks', value: '8',
      options: [1, 2, 4, 8, 16].map(function (value) {
        return { value: String(value), label: String(value) };
      }) },
    { id: 'dram-queue', kind: 'range', label: 'controller queue depth', value: 16, min: 1,
      max: 32, step: 1 }
  ];

  const METRICS = [
    { id: 'dram-hit', label: 'Row-hit rate', note: 'the row was already open' },
    { id: 'dram-conflict', label: 'Row conflicts', note: 'a different row had to be closed' },
    { id: 'dram-average', label: 'Average service', note: 'cycles from arrival to data' },
    { id: 'dram-elapsed', label: 'Elapsed', note: 'wall cycles for the whole stream' },
    { id: 'dram-throughput', label: 'Throughput', note: 'lines per thousand cycles' },
    { id: 'dram-worst', label: 'Worst wait', note: 'the request the policy left behind' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Schedule requests across banks', controls: CONTROLS }) +
      scope.DataTable.markup({ id: 'dram-outcomes', first: true,
        title: 'The three outcomes, and what each costs',
        columns: ['Outcome', 'What has to happen', 'Cycles', 'Against a hit'] }) +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      timelineCard() +
      scope.DataTable.markup({ id: 'dram-matrix',
        title: 'Interleaving against policy, on every stream',
        columns: ['Stream', 'Interleaving', 'FCFS row hits', 'FR-FCFS row hits',
          'FCFS throughput', 'FR-FCFS throughput'] }) +
      scope.DataTable.markup({ id: 'dram-banks-table',
        title: 'Bank-level parallelism: the same stream across more banks',
        columns: ['Banks', 'Row hits', 'Elapsed', 'Throughput', 'Against one bank'] }) +
      scope.DataTable.markup({ id: 'dram-reorder',
        title: 'What the reordering costs the request it passed over',
        columns: ['Policy', 'Requests moved', 'Furthest moved', 'Worst wait',
          'Bounded by'] });
  }

  function timelineCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Banks down, time across — one cell per request</div>' +
      '<div class="card-body"><div id="dram-timeline"></div>' +
      '<div class="pipe-legend" id="dram-legend"></div>' +
      '<p class="note" id="dram-timeline-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
