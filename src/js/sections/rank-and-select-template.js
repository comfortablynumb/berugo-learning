/** Markup for "Bit vectors with rank and select, and Elias-Fano". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RankAndSelectTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'rk-bits', kind: 'select', label: 'bits in the vector', value: '65536',
      options: [{ value: '16384', label: '16 384' }, { value: '65536', label: '65 536' },
        { value: '262144', label: '262 144' }, { value: '1048576', label: '1 048 576' }] },
    { id: 'rk-density', kind: 'range', label: 'density of set bits (%)', value: 50, min: 2, max: 90, step: 4 },
    { id: 'rk-gap', kind: 'range', label: 'mean gap in the monotone sequence', value: 400, min: 50, max: 1000, step: 50 }
  ];

  const METRICS = [
    { id: 'rk-overhead', label: 'Index overhead', note: 'on top of the bits themselves' },
    { id: 'rk-rank', label: 'Lookups per rank', note: 'plus the words inside one block' },
    { id: 'rk-select', label: 'Steps per select', note: 'a binary search over the index' },
    { id: 'rk-positions', label: 'Against a positions array', note: 'the obvious alternative' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The vector, its density and the sequence', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Bytes: the bits, the index, and the alternative</div>' +
      '<div class="card-body"><div id="rk-bars"></div>' +
      '<p class="note" id="rk-bars-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The same vector at four densities: where a positions array wins</div>' +
      '<div class="card-body"><table class="ref-table" id="rk-crossover"><thead><tr>' +
      '<th>Density</th><th>Set bits</th><th>Bits + index</th><th>Overhead</th>' +
      '<th>Positions array</th><th>Ratio</th><th>Cheaper</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rk-crossover-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Elias-Fano: a monotone sequence against its own lower bound</div>' +
      '<div class="card-body"><table class="ref-table" id="rk-ef"><thead><tr>' +
      '<th>Values</th><th>Universe</th><th>Low bits</th><th>Bits / value</th>' +
      '<th>Bound</th><th>Raw 32-bit</th><th>Compression</th><th>Wrong</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rk-ef-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
