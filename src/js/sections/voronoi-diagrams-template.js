/** Markup for "Voronoi diagrams". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.VoronoiDiagramsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'vd-set', kind: 'select', label: 'sites', value: 'uniform',
      options: [
        { value: 'uniform', label: 'uniform' },
        { value: 'clustered', label: 'clustered — cells vary enormously in size' },
        { value: 'circle', label: 'circle — every site on the hull, every cell unbounded' },
        { value: 'grid', label: 'grid — four sites per circle everywhere' },
        { value: 'convex-heavy', label: 'convex-heavy' }
      ] },
    { id: 'vd-sites', kind: 'range', label: 'sites', value: 24, min: 4, max: 120, step: 2 },
    { id: 'vd-rounds', kind: 'range', label: 'Lloyd relaxation rounds', value: 0,
      min: 0, max: 12, step: 1 },
    { id: 'vd-grid', kind: 'range', label: 'oracle grid, points per side', value: 30,
      min: 10, max: 60, step: 5 }
  ];

  const METRICS = [
    { id: 'vd-cells', label: 'Cells', note: 'one per site' },
    { id: 'vd-unbounded', label: 'Cells meeting the box', note: 'unbounded before clipping' },
    { id: 'vd-misassigned', label: 'Grid points in the wrong cell', note: 'against brute-force nearest site' },
    { id: 'vd-spread', label: 'Cell area spread', note: 'what Lloyd drives down' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The sites', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The cells, their sites, and the Delaunay dual</div>' +
      '<div class="card-body"><div id="vd-scene"></div>' +
      '<p class="note" id="vd-scene-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Two constructions of the same diagram</div>' +
      '<div class="card-body"><table class="ref-table" id="vd-methods"><thead><tr>' +
      '<th>Construction</th><th>Cells</th><th>Total area</th><th>Worst cell gap</th>' +
      '<th>Sites outside their own cell</th><th>Grid points misassigned</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="vd-methods-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Lloyd relaxation, round by round</div>' +
      '<div class="card-body"><div id="vd-chart"></div><div id="vd-legend"></div>' +
      '<p class="note" id="vd-chart-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What the relaxation actually moved</div>' +
      '<div class="card-body"><table class="ref-table" id="vd-lloyd"><thead><tr>' +
      '<th>Round</th><th>Total site movement</th><th>Area spread</th><th>Largest / smallest cell</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="vd-lloyd-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
