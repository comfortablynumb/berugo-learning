/** Markup for "Transforms and 3-D geometry". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TransformsAnd3dTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 't3-order', kind: 'select', label: 'composition order', value: 'rotate-then-translate',
      options: [
        { value: 'rotate-then-translate', label: 'translate first, then rotate' },
        { value: 'translate-then-rotate', label: 'rotate first, then translate' },
        { value: 'scale-then-rotate', label: 'scale first, then rotate' },
        { value: 'rotate-then-scale', label: 'rotate first, then scale' }
      ] },
    { id: 't3-angle', kind: 'range', label: 'rotation, degrees', value: 45,
      min: 0, max: 360, step: 5 },
    { id: 't3-shift', kind: 'range', label: 'translation along x', value: 40,
      min: 0, max: 100, step: 5 },
    { id: 't3-pitch', kind: 'range', label: 'pitch for the gimbal test, degrees', value: 60,
      min: 0, max: 90, step: 1 }
  ];

  const METRICS = [
    { id: 't3-moved', label: 'How far the orders differ', note: 'same operations, opposite order' },
    { id: 't3-freedom', label: 'Rotational freedom lost', note: 'at the chosen pitch' },
    { id: 't3-rayhits', label: 'Ray-triangle hits', note: 'over a fixed bundle of rays' },
    { id: 't3-raycheck', label: 'Disagreements with the reference', note: 'a differently structured test' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The transform stack', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The same shape under both composition orders</div>' +
      '<div class="card-body"><div id="t3-scene"></div>' +
      '<p class="note" id="t3-scene-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The matrix, and where a test point lands</div>' +
      '<div class="card-body"><table class="ref-table" id="t3-matrix"><thead><tr>' +
      '<th>Order</th><th>Row 1</th><th>Row 2</th><th>(1, 0, 0) lands at</th><th>(0, 0, 0) lands at</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="t3-matrix-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Gimbal lock, as freedom lost rather than as an anecdote</div>' +
      '<div class="card-body"><div id="t3-chart"></div><div id="t3-legend"></div>' +
      '<p class="note" id="t3-chart-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Nudging yaw against nudging roll, pitch by pitch</div>' +
      '<div class="card-body"><table class="ref-table" id="t3-gimbal"><thead><tr>' +
      '<th>Pitch</th><th>Gap between the two nudges</th><th>Gap at pitch zero</th>' +
      '<th>Freedom lost</th><th>What that means</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="t3-gimbal-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Ray-triangle intersection, against an independent reference</div>' +
      '<div class="card-body"><table class="ref-table" id="t3-ray"><thead><tr>' +
      '<th>Rays cast</th><th>Hits</th><th>Misses</th><th>Parallel</th><th>Edge grazes</th>' +
      '<th>Barycentric round-trip errors</th><th>Disagreements</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="t3-ray-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
