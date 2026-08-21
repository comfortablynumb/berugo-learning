/** Markup for "Strongly connected components". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StronglyConnectedTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'scc-shape', kind: 'select', label: 'digraph shape', value: 'chained-cycles',
      options: [{ value: 'chained-cycles', label: 'chained cycles — components of known size' },
        { value: 'random', label: 'random — one giant component and a dust of singletons' },
        { value: 'dag', label: 'DAG — every component is a single node' },
        { value: 'path', label: 'directed path — n components in a line' }] },
    { id: 'scc-size', kind: 'range', label: 'nodes', value: 60, min: 8, max: 800, step: 4 },
    { id: 'scc-density', kind: 'range', label: 'edges per node', value: 2, min: 1, max: 6, step: 1 },
    { id: 'scc-seed', kind: 'range', label: 'instance seed', value: 7, min: 1, max: 40, step: 1 }
  ];

  const METRICS = [
    { id: 'scc-count', label: 'Components', note: 'Tarjan and Kosaraju must agree exactly' },
    { id: 'scc-largest', label: 'Largest component', note: 'the giant one, if there is one' },
    { id: 'scc-singletons', label: 'Singletons', note: 'nodes on no cycle at all' },
    { id: 'scc-acyclic', label: 'Condensation acyclic?', note: 'the theorem, checked rather than assumed' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Digraph', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The graph, grouped by component</div>' +
      '<div class="card-body"><div id="scc-canvas"></div>' +
      '<p class="note" id="scc-canvas-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Two algorithms, one partition</div>' +
      '<div class="card-body"><table class="ref-table" id="scc-methods"><thead><tr>' +
      '<th>Algorithm</th><th>Passes</th><th>Components</th><th>Nodes visited</th>' +
      '<th>Edges examined</th><th>Peak stack</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="scc-methods-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The condensation</div>' +
      '<div class="card-body"><div id="scc-condensation"></div>' +
      '<p class="note" id="scc-condensation-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Component sizes</div>' +
      '<div class="card-body"><table class="ref-table" id="scc-sizes"><thead><tr>' +
      '<th>Rank</th><th>Size</th><th>Share of the graph</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="scc-sizes-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The same computation, under four names</div>' +
      '<div class="card-body"><table class="ref-table" id="scc-uses"><thead><tr>' +
      '<th>Problem</th><th>What the vertices are</th><th>What a component means</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="scc-uses-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
