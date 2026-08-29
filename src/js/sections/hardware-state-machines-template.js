/** Markup for "State machines in hardware". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HwFsmTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'hsm-style', kind: 'select', label: 'machine', value: 'moore',
      options: [
        { value: 'moore', label: 'Moore — the output depends on the state alone' },
        { value: 'mealy', label: 'Mealy — the output depends on the state and the input' }] },
    { id: 'hsm-encoding', kind: 'select', label: 'state encoding', value: 'binary',
      options: [
        { value: 'binary', label: 'binary — the fewest flip-flops' },
        { value: 'onehot', label: 'one-hot — one flip-flop per state, trivial decode' },
        { value: 'gray', label: 'gray — one bit changes per step where the order allows' }] },
    { id: 'hsm-input', kind: 'text', label: 'input string (0s and 1s)', value: '1101101101' }
  ];

  const METRICS = [
    { id: 'hsm-output', label: 'Output from the gates', note: 'one bit per input symbol' },
    { id: 'hsm-agree', label: 'Against the abstract machine', note: 'the transition table is the judge' },
    { id: 'hsm-flops', label: 'Flip-flops', note: 'the state register' },
    { id: 'hsm-gates', label: 'Gates', note: 'next-state and output logic' },
    { id: 'hsm-logic', label: 'Logic depth', note: 'what sets the clock period' },
    { id: 'hsm-exhaustive', label: 'Strings checked', note: 'every string up to a length' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A 1101 detector, from a table to gates',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The state graph</div>' +
      '<div class="card-body"><div id="hsm-graph" class="mermaid-host"></div>' +
      '<p class="note" id="hsm-graph-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('hsm-trace', 'Symbol by symbol, through the abstract machine and through the gates',
        ['Step', 'Input', 'State before', 'State after', 'Abstract output', 'Gate output',
          'Agree?']) +
      card('hsm-encodings', 'The same machine under three encodings',
        ['Encoding', 'Flip-flops', 'Gates', 'Logic depth', 'Clock period', 'Mismatches']) +
      chartCard() +
      card('hsm-codes', 'What each encoding actually assigns',
        ['State', 'Binary', 'One-hot', 'Gray', 'Output (Moore)']) +
      card('hsm-styles', 'Moore against Mealy, and the cost of each',
        ['Property', 'Moore', 'Mealy', 'Which to reach for']);
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Flip-flops, gates and depth, per encoding</div>' +
      '<div class="card-body"><div id="hsm-chart" class="chart-host"></div>' +
      '<p class="note" id="hsm-chart-note"></p></div></div>';
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
