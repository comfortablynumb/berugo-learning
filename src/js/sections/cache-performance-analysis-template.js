/** Markup for "Cache performance analysis". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ThreeCsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function controls() {
    return [
      { id: 'cpa-workload', kind: 'select', label: 'workload', value: 'naive',
        options: scope.MemoryLab.options(['naive', 'interchanged', 'blocked', 'sequential',
          'chase', 'conflicting', 'random']) },
      { id: 'cpa-sets', kind: 'range', label: 'sets', value: 64, min: 8, max: 128, step: 8 },
      { id: 'cpa-ways', kind: 'select', label: 'ways', value: '8',
        options: [1, 2, 4, 8, 16].map(function (value) {
          return { value: String(value), label: String(value) };
        }) }
    ];
  }

  const METRICS = [
    { id: 'cpa-misses', label: 'Misses', note: 'on the real configuration' },
    { id: 'cpa-compulsory', label: 'Compulsory', note: 'no cache could have had it' },
    { id: 'cpa-capacity', label: 'Capacity', note: 'it would not have fitted anyway' },
    { id: 'cpa-conflict', label: 'Conflict', note: 'it fitted and the mapping lost it' },
    { id: 'cpa-sum', label: 'The three sum to', note: 'and it has to be exact' },
    { id: 'cpa-fix', label: 'What to reach for', note: 'from the dominant category' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Classify every miss by what would have caught it',
        controls: controls() }) +
      scope.DataTable.markup({ id: 'cpa-categories', first: true,
        title: 'The three Cs on this workload',
        columns: ['Category', 'Misses', 'Share', 'What it means', 'The fix it implies'] }) +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      chartCard() +
      scope.DataTable.markup({ id: 'cpa-assoc',
        title: 'Associativity: conflict misses vanish and capacity misses do not',
        columns: ['Ways', 'Sets', 'Compulsory', 'Capacity', 'Conflict', 'Hit rate'] }) +
      scope.DataTable.markup({ id: 'cpa-amat',
        title: 'Average memory access time, recursively, against the measured cycles',
        columns: ['Level', 'Hit cycles', 'Miss rate', 'AMAT from here down', 'Accesses served'] }) +
      scope.DataTable.markup({ id: 'cpa-workloads',
        title: 'Every workload, decomposed',
        columns: ['Workload', 'Misses', 'Compulsory', 'Capacity', 'Conflict', 'Dominant',
          'Sums exactly'] });
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Where the misses go as associativity rises</div>' +
      '<div class="card-body"><div id="cpa-chart" class="chart-host"></div>' +
      '<p class="note" id="cpa-chart-note"></p></div></div>';
  }

  return { render: render, controls: controls, metrics: METRICS };
}));
