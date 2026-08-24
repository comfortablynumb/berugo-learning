/** Markup for "Reduction workshop". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ReductionWorkshopTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'rwk-nurses', kind: 'range', label: 'nurses', value: 9, min: 6, max: 12, step: 1 },
    { id: 'rwk-days', kind: 'range', label: 'days in the horizon', value: 7, min: 5, max: 8,
      step: 1 },
    { id: 'rwk-demand', kind: 'select', label: 'demand per day', value: '2,2,1',
      options: [
        { value: '1,1,1', label: '1 day · 1 evening · 1 night' },
        { value: '2,1,1', label: '2 day · 1 evening · 1 night' },
        { value: '2,2,1', label: '2 day · 2 evening · 1 night' }
      ] },
    { id: 'rwk-max', kind: 'range', label: 'shifts per nurse, at most', value: 5, min: 3, max: 7,
      step: 1 }
  ];

  const METRICS = [
    { id: 'rwk-model', label: 'The model', note: 'variables and clauses the requirements became' },
    { id: 'rwk-solve', label: 'The solve', note: 'search nodes, and what the answer means' },
    { id: 'rwk-checked', label: 'Requirements checked', note: 'against the schedule, not the model' },
    { id: 'rwk-unmodelled', label: 'Requirements not modelled', note: 'preferences a clause cannot carry' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A rostering scenario', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The roster the solver produced</div>' +
      '<div class="card-body"><div id="rwk-grid"></div>' +
      '<p class="note" id="rwk-grid-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every stated requirement, encoded and then checked</div>' +
      '<div class="card-body"><table class="ref-table" id="rwk-hard"><thead><tr>' +
      '<th>Requirement</th><th>Clauses that carry it</th><th>Auxiliary variables</th>' +
      '<th>Checked against the schedule</th><th>Failures</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rwk-hard-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Requirements the model does not carry, and what the roster did about them anyway</div>' +
      '<div class="card-body"><table class="ref-table" id="rwk-soft"><thead><tr>' +
      '<th>Preference</th><th>Why a clause cannot say it</th><th>What this roster achieved</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rwk-soft-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The feasibility frontier, and the three different things "no answer" can mean</div>' +
      '<div class="card-body"><table class="ref-table" id="rwk-frontier"><thead><tr>' +
      '<th>Nurses</th><th>Capacity</th><th>Shifts required</th><th>Clauses</th>' +
      '<th>What the solver said</th><th>Nodes</th><th>Wall clock</th><th>Schedule validates</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rwk-frontier-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Other scenarios, and the formulation each one is</div>' +
      '<div class="card-body"><table class="ref-table" id="rwk-catalogue"><thead><tr>' +
      '<th>Real problem</th><th>Formulation</th><th>What the mapping assumes</th>' +
      '<th>Where the model usually diverges</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rwk-catalogue-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
