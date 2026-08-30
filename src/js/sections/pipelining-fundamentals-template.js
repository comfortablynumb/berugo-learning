/** Markup for "Pipelining fundamentals". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PipelineTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const PROGRAMS = [
    { value: 'sum', label: 'sum 1..10 — a counted loop' },
    { value: 'arrayMax', label: 'array maximum — loads in a loop' },
    { value: 'strlen', label: 'string length — byte loads' },
    { value: 'factorial', label: 'factorial — calls and returns' }
  ];

  const CONTROLS = [
    { id: 'pfx-program', kind: 'select', label: 'program', value: 'sum', options: PROGRAMS },
    { id: 'pfx-cycles', kind: 'range', label: 'cycles shown in the diagram', value: 18,
      min: 6, max: 40, step: 1 }
  ];

  const METRICS = [
    { id: 'pfx-cycles-total', label: 'Cycles, pipelined', note: 'to run the whole program' },
    { id: 'pfx-ipc', label: 'IPC', note: 'instructions retired per cycle' },
    { id: 'pfx-period', label: 'Clock period', note: 'the longest stage, plus overhead' },
    { id: 'pfx-time', label: 'Total time, pipelined', note: 'cycles x period, in gate delays' },
    { id: 'pfx-single', label: 'Total time, balanced stages', note: 'the same run, logic divided evenly' },
    { id: 'pfx-latency', label: 'Latency of one instruction', note: 'and it got worse' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Run one program on both machines',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Where the cycles went</div>' +
      '<div class="card-body"><table class="ref-table" id="pfx-attribution"><thead><tr>' +
      '<th>Cause</th><th>Cycles</th><th>Share</th><th>What it is</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="pfx-attribution-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      diagramCard() +
      card('pfx-compare', 'The same program on four machines',
        ['Machine', 'Cycles', 'Clock period', 'Total time', 'Against single cycle']) +
      chartCard() +
      card('pfx-registers', 'What each pipeline register has to carry',
        ['Boundary', 'Carries', 'Why it cannot be looked up later']) +
      card('pfx-tradeoff', 'Throughput up, latency down — the trade everywhere',
        ['Setting', 'What improves', 'What gets worse', 'Where you have met it']);
  }

  function diagramCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Instructions on rows, cycles on columns</div>' +
      '<div class="card-body"><div id="pfx-diagram"></div>' +
      '<div class="pipe-legend" id="pfx-legend"></div>' +
      '<p class="note" id="pfx-diagram-note"></p></div></div>';
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Total time on both machines, all four programs</div>' +
      '<div class="card-body"><div id="pfx-chart" class="chart-host"></div>' +
      '<p class="note" id="pfx-chart-note"></p></div></div>';
  }

  function card(id, title, columns) {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">' + title + '</div>' +
      '<div class="card-body"><table class="ref-table" id="' + id + '"><thead><tr>' +
      columns.map(function (name) { return '<th>' + name + '</th>'; }).join('') +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="' + id + '-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, PROGRAMS: PROGRAMS };
}));
