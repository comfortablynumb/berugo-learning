/** Markup for "HyperLogLog and cardinality estimation". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HyperloglogTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'hll-precision', kind: 'range', label: 'precision p (m = 2^p registers)', value: 12, min: 6, max: 16, step: 1,
      note: 'Standard error is 1.04/√m and does not depend on the cardinality at all.' },
    { id: 'hll-length', kind: 'range', label: 'stream length', value: 200000, min: 20000, max: 400000, step: 20000 },
    { id: 'hll-keys', kind: 'range', label: 'distinct keys in the universe', value: 60000, min: 2000, max: 200000, step: 2000 },
    { id: 'hll-kind', kind: 'select', label: 'stream shape', value: 'zipf',
      options: [{ value: 'uniform', label: 'uniform — every key equally likely' },
        { value: 'zipf', label: 'Zipf — a few keys dominate' },
        { value: 'duplicates', label: 'duplicate-heavy — 98% from a tiny hot set' },
        { value: 'sliding', label: 'sliding — the live key range drifts forward' }] },
    { id: 'hll-shards', kind: 'range', label: 'shards to merge', value: 4, min: 2, max: 16, step: 1 }
  ];

  const METRICS = [
    { id: 'hll-estimate', label: 'Estimate', note: 'the sketch\'s answer' },
    { id: 'hll-truth', label: 'Exact distinct count', note: 'from a Set the sketch replaces' },
    { id: 'hll-error', label: 'Relative error', note: 'against the 1.04/√m claim' },
    { id: 'hll-memory', label: 'Sketch memory', note: 'against the exact Set' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The stream, and the sketch watching it', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Estimate against truth, with the ±σ band the sketch claims</div>' +
      '<div class="card-body"><div id="hll-track-chart"></div>' +
      '<div id="hll-track-legend"></div>' +
      '<p class="note" id="hll-track-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Register histogram — how many registers hold each leading-zero count</div>' +
      '<div class="card-body"><div id="hll-registers-chart"></div>' +
      '<p class="note" id="hll-registers-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Precision against memory and observed error</div>' +
      '<div class="card-body"><table class="ref-table" id="hll-precision-table"><thead><tr>' +
      '<th>p</th><th>Registers</th><th>Claimed σ</th><th>Packed bytes</th><th>Estimate</th>' +
      '<th>Relative error</th><th>In σ</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="hll-precision-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Merging per-shard sketches</div>' +
      '<div class="card-body"><pre class="step-work" id="hll-merge"></pre>' +
      '<p class="note" id="hll-merge-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The raw estimator, and what the correction is for</div>' +
      '<div class="card-body"><pre class="step-work" id="hll-correction"></pre>' +
      '<p class="note" id="hll-correction-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
