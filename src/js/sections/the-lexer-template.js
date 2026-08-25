/** Markup for "The lexer". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LexerTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const SAMPLES = {
    tour: 'let n = 1_000.5e2;\nfn greet(who) {\n  // a comment is trivia, not a token\n  return "hi ${who}!";\n}\nlet msg = greet("world");',
    malformed: '// three bad literals, then two lines that scan perfectly\nlet s = "oops;\nlet n = 1.2.3;\nlet q = 0x1;\nlet ok = 1 + 2;\nlet msg = "ok=${ok}";',
    interpolation: 'let a = 1;\nlet t = "a=${a} sum=${a + a} nested=${ { x: a } }";',
    comments: '// leading comment\nlet a = 1; // trailing\n\n// a blank line above\nlet b = 2;'
  };

  const CONTROLS = [
    { id: 'lx-sample', kind: 'select', label: 'source', value: 'malformed',
      options: [
        { value: 'malformed', label: 'malformed input — three bad literals, then two good lines' },
        { value: 'tour', label: 'a tour — numbers, comments, interpolation' },
        { value: 'interpolation', label: 'interpolation, including a nested record' },
        { value: 'comments', label: 'comments and blank lines, all of it trivia' }
      ] },
    { id: 'lx-trivia', kind: 'checkbox', label: 'show trivia chips in the stream', value: true,
      note: 'a lexer that discards trivia cannot serve a formatter' },
    { id: 'lx-edit', kind: 'select', label: 'an edit, for the incremental relex', value: 'tail',
      options: [
        { value: 'tail', label: 'change a digit near the end' },
        { value: 'middle', label: 'insert a character in the middle' },
        { value: 'head', label: 'change the first token' }
      ] }
  ];

  const METRICS = [
    { id: 'lx-tokens', label: 'Tokens', note: 'real tokens, not counting trivia' },
    { id: 'lx-trivia-count', label: 'Trivia pieces',
      note: 'whitespace and comments, attached to the token that follows' },
    { id: 'lx-errors', label: 'Error tokens',
      note: 'scanning continued past every one of them' },
    { id: 'lx-reuse', label: 'Tokens reused on relex',
      note: 'everything before the last safe boundary at or before the edit' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Source, trivia and one edit', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The source, as the scanner sees it</div>' +
      '<div class="card-body"><div id="lx-source"></div>' +
      '<p class="note" id="lx-source-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The token stream</div>' +
      '<div class="card-body"><div id="lx-stream"></div>' +
      '<p class="note" id="lx-stream-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Error tokens, and what the scanner did next</div>' +
      '<div class="card-body"><table class="ref-table" id="lx-errors-table"><thead><tr>' +
      '<th>Code</th><th>Where</th><th>Text</th><th>Message</th><th>Next token</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lx-errors-table-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Numeric literal forms, accepted and rejected</div>' +
      '<div class="card-body"><table class="ref-table" id="lx-number-table"><thead><tr>' +
      '<th>Written</th><th>Kind</th><th>Value</th><th>Float</th><th>Why</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lx-number-table-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">One edit, and how much of the stream survives it</div>' +
      '<div class="card-body"><table class="ref-table" id="lx-relex-table"><thead><tr>' +
      '<th>Measure</th><th>Value</th><th>What it means</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lx-relex-table-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, SAMPLES: SAMPLES };
}));
