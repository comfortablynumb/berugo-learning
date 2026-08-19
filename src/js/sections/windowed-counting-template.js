/** Markup for "Windows, decay and top-k over streams". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.WindowedCountingTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'win-size', kind: 'range', label: 'window length N (bits)', value: 20000, min: 2000, max: 40000, step: 2000 },
    { id: 'win-persize', kind: 'select', label: 'buckets allowed per size', value: '2',
      options: [{ value: '2', label: '2 — plain DGIM' }, { value: '4', label: '4' },
        { value: '8', label: '8' }, { value: '16', label: '16 — an exponential histogram' }] },
    { id: 'win-period', kind: 'range', label: 'burst period', value: 9000, min: 1000, max: 30000, step: 1000 },
    { id: 'win-counters', kind: 'range', label: 'space-saving counters', value: 200, min: 20, max: 1000, step: 20 },
    { id: 'win-halflife', kind: 'range', label: 'decay half-life (items)', value: 20000, min: 2000, max: 100000, step: 2000 }
  ];

  const METRICS = [
    { id: 'win-memory', label: 'DGIM memory', note: 'against one bit per position in the window' },
    { id: 'win-error', label: 'Worst relative error', note: 'over the whole run, against the exact count' },
    { id: 'win-buckets', label: 'Buckets held', note: 'O(log N) of them, each O(log N) bits' },
    { id: 'win-recall', label: 'Top-k recall', note: 'space-saving against the exact top-k' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The window, the buckets and the counters', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Ones in the last N, exactly and approximately</div>' +
      '<div class="card-body"><div id="win-track-chart"></div>' +
      '<div id="win-track-legend"></div>' +
      '<p class="note" id="win-track-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Buckets per size: memory against the bound it buys</div>' +
      '<div class="card-body"><table class="ref-table" id="win-buckets-table"><thead><tr>' +
      '<th>Buckets per size</th><th>Buckets held</th><th>Bits</th><th>Worst error seen</th>' +
      '<th>Bound it reports now</th><th>Against exact</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="win-buckets-table-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Top talkers: three answers to three slightly different questions</div>' +
      '<div class="card-body"><table class="ref-table" id="win-topk"><thead><tr>' +
      '<th>Rank</th><th>Exact</th><th>Space-saving</th><th>Lossy counting</th><th>Decayed</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="win-topk-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What each structure guarantees, and what it costs</div>' +
      '<div class="card-body"><pre class="step-work" id="win-guarantees"></pre>' +
      '<p class="note" id="win-guarantees-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
