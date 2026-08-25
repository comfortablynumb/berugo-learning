/** Markup for "The untyped lambda calculus". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.UntypedLambdaTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'lam-term', kind: 'select', label: 'the term', value: 'plus two three',
      options: [
        { value: 'plus two three', label: 'plus two three — Church arithmetic' },
        { value: 'mult two three', label: 'mult two three' },
        { value: 'ignore omega', label: '(λx. λy. y) Ω — the argument that diverges' },
        { value: 'fst (pair a b)', label: 'fst (pair a b) — a Church pair' },
        { value: 'capture', label: '(λx. λy. x) y — the capture fixture' },
        { value: 'factorial 4', label: 'factorial 4, via the Y combinator' },
        { value: 'isZero (mult two zero)', label: 'isZero (mult two zero)' }
      ] },
    { id: 'lam-strategy', kind: 'select', label: 'reduction strategy', value: 'normal',
      options: [
        { value: 'normal', label: 'normal order — leftmost outermost' },
        { value: 'applicative', label: 'applicative order — leftmost innermost' },
        { value: 'callByName', label: 'call by name' },
        { value: 'callByValue', label: 'call by value' },
        { value: 'headSpine', label: 'head reduction' }
      ] },
    { id: 'lam-budget', kind: 'select', label: 'step budget', value: '2000',
      options: [
        { value: '50', label: '50 steps' },
        { value: '200', label: '200 steps' },
        { value: '2000', label: '2 000 steps' },
        { value: '40000', label: '40 000 steps' }
      ] }
  ];

  const METRICS = [
    { id: 'lam-steps', label: 'β-steps taken', note: 'one substitution each' },
    { id: 'lam-outcome', label: 'How it ended', note: 'normal form, budget or size cap' },
    { id: 'lam-result', label: 'What it means', note: 'read back as a number or a boolean' },
    { id: 'lam-renames', label: 'Binders renamed', note: 'every one avoided a capture' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Term, strategy and budget', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The same term under every strategy</div>' +
      '<div class="card-body"><table class="ref-table" id="lam-strategies"><thead><tr>' +
      '<th>Strategy</th><th>Picks</th><th>Steps</th><th>Ends</th><th>Result</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lam-strategies-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The reduction, one β-step per row</div>' +
      '<div class="card-body"><div id="lam-trace"></div>' +
      '<p class="note" id="lam-trace-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Substitution, and the binder it had to rename</div>' +
      '<div class="card-body"><table class="ref-table" id="lam-capture"><thead><tr>' +
      '<th>Term</th><th>Naive substitution</th><th>Capture-avoiding</th><th>Same?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lam-capture-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Church encodings, each reduced and read back</div>' +
      '<div class="card-body"><table class="ref-table" id="lam-church"><thead><tr>' +
      '<th>Term</th><th>Normal form</th><th>Steps</th><th>Reads back as</th><th>Expected</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lam-church-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Recursion with no recursion: factorial through Y</div>' +
      '<div class="card-body"><table class="ref-table" id="lam-factorial"><thead><tr>' +
      '<th>n</th><th>Normal form reads as</th><th>β-steps</th><th>Term size</th>' +
      '<th>Growth over the previous row</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lam-factorial-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
