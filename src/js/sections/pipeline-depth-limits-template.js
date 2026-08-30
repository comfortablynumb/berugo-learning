/** Markup for "Deeper pipelines and their limits". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DepthTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'pdl-overhead', kind: 'range', label: 'pipeline-register overhead, in gate delays',
      value: 3, min: 1, max: 30, step: 1 },
    { id: 'pdl-workload', kind: 'select', label: 'workload', value: 'branchy',
      options: [
        { value: 'predictable', label: 'predictable branches — tight loops' },
        { value: 'branchy', label: 'unpredictable branches — data-dependent decisions' },
        { value: 'memory', label: 'memory bound — load-use everywhere' }] },
    { id: 'pdl-depth', kind: 'range', label: 'depth to inspect', value: 5,
      min: 1, max: 40, step: 1 }
  ];

  const METRICS = [
    { id: 'pdl-period', label: 'Clock period at this depth', note: 'logic divided, plus overhead' },
    { id: 'pdl-cpi', label: 'CPI at this depth', note: 'and the penalty that drives it' },
    { id: 'pdl-time', label: 'Total time', note: 'instructions x CPI x period' },
    { id: 'pdl-fastest', label: 'Fastest depth', note: 'on this workload' },
    { id: 'pdl-efficient', label: 'Most efficient depth', note: 'performance cubed per watt' },
    { id: 'pdl-overhead-share', label: 'Overhead share of the period', note: 'at the fastest depth' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Deeper, and deeper, and then worse',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The curve, depth by depth</div>' +
      '<div class="card-body"><table class="ref-table" id="pdl-curve"><thead><tr>' +
      '<th>Depth</th><th>Period</th><th>Penalty</th><th>CPI</th><th>Time</th>' +
      '<th>Overhead share</th></tr></thead><tbody></tbody></table>' +
      '<p class="note" id="pdl-curve-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      chartCard() +
      card('pdl-workloads', 'Three workloads, one machine, three answers',
        ['Workload', 'Fastest depth', 'Its CPI', 'Most efficient depth', 'What decides it']) +
      card('pdl-terms', 'The two things that do not divide',
        ['Term', 'At depth 1', 'At depth 20', 'Why it grows']) +
      card('pdl-history', 'The industry ran this experiment in public',
        ['Machine', 'Depth', 'What happened', 'What it settled']);
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Total time against depth</div>' +
      '<div class="card-body"><div id="pdl-chart" class="chart-host"></div>' +
      '<p class="note" id="pdl-chart-note"></p></div></div>';
  }

  function card(id, title, columns) {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">' + title + '</div>' +
      '<div class="card-body"><table class="ref-table" id="' + id + '"><thead><tr>' +
      columns.map(function (name) { return '<th>' + name + '</th>'; }).join('') +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="' + id + '-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
