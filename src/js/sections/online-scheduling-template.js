/** Markup for "Online scheduling and load balancing". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.OnlineSchedulingTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'osc-machines', kind: 'range', label: 'machines', value: 4, min: 2, max: 8, step: 1 },
    { id: 'osc-jobs', kind: 'range', label: 'jobs per instance', value: 8, min: 6, max: 10,
      step: 1 },
    { id: 'osc-instances', kind: 'select', label: 'instances', value: '40',
      options: [
        { value: '20', label: '20' },
        { value: '40', label: '40' },
        { value: '80', label: '80' }
      ] },
    { id: 'osc-replicas', kind: 'select', label: 'virtual nodes per machine', value: '16',
      options: [
        { value: '4', label: '4' },
        { value: '16', label: '16' },
        { value: '64', label: '64' }
      ] }
  ];

  const METRICS = [
    { id: 'osc-online', label: 'List scheduling, worst ratio', note: 'against the exact optimum' },
    { id: 'osc-lpt', label: 'LPT (the same rule, offline)', note: 'sorted longest first' },
    { id: 'osc-trap', label: 'The tight instance', note: 'where the bound is attained exactly' },
    { id: 'osc-choices', label: 'Two choices instead of one', note: 'maximum load above the mean' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Arrivals, machines, and no lookahead',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Maximum load against the number of bins, one choice against two</div>' +
      '<div class="card-body"><div id="osc-chart" class="chart-host"></div>' +
      '<p class="note" id="osc-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Online against offline, scored on exact optima</div>' +
      '<div class="card-body"><table class="ref-table" id="osc-ratios"><thead><tr>' +
      '<th>Rule</th><th>Worst ratio</th><th>Mean ratio</th><th>Proved bound</th>' +
      '<th>Inside it</th><th>What it knows</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="osc-ratios-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The power of two choices, measured against both predictions</div>' +
      '<div class="card-body"><table class="ref-table" id="osc-balls"><thead><tr>' +
      '<th>Bins and balls</th><th>One choice</th><th>log n / log log n</th><th>Two choices</th>' +
      '<th>log log n / log 2</th><th>Three choices</th><th>One over two</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="osc-balls-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Consistent hashing: what the imbalance buys</div>' +
      '<div class="card-body"><table class="ref-table" id="osc-ring"><thead><tr>' +
      '<th>Virtual nodes each</th><th>Ring points</th><th>Busiest machine over the mean</th>' +
      '<th>Busiest over quietest</th><th>Keys that move when one machine leaves</th>' +
      '<th>Ideal</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="osc-ring-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
