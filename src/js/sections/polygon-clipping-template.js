/** Markup for "Boolean operations and clipping". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PolygonClippingTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'pk-clip', kind: 'select', label: 'clip polygon', value: 'notch',
      options: [
        { value: 'notch', label: 'deep notch — concave, and Sutherland-Hodgman returns nothing' },
        { value: 'shallow', label: 'shallow notch — concave, also returns nothing' },
        { value: 'l-shape', label: 'L-shape — concave, returns a plausible wrong answer' },
        { value: 'chevron', label: 'chevron — concave, returns a plausible wrong answer' },
        { value: 'star', label: 'star — five reflex vertices' },
        { value: 'band', label: 'band — convex, where the algorithm is correct' },
        { value: 'square', label: 'square — convex' }
      ] },
    { id: 'pk-operation', kind: 'select', label: 'boolean operation', value: 'intersection',
      options: [
        { value: 'intersection', label: 'intersection — in both' },
        { value: 'union', label: 'union — in either' },
        { value: 'difference', label: 'difference — in the subject, not the clip' },
        { value: 'xor', label: 'xor — in exactly one' }
      ] },
    { id: 'pk-grid', kind: 'range', label: 'sampling grid, cells per side', value: 400,
      min: 50, max: 800, step: 50 },
    { id: 'pk-corners', kind: 'range', label: 'corners approximating the offset disc', value: 16,
      min: 3, max: 64, step: 1 }
  ];

  const METRICS = [
    { id: 'pk-sh-area', label: 'Sutherland-Hodgman area', note: 'clipping against the whole polygon' },
    { id: 'pk-fixed-area', label: 'After convex decomposition', note: 'clipping against each piece' },
    { id: 'pk-truth', label: 'Sampled area', note: 'the reference, with its own resolution' },
    { id: 'pk-error', label: 'Sutherland-Hodgman error', note: 'against the sampled area' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The two polygons', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Subject, clip, and what each method returns</div>' +
      '<div class="card-body"><div id="pk-scene"></div>' +
      '<p class="note" id="pk-scene-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The concave failure, shape by shape</div>' +
      '<div class="card-body"><table class="ref-table" id="pk-shapes"><thead><tr>' +
      '<th>Clip polygon</th><th>Convex</th><th>Sutherland-Hodgman</th><th>Vertices returned</th>' +
      '<th>Convex decomposition</th><th>Sampled</th><th>SH error</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="pk-shapes-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The four boolean operations, by sampling</div>' +
      '<div class="card-body"><table class="ref-table" id="pk-ops"><thead><tr>' +
      '<th>Operation</th><th>Area</th><th>Cells inside</th><th>Of total cells</th>' +
      '<th>Resolution floor</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="pk-ops-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Minkowski sums, and the offset nobody tunes</div>' +
      '<div class="card-body"><table class="ref-table" id="pk-minkowski"><thead><tr>' +
      '<th>Corners on the disc</th><th>Offset area</th><th>True disc offset</th>' +
      '<th>Shortfall</th><th>Vertices</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="pk-minkowski-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
