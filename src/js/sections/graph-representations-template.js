/** Markup for "Representations and traversal". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GraphRepresentationsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'gr-shape', kind: 'select', label: 'graph shape', value: 'grid',
      options: [{ value: 'grid', label: 'grid — geometry, low degree' },
        { value: 'random', label: 'random — tight degrees, log diameter' },
        { value: 'scale-free', label: 'scale-free — one huge degree' },
        { value: 'path', label: 'path — depth n' },
        { value: 'star', label: 'star — degree n − 1' },
        { value: 'barbell', label: 'barbell — two cliques, one bridge' }] },
    { id: 'gr-size', kind: 'range', label: 'nodes', value: 400, min: 25, max: 4000, step: 25 },
    { id: 'gr-seed', kind: 'range', label: 'instance seed', value: 3, min: 1, max: 40, step: 1 },
    { id: 'gr-source', kind: 'range', label: 'traversal source', value: 0, min: 0, max: 200, step: 1 }
  ];

  const METRICS = [
    { id: 'gr-nodes', label: 'Nodes and edges', note: 'the instance the figures below describe' },
    { id: 'gr-csr', label: 'CSR bytes', note: 'two typed arrays, scanned contiguously' },
    { id: 'gr-matrix', label: 'Matrix bytes', note: 'n² whatever the edge count' },
    { id: 'gr-ratio', label: 'Matrix / CSR', note: 'why nobody stores the matrix' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Graph and traversal', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The graph, with the BFS tree drawn</div>' +
      '<div class="card-body"><div id="gr-canvas"></div>' +
      '<p class="note" id="gr-canvas-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Three representations of the same graph</div>' +
      '<div class="card-body"><table class="ref-table" id="gr-memory"><thead><tr>' +
      '<th>Representation</th><th>Bytes</th><th>Against CSR</th><th>Neighbour scan</th>' +
      '<th>Edge test</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="gr-memory-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">BFS and DFS on the same source</div>' +
      '<div class="card-body"><table class="ref-table" id="gr-walks"><thead><tr>' +
      '<th>Walk</th><th>Nodes visited</th><th>Edges examined</th><th>Peak frontier or stack</th>' +
      '<th>What the peak is</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="gr-walks-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Edge classification, and what each kind means</div>' +
      '<div class="card-body"><table class="ref-table" id="gr-edges"><thead><tr>' +
      '<th>Kind</th><th>Count</th><th>What it tells you</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="gr-edges-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Components, bipartiteness, and the witness when it fails</div>' +
      '<div class="card-body"><div id="gr-structure"></div>' +
      '<p class="note" id="gr-structure-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
