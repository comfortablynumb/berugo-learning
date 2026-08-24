/** Markup for "Parallel models and work-span analysis". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.WorkAndSpanTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'wsp-n', kind: 'select', label: 'elements', value: '256',
      options: [
        { value: '64', label: '64' },
        { value: '256', label: '256' },
        { value: '1024', label: '1 024' }
      ] },
    { id: 'wsp-serial', kind: 'select', label: 'serial fraction', value: '0.05',
      options: [
        { value: '0.001', label: '0.1%' },
        { value: '0.01', label: '1%' },
        { value: '0.05', label: '5%' },
        { value: '0.2', label: '20%' }
      ] }
  ];

  const METRICS = [
    { id: 'wsp-work', label: 'Work, the sequential total', note: 'operations, whoever runs them' },
    { id: 'wsp-span', label: 'Span, the critical path', note: 'and it does not shrink with processors' },
    { id: 'wsp-ceiling', label: 'Speed-up ceiling', note: 'work over span, however many processors' },
    { id: 'wsp-amdahl', label: 'Amdahl’s ceiling', note: 'at the chosen serial fraction' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A scan, and a serial fraction', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Time against processors, with the span drawn as a floor</div>' +
      '<div class="card-body"><div id="wsp-chart" class="chart-host"></div>' +
      '<p class="note" id="wsp-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Three scans of the same array: work, span and correctness</div>' +
      '<div class="card-body"><table class="ref-table" id="wsp-scans"><thead><tr>' +
      '<th>Algorithm</th><th>Work</th><th>Span</th><th>Work ÷ span</th><th>Result checked</th>' +
      '<th>Work relative to the loop</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="wsp-scans-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">A greedy schedule against Brent’s bound, processor by processor</div>' +
      '<div class="card-body"><table class="ref-table" id="wsp-brent"><thead><tr>' +
      '<th>Processors</th><th>Measured time</th><th>Brent’s bound</th><th>Speed-up</th>' +
      '<th>Utilisation</th><th>Time ÷ span</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="wsp-brent-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Amdahl and Gustafson, which answer different questions</div>' +
      '<div class="card-body"><table class="ref-table" id="wsp-ceilings"><thead><tr>' +
      '<th>Serial fraction</th><th>Amdahl ceiling</th><th>Amdahl at 8</th><th>at 32</th>' +
      '<th>at 128</th><th>at 1 024</th><th>Gustafson at 1 024</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="wsp-ceilings-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
