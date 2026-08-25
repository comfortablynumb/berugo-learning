/** Markup for "Operational semantics". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.OperationalTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ops-term', kind: 'select', label: 'the term', value: '(1 + 2) * (3 + 4)',
      options: [
        { value: '(1 + 2) * (3 + 4)', label: '(1 + 2) * (3 + 4) — two operands to choose from' },
        { value: '2 + 3 * 4', label: '2 + 3 * 4' },
        { value: 'if 2 < 3 then 10 else 20', label: 'if 2 < 3 then 10 else 20' },
        { value: 'if iszero 0 then 1 + 1 else true + 1',
          label: 'if iszero 0 then 1 + 1 else true + 1 — a stuck dead branch' },
        { value: 'pred (pred (2 + 3))', label: 'pred (pred (2 + 3))' },
        { value: 'if 1 then 2 else 3', label: 'if 1 then 2 else 3 — a number as a guard' },
        { value: 'true + 1', label: 'true + 1 — stuck immediately' }
      ] },
    { id: 'ops-rules', kind: 'select', label: 'the rule set', value: 'standard',
      options: [
        { value: 'standard', label: 'the standard rules' },
        { value: 'rightToLeft', label: 'operands right to left' },
        { value: 'eagerIf', label: 'if evaluates both branches' }
      ] }
  ];

  const METRICS = [
    { id: 'ops-steps', label: 'Small steps', note: 'one rule application each' },
    { id: 'ops-outcome', label: 'Where it ended', note: 'a value, or stuck' },
    { id: 'ops-deterministic', label: 'Deterministic', note: 'at most one rule ever applies' },
    { id: 'ops-agreement', label: 'Big step agrees', note: 'same value, or no derivation' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Term and rule set', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The rule set you selected</div>' +
      '<div class="card-body"><table class="ref-table" id="ops-rule-table"><thead><tr>' +
      '<th>Rule</th><th>Kind</th><th>Shape</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ops-rule-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The small-step trace, with the context that located each redex</div>' +
      '<div class="card-body"><table class="ref-table" id="ops-trace"><thead><tr>' +
      '<th>#</th><th>Term</th><th>Rule</th><th>Context E[·]</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ops-trace-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The big-step derivation of the same term</div>' +
      '<div class="card-body"><div id="ops-derivation"></div>' +
      '<p class="note" id="ops-derivation-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every fixture, both semantics, all three rule sets</div>' +
      '<div class="card-body"><table class="ref-table" id="ops-sweep"><thead><tr>' +
      '<th>Term</th><th>Standard</th><th>Right to left</th><th>Eager if</th>' +
      '<th>Rules that ever applied at once</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ops-sweep-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Stuck terms, and what each one would be at run time</div>' +
      '<div class="card-body"><table class="ref-table" id="ops-stuck"><thead><tr>' +
      '<th>Term</th><th>Small step ends at</th><th>Big step</th><th>What went wrong</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ops-stuck-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
