/** Markup for "Type inference and Hindley–Milner". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HmTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'hmi-term', kind: 'select', label: 'the term (no annotations anywhere)',
      value: 'let id = λx. x in pair (id 3) (id true)',
      options: [
        { value: 'λx. x', label: 'λx. x' },
        { value: 'λf. λx. f (f x)', label: 'λf. λx. f (f x)' },
        { value: 'λf. λg. λx. f (g x)', label: 'λf. λg. λx. f (g x) — composition' },
        { value: 'let id = λx. x in pair (id 3) (id true)',
          label: 'let id = λx. x in pair (id 3) (id true)' },
        { value: 'λid. pair (id 3) (id true)',
          label: 'λid. pair (id 3) (id true) — the same body, lambda-bound' },
        { value: 'λx. x x', label: 'λx. x x — the occurs check' },
        { value: 'if isZero 0 then 1 else true',
          label: 'if isZero 0 then 1 else true — branches disagree' },
        { value: 'λl. add (length l) 1', label: 'λl. add (length l) 1' },
        { value: 'let f = λx. x in pair (f (λy. y)) (f "s")',
          label: 'let f = λx. x in pair (f (λy. y)) (f "s")' }
      ] },
    { id: 'hmi-unify', kind: 'select', label: 'a unification problem on its own',
      value: '0', options: [
        { value: '0', label: 'a → b  ~  Number → Boolean' },
        { value: '1', label: 'a → a  ~  Number → Boolean' },
        { value: '2', label: 'a  ~  a → b — the occurs check' },
        { value: '3', label: 'List a  ~  List Number' },
        { value: '4', label: 'List a  ~  Pair a b' },
        { value: '5', label: '(a → b) → a  ~  (Number → c) → d' }
      ] }
  ];

  const METRICS = [
    { id: 'hmi-scheme', label: 'The principal type', note: 'the most general one, up to renaming' },
    { id: 'hmi-fresh', label: 'Type variables invented', note: 'one per binder and per application' },
    { id: 'hmi-unifications', label: 'Unification problems', note: 'equations solved along the way' },
    { id: 'hmi-verdict', label: 'Verdict', note: 'inferred, or the reason it could not be' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A term, and a unification problem',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Unifying two types, step by step</div>' +
      '<div class="card-body"><table class="ref-table" id="hmi-unify-table"><thead><tr>' +
      '<th>#</th><th>Left</th><th>Right</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="hmi-unify-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Algorithm W, one line per rule it applied</div>' +
      '<div class="card-body"><table class="ref-table" id="hmi-log"><thead><tr>' +
      '<th>#</th><th>Rule</th><th>What it did</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="hmi-log-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every equation unification was asked to solve</div>' +
      '<div class="card-body"><table class="ref-table" id="hmi-equations"><thead><tr>' +
      '<th>#</th><th>Left</th><th>Right</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="hmi-equations-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The whole fixture set, against the type each one should have</div>' +
      '<div class="card-body"><table class="ref-table" id="hmi-fixtures"><thead><tr>' +
      '<th>Term</th><th>Inferred</th><th>Expected</th><th>Agrees</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="hmi-fixtures-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What generalisation at let is worth</div>' +
      '<div class="card-body"><table class="ref-table" id="hmi-contrast"><thead><tr>' +
      '<th>Term</th><th>Result</th><th>Why</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="hmi-contrast-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
