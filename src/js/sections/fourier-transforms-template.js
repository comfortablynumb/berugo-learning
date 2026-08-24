/** Markup for "Fourier transforms and signal processing". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.FourierTransformsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ft-window', kind: 'select', label: 'window', value: 'rectangular',
      options: [
        { value: 'rectangular', label: 'rectangular — no window at all' },
        { value: 'hamming', label: 'Hamming' },
        { value: 'hann', label: 'Hann' },
        { value: 'blackman', label: 'Blackman' }
      ] },
    { id: 'ft-frequency', kind: 'range', label: 'first component’s frequency (÷2)', value: 21,
      min: 10, max: 60, step: 1,
      note: 'odd values land between bins, which is where leakage comes from' },
    { id: 'ft-size', kind: 'select', label: 'transform size', value: '256',
      options: [
        { value: '128', label: '128' },
        { value: '256', label: '256' },
        { value: '512', label: '512' }
      ] }
  ];

  const METRICS = [
    { id: 'ft-butterflies', label: 'Butterflies at n = 256', note: 'against the naive DFT’s operations' },
    { id: 'ft-saving', label: 'Operations saved', note: 'and it grows with n' },
    { id: 'ft-roundtrip', label: 'Round-trip error at n = 65 536', note: 'forward then inverse' },
    { id: 'ft-leakage', label: 'Peak-to-sidelobe with this window', note: 'higher is cleaner' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A signal, a window and a size', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The spectrum</div>' +
      '<div class="card-body"><div id="ft-chart" class="chart-host"></div>' +
      '<div id="ft-legend"></div><p class="note" id="ft-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The FFT against the transform it computes</div>' +
      '<div class="card-body"><table class="ref-table" id="ft-race"><thead><tr>' +
      '<th>n</th><th>Butterflies</th><th>(n/2)log₂n</th><th>Naive DFT operations</th>' +
      '<th>Saving</th><th>Difference from the naive result</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ft-race-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Windows — the same signal, four ways of ending it</div>' +
      '<div class="card-body"><table class="ref-table" id="ft-windows"><thead><tr>' +
      '<th>Window</th><th>Peak height</th><th>Worst distant sidelobe</th>' +
      '<th>Peak-to-sidelobe ratio</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ft-windows-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Aliasing at a 1 kHz sample rate</div>' +
      '<div class="card-body"><table class="ref-table" id="ft-alias"><thead><tr>' +
      '<th>Frequency present</th><th>Where it appears</th><th>Aliased</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ft-alias-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Convolution three ways — and the one that is exact</div>' +
      '<div class="card-body"><table class="ref-table" id="ft-convolution"><thead><tr>' +
      '<th>Method</th><th>Operations</th><th>Result</th><th>Matches schoolbook</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ft-convolution-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
