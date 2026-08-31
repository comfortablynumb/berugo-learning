/** Markup for "NUMA and affinity". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.NumaTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'numa-initialiser', kind: 'select', label: 'who touches the buffer first',
      value: 'one', options: [
        { value: 'one', label: 'one thread initialises all of it — the default, and the trap' },
        { value: 'each', label: 'each worker touches its own chunk first' }] },
    { id: 'numa-policy', kind: 'select', label: 'allocation policy', value: 'firstTouch',
      options: [{ value: 'firstTouch', label: 'first touch' },
        { value: 'interleave', label: 'interleaved round-robin' }] },
    { id: 'numa-nodes', kind: 'select', label: 'nodes', value: '2',
      options: [2, 4].map(function (value) {
        return { value: String(value), label: String(value) };
      }) },
    { id: 'numa-remote', kind: 'range', label: 'remote latency (local is 80)', value: 140,
      min: 90, max: 240, step: 10 },
    { id: 'numa-migrate', kind: 'checkbox', label: 'migrate pages that keep being remote',
      value: false }
  ];

  const METRICS = [
    { id: 'numa-locality', label: 'Locality', note: 'accesses served by the local node' },
    { id: 'numa-average', label: 'Average access', note: 'cycles, steady state' },
    { id: 'numa-penalty', label: 'Against all-local', note: 'what the misallocation costs' },
    { id: 'numa-spread', label: 'Pages per node', note: 'where first touch put them' },
    { id: 'numa-migrations', label: 'Pages migrated', note: 'moved to the node using them' },
    { id: 'numa-verdict', label: 'The rule', note: 'allocate where you will use it' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A parallel-for over a freshly allocated buffer',
        controls: CONTROLS }) +
      scope.DataTable.markup({ id: 'numa-matrix', first: true,
        title: 'The latency matrix — what numactl --hardware prints',
        columns: ['From node', 'To node 0', 'To node 1', 'To node 2', 'To node 3'] }) +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      chartCard() +
      scope.DataTable.markup({ id: 'numa-mistake',
        title: 'The mistake and its fix, measured',
        columns: ['Who initialises', 'Locality', 'Average cycles', 'Against all-local',
          'Where the pages went'] }) +
      scope.DataTable.markup({ id: 'numa-policies',
        title: 'The three policies, on the same workload',
        columns: ['Policy', 'Locality', 'Average cycles', 'What it is good for'] }) +
      scope.DataTable.markup({ id: 'numa-migrate-table',
        title: 'Migration has to pass two tests, not one',
        columns: ['Pattern', 'Migration off', 'Migration on', 'Migrations', 'The right answer'] });
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Average access cost as the remote penalty rises</div>' +
      '<div class="card-body"><div id="numa-chart" class="chart-host"></div>' +
      '<p class="note" id="numa-chart-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
