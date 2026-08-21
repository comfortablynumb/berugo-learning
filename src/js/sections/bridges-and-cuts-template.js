/** Markup for "Bridges, articulation points and biconnectivity". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BridgesAndCutsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'brg-shape', kind: 'select', label: 'network shape', value: 'barbell',
      options: [{ value: 'barbell', label: 'barbell — two clusters, one link' },
        { value: 'random', label: 'random — few bridges at this density' },
        { value: 'path', label: 'path — every edge a bridge' },
        { value: 'star', label: 'star — one hub, every edge a bridge' },
        { value: 'grid', label: 'grid — no bridges at all' }] },
    { id: 'brg-size', kind: 'range', label: 'nodes', value: 40, min: 6, max: 400, step: 2 },
    { id: 'brg-seed', kind: 'range', label: 'instance seed', value: 3, min: 1, max: 40, step: 1 },
    { id: 'brg-parallel', kind: 'range', label: 'redundant links added (parallel edges)', value: 0, min: 0, max: 20, step: 1 }
  ];

  const METRICS = [
    { id: 'brg-bridges', label: 'Bridges', note: 'links whose loss splits the network' },
    { id: 'brg-cuts', label: 'Articulation points', note: 'nodes whose loss splits it' },
    { id: 'brg-blocks', label: 'Biconnected blocks', note: 'regions with no single point of failure' },
    { id: 'brg-oracle', label: 'Agrees with the removal oracle?', note: 'remove each edge and recount' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Network', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The network, with bridges and cut vertices marked</div>' +
      '<div class="card-body"><div id="brg-canvas"></div>' +
      '<p class="note" id="brg-canvas-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Redundancy: what one extra link buys</div>' +
      '<div class="card-body"><table class="ref-table" id="brg-redundancy"><thead><tr>' +
      '<th>Parallel links added</th><th>Bridges</th><th>Cut vertices</th><th>Blocks</th>' +
      '<th>Matches the oracle?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="brg-redundancy-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The parent-vertex bug, side by side with the oracle</div>' +
      '<div class="card-body"><div id="brg-parallel-view"></div>' +
      '<p class="note" id="brg-parallel-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Which links matter most</div>' +
      '<div class="card-body"><table class="ref-table" id="brg-list"><thead><tr>' +
      '<th>Link</th><th>Kind</th><th>What breaks if it goes</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="brg-list-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The block-cut tree</div>' +
      '<div class="card-body"><div id="brg-tree"></div>' +
      '<p class="note" id="brg-tree-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
