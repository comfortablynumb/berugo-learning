/** Markup for "Automata over infinite words". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BuchiTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'inf-system', kind: 'select', label: 'the system under check', value: 'starve',
      options: [
        { value: 'good', label: 'a server that always grants' },
        { value: 'starve', label: 'a server that may wait forever' },
        { value: 'rogue', label: 'a server that grants without a request' }
      ] },
    { id: 'inf-property', kind: 'select', label: 'the property', value: 'liveness',
      options: [
        { value: 'liveness', label: 'liveness — every request is eventually granted' },
        { value: 'safety', label: 'safety — no grant unless a request is outstanding' }
      ] }
  ];

  const METRICS = [
    { id: 'inf-verdict', label: 'Property holds', note: 'emptiness of the product with the monitor' },
    { id: 'inf-trace', label: 'Counter-example', note: 'a lasso: a stem, then a cycle forever' },
    { id: 'inf-states', label: 'Product states', note: 'system × monitor, reachable only' },
    { id: 'inf-confirm', label: 'The trace is accepted', note: 'the witness re-run against the machine' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'System and property', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The verdict, and the trace behind it</div>' +
      '<div class="card-body"><div id="inf-answer"></div>' +
      '<p class="note" id="inf-answer-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The counter-example unrolled</div>' +
      '<div class="card-body"><table class="ref-table" id="inf-unroll"><thead><tr>' +
      '<th>Step</th><th>Propositions</th><th>Part of the lasso</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="inf-unroll-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every system against every property</div>' +
      '<div class="card-body"><table class="ref-table" id="inf-matrix"><thead><tr>' +
      '<th>System</th><th>Safety</th><th>Liveness</th><th>What a finite test would find</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="inf-matrix-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Safety against liveness, mechanically</div>' +
      '<div class="card-body"><table class="ref-table" id="inf-kinds"><thead><tr>' +
      '<th>Property</th><th>Violated by</th><th>Found by</th><th>Example</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="inf-kinds-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Acceptance conditions, and why there is more than one</div>' +
      '<div class="card-body"><table class="ref-table" id="inf-conditions"><thead><tr>' +
      '<th>Condition</th><th>Accepts when</th><th>Determinisable</th><th>Used for</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="inf-conditions-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
