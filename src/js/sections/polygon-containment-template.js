/** Markup for "Polygons, areas and containment". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PolygonContainmentTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'pc-shape', kind: 'select', label: 'polygon', value: 'pentagram',
      options: [
        { value: 'pentagram', label: 'pentagram — wound twice around its own centre' },
        { value: 'bowtie', label: 'bowtie — self-intersecting, each lobe wound once' },
        { value: 'square', label: 'square — simple and convex' },
        { value: 'l-shape', label: 'L-shape — simple and concave' },
        { value: 'comb', label: 'comb — five teeth, many crossings per ray' },
        { value: 'star', label: 'star — concave, simple, ten vertices' },
        { value: 'chevron', label: 'chevron — one reflex vertex' },
        { value: 'spiky', label: 'spiky — near-collinear edge midpoints' }
      ] },
    { id: 'pc-probes', kind: 'range', label: 'probe grid, points per side', value: 21,
      min: 5, max: 61, step: 2 },
    { id: 'pc-simplify', kind: 'range', label: 'simplification tolerance', value: 0,
      min: 0, max: 20, step: 1 },
    { id: 'pc-method', kind: 'select', label: 'simplification', value: 'douglas-peucker',
      options: [
        { value: 'douglas-peucker', label: 'Douglas-Peucker — keeps whatever is furthest from the chord' },
        { value: 'visvalingam', label: 'Visvalingam — drops the smallest triangle first' }
      ] }
  ];

  const METRICS = [
    { id: 'pc-area', label: 'Area', note: 'from the shoelace formula' },
    { id: 'pc-winding', label: 'Winding at the centre', note: 'how many times the ring goes round' },
    { id: 'pc-disagree', label: 'Probes where the two tests disagree', note: 'ray casting against winding' },
    { id: 'pc-selfint', label: 'Self-intersections', note: 'non-adjacent edge pairs that cross' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The polygon and the probes', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Inside by ray casting, inside by winding, or both</div>' +
      '<div class="card-body"><div id="pc-scene"></div>' +
      '<p class="note" id="pc-scene-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Where the two fill rules part company</div>' +
      '<div class="card-body"><table class="ref-table" id="pc-probe"><thead><tr>' +
      '<th>Point</th><th>Ray crossings</th><th>Ray casting says</th>' +
      '<th>Winding number</th><th>Winding says</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="pc-probe-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The same question asked of every shape</div>' +
      '<div class="card-body"><table class="ref-table" id="pc-shapes"><thead><tr>' +
      '<th>Polygon</th><th>Vertices</th><th>Area</th><th>Convex</th><th>Simple</th>' +
      '<th>Probes disagreeing</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="pc-shapes-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Simplification: what each method gives up first</div>' +
      '<div class="card-body"><table class="ref-table" id="pc-simplify-table"><thead><tr>' +
      '<th>Method</th><th>Vertices kept</th><th>Area kept</th><th>Furthest a point moved</th>' +
      '<th>Still simple</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="pc-simplify-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
