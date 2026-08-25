/** Markup for "The simply typed lambda calculus". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StlcTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'stl-term', kind: 'select', label: 'the term',
      value: 'λf: Number → Number. λx: Number. f (f x)',
      options: [
        { value: 'λx: Number. x', label: 'λx: Number. x' },
        { value: '(λx: Number. x) 3', label: '(λx: Number. x) 3' },
        { value: '(λx: Number. x) true', label: '(λx: Number. x) true — a mismatch' },
        { value: 'λf: Number → Number. λx: Number. f (f x)',
          label: 'λf: Number → Number. λx: Number. f (f x)' },
        { value: 'if true then 1 else false',
          label: 'if true then 1 else false — the branches disagree' },
        { value: 'let y = 3 in y', label: 'let y = 3 in y' },
        { value: 'λx: Number. x x', label: 'λx: Number. x x — self-application' },
        { value: 'λr: { a: Number }. r.b', label: 'λr: { a: Number }. r.b — no such field' },
        { value: '3 4', label: '3 4 — a Number is not a function' }
      ] },
    { id: 'stl-sample', kind: 'range', label: 'extra sampled terms for the soundness sweep',
      value: 2000, min: 0, max: 8000, step: 1000 }
  ];

  const METRICS = [
    { id: 'stl-type', label: 'The type', note: 'derived, not declared' },
    { id: 'stl-height', label: 'Derivation height', note: 'how deep the proof goes' },
    { id: 'stl-nodes', label: 'Rules applied', note: 'nodes in the derivation tree' },
    { id: 'stl-stuck', label: 'Well-typed and stuck', note: 'must be zero, or the system is unsound' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Term and sweep size', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The verdict</div>' +
      '<div class="card-body"><div id="stl-verdict" class="mono" ' +
      'style="font-size:.85rem;word-break:break-word"></div>' +
      '<p class="note" id="stl-verdict-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The typing derivation</div>' +
      '<div class="card-body"><div id="stl-derivation"></div>' +
      '<p class="note" id="stl-derivation-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every fixture, with the rule that failed</div>' +
      '<div class="card-body"><table class="ref-table" id="stl-fixtures"><thead><tr>' +
      '<th>Term</th><th>Verdict</th><th>Type or failing rule</th><th>Expected</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="stl-fixtures-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Progress and preservation, checked by exhaustion</div>' +
      '<div class="card-body"><table class="ref-table" id="stl-soundness"><thead><tr>' +
      '<th></th><th>Ran to a value</th><th>Got stuck</th><th>Total</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="stl-soundness-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The typing rules</div>' +
      '<div class="card-body"><table class="ref-table" id="stl-rules"><thead><tr>' +
      '<th>Rule</th><th>Premises</th><th>Conclusion</th><th>Reads as</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="stl-rules-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
