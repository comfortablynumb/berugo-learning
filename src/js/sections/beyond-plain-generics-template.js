/** Markup for "Beyond plain generics". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TypeClassTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'tcl-goal', kind: 'select', label: 'the constraint to resolve',
      value: 'Eq (List (List Int))',
      options: [
        { value: 'Eq Int', label: 'Eq Int — a ground instance' },
        { value: 'Eq (List Int)', label: 'Eq (List Int)' },
        { value: 'Eq (List (List Int))', label: 'Eq (List (List Int))' },
        { value: 'Eq (Pair Int (List Bool))', label: 'Eq (Pair Int (List Bool))' },
        { value: 'Ord (List Int)', label: 'Ord (List Int) — a superclass underneath' },
        { value: 'Show (Pair (List Int) Bool)', label: 'Show (Pair (List Int) Bool)' },
        { value: 'Eq (List Double)', label: 'Eq (List Double) — no instance for the element' },
        { value: 'Num (List Int)', label: 'Num (List Int) — no instance at all' },
        { value: 'Show a', label: 'Show a — ambiguous' }
      ] },
    { id: 'tcl-superclasses', kind: 'select', label: 'superclass dictionaries', value: 'on',
      options: [
        { value: 'on', label: 'built into each dictionary' },
        { value: 'off', label: 'left out, so only the class itself resolves' }
      ] },
    { id: 'tcl-risky', kind: 'select', label: 'the two overlapping instances', value: 'off',
      options: [
        { value: 'off', label: 'not in scope' },
        { value: 'on', label: 'in scope, and coherence enforced' },
        { value: 'allow', label: 'in scope, and the most specific wins' }
      ] }
  ];

  const METRICS = [
    { id: 'tcl-dictionaries', label: 'Dictionaries built', note: 'all of them, at compile time' },
    { id: 'tcl-depth', label: 'Resolution depth', note: 'how far the instance chain goes' },
    { id: 'tcl-methods', label: 'Methods in scope', note: 'the class plus its superclasses' },
    { id: 'tcl-verdict', label: 'Verdict', note: 'resolved, ambiguous, overlapping or missing' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Constraint, superclasses and overlap',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">What the compiler inserts</div>' +
      '<div class="card-body"><div id="tcl-dictionary" class="mono" ' +
      'style="font-size:.85rem;word-break:break-all"></div>' +
      '<p class="note" id="tcl-dictionary-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The resolution tree</div>' +
      '<div class="card-body"><div id="tcl-tree"></div>' +
      '<p class="note" id="tcl-tree-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every goal, resolved or refused</div>' +
      '<div class="card-body"><table class="ref-table" id="tcl-goals"><thead><tr>' +
      '<th>Constraint</th><th>Dictionary</th><th>Count</th><th>Depth</th><th>Note</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tcl-goals-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Coherence: the same goal, three instance sets</div>' +
      '<div class="card-body"><table class="ref-table" id="tcl-coherence"><thead><tr>' +
      '<th>Instances in scope</th><th>Result</th><th>Dictionary chosen</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tcl-coherence-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The classes and their instances</div>' +
      '<div class="card-body"><table class="ref-table" id="tcl-instances"><thead><tr>' +
      '<th>Class</th><th>Head</th><th>Context</th><th>Defined in</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tcl-instances-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
