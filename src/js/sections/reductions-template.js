/** Markup for "Reductions". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ReductionsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'rdx-name', kind: 'select', label: 'reduction', value: 'sat-to-independent-set',
      options: [
        { value: 'sat-to-independent-set', label: '3-SAT → independent set' },
        { value: 'sat-to-clique', label: '3-SAT → clique' },
        { value: 'sat-to-colouring', label: '3-SAT → 3-colouring' },
        { value: 'vertex-cover-to-set-cover', label: 'vertex cover → set cover' },
        { value: 'subset-sum-to-partition', label: 'subset sum → partition' }
      ] },
    { id: 'rdx-side', kind: 'select', label: 'source instance', value: 'yes',
      options: [
        { value: 'yes', label: 'a satisfiable source' },
        { value: 'no', label: 'an unsatisfiable source' }
      ] },
    { id: 'rdx-seed', kind: 'select', label: 'instance seed', value: '2',
      options: [
        { value: '2', label: 'seed 2' },
        { value: '5', label: 'seed 5' },
        { value: '9', label: 'seed 9' }
      ] }
  ];

  const METRICS = [
    { id: 'rdx-size', label: 'Target instance', note: 'what the gadgets built' },
    { id: 'rdx-steps', label: 'Solving the target', note: 'search steps in the target problem' },
    { id: 'rdx-answer', label: 'The two answers', note: 'source and target must agree' },
    { id: 'rdx-valid', label: 'Mapped back and checked', note: 'against the SOURCE instance' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'One reduction, end to end', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The target instance the gadgets built</div>' +
      '<div class="card-body"><div id="rdx-graph" class="chart-host"></div>' +
      '<p class="note" id="rdx-graph-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The four steps, and the one that is usually missing</div>' +
      '<div class="card-body"><table class="ref-table" id="rdx-flow"><thead><tr>' +
      '<th>Step</th><th>What it produced</th><th>Cost</th><th>What would go unnoticed without it</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rdx-flow-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The gadgets, clause by clause</div>' +
      '<div class="card-body"><table class="ref-table" id="rdx-gadgets"><thead><tr>' +
      '<th>Clause</th><th>Literals</th><th>Vertices it became</th><th>In the answer</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rdx-gadgets-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every reduction, round-tripped and validated</div>' +
      '<div class="card-body"><table class="ref-table" id="rdx-audit"><thead><tr>' +
      '<th>Reduction</th><th>Source answer</th><th>Target solved</th><th>Answers agree</th>' +
      '<th>Mapped answer valid in the source</th><th>Steps to solve the target</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rdx-audit-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
