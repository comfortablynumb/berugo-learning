/** Markup for "DP on DAGs and digit DP". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DigitDpTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'dgt-property', kind: 'select', label: 'property to count', value: 'adjacent',
      options: [{ value: 'adjacent', label: 'no two equal adjacent digits' },
        { value: 'increasing', label: 'strictly increasing digits' },
        { value: 'divisible', label: 'digit sum divisible by 3' },
        { value: 'thirteen', label: 'contains the digits 1 then 3' }] },
    { id: 'dgt-low', kind: 'range', label: 'range lower bound', value: 137, min: 0, max: 5000, step: 1 },
    { id: 'dgt-high', kind: 'range', label: 'range upper bound', value: 4321, min: 1, max: 20000, step: 1 },
    { id: 'dgt-nodes', kind: 'range', label: 'nodes in the DAG', value: 14, min: 4, max: 40, step: 1 }
  ];

  const METRICS = [
    { id: 'dgt-count', label: 'Numbers in range', note: 'checked against counting them one by one' },
    { id: 'dgt-states', label: 'Memoised states', note: '(position, automaton state, started)' },
    { id: 'dgt-brute', label: 'Values the brute force touched', note: 'the whole range, one at a time' },
    { id: 'dgt-ratio', label: 'Ratio', note: 'and it grows without bound with the range' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Property, range and DAG', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The cost does not depend on the value, only on its length</div>' +
      '<div class="card-body"><table class="ref-table" id="dgt-scale"><thead><tr>' +
      '<th>Upper bound</th><th>Digits</th><th>Count</th><th>States</th><th>Counting one by one would take</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dgt-scale-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Four properties, one walk</div>' +
      '<div class="card-body"><table class="ref-table" id="dgt-properties"><thead><tr>' +
      '<th>Property</th><th>Automaton state</th><th>Count in range</th><th>Brute force</th><th>Agrees?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dgt-properties-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The tight flag, and what happens without it</div>' +
      '<div class="card-body"><div id="dgt-tight"></div>' +
      '<p class="note" id="dgt-tight-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">DP over a DAG: the topological order is the whole algorithm</div>' +
      '<div class="card-body"><table class="ref-table" id="dgt-dag"><thead><tr>' +
      '<th>Question</th><th>Answer</th><th>States</th><th>Transitions</th><th>Note</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dgt-dag-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
