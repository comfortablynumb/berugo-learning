/** Markup for "Broad-phase collision detection". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BroadPhaseTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'bp-phase', kind: 'select', label: 'broad phase', value: 'sap',
      options: [{ value: 'sap', label: 'sweep and prune' },
        { value: 'hash', label: 'spatial hash, rebuilt each frame' },
        { value: 'brute', label: 'all pairs' }] },
    { id: 'bp-count', kind: 'range', label: 'bodies', value: 400, min: 50, max: 800, step: 50 },
    { id: 'bp-speed', kind: 'range', label: 'speed (units per second)', value: 60, min: 15, max: 1200, step: 15 },
    { id: 'bp-radius', kind: 'range', label: 'body radius', value: 6, min: 2, max: 20, step: 1 },
    { id: 'bp-step', kind: 'select', label: 'time step', value: '30',
      options: [{ value: '30', label: '1/30 s' }, { value: '60', label: '1/60 s' },
        { value: '120', label: '1/120 s' }, { value: '240', label: '1/240 s' }] }
  ];

  const METRICS = [
    { id: 'bp-tests', label: 'Pairs tested per frame', note: 'against all pairs on the same scene' },
    { id: 'bp-pairs', label: 'Pairs found per frame', note: 'identical for every phase, by construction' },
    { id: 'bp-swaps', label: 'Sort swaps per frame', note: 'the first frame against the rest' },
    { id: 'bp-missed', label: 'Contacts missed', note: 'found by a swept test, seen by neither frame boundary' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The scene, the phase and the step', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The bodies at the last frame, with the touching pairs marked</div>' +
      '<div class="card-body"><div id="bp-map"></div>' +
      '<p class="note" id="bp-map-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Three phases, the same scene, the same answer</div>' +
      '<div class="card-body"><table class="ref-table" id="bp-compare"><thead><tr>' +
      '<th>Phase</th><th>Pairs tested / frame</th><th>Pairs found / frame</th><th>Tests per pair</th>' +
      '<th>Swaps / frame</th><th>Against all pairs</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bp-compare-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Work per frame, and the sort cost that temporal coherence buys down</div>' +
      '<div class="card-body"><div id="bp-chart"></div>' +
      '<div id="bp-chart-legend"></div>' +
      '<p class="note" id="bp-chart-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Tunnelling: the failure no broad phase can fix</div>' +
      '<div class="card-body"><table class="ref-table" id="bp-tunnel"><thead><tr>' +
      '<th>Speed</th><th>Travel per step</th><th>In diameters</th><th>Contacts reported</th>' +
      '<th>Contacts missed</th><th>Miss rate</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bp-tunnel-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
