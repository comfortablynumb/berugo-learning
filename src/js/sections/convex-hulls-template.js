/** Markup for "Convex hulls". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ConvexHullsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ch-set', kind: 'select', label: 'point set', value: 'uniform',
      options: [
        { value: 'uniform', label: 'uniform — a few points on the hull, most inside' },
        { value: 'circle', label: 'circle — every point is on the hull' },
        { value: 'convex-heavy', label: 'convex-heavy — a thick ring, most points near the edge' },
        { value: 'clustered', label: 'clustered — three clumps' },
        { value: 'grid', label: 'grid — collinear points everywhere' },
        { value: 'collinear', label: 'collinear — the hull is a segment' },
        { value: 'coincident', label: 'coincident — every point repeated three times' }
      ] },
    { id: 'ch-count', kind: 'range', label: 'points', value: 200, min: 8, max: 1200, step: 8 },
    { id: 'ch-collinear', kind: 'select', label: 'points lying exactly on a hull edge', value: 'drop',
      options: [
        { value: 'drop', label: 'drop — the fewest vertices, strictly convex' },
        { value: 'keep', label: 'keep — every input point on the boundary survives' }
      ] },
    { id: 'ch-show', kind: 'select', label: 'algorithm drawn', value: 'monotone-chain',
      options: [
        { value: 'monotone-chain', label: 'Andrew’s monotone chain' },
        { value: 'gift-wrapping', label: 'gift wrapping (Jarvis march)' },
        { value: 'graham-scan', label: 'Graham scan' },
        { value: 'quickhull', label: 'quickhull' }
      ] }
  ];

  const METRICS = [
    { id: 'ch-vertices', label: 'Hull vertices', note: 'h, out of n points' },
    { id: 'ch-cheapest', label: 'Fewest orientation tests', note: 'the algorithm that did least work' },
    { id: 'ch-spread', label: 'Dearest over cheapest', note: 'how far apart the four are' },
    { id: 'ch-agree', label: 'Algorithms agreeing', note: 'checked against a brute-force oracle' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The points and the policy', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The hull, and the points it encloses</div>' +
      '<div class="card-body"><div id="ch-scene"></div>' +
      '<p class="note" id="ch-scene-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Four algorithms, one point set, counted in orientation tests</div>' +
      '<div class="card-body"><table class="ref-table" id="ch-algos"><thead><tr>' +
      '<th>Algorithm</th><th>Bound</th><th>Vertices</th><th>Orientation tests</th>' +
      '<th>Sort comparisons</th><th>Oracle</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ch-algos-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Where gift wrapping wins, and where it collapses</div>' +
      '<div class="card-body"><div id="ch-chart"></div><div id="ch-legend"></div>' +
      '<p class="note" id="ch-chart-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The collinear policy, on every degenerate set</div>' +
      '<div class="card-body"><table class="ref-table" id="ch-degenerate"><thead><tr>' +
      '<th>Point set</th><th>Points</th><th>drop</th><th>keep</th><th>All four agree</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ch-degenerate-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
