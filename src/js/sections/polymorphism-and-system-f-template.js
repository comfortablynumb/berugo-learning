/** Markup for "Polymorphism and System F". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SystemFTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'syf-term', kind: 'select', label: 'the term',
      value: 'λid: ∀a. a → a. mix (id [Nat] zero) (id [Bool] yes)',
      options: [
        { value: 'Λa. λx: a. x', label: 'Λa. λx: a. x — the polymorphic identity' },
        { value: '(Λa. λx: a. x) [Nat]', label: '(Λa. λx: a. x) [Nat] — specialised' },
        { value: '(Λa. λx: a. x) [Nat] zero', label: '(Λa. λx: a. x) [Nat] zero' },
        { value: 'Λa. λf: a → a. λx: a. f (f x)', label: 'Λa. λf: a → a. λx: a. f (f x)' },
        { value: 'λid: ∀a. a → a. mix (id [Nat] zero) (id [Bool] yes)',
          label: 'rank 2: an argument used at two types' },
        { value: 'λid: ∀a. a → a. id [∀b. b → b] id',
          label: 'self-application, typed at its own type' },
        { value: '(Λa. λx: a. x) [Nat] yes', label: '(Λa. λx: a. x) [Nat] yes — a mismatch' },
        { value: 'zero [Nat]', label: 'zero [Nat] — not a ∀ type' },
        { value: 'Λa. λx: a. succ x', label: 'Λa. λx: a. succ x — parametricity bites' }
      ] },
    { id: 'syf-type', kind: 'select', label: 'a type to enumerate the inhabitants of',
      value: '0', options: [
        { value: '0', label: '∀α. α → α' },
        { value: '1', label: '∀α β. α → β → α' },
        { value: '2', label: '∀α. α → α → α' },
        { value: '3', label: '∀α. α' },
        { value: '4', label: '∀α β. α → β' }
      ] }
  ];

  const METRICS = [
    { id: 'syf-type-of', label: 'The type', note: 'checked, with every ∀ written out' },
    { id: 'syf-nodes', label: 'Rules applied', note: 'nodes in the derivation' },
    { id: 'syf-erased', label: 'After erasure', note: 'what the runtime actually sees' },
    { id: 'syf-inhabitants', label: 'Inhabitants of the chosen type',
      note: 'closed normal forms, enumerated' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A term, and a type to explore', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Parametricity: what a function of this type ' +
      'can possibly do</div>' +
      '<div class="card-body"><table class="ref-table" id="syf-free"><thead><tr>' +
      '<th>Type</th><th>Inhabitants</th><th>What they are</th><th>The claim</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="syf-free-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The typing derivation</div>' +
      '<div class="card-body"><div id="syf-derivation"></div>' +
      '<p class="note" id="syf-derivation-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every fixture, accepted or rejected with a reason</div>' +
      '<div class="card-body"><table class="ref-table" id="syf-fixtures"><thead><tr>' +
      '<th>Term</th><th>Type or rejection</th><th>Expected</th><th>Agrees</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="syf-fixtures-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What erasure removes</div>' +
      '<div class="card-body"><table class="ref-table" id="syf-erasure"><thead><tr>' +
      '<th>Typed term</th><th>Erased</th><th>Characters</th><th>The type it had</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="syf-erasure-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The rank-2 term, in System F and in Hindley–Milner</div>' +
      '<div class="card-body"><table class="ref-table" id="syf-rank"><thead><tr>' +
      '<th>System</th><th>Term</th><th>Result</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="syf-rank-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
