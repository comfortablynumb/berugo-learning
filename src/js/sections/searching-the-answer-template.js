/** Markup for "Searching on the answer". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SearchingTheAnswerTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ans-problem', kind: 'select', label: 'problem', value: 'ships',
      options: [{ value: 'ships', label: 'minimum ship capacity in D days' },
        { value: 'books', label: 'allocate books to readers' },
        { value: 'cows', label: 'aggressive cows' },
        { value: 'divisor', label: 'smallest divisor under a threshold' }] },
    { id: 'ans-items', kind: 'range', label: 'items', value: 10, min: 4, max: 24, step: 1 },
    { id: 'ans-parts', kind: 'range', label: 'days / readers / cows', value: 5, min: 2, max: 12, step: 1 },
    { id: 'ans-seed', kind: 'range', label: 'instance seed (0 = the worked example)', value: 0,
      min: 0, max: 40, step: 1 }
  ];

  const METRICS = [
    { id: 'ans-answer', label: 'Answer', note: 'the boundary of the predicate' },
    { id: 'ans-checks', label: 'Feasibility checks', note: 'to find it' },
    { id: 'ans-span', label: 'Candidates', note: 'a sweep would test every one' },
    { id: 'ans-monotone', label: 'Predicate monotone', note: 'checked over the whole range' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The problem and its instance', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The boolean array the predicate induces</div>' +
      '<div class="card-body"><div id="ans-strip"></div>' +
      '<p class="note" id="ans-strip-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The search, one row per feasibility check</div>' +
      '<div class="card-body"><table class="ref-table" id="ans-trace"><thead><tr>' +
      '<th>Check</th><th>[low, high]</th><th>Candidate</th><th>Feasible</th><th>Interval after</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ans-trace-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Four problems, one shape</div>' +
      '<div class="card-body"><table class="ref-table" id="ans-problems"><thead><tr>' +
      '<th>Problem</th><th>The answer being searched for</th><th>Range</th>' +
      '<th>Checks</th><th>Sweep would take</th><th>Agrees with brute force</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ans-problems-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What monotonicity buys, and what a non-monotone predicate costs</div>' +
      '<div class="card-body"><table class="ref-table" id="ans-monotone-table"><thead><tr>' +
      '<th>Predicate</th><th>Flips</th><th>Monotone</th><th>Binary search answer</th><th>True answer</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ans-monotone-table-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
