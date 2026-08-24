/** Markup for "Caching and page-replacement policies". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PageReplacementTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'pgr-trace', kind: 'select', label: 'request trace', value: 'mixed',
      options: [
        { value: 'zipf', label: 'Zipf — a stationary hot set' },
        { value: 'scan', label: 'scan — a working set plus a sweep' },
        { value: 'loop', label: 'loop — a cycle just larger than the cache' },
        { value: 'mixed', label: 'mixed — hot set with periodic scans' }
      ] },
    { id: 'pgr-capacity', kind: 'range', label: 'cache entries', value: 100, min: 25, max: 300,
      step: 25 },
    { id: 'pgr-length', kind: 'select', label: 'trace length', value: '20000',
      options: [
        { value: '10000', label: '10 000' },
        { value: '20000', label: '20 000' },
        { value: '40000', label: '40 000' }
      ] }
  ];

  const METRICS = [
    { id: 'pgr-best', label: 'Best policy on this trace', note: 'hit rate, and which one' },
    { id: 'pgr-optimum', label: 'Belady’s optimum', note: 'the unreachable ceiling on this trace' },
    { id: 'pgr-lru', label: 'LRU', note: 'and how much of the ceiling it reaches' },
    { id: 'pgr-scan', label: 'Scan resistance', note: 'hit rate retained when a sweep is added' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A trace and a cache size', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Hit rate against cache size, with the optimum drawn as a ceiling</div>' +
      '<div class="card-body"><div id="pgr-chart" class="chart-host"></div>' +
      '<p class="note" id="pgr-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Seven policies and the offline optimum, on one trace at one size</div>' +
      '<div class="card-body"><table class="ref-table" id="pgr-table"><thead><tr>' +
      '<th>Policy</th><th>Hit rate</th><th>Of Belady’s optimum</th><th>Hits</th><th>Misses</th>' +
      '<th>Evictions</th><th>What it trusts</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="pgr-table-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The scan, which is the failure every policy after LRU is an answer to</div>' +
      '<div class="card-body"><table class="ref-table" id="pgr-resist"><thead><tr>' +
      '<th>Policy</th><th>Hit rate on Zipf</th><th>Hit rate with a scan</th>' +
      '<th>Fraction retained</th><th>Scan resistant</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="pgr-resist-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">ARC adapting: the target boundary between recency and frequency</div>' +
      '<div class="card-body"><table class="ref-table" id="pgr-arc"><thead><tr>' +
      '<th>Requests seen</th><th>Target size of the recency half (p)</th><th>Items in T1</th>' +
      '<th>Items in T2</th><th>Hit rate so far</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="pgr-arc-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
