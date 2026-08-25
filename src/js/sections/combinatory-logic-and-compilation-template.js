/** Markup for "Combinatory logic and compilation". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CombinatorsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'cmb-term', kind: 'select', label: 'the lambda term', value: 'λf x. f (f x)',
      options: [
        { value: 'λx. x', label: 'λx. x — the identity' },
        { value: 'λx y. x', label: 'λx y. x — keep the first' },
        { value: 'λx y. y', label: 'λx y. y — keep the second' },
        { value: 'λf x. f (f x)', label: 'λf x. f (f x) — apply twice' },
        { value: 'λf g x. f (g x)', label: 'λf g x. f (g x) — composition' },
        { value: 'λx y z. x z (y z)', label: 'λx y z. x z (y z) — S itself' },
        { value: 'λa b c d. a b c d', label: 'λa b c d. a b c d — four parameters' }
      ] },
    { id: 'cmb-optimise', kind: 'select', label: 'bracket abstraction', value: 'on',
      options: [
        { value: 'on', label: 'with Schönfinkel\'s optimisations' },
        { value: 'off', label: 'the plain four-case algorithm' }
      ] },
    { id: 'cmb-args', kind: 'select', label: 'apply the result to', value: 'three arguments',
      options: [
        { value: 'nothing', label: 'nothing — just compile it' },
        { value: 'one argument', label: 'one argument (p)' },
        { value: 'two arguments', label: 'two arguments (p q)' },
        { value: 'three arguments', label: 'three arguments (p q r)' }
      ] }
  ];

  const METRICS = [
    { id: 'cmb-size', label: 'Compiled size', note: 'nodes in the combinator term' },
    { id: 'cmb-blowup', label: 'Cost of compiling', note: 'compiled size over the original' },
    { id: 'cmb-steps', label: 'Reduction steps', note: 'firing S, K and I on the spine' },
    { id: 'cmb-agree', label: 'Agrees with the λ-term', note: 'same normal form, checked' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Term, algorithm and arguments', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The compiled term</div>' +
      '<div class="card-body"><div id="cmb-output" class="mono" ' +
      'style="font-size:.85rem;word-break:break-all"></div>' +
      '<p class="note" id="cmb-output-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Bracket abstraction, one rule per row</div>' +
      '<div class="card-body"><table class="ref-table" id="cmb-steps-table"><thead><tr>' +
      '<th>#</th><th>Rule applied</th><th>Result of that step</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="cmb-steps-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Graph reduction of the compiled term</div>' +
      '<div class="card-body"><div id="cmb-trace"></div>' +
      '<p class="note" id="cmb-trace-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Does the compiled term compute the same function?</div>' +
      '<div class="card-body"><table class="ref-table" id="cmb-agreement"><thead><tr>' +
      '<th>Source term</th><th>Compiled to</th><th>λ-calculus result</th>' +
      '<th>Combinator result</th><th>Agree</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="cmb-agreement-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What the optimisations are worth</div>' +
      '<div class="card-body"><table class="ref-table" id="cmb-blowup-table"><thead><tr>' +
      '<th>Term</th><th>λ-size</th><th>Plain algorithm</th><th>Optimised</th><th>Ratio</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="cmb-blowup-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The combinators, and what each one does</div>' +
      '<div class="card-body"><table class="ref-table" id="cmb-rules"><thead><tr>' +
      '<th>Combinator</th><th>Arity</th><th>Rule</th><th>Reads as</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="cmb-rules-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
