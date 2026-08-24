/** Markup for "Transform-based compression: BWT and friends". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TransformCompressionTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'bwtp-corpus', kind: 'select', label: 'corpus', value: 'English text',
      options: [
        { value: 'English text', label: 'English text' },
        { value: 'source code', label: 'source code' },
        { value: 'JSON logs', label: 'JSON logs' },
        { value: 'mixed prose', label: 'mixed prose' },
        { value: 'random bytes', label: 'random bytes' }
      ] },
    { id: 'bwtp-size', kind: 'range', label: 'bytes', value: 2000, min: 500, max: 4000,
      step: 500 }
  ];

  const METRICS = [
    { id: 'bwtp-input', label: 'Input entropy', note: 'bits per byte, before anything happens' },
    { id: 'bwtp-after', label: 'After the transform', note: 'a permutation changes nothing at all' },
    { id: 'bwtp-mtf', label: 'After move-to-front', note: 'where the entropy actually falls' },
    { id: 'bwtp-zeros', label: 'Zeros after MTF', note: 'the share of the stream a run-length stage collapses' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'What to transform', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Where in the chain the gain occurs</div>' +
      '<div class="card-body"><div id="bwtp-chart" class="chart-host"></div>' +
      '<p class="note" id="bwtp-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The pipeline, stage by stage</div>' +
      '<div class="card-body"><table class="ref-table" id="bwtp-stages"><thead><tr>' +
      '<th>Stage</th><th>Symbols</th><th>Bits per symbol</th><th>Entropy floor (bytes)</th>' +
      '<th>What it did</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bwtp-stages-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The first bytes of each stage, side by side</div>' +
      '<div class="card-body"><table class="ref-table" id="bwtp-sample"><thead><tr>' +
      '<th>Stage</th><th>First 32 symbols</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bwtp-sample-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Block size: the transform’s one real parameter</div>' +
      '<div class="card-body"><table class="ref-table" id="bwtp-blocks"><thead><tr>' +
      '<th>Block size</th><th>Blocks</th><th>Bits per symbol after MTF</th><th>Zeros</th>' +
      '<th>Entropy-coded bytes</th><th>Ratio</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bwtp-blocks-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
