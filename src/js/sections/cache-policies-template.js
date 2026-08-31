/** Markup for "Policies: writes and replacement". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CachePolicyTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function controls() {
    return [
      { id: 'pol-workload', kind: 'select', label: 'workload', value: 'hot',
        options: scope.MemoryLab.options(['hot', 'streamingWrites', 'sequential', 'chase',
          'conflicting', 'random']) },
      { id: 'pol-replacement', kind: 'select', label: 'replacement', value: 'lru',
        options: Object.keys(scope.Memory.Cache.REPLACEMENT).map(function (key) {
          return { value: key, label: scope.Memory.Cache.REPLACEMENT[key].name };
        }) },
      { id: 'pol-write', kind: 'select', label: 'write policy', value: 'writeBack',
        options: [{ value: 'writeBack', label: 'write back' },
          { value: 'writeThrough', label: 'write through' }] },
      { id: 'pol-allocate', kind: 'select', label: 'on a write miss', value: 'writeAllocate',
        options: [{ value: 'writeAllocate', label: 'write allocate — fetch the line first' },
          { value: 'noWriteAllocate', label: 'no write allocate — go straight past' }] }
    ];
  }

  const METRICS = [
    { id: 'pol-hitrate', label: 'Hit rate', note: 'this workload, these policies' },
    { id: 'pol-traffic', label: 'Traffic to the next level', note: 'transactions, not misses' },
    { id: 'pol-dirty', label: 'Dirty evictions', note: 'lines written out on the way past' },
    { id: 'pol-through', label: 'Write-throughs', note: 'writes forwarded immediately' },
    { id: 'pol-bypassed', label: 'Writes bypassed', note: 'never brought into the cache' },
    { id: 'pol-verdict', label: 'The right choice here', note: 'on this workload' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Hold the organisation, change the policy',
        controls: controls() }) +
      scope.DataTable.markup({ id: 'pol-state', first: true,
        title: 'A line\'s life under write-back',
        columns: ['State', 'How it got there', 'What an eviction costs'] }) +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      scope.DataTable.markup({ id: 'pol-write-table',
        title: 'The write matrix: the same two workloads under every combination',
        columns: ['Write policy', 'On a write miss', 'Hot loop: traffic', 'Streaming: traffic',
          'Which workload it suits'] }) +
      chartCard() +
      scope.DataTable.markup({ id: 'pol-replace-table',
        title: 'Replacement, on the pattern that breaks LRU',
        columns: ['Policy', 'State per set', 'Cyclic loop hits', 'Working set after a scan',
          'What it is for'] }) +
      scope.DataTable.markup({ id: 'pol-scan',
        title: 'Scan length: how long a scan each policy survives',
        columns: ['Scan length', 'LRU', 'pseudo-LRU', 'FIFO', 'RRIP', 'random'] });
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Hit rate by replacement policy, across the workloads</div>' +
      '<div class="card-body"><div id="pol-chart" class="chart-host"></div>' +
      '<p class="note" id="pol-chart-note"></p></div></div>';
  }

  return { render: render, controls: controls, metrics: METRICS };
}));
