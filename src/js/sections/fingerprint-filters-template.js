/** Markup for "Cuckoo and quotient filters". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.FingerprintFiltersTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'fpf-capacity', kind: 'select', label: 'cuckoo table size', value: '8192',
      options: [{ value: '2048', label: '2 048 slots' }, { value: '8192', label: '8 192 slots' },
        { value: '32768', label: '32 768 slots' }] },
    { id: 'fpf-bits', kind: 'range', label: 'fingerprint bits', value: 8, min: 4, max: 16, step: 1,
      note: 'The error rate is set by this alone; the load factor barely moves with it.' },
    { id: 'fpf-bucket', kind: 'select', label: 'slots per bucket', value: '4',
      options: [{ value: '1', label: '1 — plain cuckoo hashing' }, { value: '2', label: '2' },
        { value: '4', label: '4 — the usual choice' }, { value: '8', label: '8' }] },
    { id: 'fpf-kicks', kind: 'range', label: 'eviction chain limit', value: 500, min: 20, max: 1000, step: 20 },
    { id: 'fpf-target', kind: 'select', label: 'error rate for the space comparison', value: '0.01',
      options: [{ value: '0.1', label: '10%' }, { value: '0.03', label: '3%' },
        { value: '0.01', label: '1%' }, { value: '0.001', label: '0.1%' }] }
  ];

  const METRICS = [
    { id: 'fpf-load', label: 'Load reached before failure', note: 'inserts stop here, permanently' },
    { id: 'fpf-kicksper', label: 'Evictions per insert', note: 'mean over the whole fill' },
    { id: 'fpf-error', label: 'Measured error', note: 'against the 2b·α/2^f prediction' },
    { id: 'fpf-damage', label: 'False negatives after phantom deletes', note: 'deleting keys never inserted' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Fill it until it refuses', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Eviction chain lengths over one complete fill</div>' +
      '<div class="card-body"><div id="fpf-chain-chart"></div>' +
      '<p class="note" id="fpf-chain-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Fingerprint size: error and memory, at the load the table reaches</div>' +
      '<div class="card-body"><table class="ref-table" id="fpf-sweep"><thead><tr>' +
      '<th>Fingerprint</th><th>Inserted</th><th>Load</th><th>Predicted</th><th>Measured</th>' +
      '<th>Bits per item</th><th>Evictions per insert</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="fpf-sweep-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Slots per bucket: where the load ceiling comes from</div>' +
      '<div class="card-body"><table class="ref-table" id="fpf-buckets"><thead><tr>' +
      '<th>Slots per bucket</th><th>Load reached</th><th>Items</th><th>Evictions per insert</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="fpf-buckets-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The delete that looks like a set operation and is not</div>' +
      '<div class="card-body"><pre class="step-work" id="fpf-phantom"></pre>' +
      '<p class="note" id="fpf-phantom-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Three families at one target error</div>' +
      '<div class="card-body"><table class="ref-table" id="fpf-space"><thead><tr>' +
      '<th>Filter</th><th>Bits per item, as built</th><th>At its design load</th><th>Predicted</th>' +
      '<th>Measured</th><th>Lines per query</th><th>Deletes</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="fpf-space-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Two quotient filters merged, without either key set</div>' +
      '<div class="card-body"><pre class="step-work" id="fpf-merge"></pre>' +
      '<p class="note" id="fpf-merge-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
