/** Markup for "Triangulation". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PolygonTriangulationTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'tg-mode', kind: 'select', label: 'what to triangulate', value: 'delaunay',
      options: [
        { value: 'delaunay', label: 'a point set, by Delaunay' },
        { value: 'ear-clipping', label: 'a polygon, by ear clipping' }
      ] },
    { id: 'tg-polygon', kind: 'select', label: 'polygon (ear clipping)', value: 'comb',
      options: [
        { value: 'comb', label: 'comb — five teeth, ears are scarce' },
        { value: 'l-shape', label: 'L-shape — one reflex vertex' },
        { value: 'star', label: 'star — five reflex vertices' },
        { value: 'chevron', label: 'chevron — one deep notch' },
        { value: 'spiky', label: 'spiky — near-collinear midpoints' },
        { value: 'square', label: 'square — the trivial case' }
      ] },
    { id: 'tg-set', kind: 'select', label: 'point set (Delaunay)', value: 'uniform',
      options: [
        { value: 'uniform', label: 'uniform' },
        { value: 'clustered', label: 'clustered — very uneven density' },
        { value: 'circle', label: 'circle — every point co-circular' },
        { value: 'grid', label: 'grid — four points per circle, everywhere' },
        { value: 'convex-heavy', label: 'convex-heavy' }
      ] },
    { id: 'tg-points', kind: 'range', label: 'points', value: 60, min: 8, max: 240, step: 4 },
    { id: 'tg-flips', kind: 'range', label: 'legal flips away from Delaunay', value: 60,
      min: 1, max: 300, step: 1 }
  ];

  const METRICS = [
    { id: 'tg-triangles', label: 'Triangles', note: 'produced' },
    { id: 'tg-empty', label: 'Empty-circle violations', note: 'checked against every vertex' },
    { id: 'tg-minangle', label: 'Smallest angle', note: 'what Delaunay maximises' },
    { id: 'tg-work', label: 'Predicate calls', note: 'orientation plus in-circle' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The input', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The mesh, with one circumcircle drawn</div>' +
      '<div class="card-body"><div id="tg-scene"></div>' +
      '<p class="note" id="tg-scene-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Delaunay against a valid triangulation of the same points</div>' +
      '<div class="card-body"><table class="ref-table" id="tg-compare"><thead><tr>' +
      '<th>Triangulation</th><th>Triangles</th><th>Smallest angle</th><th>Mean smallest angle</th>' +
      '<th>Skinny (under 20°)</th><th>Empty-circle violations</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tg-compare-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The angle distribution both triangulations produce</div>' +
      '<div class="card-body"><div id="tg-chart"></div><div id="tg-legend"></div>' +
      '<p class="note" id="tg-chart-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Ear clipping, polygon by polygon</div>' +
      '<div class="card-body"><table class="ref-table" id="tg-ears"><thead><tr>' +
      '<th>Polygon</th><th>Vertices</th><th>Triangles</th><th>Expected</th><th>Ear tests</th>' +
      '<th>Area preserved</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tg-ears-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
