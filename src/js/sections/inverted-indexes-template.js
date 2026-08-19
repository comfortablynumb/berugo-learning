/** Markup for "Inverted indexes and postings". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.InvertedIndexesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ii-docs', kind: 'range', label: 'documents', value: 5000, min: 200, max: 20000, step: 200 },
    { id: 'ii-vocab', kind: 'range', label: 'vocabulary', value: 400, min: 20, max: 2000, step: 20,
      note: 'Term frequencies follow Zipf, so a handful of terms are in nearly every document.' },
    { id: 'ii-strategy', kind: 'select', label: 'intersection', value: 'galloping',
      options: [{ value: 'linear', label: 'linear merge — walk both lists in step' },
        { value: 'skip', label: 'skip pointers every √n entries' },
        { value: 'galloping', label: 'galloping — probe 1, 2, 4, 8 … then binary search' }] },
    { id: 'ii-skew', kind: 'range', label: 'query skew: shorter list length', value: 100, min: 5, max: 50000, step: 5,
      note: 'Against a 100 000-entry list. This ratio is what decides the winner.' },
    { id: 'ii-seed', kind: 'range', label: 'seed', value: 5, min: 1, max: 40, step: 1 }
  ];

  const METRICS = [
    { id: 'ii-postings', label: 'Postings', note: 'term-document pairs in the index' },
    { id: 'ii-bits', label: 'Bits per posting', note: 'variable-byte over gaps, against a raw 32' },
    { id: 'ii-query', label: 'Comparisons for the query', note: 'rarest term first' },
    { id: 'ii-positions', label: 'Position overhead', note: 'what phrase search costs' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Corpus, intersection strategy and query skew', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Comparisons against list-length skew</div>' +
      '<div class="card-body"><div id="ii-chart"></div><div id="ii-legend"></div></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The three strategies at this skew</div>' +
      '<div class="card-body"><table class="ref-table" id="ii-strategy-table"><thead><tr>' +
      '<th>Strategy</th><th>Comparisons</th><th>Postings visited</th><th>Skips taken</th>' +
      '<th>Probes</th><th>Same result</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ii-strategy-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What the postings cost, encoded three ways</div>' +
      '<div class="card-body"><table class="ref-table" id="ii-encoding-table"><thead><tr>' +
      '<th>Encoding</th><th>Bytes</th><th>Bits per posting</th><th>Against raw</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ii-encoding-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">A boolean query and a phrase query over the same index</div>' +
      '<div class="card-body"><pre class="step-work" id="ii-query-out"></pre>' +
      '<p class="note" id="ii-query-out-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
