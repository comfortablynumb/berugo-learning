/** Markup for "The external-memory model". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ExternalMemoryTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'xmm-records', kind: 'select', label: 'records to sort', value: '8192',
      options: [
        { value: '4096', label: '4 096' },
        { value: '8192', label: '8 192' },
        { value: '16384', label: '16 384' }
      ] },
    { id: 'xmm-block', kind: 'select', label: 'block size B', value: '64',
      options: [
        { value: '16', label: '16 records' },
        { value: '64', label: '64 records' },
        { value: '256', label: '256 records' }
      ] },
    { id: 'xmm-memory', kind: 'select', label: 'memory M', value: '4096',
      options: [
        { value: '256', label: '256 records' },
        { value: '1024', label: '1 024 records' },
        { value: '4096', label: '4 096 records' }
      ] }
  ];

  const METRICS = [
    { id: 'xmm-transfers', label: 'Measured transfers', note: 'block reads plus block writes' },
    { id: 'xmm-predicted', label: 'The formula', note: '2·(N/B)·(1 + merge passes)' },
    { id: 'xmm-peak', label: 'Peak records held', note: 'against the memory budget, which is enforced' },
    { id: 'xmm-join', label: 'Nested loop over sort-merge', note: 'transfers, at the largest size' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'N, M and B', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The three bounds, at rising data size</div>' +
      '<div class="card-body"><div id="xmm-chart" class="chart-host"></div>' +
      '<p class="note" id="xmm-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">External merge sort against its closed form, at four settings</div>' +
      '<div class="card-body"><table class="ref-table" id="xmm-sort"><thead><tr>' +
      '<th>M</th><th>B</th><th>Initial runs</th><th>Merge passes</th><th>Fan-out</th>' +
      '<th>Transfers</th><th>Predicted</th><th>Ratio</th><th>Sorted</th><th>Peak held</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="xmm-sort-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Scan, sort and search: three bounds that are not within constants of each other</div>' +
      '<div class="card-body"><table class="ref-table" id="xmm-bounds"><thead><tr>' +
      '<th>Records</th><th>Scan (N/B)</th><th>Sort</th><th>Merge passes</th>' +
      '<th>Search (log_B N)</th><th>One transfer per record</th><th>That over a scan</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="xmm-bounds-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Two joins, and where the crossover is</div>' +
      '<div class="card-body"><table class="ref-table" id="xmm-joins"><thead><tr>' +
      '<th>Rows per side</th><th>Nested loop</th><th>Sort-merge</th><th>Of which sorting</th>' +
      '<th>Of which the walk</th><th>Ratio</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="xmm-joins-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
