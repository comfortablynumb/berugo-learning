/** Markup for "Prefix codes and Huffman". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PrefixCodesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'huf-corpus', kind: 'select', label: 'corpus', value: 'English text',
      options: [
        { value: 'English text', label: 'English text' },
        { value: 'source code', label: 'source code' },
        { value: 'JSON logs', label: 'JSON logs' },
        { value: 'mixed prose', label: 'mixed prose' },
        { value: 'image-like', label: 'image-like' }
      ] },
    { id: 'huf-size', kind: 'range', label: 'bytes', value: 3000, min: 1000, max: 6000,
      step: 1000 }
  ];

  const METRICS = [
    { id: 'huf-bits', label: 'Bits per symbol', note: 'what the code actually spends' },
    { id: 'huf-gap', label: 'Above the entropy', note: 'the whole-bit penalty, per symbol' },
    { id: 'huf-kraft', label: 'Kraft sum', note: 'exactly 1 for a complete prefix code' },
    { id: 'huf-table', label: 'Cheapest table encoding', note: 'the bytes a decoder needs before it can start' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'What to code', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The gap Huffman cannot close, against source skew</div>' +
      '<div class="card-body"><div id="huf-chart" class="chart-host"></div>' +
      '<p class="note" id="huf-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The coded stream, one span per symbol</div>' +
      '<div class="card-body"><div id="huf-stream"></div>' +
      '<p class="note" id="huf-stream-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The code table: what each symbol costs against what it carries</div>' +
      '<div class="card-body"><table class="ref-table" id="huf-codes"><thead><tr>' +
      '<th>Symbol</th><th>Count</th><th>Probability</th><th>Codeword</th><th>Bits spent</th>' +
      '<th>Bits it carries</th><th>Waste</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="huf-codes-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The two-symbol source, swept over skew</div>' +
      '<div class="card-body"><table class="ref-table" id="huf-skew"><thead><tr>' +
      '<th>Rarer symbol’s share</th><th>Entropy</th><th>Huffman</th><th>Arithmetic</th>' +
      '<th>Huffman ÷ entropy</th><th>Arithmetic ÷ entropy</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="huf-skew-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Getting the table to the decoder: three encodings of the same code</div>' +
      '<div class="card-body"><table class="ref-table" id="huf-tablecost"><thead><tr>' +
      '<th>Encoding</th><th>Bits</th><th>Bytes</th><th>What the decoder receives</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="huf-tablecost-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
