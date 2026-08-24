/** Markup for "Dictionary compression". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DictionaryCompressionTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'lzd-corpus', kind: 'select', label: 'corpus', value: 'mixed prose',
      options: [
        { value: 'mixed prose', label: 'mixed prose' },
        { value: 'English text', label: 'English text' },
        { value: 'source code', label: 'source code' },
        { value: 'JSON logs', label: 'JSON logs' },
        { value: 'random bytes', label: 'random bytes' }
      ] },
    { id: 'lzd-size', kind: 'range', label: 'bytes', value: 6000, min: 2000, max: 12000,
      step: 2000 }
  ];

  const METRICS = [
    { id: 'lzd-ratio', label: 'Ratio at search depth 32', note: 'input bytes over coded bytes' },
    { id: 'lzd-matches', label: 'Bytes covered by matches', note: 'the rest are literals at nine bits each' },
    { id: 'lzd-ladder', label: 'Depth 1 to depth 64', note: 'what searching harder is worth' },
    { id: 'lzd-work', label: 'The price of that', note: 'chain links walked per input byte' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'What to compress', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Ratio against work: the compression-level ladder</div>' +
      '<div class="card-body"><div id="lzd-chart" class="chart-host"></div>' +
      '<p class="note" id="lzd-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Search depth: the same algorithm, looking harder</div>' +
      '<div class="card-body"><table class="ref-table" id="lzd-depths"><thead><tr>' +
      '<th>Search depth</th><th>Coded bytes</th><th>Ratio</th><th>Matches found</th>' +
      '<th>Bytes matched</th><th>Chain links per byte</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lzd-depths-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Window size: the decoder’s memory, and what it buys</div>' +
      '<div class="card-body"><table class="ref-table" id="lzd-windows"><thead><tr>' +
      '<th>Window</th><th>Distance field</th><th>Coded bytes</th><th>Ratio</th><th>Matches</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lzd-windows-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The token stream, and the two dictionary families</div>' +
      '<div class="card-body"><table class="ref-table" id="lzd-tokens"><thead><tr>' +
      '<th>Scheme</th><th>Coded bytes</th><th>Ratio</th><th>Round-trip</th><th>What it transmits</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lzd-tokens-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
