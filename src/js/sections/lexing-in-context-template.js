/** Markup for "Lexing in context". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LexModesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'lxc-source', kind: 'select', label: 'the source', value: 'nested',
      options: [
        { value: 'flat', label: 'a template with one interpolation' },
        { value: 'nested', label: 'a template with a template inside its interpolation' },
        { value: 'deep', label: 'three levels of nesting' }
      ] },
    { id: 'lxc-stack', kind: 'select', label: 'the lexer', value: 'stack',
      options: [
        { value: 'stack', label: 'with a mode stack' },
        { value: 'flat', label: 'without one — a single toggling mode' }
      ] },
    { id: 'lxc-indent', kind: 'select', label: 'indentation sample', value: 'blanks',
      options: [
        { value: 'blanks', label: 'blank lines and a comment inside a block' },
        { value: 'tabs', label: 'tabs and spaces that look identical' },
        { value: 'bad', label: 'a dedent to a column no block opened' }
      ] }
  ];

  const METRICS = [
    { id: 'lxc-tokens', label: 'Tokens produced', note: 'the two lexers on the same source' },
    { id: 'lxc-depth', label: 'Deepest mode stack', note: 'one is always 1 — that is the bug' },
    { id: 'lxc-interp', label: 'Interpolations found', note: 'the number the flat lexer misses' },
    { id: 'lxc-indent-errors', label: 'Indentation errors', note: 'a dedent matching no block' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Source, lexer and indentation', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The token stream</div>' +
      '<div class="card-body"><div id="lxc-tokens-view" class="mono" ' +
      'style="font-size:.8rem"></div>' +
      '<p class="note" id="lxc-tokens-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The mode stack as tokens are produced</div>' +
      '<div class="card-body"><table class="ref-table" id="lxc-stack-table"><thead><tr>' +
      '<th>At</th><th>Action</th><th>Stack</th><th>Depth</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lxc-stack-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">INDENT and DEDENT from an indentation stack</div>' +
      '<div class="card-body"><div id="lxc-indent-source" class="mono" ' +
      'style="font-size:.8rem"></div>' +
      '<table class="ref-table" id="lxc-indent-table"><thead><tr>' +
      '<th>Line</th><th>Column</th><th>Tokens emitted</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lxc-indent-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Maximal munch, and where it fails</div>' +
      '<div class="card-body"><table class="ref-table" id="lxc-munch"><thead><tr>' +
      '<th>Input</th><th>Operator set</th><th>Tokens</th><th>Right?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lxc-munch-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Where a language hides its context sensitivity</div>' +
      '<div class="card-body"><table class="ref-table" id="lxc-cases"><thead><tr>' +
      '<th>Language</th><th>The construct</th><th>What the lexer needs to know</th>' +
      '<th>How it is done</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lxc-cases-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
