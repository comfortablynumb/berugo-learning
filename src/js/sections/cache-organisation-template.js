/** Markup for "Cache organisation". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CacheOrgTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function controls() {
    return [
      { id: 'org-address', kind: 'text', label: 'an address to decompose (hex)',
        value: '0x1234' },
      { id: 'org-sets', kind: 'select', label: 'sets', value: '16',
        options: [1, 4, 8, 16, 32, 64].map(function (value) {
          return { value: String(value), label: String(value) };
        }) },
      { id: 'org-ways', kind: 'select', label: 'ways', value: '4',
        options: [1, 2, 4, 8, 16].map(function (value) {
          return { value: String(value),
            label: value === 1 ? '1 — direct mapped' : String(value) };
        }) },
      { id: 'org-line', kind: 'select', label: 'line size', value: '64',
        options: [16, 32, 64, 128, 256].map(function (value) {
          return { value: String(value), label: value + ' bytes' };
        }) },
      { id: 'org-workload', kind: 'select', label: 'workload', value: 'conflicting',
        options: scope.MemoryLab.options(['sequential', 'strided', 'conflicting',
          'chase', 'random']) }
    ];
  }

  const METRICS = [
    { id: 'org-capacity', label: 'Capacity', note: 'sets x ways x line size' },
    { id: 'org-tag', label: 'Tag', note: 'what distinguishes this line in its set' },
    { id: 'org-index', label: 'Index', note: 'which set it must live in' },
    { id: 'org-offset', label: 'Offset', note: 'which byte within the line' },
    { id: 'org-hitrate', label: 'Hit rate', note: 'this workload on this configuration' },
    { id: 'org-spread', label: 'Sets in use', note: 'of the sets there are' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Decompose an address, then run a workload',
        controls: controls() }) +
      scope.DataTable.markup({ id: 'org-decompose', first: true,
        title: 'The address, in the three fields a cache reads it as',
        columns: ['Field', 'Value', 'What it decides'] }) +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      gridCard() +
      scope.DataTable.markup({ id: 'org-stride',
        title: 'The same 32 lines at every stride, on a 64-set cache',
        columns: ['Stride', 'Sets it can reach', 'Hit rate', 'Misses', 'What happened'] }) +
      scope.DataTable.markup({ id: 'org-assoc',
        title: 'Associativity against the conflicting stride',
        columns: ['Organisation', 'Sets', 'Ways', 'Hit rate', 'Sets in use'] }) +
      scope.DataTable.markup({ id: 'org-line-table',
        title: 'Line size on a sparse walk: fewer misses, the same wasted bytes',
        columns: ['Line size', 'Misses', 'Bytes fetched', 'Bytes actually used', 'Waste'] });
  }

  function gridCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The cache as a table: one row per set, one column per way</div>' +
      '<div class="card-body"><div id="org-grid"></div>' +
      '<div class="pipe-legend" id="org-legend"></div>' +
      '<p class="note" id="org-grid-note"></p></div></div>';
  }

  return { render: render, controls: controls, metrics: METRICS };
}));
