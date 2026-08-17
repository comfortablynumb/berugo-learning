/** Markup for "Cache-conscious layouts". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CacheLayoutsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'layout-n', kind: 'range', label: 'keys', value: 4096, min: 256, max: 65536, step: 256 },
    { id: 'layout-block', kind: 'range', label: 'block size (blocked layout)', value: 16, min: 4, max: 64, step: 4,
      note: '16 four-byte keys is exactly one 64-byte cache line.' },
    { id: 'layout-queries', kind: 'range', label: 'queries', value: 400, min: 50, max: 2000, step: 50,
      note: 'The cache is warm after the first few, so more queries push the cold-start misses down.' },
    { id: 'layout-cache', kind: 'range', label: 'cache (KB)', value: 32, min: 4, max: 256, step: 4,
      note: 'Fully associative LRU, 64-byte lines. Once it holds the whole array every layout ties.' }
  ];

  const METRICS = [
    { id: 'layout-sorted', label: 'Sorted array', note: 'misses per query' },
    { id: 'layout-eytzinger', label: 'Eytzinger', note: 'breadth-first layout' },
    { id: 'layout-blocked', label: 'Blocked', note: 'B keys per node' },
    { id: 'layout-best', label: 'Fewest misses', note: 'the layout that fetches least memory' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Search workload', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Cache misses per query</div>' +
      '<div class="card-body"><div id="layout-chart"></div><div id="layout-legend"></div>' +
      '<p class="note">Distinct lines per query is almost identical for all three - a search of ' +
      'log n probes touches log n lines however the keys are arranged. What differs is how much ' +
      'of the structure survives in the cache between queries, so misses are what is plotted.</p>' +
      '</div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem"><div class="card-header">Eytzinger index mapping</div>' +
      '<div class="card-body"><div id="layout-mapping" class="mono" style="font-size:.75rem"></div>' +
      '<p class="note">Breadth-first order: the root is index 1, and the children of i are 2i and ' +
      '2i+1, so the first levels of the search share a cache line.</p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
