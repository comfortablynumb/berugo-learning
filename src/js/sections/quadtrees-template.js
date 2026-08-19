/** Markup for "Quadtrees, octrees and loose quadtrees". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.QuadtreesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'qt-kind', kind: 'select', label: 'point distribution', value: 'clustered',
      options: [{ value: 'clustered', label: 'clustered — where a quadtree earns its keep' },
        { value: 'uniform', label: 'uniform' },
        { value: 'coincident', label: 'coincident — three distinct locations' },
        { value: 'collinear', label: 'collinear' }] },
    { id: 'qt-capacity', kind: 'range', label: 'leaf capacity', value: 8, min: 1, max: 64, step: 1 },
    { id: 'qt-depth', kind: 'range', label: 'depth cap', value: 12, min: 4, max: 20, step: 1 },
    { id: 'qt-radius', kind: 'range', label: 'query radius', value: 25, min: 10, max: 60, step: 5 },
    { id: 'qt-loose', kind: 'select', label: 'looseness (for boxes)', value: '1',
      options: [{ value: '1', label: '1.0 — tight, boxes strand at the parent' },
        { value: '1.5', label: '1.5' }, { value: '2', label: '2.0' }] }
  ];

  const METRICS = [
    { id: 'qt-nodes', label: 'Nodes', note: 'and how many of the leaves hold nothing' },
    { id: 'qt-depth-reached', label: 'Depth reached', note: 'against the cap, and the largest leaf' },
    { id: 'qt-candidates', label: 'Candidates per query', note: 'points measured against the query circle' },
    { id: 'qt-bytes', label: 'Memory per point', note: 'nodes plus the points themselves' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Capacity, depth and the input', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The subdivision, drawn over the points</div>' +
      '<div class="card-body"><div id="qt-map"></div>' +
      '<p class="note" id="qt-map-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The capacity sweep: candidates barely move, everything else does</div>' +
      '<div class="card-body"><div id="qt-sweep-chart"></div>' +
      '<div id="qt-sweep-legend"></div>' +
      '<p class="note" id="qt-sweep-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Capacity against nodes, depth and query cost</div>' +
      '<div class="card-body"><table class="ref-table" id="qt-sweep-table"><thead><tr>' +
      '<th>Capacity</th><th>Nodes</th><th>Leaves</th><th>Empty leaves</th><th>Depth</th>' +
      '<th>Largest leaf</th><th>Candidates / query</th><th>Nodes visited</th><th>Memory</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="qt-sweep-table-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Raising the depth cap on coincident points</div>' +
      '<div class="card-body"><table class="ref-table" id="qt-coincident"><thead><tr>' +
      '<th>Depth cap</th><th>Nodes</th><th>Depth reached</th><th>Largest leaf</th><th>Memory</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="qt-coincident-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Objects with extent: what looseness buys, and where it stops</div>' +
      '<div class="card-body"><pre class="step-work" id="qt-loose-report"></pre>' +
      '<p class="note" id="qt-loose-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
