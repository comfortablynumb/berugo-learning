/** Markup for "Derandomisation". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DerandomisationTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'drz-n', kind: 'range', label: 'vertices', value: 16, min: 10, max: 20, step: 2 },
    { id: 'drz-density', kind: 'select', label: 'edge density', value: '0.4',
      options: [
        { value: '0.25', label: '0.25 — sparse' },
        { value: '0.4', label: '0.4' },
        { value: '0.7', label: '0.7 — dense' }
      ] },
    { id: 'drz-trials', kind: 'select', label: 'random assignments drawn', value: '500',
      options: [
        { value: '200', label: '200' },
        { value: '500', label: '500' },
        { value: '2000', label: '2 000' }
      ] }
  ];

  const METRICS = [
    { id: 'drz-random', label: 'Random assignment', note: 'mean cut, and how often it misses |E|/2' },
    { id: 'drz-deterministic', label: 'Conditional expectations', note: 'one deterministic run, no coins' },
    { id: 'drz-space', label: 'Pairwise-independent space', note: 'best over the whole family' },
    { id: 'drz-exact', label: 'Exact maximum cut', note: 'by enumeration, for the ratio' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A graph and a trial budget', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Where the random cuts landed, and where the deterministic one is</div>' +
      '<div class="card-body"><div id="drz-chart" class="chart-host"></div>' +
      '<p class="note" id="drz-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Four ways to get a cut, and what each one guarantees</div>' +
      '<div class="card-body"><table class="ref-table" id="drz-compare"><thead><tr>' +
      '<th>Method</th><th>Cut</th><th>Fraction of the maximum</th><th>Random bits used</th>' +
      '<th>Assignments examined</th><th>Guarantee</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="drz-compare-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The conditional-expectation walk, vertex by vertex</div>' +
      '<div class="card-body"><table class="ref-table" id="drz-walk"><thead><tr>' +
      '<th>Vertex</th><th>Cut edges if side 0</th><th>Cut edges if side 1</th><th>Chose</th>' +
      '<th>Conditional expectation after</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="drz-walk-note"></p></div></div>' +
      '<div class="grid-even" style="margin-top:.875rem">' +
      '<div class="card"><div class="card-header">How independent the small family actually is</div>' +
      '<div class="card-body"><table class="ref-table" id="drz-profile"><thead><tr>' +
      '<th>Property</th><th>Worst deviation from uniform</th><th>Verdict</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="drz-profile-note"></p></div></div>' +
      '<div class="card"><div class="card-header">The same argument on MAX-SAT</div>' +
      '<div class="card-body"><table class="ref-table" id="drz-sat"><thead><tr>' +
      '<th>Method</th><th>Clauses satisfied</th><th>Against the expectation</th><th>Guarantee</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="drz-sat-note"></p></div></div>' +
      '</div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
