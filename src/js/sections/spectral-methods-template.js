/** Markup for "Spectral methods, centrality and communities". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SpectralMethodsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'spc-shape', kind: 'select', label: 'graph', value: 'clustered',
      options: [{ value: 'clustered', label: 'clustered — four planted groups' },
        { value: 'random', label: 'random — no communities to find' },
        { value: 'scale-free', label: 'scale-free — a few very busy vertices' },
        { value: 'interval', label: 'interval — a chain of overlaps' },
        { value: 'bipartite', label: 'bipartite — two sides' },
        { value: 'planar-grid', label: 'grid — every vertex alike' }] },
    { id: 'spc-nodes', kind: 'range', label: 'vertices', value: 24, min: 12, max: 48, step: 4 },
    { id: 'spc-seed', kind: 'range', label: 'graph seed', value: 1, min: 1, max: 20, step: 1 },
    { id: 'spc-measure', kind: 'select', label: 'measure drawn on the map', value: 'betweenness',
      options: [{ value: 'betweenness', label: 'betweenness — routes that pass through' },
        { value: 'closeness', label: 'closeness — distance to everybody' },
        { value: 'pagerank', label: 'PageRank — a random walk with restarts' },
        { value: 'community', label: 'Louvain communities' },
        { value: 'fiedler', label: 'spectral bisection by the Fiedler vector' }] },
    { id: 'spc-damping', kind: 'range', label: 'PageRank damping ×100', value: 85, min: 50, max: 99, step: 1 },
    { id: 'spc-pages', kind: 'range', label: 'pages in the link graph', value: 40, min: 10, max: 80, step: 5 }
  ];

  const METRICS = [
    { id: 'spc-top', label: 'Most central vertex', note: 'by the measure selected above' },
    { id: 'spc-fiedler', label: 'Algebraic connectivity', note: 'the second-smallest Laplacian eigenvalue' },
    { id: 'spc-modularity', label: 'Modularity', note: 'and how many communities Louvain kept' },
    { id: 'spc-check', label: 'PageRank against a linear solve', note: 'power iteration verified, not trusted' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The graph and the measure', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The graph, sized and grouped by what was measured</div>' +
      '<div class="card-body"><div id="spc-map"></div>' +
      '<p class="note" id="spc-map-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Four measures of importance, and how little they agree</div>' +
      '<div class="card-body"><div id="spc-ranks"></div>' +
      '<p class="note" id="spc-ranks-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Communities: what Louvain found, and what was actually there</div>' +
      '<div class="card-body"><div id="spc-communities"></div>' +
      '<p class="note" id="spc-communities-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Damping: what 0.85 costs and what it buys</div>' +
      '<div class="card-body"><div id="spc-chart"></div><div id="spc-legend"></div>' +
      '<table class="ref-table" id="spc-damping-table"><thead><tr>' +
      '<th>Damping</th><th>Iterations to 10⁻¹⁰</th><th>The naive d^k prediction</th>' +
      '<th>Overshoot</th><th>Highest-ranked page</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="spc-damping-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Dangling pages: the bug, and the output it does not touch</div>' +
      '<div class="card-body"><table class="ref-table" id="spc-dangling"><thead><tr>' +
      '<th>Version</th><th>Mass in the vector</th><th>Largest difference</th>' +
      '<th>Positions that moved</th><th>Top ten that moved</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="spc-dangling-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
