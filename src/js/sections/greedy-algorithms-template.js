/** Markup for "Greedy algorithms and exchange arguments". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GreedyAlgorithmsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'grd-criterion', kind: 'select', label: 'greedy criterion', value: 'earliest-finish',
      options: [{ value: 'earliest-finish', label: 'earliest finish time' },
        { value: 'earliest-start', label: 'earliest start time' },
        { value: 'shortest', label: 'shortest duration' },
        { value: 'fewest-conflicts', label: 'fewest conflicts' }] },
    { id: 'grd-count', kind: 'range', label: 'intervals', value: 12, min: 4, max: 30, step: 1 },
    { id: 'grd-span', kind: 'range', label: 'time span', value: 20, min: 8, max: 40, step: 1 },
    { id: 'grd-seed', kind: 'range', label: 'instance seed', value: 3, min: 1, max: 40, step: 1 },
    { id: 'grd-coins', kind: 'select', label: 'coin system', value: '1,5,10,25',
      options: [{ value: '1,5,10,25', label: 'US: 1, 5, 10, 25' },
        { value: '1,2,5,10,20,50', label: 'euro: 1, 2, 5, 10, 20, 50' },
        { value: '1,3,4', label: '1, 3, 4' },
        { value: '1,7,10', label: '1, 7, 10' },
        { value: '1,15,25', label: '1, 15, 25' }] }
  ];

  const METRICS = [
    { id: 'grd-chosen', label: 'Intervals scheduled', note: 'by the selected criterion' },
    { id: 'grd-optimal', label: 'The true optimum', note: 'by dynamic programming over the same instance' },
    { id: 'grd-gap', label: 'Gap', note: 'zero is the only acceptable value' },
    { id: 'grd-canonical', label: 'Greedy change-making', note: 'optimal for this coin system?' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The instance and the rule', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The instance, with the chosen intervals highlighted</div>' +
      '<div class="card-body"><div id="grd-intervals"></div>' +
      '<p class="note" id="grd-intervals-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Four criteria on this instance</div>' +
      '<div class="card-body"><table class="ref-table" id="grd-criteria"><thead><tr>' +
      '<th>Criterion</th><th>Scheduled</th><th>Optimum</th><th>Optimal here?</th><th>Provably optimal?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="grd-criteria-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">A counter-example, searched for rather than remembered</div>' +
      '<div class="card-body"><table class="ref-table" id="grd-counter"><thead><tr>' +
      '<th>Criterion</th><th>Intervals needed</th><th>Instances searched</th><th>Greedy</th><th>Optimum</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="grd-counter-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Staying ahead: the certificate for earliest finish</div>' +
      '<div class="card-body"><table class="ref-table" id="grd-ahead"><thead><tr>' +
      '<th>k</th><th>Greedy\'s k-th finishes at</th><th>The optimum\'s k-th finishes at</th><th>Ahead?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="grd-ahead-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Coin systems: where greedy is and is not optimal</div>' +
      '<div class="card-body"><table class="ref-table" id="grd-coin-table"><thead><tr>' +
      '<th>System</th><th>Canonical?</th><th>Smallest witness</th><th>Greedy coins</th><th>Optimal coins</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="grd-coin-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
