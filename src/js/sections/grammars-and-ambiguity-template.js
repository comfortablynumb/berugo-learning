/** Markup for "Grammars, derivations and ambiguity". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GrammarsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'gra-grammar', kind: 'select', label: 'the grammar', value: 'ambiguousSum',
      options: [
        { value: 'ambiguousSum', label: 'E to E + E, or a — ambiguous' },
        { value: 'precedenceSum', label: 'E/T/F with precedence — unambiguous' },
        { value: 'danglingElse', label: 'if-then-else — ambiguous at one point' },
        { value: 'balanced', label: 'balanced brackets — unambiguous' }
      ] },
    { id: 'gra-input', kind: 'text', label: 'the input, space separated', value: 'a + a + a',
      maxLength: 40 },
    { id: 'gra-order', kind: 'select', label: 'derivation order', value: 'leftmost',
      options: [
        { value: 'leftmost', label: 'leftmost — expand the first nonterminal' },
        { value: 'rightmost', label: 'rightmost — expand the last nonterminal' }
      ] }
  ];

  const METRICS = [
    { id: 'gra-trees', label: 'Distinct parse trees', note: 'enumerated, not estimated' },
    { id: 'gra-verdict', label: 'Ambiguous on this input', note: 'more than one tree means yes' },
    { id: 'gra-steps', label: 'Derivation steps', note: 'one production applied per step' },
    { id: 'gra-shortest', label: 'Shortest ambiguous input', note: 'searched by length, then order' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Grammar and input', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The productions, and what they derive</div>' +
      '<div class="card-body"><div id="gra-rules" class="mono" style="font-size:.85rem"></div>' +
      '<p class="note" id="gra-rules-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every parse tree for this input</div>' +
      '<div class="card-body"><div id="gra-forest"></div>' +
      '<p class="note" id="gra-forest-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The derivation, one step at a time</div>' +
      '<div class="card-body"><table class="ref-table" id="gra-derivation"><thead><tr>' +
      '<th>Step</th><th>Sentential form</th><th>Production applied</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="gra-derivation-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Ambiguity across the shortest inputs</div>' +
      '<div class="card-body"><table class="ref-table" id="gra-sweep"><thead><tr>' +
      '<th>Input</th><th>Trees</th><th>Shapes</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="gra-sweep-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Grammar against language</div>' +
      '<div class="card-body"><table class="ref-table" id="gra-compare"><thead><tr>' +
      '<th>Grammar</th><th>Ambiguous</th><th>Shortest witness</th><th>Same language as</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="gra-compare-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
