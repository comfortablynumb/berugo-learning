/** Markup for "Quantiles: reservoir, t-digest, KLL and DDSketch". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.QuantileSketchesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'qsk-length', kind: 'range', label: 'requests in the stream', value: 200000, min: 20000, max: 400000, step: 20000 },
    { id: 'qsk-slow', kind: 'range', label: 'share landing in the slow mode', value: 10, min: 0, max: 50, step: 1,
      suffix: '%',
      note: 'A bimodal latency distribution is where a rank-accurate sketch can still be wildly wrong about the value.' },
    { id: 'qsk-reservoir', kind: 'range', label: 'reservoir size', value: 1000, min: 100, max: 4000, step: 100 },
    { id: 'qsk-compression', kind: 'range', label: 't-digest compression δ', value: 100, min: 20, max: 400, step: 20 },
    { id: 'qsk-alpha', kind: 'select', label: 'DDSketch relative accuracy α', value: '0.01',
      options: [{ value: '0.05', label: '5% — 40 buckets per decade' },
        { value: '0.01', label: '1%' },
        { value: '0.002', label: '0.2% — many more buckets' }] }
  ];

  const METRICS = [
    { id: 'qsk-p99', label: 'Exact p99', note: 'from every value, kept' },
    { id: 'qsk-best', label: 'Closest at p99.9', note: 'by relative value error' },
    { id: 'qsk-worst', label: 'Furthest at p99.9', note: 'same stream, same instant' },
    { id: 'qsk-memory', label: 'Exact memory', note: 'against the cheapest sketch here' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The latency stream, and four sketches watching it', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Relative value error, quantile by quantile</div>' +
      '<div class="card-body"><div id="qsk-error-chart"></div>' +
      '<div id="qsk-error-legend"></div>' +
      '<p class="note" id="qsk-error-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The four quantiles anyone asks for</div>' +
      '<div class="card-body"><table class="ref-table" id="qsk-table"><thead><tr>' +
      '<th>Sketch</th><th>Memory</th><th>p50</th><th>p90</th><th>p99</th><th>p99.9</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="qsk-table-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Value error and rank error are different claims</div>' +
      '<div class="card-body"><table class="ref-table" id="qsk-rank"><thead><tr>' +
      '<th>Sketch</th><th>Guarantee it makes</th><th>Worst value error</th><th>Worst rank error</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="qsk-rank-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Why averaging p99s across shards is meaningless</div>' +
      '<div class="card-body"><pre class="step-work" id="qsk-shards"></pre>' +
      '<p class="note" id="qsk-shards-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
