/** Markup for "Maximum flow". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MaximumFlowTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'mfl-shape', kind: 'select', label: 'network', value: 'layered',
      options: [{ value: 'layered', label: 'layered — ranks between source and sink' },
        { value: 'grid', label: 'grid — flows left to right' },
        { value: 'unit', label: 'unit capacity — every arc worth 1' },
        { value: 'bottleneck', label: 'bottleneck — one narrow pipe' },
        { value: 'random', label: 'random — no structure at all' }] },
    { id: 'mfl-width', kind: 'range', label: 'width of each rank', value: 4, min: 2, max: 8, step: 1 },
    { id: 'mfl-layers', kind: 'range', label: 'ranks between source and sink', value: 4, min: 2, max: 7, step: 1 },
    { id: 'mfl-capacity', kind: 'range', label: 'largest capacity', value: 12, min: 1, max: 64, step: 1 },
    { id: 'mfl-seed', kind: 'range', label: 'network seed', value: 1, min: 1, max: 40, step: 1 },
    { id: 'mfl-pick', kind: 'select', label: 'algorithm drawn on the map', value: 'dinic',
      options: [{ value: 'dinic', label: 'Dinic — blocking flows' },
        { value: 'edmonds-karp', label: 'Edmonds-Karp — shortest augmenting path' },
        { value: 'ford-fulkerson', label: 'Ford-Fulkerson — any augmenting path' },
        { value: 'scaling', label: 'capacity scaling — fat paths first' }] }
  ];

  const METRICS = [
    { id: 'mfl-value', label: 'Maximum flow', note: 'and the cut that caps it' },
    { id: 'mfl-paths', label: 'Augmenting paths', note: 'how many times the algorithm found a route' },
    { id: 'mfl-agree', label: 'Do all six agree?', note: 'value, cut capacity and conservation' },
    { id: 'mfl-valid', label: 'Flow is valid?', note: 'capacity and conservation at every vertex' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The network', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The flow, with saturated arcs and the cut marked</div>' +
      '<div class="card-body"><div id="mfl-map"></div>' +
      '<p class="note" id="mfl-map-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The residual graph, which is where the back edges live</div>' +
      '<div class="card-body"><div id="mfl-residual"></div>' +
      '<p class="note" id="mfl-residual-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Six algorithms, one network</div>' +
      '<div class="card-body"><table class="ref-table" id="mfl-compare"><thead><tr>' +
      '<th>Algorithm</th><th>Value</th><th>Paths or phases</th><th>Arc visits</th>' +
      '<th>Cut capacity</th><th>Valid flow?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mfl-compare-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Why the back edge is the algorithm</div>' +
      '<div class="card-body"><div id="mfl-backedge"></div>' +
      '<p class="note" id="mfl-backedge-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What happens as the capacities grow</div>' +
      '<div class="card-body"><table class="ref-table" id="mfl-scaling"><thead><tr>' +
      '<th>Largest capacity</th><th>Value</th><th>Ford-Fulkerson paths</th>' +
      '<th>Edmonds-Karp paths</th><th>Dinic phases</th><th>Scaling rounds</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mfl-scaling-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
