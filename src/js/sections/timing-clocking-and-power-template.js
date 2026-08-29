/** Markup for "Timing, clocking and power". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TimingTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CIRCUITS = {
    ripple8: { label: '8-bit ripple-carry adder', about: 'a long chain and nothing else' },
    lookahead8: { label: '8-bit carry-lookahead adder', about: 'the same function, shallower' },
    alu8: { label: '8-bit ALU', about: 'an adder with a multiplexer in front of every bit' },
    fsm: { label: 'the 1101 detector, binary encoded',
      about: 'the only one here with a register-to-register path' },
    hazard: { label: 'the glitching AND-OR circuit',
      about: 'small, and it burns power computing nothing' }
  };

  const CONTROLS = [
    { id: 'clk-circuit', kind: 'select', label: 'circuit to analyse', value: 'ripple8',
      options: Object.keys(CIRCUITS).map(function (id) {
        return { value: id, label: CIRCUITS[id].label };
      }) },
    { id: 'clk-target', kind: 'range', label: 'target clock period (gate delays)',
      value: 30, min: 5, max: 80, step: 1 },
    { id: 'clk-stages', kind: 'range', label: 'pipeline stages to consider',
      value: 4, min: 1, max: 8, step: 1 },
    { id: 'clk-cores', kind: 'range', label: 'cores, for the power comparison',
      value: 2, min: 1, max: 8, step: 1 }
  ];

  const METRICS = [
    { id: 'clk-period', label: 'Minimum clock period', note: 'logic plus flip-flop overhead' },
    { id: 'clk-slack', label: 'Slack against the target', note: 'negative means it does not fit' },
    { id: 'clk-limit', label: 'Limited by', note: 'which class of path is worst' },
    { id: 'clk-overhead', label: 'Overhead per stage',
      note: 'clock-to-q plus setup, paid every stage' },
    { id: 'clk-activity', label: 'Wire changes per transition', note: 'measured by simulation' },
    { id: 'clk-wasted', label: 'Switching that computed nothing',
      note: 'glitches, as a share of all switching' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Analyse a circuit the way a timing tool does',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The four classes of path</div>' +
      '<div class="card-body"><table class="ref-table" id="clk-paths"><thead><tr>' +
      '<th>Path class</th><th>Worst delay</th><th>From</th><th>To</th>' +
      '<th>What constrains it</th></tr></thead><tbody></tbody></table>' +
      '<p class="note" id="clk-paths-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('clk-critical', 'The critical path, gate by gate',
        ['Step', 'Gate', 'Delay', 'Cumulative', 'Share of the period']) +
      chartCard() +
      card('clk-pipeline', 'What pipelining buys, and what it costs',
        ['Stages', 'Clock period', 'Throughput', 'Latency', 'Speed-up', 'Overhead share']) +
      card('clk-power', 'The power equation, as a comparison',
        ['Design', 'Voltage', 'Frequency', 'Activity', 'Relative power', 'Same throughput?']) +
      card('clk-rules', 'What a timing report actually tells you',
        ['Finding', 'What it means', 'What fixes it', 'What does not']);
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Clock period and throughput against pipeline depth</div>' +
      '<div class="card-body"><div id="clk-chart" class="chart-host"></div>' +
      '<p class="note" id="clk-chart-note"></p></div></div>';
  }

  function card(id, title, columns) {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">' + title + '</div>' +
      '<div class="card-body"><table class="ref-table" id="' + id + '"><thead><tr>' +
      columns.map(function (name) { return '<th>' + name + '</th>'; }).join('') +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="' + id + '-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, CIRCUITS: CIRCUITS };
}));
