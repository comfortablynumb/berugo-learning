/** Markup for "Subtyping and variance". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SubtypingTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'var-pair', kind: 'select', label: 'the subtyping question', value: '3',
      options: [
        { value: '0', label: '{x: Integer, y: Integer, c: String}  ≤  {x: Number, y: Number}' },
        { value: '1', label: '{y: Integer, x: Integer}  ≤  {x: Number, y: Number}' },
        { value: '2', label: '{x: Number}  ≤  {x: Integer} — depth the wrong way' },
        { value: '3', label: 'Number → Integer  ≤  Integer → Number' },
        { value: '4', label: 'Integer → Integer  ≤  Number → Number' },
        { value: '5', label: 'List<Integer>  ≤  List<Number> — covariant' },
        { value: '6', label: 'Ref<Integer>  ≤  Ref<Number> — invariant' },
        { value: '7', label: 'Sink<Number>  ≤  Sink<Integer> — contravariant' },
        { value: '8', label: 'Map<Integer, Integer>  ≤  Map<Number, Number>' },
        { value: '9', label: 'CovariantArray<Integer>  ≤  CovariantArray<Number>' }
      ] },
    { id: 'var-lattice', kind: 'select', label: 'a join and meet to compute', value: '0',
      options: [
        { value: '0', label: 'Integer and Double' },
        { value: '1', label: 'Integer and String' },
        { value: '2', label: '{x: Integer, y: String} and {x: Double, z: Boolean}' },
        { value: '3', label: '{x: Integer, y: String} and {x: Integer, z: Boolean}' }
      ] }
  ];

  const METRICS = [
    { id: 'var-verdict', label: 'Is it a subtype', note: 'derived from the rules' },
    { id: 'var-rule', label: 'The deciding rule', note: 'the outermost one applied' },
    { id: 'var-join', label: 'Least common supertype', note: 'what a conditional would infer' },
    { id: 'var-holes', label: 'Unsound pairs found', note: 'searched for, not asserted' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A pair of types, and a lattice question',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Variance, and what each container allows</div>' +
      '<div class="card-body"><table class="ref-table" id="var-table"><thead><tr>' +
      '<th>Container</th><th>Variance</th><th>C&lt;Integer&gt; ≤ C&lt;Number&gt;</th>' +
      '<th>C&lt;Number&gt; ≤ C&lt;Integer&gt;</th><th>Sound</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="var-table-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The derivation, with the argument position flipped</div>' +
      '<div class="card-body"><div id="var-derivation"></div>' +
      '<p class="note" id="var-derivation-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every question, and what the rules answer</div>' +
      '<div class="card-body"><table class="ref-table" id="var-questions"><thead><tr>' +
      '<th>Left</th><th>Right</th><th>Subtype</th><th>Rule</th><th>Why not</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="var-questions-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The covariant-array hole, with the value that breaks it</div>' +
      '<div class="card-body"><table class="ref-table" id="var-unsound"><thead><tr>' +
      '<th>The rule admits</th><th>Store a</th><th>What goes wrong</th>' +
      '<th>Invariant rejects it</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="var-unsound-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Joins and meets</div>' +
      '<div class="card-body"><table class="ref-table" id="var-lattice-table"><thead><tr>' +
      '<th>Left</th><th>Right</th><th>Join (⊔)</th><th>Meet (⊓)</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="var-lattice-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
