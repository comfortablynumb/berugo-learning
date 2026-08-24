/** Markup for "Real-world general-purpose codecs". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GeneralPurposeCodecsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'gpc-size', kind: 'range', label: 'bytes per corpus', value: 3000, min: 1000,
      max: 6000, step: 1000 },
    { id: 'gpc-corpus', kind: 'select', label: 'corpus for the Pareto sweep', value: 'mixed prose',
      options: [
        { value: 'mixed prose', label: 'mixed prose' },
        { value: 'English text', label: 'English text' },
        { value: 'source code', label: 'source code' },
        { value: 'JSON logs', label: 'JSON logs' }
      ] }
  ];

  const METRICS = [
    { id: 'gpc-best', label: 'Best ratio on the whole set', note: 'and which codec, on which corpus' },
    { id: 'gpc-worst', label: 'Worst ratio on the whole set', note: 'expansion is a result, not an omission' },
    { id: 'gpc-roundtrips', label: 'Round-trips verified', note: 'a size from a codec that cannot decode is not a measurement' },
    { id: 'gpc-overhead', label: 'DEFLATE’s floor', note: 'the stored-block overhead, per block' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The bench', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Ratio against encode work: the Pareto frontier</div>' +
      '<div class="card-body"><div id="gpc-chart" class="chart-host"></div>' +
      '<p class="note" id="gpc-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Six codecs on seven corpora — and the ranking changes</div>' +
      '<div class="card-body"><table class="ref-table" id="gpc-bake"><thead><tr>' +
      '<th>Corpus</th><th>Entropy</th><th>Huffman</th><th>Arithmetic</th><th>rANS</th>' +
      '<th>LZSS</th><th>DEFLATE</th><th>BWT chain</th><th>Winner</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="gpc-bake-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The block-type decision, per corpus</div>' +
      '<div class="card-body"><table class="ref-table" id="gpc-blocks"><thead><tr>' +
      '<th>Corpus</th><th>Stored</th><th>Fixed Huffman</th><th>Chosen</th><th>Ratio</th>' +
      '<th>Round-trip</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="gpc-blocks-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Edge cases every codec has to survive</div>' +
      '<div class="card-body"><table class="ref-table" id="gpc-edges"><thead><tr>' +
      '<th>Input</th><th>Huffman</th><th>Arithmetic</th><th>rANS</th><th>LZSS</th>' +
      '<th>DEFLATE</th><th>BWT chain</th><th>All round-trip</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="gpc-edges-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
