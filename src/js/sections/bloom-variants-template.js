/** Markup for "Counting, blocked and scalable Bloom filters". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BloomVariantsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'bvr-n', kind: 'range', label: 'keys', value: 20000, min: 2000, max: 40000, step: 2000 },
    { id: 'bvr-p', kind: 'select', label: 'target false-positive rate', value: '0.01',
      options: [{ value: '0.1', label: '10%' }, { value: '0.03', label: '3%' },
        { value: '0.01', label: '1%' }, { value: '0.001', label: '0.1%' }] },
    { id: 'bvr-counter', kind: 'select', label: 'counting filter: bits per counter', value: '4',
      options: [{ value: '2', label: '2 bits — counts to 3' },
        { value: '3', label: '3 bits — counts to 7' },
        { value: '4', label: '4 bits — counts to 15, the usual choice' },
        { value: '8', label: '8 bits — counts to 255' }] },
    { id: 'bvr-repeats', kind: 'range', label: 'times each key is inserted', value: 1, min: 1, max: 16, step: 1,
      note: 'A counting filter over a multiset is where the counters saturate — and a saturated counter can never be decremented again.' },
    { id: 'bvr-layers', kind: 'range', label: 'scalable filter: n it was sized for, as a fraction of the real n', value: 10, min: 2, max: 40, step: 2,
      suffix: 'x too small' }
  ];

  const METRICS = [
    { id: 'bvr-memory', label: 'Counting filter memory', note: 'against the standard filter' },
    { id: 'bvr-lines', label: 'Cache lines per query', note: 'blocked against standard' },
    { id: 'bvr-inflation', label: 'Blocked error inflation', note: 'measured, at the same m and k' },
    { id: 'bvr-layercount', label: 'Scalable layers', note: 'added as the sizing assumption failed' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'One workload, four filters', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Block size: error against cache lines</div>' +
      '<div class="card-body"><div id="bvr-block-chart"></div>' +
      '<div id="bvr-block-legend"></div>' +
      '<p class="note" id="bvr-block-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The same keys and the same probes through every variant</div>' +
      '<div class="card-body"><table class="ref-table" id="bvr-variants"><thead><tr>' +
      '<th>Filter</th><th>Bytes</th><th>Bits per key</th><th>Predicted</th><th>Measured</th>' +
      '<th>False negatives</th><th>Lines per query</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bvr-variants-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Counting filter: what the counters actually reach</div>' +
      '<div class="card-body"><pre class="step-work" id="bvr-counting"></pre>' +
      '<p class="note" id="bvr-counting-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Scalable filter: the layer chain and its tightening targets</div>' +
      '<div class="card-body"><table class="ref-table" id="bvr-layers-table"><thead><tr>' +
      '<th>Layer</th><th>Sized for</th><th>Holds</th><th>Target error</th><th>Bits</th><th>k</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bvr-layers-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
