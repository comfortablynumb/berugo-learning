/** Markup for "Domain-specific compression". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DomainSpecificTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'dsc-count', kind: 'range', label: 'values per column', value: 2000, min: 500,
      max: 4000, step: 500 },
    { id: 'dsc-seed', kind: 'select', label: 'data seed', value: '11',
      options: [
        { value: '11', label: 'seed 11' },
        { value: '23', label: 'seed 23' },
        { value: '37', label: 'seed 37' }
      ] }
  ];

  const METRICS = [
    { id: 'dsc-best', label: 'Best integer encoding', note: 'on the sorted timestamp column' },
    { id: 'dsc-sorting', label: 'What sorting is worth', note: 'the same encoder, the same values, a different order' },
    { id: 'dsc-gorilla', label: 'Gorilla on a real metric', note: 'and the same metric at full double precision' },
    { id: 'dsc-exact', label: 'Float round-trips', note: 'Gorilla is lossless — every bit returns' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The columns', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Sorted against shuffled, per encoding</div>' +
      '<div class="card-body"><div id="dsc-chart" class="chart-host"></div>' +
      '<p class="note" id="dsc-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Six encodings on four integer columns</div>' +
      '<div class="card-body"><table class="ref-table" id="dsc-integers"><thead><tr>' +
      '<th>Column</th><th>raw 64-bit</th><th>varint</th><th>delta+varint</th>' +
      '<th>delta+bit-packed</th><th>delta+FOR</th><th>delta+Simple-8b</th><th>Best</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dsc-integers-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Cardinality and sortedness on a string column</div>' +
      '<div class="card-body"><table class="ref-table" id="dsc-cardinality"><thead><tr>' +
      '<th>Distinct values</th><th>Dictionary code width</th><th>Dictionary bytes</th>' +
      '<th>Runs, unsorted</th><th>Runs, sorted</th><th>RLE bytes, unsorted</th>' +
      '<th>RLE bytes, sorted</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dsc-cardinality-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Gorilla: the ratio is a fact about the mantissa</div>' +
      '<div class="card-body"><table class="ref-table" id="dsc-floats"><thead><tr>' +
      '<th>Series</th><th>Raw bytes</th><th>Encoded</th><th>Bits per value</th><th>Ratio</th>' +
      '<th>Exact round-trip</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dsc-floats-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
