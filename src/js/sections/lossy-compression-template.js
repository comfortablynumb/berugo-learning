/** Markup for "Lossy compression". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LossyCompressionTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'lsy-quality', kind: 'range', label: 'quality', value: 50, min: 10, max: 100,
      step: 5 },
    { id: 'lsy-size', kind: 'select', label: 'image side', value: '64',
      options: [
        { value: '48', label: '48 × 48' },
        { value: '64', label: '64 × 64' },
        { value: '96', label: '96 × 96' }
      ] },
    { id: 'lsy-rounds', kind: 'select', label: 're-encode rounds', value: '6',
      options: [
        { value: '4', label: '4 rounds' },
        { value: '6', label: '6 rounds' },
        { value: '8', label: '8 rounds' }
      ] }
  ];

  const METRICS = [
    { id: 'lsy-ratio', label: 'Ratio at this quality', note: 'against the raw greyscale bytes' },
    { id: 'lsy-psnr', label: 'PSNR', note: 'decibels: a per-pixel error, blind to where it is' },
    { id: 'lsy-ssim', label: 'SSIM', note: 'structural: it notices blocking, PSNR does not' },
    { id: 'lsy-kept', label: 'Coefficients kept', note: 'the non-zero ones after quantisation' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Quality and image', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Rate against distortion, on two measures that disagree</div>' +
      '<div class="card-body"><div id="lsy-chart" class="chart-host"></div>' +
      '<p class="note" id="lsy-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The quality ladder</div>' +
      '<div class="card-body"><table class="ref-table" id="lsy-ladder"><thead><tr>' +
      '<th>Quality</th><th>Bytes</th><th>Ratio</th><th>PSNR (dB)</th><th>SSIM</th>' +
      '<th>Non-zero coefficients</th><th>Of the total</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lsy-ladder-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">One 8 × 8 block: the DCT, the quantiser and what survives</div>' +
      '<div class="card-body"><table class="ref-table" id="lsy-block"><thead><tr>' +
      '<th>Row</th><th>Coefficients (DCT)</th><th>Quantisation step</th><th>Levels kept</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lsy-block-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Generation loss: re-encoding, aligned and shifted</div>' +
      '<div class="card-body"><table class="ref-table" id="lsy-generation"><thead><tr>' +
      '<th>Round</th><th>Aligned PSNR</th><th>Aligned SSIM</th><th>Pixels changed</th>' +
      '<th>Shifted PSNR</th><th>Shifted SSIM</th><th>Pixels changed</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lsy-generation-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
