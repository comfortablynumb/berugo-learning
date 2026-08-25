/** Markup for "Denotational and axiomatic semantics". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HoareTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'hoa-program', kind: 'select', label: 'the annotated program', value: 'sum',
      options: [
        { value: 'swap', label: 'swap through a temporary' },
        { value: 'swapNoTemp', label: 'swap without the temporary — the classic bug' },
        { value: 'max', label: 'max of two numbers' },
        { value: 'maxWrong', label: 'max with the wrong else branch' },
        { value: 'sum', label: 'sum 0..n−1, with the full invariant' },
        { value: 'sumNoBound', label: 'the same, without i ≤ n in the invariant' },
        { value: 'sumTooWeak', label: 'the same, with an invariant that says nothing' },
        { value: 'division', label: 'division by repeated subtraction' },
        { value: 'divisionNoBound', label: 'the same, without r ≥ 0' }
      ] },
    { id: 'hoa-low', kind: 'range', label: 'lowest value the checker considers',
      value: -2, min: -4, max: 0, step: 1 },
    { id: 'hoa-high', kind: 'range', label: 'highest value the checker considers',
      value: 5, min: 3, max: 8, step: 1 }
  ];

  const METRICS = [
    { id: 'hoa-proved', label: 'Triple discharged', note: 'over the whole bounded domain' },
    { id: 'hoa-obligations', label: 'Verification conditions', note: 'entry, preservation, exit' },
    { id: 'hoa-states', label: 'States examined', note: 'every assignment in the domain' },
    { id: 'hoa-runs', label: 'Concrete runs', note: 'the program actually executed' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Program and checking domain', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The program, with its specification</div>' +
      '<div class="card-body"><pre class="mono" id="hoa-source" ' +
      'style="font-size:.8rem;overflow-x:auto;margin:0"></pre>' +
      '<p class="note" id="hoa-source-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The verification conditions, each discharged or refuted</div>' +
      '<div class="card-body"><table class="ref-table" id="hoa-obligations-table"><thead><tr>' +
      '<th>Condition</th><th>Reads as</th><th>Holds</th><th>Counterexample</th>' +
      '<th>The part that is false</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="hoa-obligations-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Running the program, independently of the proof</div>' +
      '<div class="card-body"><table class="ref-table" id="hoa-runs-table"><thead><tr>' +
      '<th>Runs from a valid start state</th><th>Ended in the postcondition</th>' +
      '<th>Did not terminate</th><th>First failure</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="hoa-runs-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every program, proof against execution</div>' +
      '<div class="card-body"><table class="ref-table" id="hoa-sweep"><thead><tr>' +
      '<th>Program</th><th>Proof</th><th>Failing condition</th><th>Execution</th>' +
      '<th>What that combination means</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="hoa-sweep-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Why nobody computes wp through a loop</div>' +
      '<div class="card-body"><table class="ref-table" id="hoa-blowup"><thead><tr>' +
      '<th>Nested conditionals</th><th>Formula size</th><th>Growth</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="hoa-blowup-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
