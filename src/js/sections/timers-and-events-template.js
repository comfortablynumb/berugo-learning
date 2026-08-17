/** Markup for "Priority queues in systems: timers, schedulers and event simulation". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TimersAndEventsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'te-timers', kind: 'range', label: 'timers', value: 100000, min: 1000, max: 300000, step: 1000 },
    { id: 'te-horizon', kind: 'range', label: 'ticks to run', value: 5000, min: 500, max: 20000, step: 500 },
    { id: 'te-cancel', kind: 'range', label: 'cancelled share', value: 50, min: 0, max: 90, step: 5, suffix: '%',
      note: 'Most timeouts are cancelled before they fire. That is the workload, not an edge case.' },
    { id: 'te-seed', kind: 'range', label: 'seed', value: 3, min: 1, max: 40, step: 1 },
    { id: 'te-rho', kind: 'range', label: 'M/M/1 utilisation ρ', value: 0.8, min: 0.1, max: 0.95, step: 0.05 }
  ];

  const METRICS = [
    { id: 'te-wheel-cost', label: 'Wheel: comparisons', note: 'a bucket index is arithmetic, not a search' },
    { id: 'te-heap-cost', label: 'Heap: comparisons', note: 'log n per insert and per expiry' },
    { id: 'te-touches', label: 'Entry touches per tick', note: 'wheel against heap' },
    { id: 'te-little', label: 'Little’s law holds', note: 'L ÷ (λ·W) from the simulation' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Timers and simulation', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The M/M/1 queue, simulated against its closed form</div>' +
      '<div class="card-body"><table class="ref-table" id="te-mm1"><thead><tr>' +
      '<th>Quantity</th><th>Simulated</th><th>Closed form</th><th>Error</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="te-mm1-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">100 000 timers with churn: three structures</div>' +
      '<div class="card-body"><table class="ref-table" id="te-timers-table"><thead><tr>' +
      '<th>Structure</th><th>Comparisons</th><th>Entry touches</th><th>Per tick</th><th>Cascaded</th><th>Add / cancel</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="te-timers-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What each structure gives up</div>' +
      '<div class="card-body"><table class="ref-table" id="te-tradeoff"><thead><tr>' +
      '<th>Structure</th><th>Add</th><th>Cancel</th><th>Expiry</th><th>Precision</th><th>Where it is used</th>' +
      '</tr></thead><tbody></tbody></table></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
