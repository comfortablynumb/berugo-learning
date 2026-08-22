/** Markup for "2-SAT and implication graphs". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TwoSatTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'tsat-model', kind: 'select', label: 'instance', value: 'scheduling',
      options: [{ value: 'scheduling', label: 'scheduling — tasks choosing one of two slots' },
        { value: 'random', label: 'random — two literals per clause, no structure' },
        { value: 'forced', label: 'forced — two variables pinned by unit clauses' },
        { value: 'at-most-one', label: 'at-most-one — a cardinality constraint, pairwise' }] },
    { id: 'tsat-vars', kind: 'range', label: 'variables', value: 8, min: 4, max: 14, step: 1 },
    { id: 'tsat-clauses', kind: 'range', label: 'conflicts or clauses', value: 6, min: 2, max: 20, step: 1 },
    { id: 'tsat-seed', kind: 'range', label: 'instance seed', value: 1, min: 1, max: 40, step: 1 },
    { id: 'tsat-relax', kind: 'range', label: 'three-literal clauses in the relaxation panel', value: 20, min: 10, max: 40, step: 5 }
  ];

  const METRICS = [
    { id: 'tsat-answer', label: 'Satisfiable?', note: 'read off the strongly connected components' },
    { id: 'tsat-components', label: 'Components', note: 'over twice as many literals as variables' },
    { id: 'tsat-oracle', label: 'Brute force agrees?', note: 'every assignment, tried' },
    { id: 'tsat-violated', label: 'Clauses the answer breaks', note: 'the assignment checked against the formula' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The formula', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The implication graph, grouped by component</div>' +
      '<div class="card-body"><div id="tsat-map"></div>' +
      '<p class="note" id="tsat-map-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every clause is two implications, and dropping either one breaks it</div>' +
      '<div class="card-body"><div id="tsat-implications"></div>' +
      '<p class="note" id="tsat-implications-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Reading the assignment off the condensation order</div>' +
      '<div class="card-body"><div id="tsat-assign"></div>' +
      '<p class="note" id="tsat-assign-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Where random instances stop being satisfiable</div>' +
      '<div class="card-body"><div id="tsat-chart"></div><div id="tsat-legend"></div>' +
      '<table class="ref-table" id="tsat-threshold"><thead><tr>' +
      '<th>Clauses per variable</th><th>Clauses</th><th>Satisfiable</th><th>Of</th><th>Rate</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tsat-threshold-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The wall: what an implication graph does with a three-literal clause</div>' +
      '<div class="card-body"><table class="ref-table" id="tsat-wall"><thead><tr>' +
      '<th>Three-literal clauses</th><th>Trials</th><th>Both agree satisfiable</th>' +
      '<th>Both agree unsatisfiable</th><th>Relaxation wrongly says no</th><th>Wrongly says yes</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tsat-wall-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
