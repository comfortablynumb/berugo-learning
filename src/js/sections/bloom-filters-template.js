/** Markup for "Bloom filters". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BloomFiltersTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'blf-n', kind: 'range', label: 'keys you sized for (n)', value: 10000, min: 1000, max: 20000, step: 1000,
      note: 'The sizing formula needs an n. Everything that goes wrong later goes wrong because this number was optimistic.' },
    { id: 'blf-p', kind: 'select', label: 'target false-positive rate', value: '0.01',
      options: [{ value: '0.1', label: '10% — a cheap pre-filter' },
        { value: '0.03', label: '3%' },
        { value: '0.01', label: '1% — the usual default' },
        { value: '0.001', label: '0.1% — an expensive miss' }] },
    { id: 'blf-fill', kind: 'range', label: 'keys actually inserted, as a multiple of n', value: 100, min: 25, max: 250, step: 5,
      suffix: '%' },
    { id: 'blf-k', kind: 'select', label: 'hash count k', value: 'optimal',
      options: [{ value: 'optimal', label: 'optimal — (m/n) ln 2, rounded' },
        { value: '1', label: '1 — one bit per key' },
        { value: '3', label: '3' },
        { value: '12', label: '12 — past the optimum' }] }
  ];

  const METRICS = [
    { id: 'blf-bits', label: 'Bits per key', note: 'm / n from the sizing formula' },
    { id: 'blf-hashes', label: 'Hashes per operation', note: 'k' },
    { id: 'blf-predicted', label: 'Predicted error', note: '(1 − e^(−kn/m))^k at the current fill' },
    { id: 'blf-measured', label: 'Measured error', note: 'against keys known to be absent' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Size the filter, then overfill it', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Predicted error and measured error as the filter fills</div>' +
      '<div class="card-body"><div id="blf-chart-host"></div>' +
      '<div id="blf-legend"></div>' +
      '<p class="note" id="blf-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The sizing table this calculator is reading from</div>' +
      '<div class="card-body"><table class="ref-table" id="blf-sizing"><thead><tr>' +
      '<th>Target</th><th>Bits per key</th><th>k</th><th>Memory for n keys</th><th>Achieved at n</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="blf-sizing-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Overfilling, step by step</div>' +
      '<div class="card-body"><pre class="step-work" id="blf-overfill"></pre>' +
      '<p class="note" id="blf-overfill-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The check that must never fail</div>' +
      '<div class="card-body"><pre class="step-work" id="blf-negatives"></pre>' +
      '<p class="note">A Bloom filter may say yes when it should say no. It may never say no when it should ' +
      'say yes: every bit a key set stays set, so the k bits it tests are all still there.</p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
