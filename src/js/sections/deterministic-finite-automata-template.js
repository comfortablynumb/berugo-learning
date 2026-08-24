/** Markup for "Deterministic finite automata". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DfaTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'dfa-machine', kind: 'select', label: 'the machine', value: 'div3',
      options: [
        { value: 'div3', label: 'binary numerals divisible by 3' },
        { value: 'div7', label: 'binary numerals divisible by 7' },
        { value: 'ends-abb', label: 'ends in abb' },
        { value: 'even-a', label: 'an even number of a' },
        { value: 'no-three', label: 'never three a in a row' }
      ] },
    { id: 'dfa-input', kind: 'select', label: 'the input to run', value: 'first',
      options: [
        { value: 'first', label: 'the first accepted string' },
        { value: 'reject', label: 'the first rejected string' },
        { value: 'long', label: 'a longer accepted string' }
      ] }
  ];

  const METRICS = [
    { id: 'dfa-states', label: 'States', note: 'exactly what has to be remembered' },
    { id: 'dfa-verdict', label: 'This run', note: 'accepted or rejected, and where it ended' },
    { id: 'dfa-batch', label: 'Batch agreement', note: 'against the definition, every string' },
    { id: 'dfa-minimal', label: 'Already minimal', note: 'checked against Myhill-Nerode' }
  ];

  function render() {
    return '<div class="card"><div class="card-header">The machine, with the current state lit</div>' +
      '<div class="card-body"><div id="dfa-graph" class="chart-host"></div>' +
      '<p class="note" id="dfa-graph-note"></p></div></div>' +
      '<div class="grid-2" style="margin-top:.875rem">' +
      scope.ControlPanel.markup({ title: 'Machine and input', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The run, step by step</div>' +
      '<div class="card-body"><div id="dfa-run"></div>' +
      '<p class="note" id="dfa-run-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The transition table — the five-tuple, written out</div>' +
      '<div class="card-body"><table class="ref-table" id="dfa-table"><thead><tr>' +
      '<th>State</th><th>Start</th><th>Accepting</th><th>On each symbol</th><th>Means</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dfa-table-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The batch tester: every string, against the definition</div>' +
      '<div class="card-body"><table class="ref-table" id="dfa-batch-table"><thead><tr>' +
      '<th>Length</th><th>Strings</th><th>Accepted</th><th>Definition accepts</th><th>Agree</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dfa-batch-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Design patterns: what each kind of machine remembers</div>' +
      '<div class="card-body"><table class="ref-table" id="dfa-patterns"><thead><tr>' +
      '<th>Pattern</th><th>The state is</th><th>States needed</th><th>Where it turns up</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dfa-patterns-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
