/** Markup for "Rotating calipers and optimisation on hulls". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RotatingCalipersTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'rc-set', kind: 'select', label: 'point set', value: 'diagonal',
      options: [
        { value: 'diagonal', label: 'diagonal strip — where the axis-aligned box is worst' },
        { value: 'uniform', label: 'uniform' },
        { value: 'circle', label: 'circle — every orientation nearly equal' },
        { value: 'clustered', label: 'clustered' },
        { value: 'convex-heavy', label: 'convex-heavy' },
        { value: 'grid', label: 'grid — axis-aligned already' }
      ] },
    { id: 'rc-count', kind: 'range', label: 'points', value: 80, min: 8, max: 600, step: 8 },
    { id: 'rc-angle', kind: 'range', label: 'caliper angle shown, degrees', value: 0,
      min: 0, max: 90, step: 1 },
    { id: 'rc-steps', kind: 'range', label: 'rotation sweep steps (the reference)', value: 3600,
      min: 90, max: 7200, step: 90 }
  ];

  const METRICS = [
    { id: 'rc-diameter', label: 'Diameter', note: 'the farthest pair' },
    { id: 'rc-minrect', label: 'Minimum-area rectangle', note: 'over the hull edge angles only' },
    { id: 'rc-vsbox', label: 'Against the axis-aligned box', note: 'how much the rotation buys' },
    { id: 'rc-circle', label: 'Smallest enclosing circle', note: 'radius, by Welzl' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The points and the calipers', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The hull, the caliper rectangle and the enclosing circle</div>' +
      '<div class="card-body"><div id="rc-scene"></div>' +
      '<p class="note" id="rc-scene-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Only the hull edge angles are tried, and one of them wins</div>' +
      '<div class="card-body"><table class="ref-table" id="rc-angles"><thead><tr>' +
      '<th>Candidate angle</th><th>Width</th><th>Height</th><th>Area</th><th></th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rc-angles-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The linear scan against a brute-force reference</div>' +
      '<div class="card-body"><table class="ref-table" id="rc-check"><thead><tr>' +
      '<th>Quantity</th><th>Calipers</th><th>Reference</th><th>How the reference works</th>' +
      '<th>Agreement</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rc-check-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What the rotation is worth, point set by point set</div>' +
      '<div class="card-body"><table class="ref-table" id="rc-sets"><thead><tr>' +
      '<th>Point set</th><th>Hull vertices</th><th>Minimum rectangle</th>' +
      '<th>Axis-aligned box</th><th>Ratio</th><th>Best angle</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rc-sets-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
