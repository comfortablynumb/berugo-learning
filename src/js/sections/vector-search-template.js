/** Markup for "Nearest neighbours in high dimensions". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.VectorSearchTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'vs-ef', kind: 'range', label: 'HNSW search beam (ef)', value: 32, min: 10, max: 256, step: 2 },
    { id: 'vs-m', kind: 'select', label: 'HNSW connections (M)', value: '8',
      options: [{ value: '4', label: '4' }, { value: '8', label: '8' }, { value: '16', label: '16' }] },
    { id: 'vs-efc', kind: 'select', label: 'build beam (efConstruction)', value: '100',
      options: [{ value: '24', label: '24 — too narrow' }, { value: '48', label: '48' },
        { value: '100', label: '100' }, { value: '200', label: '200' }] },
    { id: 'vs-probe', kind: 'range', label: 'IVF lists probed', value: 4, min: 1, max: 32, step: 1 },
    { id: 'vs-rerank', kind: 'range', label: 'quantiser shortlist (× k)', value: 10, min: 1, max: 50, step: 1 },
    { id: 'vs-layer', kind: 'range', label: 'HNSW layer drawn', value: 1, min: 0, max: 4, step: 1 }
  ];

  const METRICS = [
    { id: 'vs-recall', label: 'HNSW recall at k = 10', note: 'against a brute-force scan of every vector' },
    { id: 'vs-cost', label: 'Distance computations', note: 'per query, against an exact scan' },
    { id: 'vs-pq', label: 'Quantised recall', note: 'the same codes, alone and re-ranked' },
    { id: 'vs-memory', label: 'Bytes per vector', note: 'exact, quantised, and the graph' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The dials, and which of them is a rebuild', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">One HNSW layer, projected onto the first two coordinates</div>' +
      '<div class="card-body"><div id="vs-graph"></div>' +
      '<p class="note" id="vs-graph-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Recall against work: the curve every vector index is sold on</div>' +
      '<div class="card-body"><div id="vs-chart"></div>' +
      '<div id="vs-chart-legend"></div>' +
      '<p class="note" id="vs-chart-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every family on the same corpus and the same queries</div>' +
      '<div class="card-body"><table class="ref-table" id="vs-compare"><thead><tr>' +
      '<th>Index</th><th>Recall @ 10</th><th>Nearest returned first</th><th>Distances / query</th>' +
      '<th>Bytes / vector</th><th>Build</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="vs-compare-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The two HNSW parameters do different jobs</div>' +
      '<div class="card-body"><pre class="step-work" id="vs-params"></pre>' +
      '<p class="note" id="vs-params-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
