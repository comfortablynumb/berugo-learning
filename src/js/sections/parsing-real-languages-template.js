/** Markup for "Parsing real languages". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RealLanguagesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'rlp-case', kind: 'select', label: 'the hard case', value: 'asi',
      options: [
        { value: 'asi', label: 'JavaScript — automatic semicolon insertion' },
        { value: 'typedef', label: 'C — the typedef ambiguity and the lexer hack' },
        { value: 'angles', label: 'C++ — nested template angle brackets' }
      ] },
    { id: 'rlp-fix', kind: 'select', label: 'the fix', value: 'applied',
      options: [
        { value: 'naive', label: 'off — parse it the way the grammar says' },
        { value: 'applied', label: 'on — apply what the language actually does' }
      ] },
    { id: 'rlp-source', kind: 'text', label: 'JavaScript source, newline as a backslash-n',
      value: 'return\\n1', maxLength: 40 },
    { id: 'rlp-typedef', kind: 'select', label: 'is x a typedef name?', value: 'yes',
      options: [
        { value: 'yes', label: 'yes — typedef int x; appeared earlier' },
        { value: 'no', label: 'no — x is a variable' }
      ] }
  ];

  const METRICS = [
    { id: 'rlp-verdict', label: 'What it parses as', note: 'with the fix on or off' },
    { id: 'rlp-differs', label: 'The fix changed the parse', note: 'the whole reason it exists' },
    { id: 'rlp-feedback', label: 'Information fed backwards', note: 'what breaks the clean layering' },
    { id: 'rlp-cases', label: 'ASI cases matching the spec', note: 'asserted, not illustrated' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Case, fix and input', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The input, and what came out</div>' +
      '<div class="card-body"><div id="rlp-result" class="mono" style="font-size:.85rem"></div>' +
      '<p class="note" id="rlp-result-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every semicolon the rule inserted, and why</div>' +
      '<div class="card-body"><table class="ref-table" id="rlp-inserted"><thead><tr>' +
      '<th>After</th><th>Before</th><th>Rule</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rlp-inserted-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The cases the specification pins down</div>' +
      '<div class="card-body"><table class="ref-table" id="rlp-asi"><thead><tr>' +
      '<th>Case</th><th>Source</th><th>Tokens after insertion</th><th>Matches the spec</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rlp-asi-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The gallery: every case, broken and then fixed</div>' +
      '<div class="card-body"><table class="ref-table" id="rlp-gallery"><thead><tr>' +
      '<th>Language</th><th>Construct</th><th>A naive parser gets</th><th>The fix that shipped</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rlp-gallery-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The engineering answers, and what each costs</div>' +
      '<div class="card-body"><table class="ref-table" id="rlp-answers"><thead><tr>' +
      '<th>Answer</th><th>How it works</th><th>Cost</th><th>Used by</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rlp-answers-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
