/** Markup for "Decision problems, P, NP and certificates". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DecisionProblemsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'dcp-size', kind: 'range', label: 'instance size', value: 12, min: 8, max: 15, step: 1 },
    { id: 'dcp-seed', kind: 'select', label: 'instance seed', value: '3',
      options: [
        { value: '1', label: 'seed 1' },
        { value: '3', label: 'seed 3' },
        { value: '7', label: 'seed 7' }
      ] }
  ];

  const METRICS = [
    { id: 'dcp-verify', label: 'Verifying a certificate', note: 'steps, worst of the four problems' },
    { id: 'dcp-search', label: 'Searching on a NO instance', note: 'steps, same four problems' },
    { id: 'dcp-gap', label: 'Search over verify', note: 'the gap that defines NP, measured' },
    { id: 'dcp-rejects', label: 'Bad certificates rejected', note: 'wrong ones and malformed ones' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'One instance size, four problems', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Checking stays flat; searching does not</div>' +
      '<div class="card-body"><div id="dcp-chart" class="chart-host"></div>' +
      '<p class="note" id="dcp-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The verifier and the search, on a YES instance and a NO instance</div>' +
      '<div class="card-body"><table class="ref-table" id="dcp-costs"><thead><tr>' +
      '<th>Problem</th><th>Certificate</th><th>Verify</th><th>Search (YES)</th>' +
      '<th>Search (NO)</th><th>Search ÷ verify on NO</th><th>The space it would enumerate</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dcp-costs-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What the verifier does with a certificate that is wrong, and with one that is malformed</div>' +
      '<div class="card-body"><table class="ref-table" id="dcp-rejection"><thead><tr>' +
      '<th>Problem</th><th>A valid certificate</th><th>One value corrupted</th>' +
      '<th>Structurally malformed</th><th>Why the NO instance has no answer</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dcp-rejection-note"></p></div></div>' +
      '<div class="grid-2" style="margin-top:.875rem">' +
      '<div class="card"><div class="card-header">The same problem at rising size</div>' +
      '<div class="card-body"><table class="ref-table" id="dcp-sweep"><thead><tr>' +
      '<th>Vertices</th><th>Verify</th><th>Search, YES</th><th>Search, NO</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dcp-sweep-note"></p></div></div>' +
      '<div class="card"><div class="card-header">The certificate shapes NP is made of</div>' +
      '<div class="card-body"><table class="ref-table" id="dcp-problems"><thead><tr>' +
      '<th>Problem</th><th>Certificate</th><th>Verification</th><th>Search</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dcp-problems-note"></p></div></div>' +
      '</div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
