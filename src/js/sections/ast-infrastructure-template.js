/** Markup for "AST infrastructure". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AstInfraTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ai-programs', kind: 'range', label: 'generated programs in the sweep',
      value: 2000, min: 250, max: 10000, step: 250,
      note: 'each one parsed, printed and reparsed' },
    { id: 'ai-depth', kind: 'range', label: 'maximum expression depth', value: 4,
      min: 2, max: 7, step: 1, note: 'deeper programs nest more and bracket more' },
    { id: 'ai-printer', kind: 'select', label: 'printer', value: 'both',
      options: [
        { value: 'both', label: 'both — the real one against a deliberately broken one' },
        { value: 'honest', label: 'the real printer alone' },
        { value: 'broken', label: 'the broken one alone — precedence ignored on the right' }
      ] },
    { id: 'ai-indent', kind: 'select', label: 'indent width', value: '  ',
      options: [
        { value: '  ', label: 'two spaces' },
        { value: '    ', label: 'four spaces' },
        { value: '\t', label: 'a tab' }
      ] }
  ];

  const METRICS = [
    { id: 'ai-checked', label: 'Programs round-tripped',
      note: 'parse, print, reparse, compare the trees' },
    { id: 'ai-failures', label: 'Round-trip failures',
      note: 'a tree that changed under printing' },
    { id: 'ai-caught', label: 'Caught by the broken printer',
      note: 'what the property is worth' },
    { id: 'ai-stable', label: 'Trees stable under reformatting',
      note: 'indent width changed, tree compared' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A sweep, and two printers', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">One program, printed and reparsed</div>' +
      '<div class="card-body"><table class="ref-table" id="ai-example"><thead><tr>' +
      '<th>Stage</th><th>Text</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ai-example-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The two printers on the same programs</div>' +
      '<div class="card-body"><table class="ref-table" id="ai-sabotage"><thead><tr>' +
      '<th>Printer</th><th>Checked</th><th>Round trips</th><th>Fails</th><th>Verdict</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ai-sabotage-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What the broken printer loses, and where</div>' +
      '<div class="card-body"><table class="ref-table" id="ai-difference"><thead><tr>' +
      '<th>Source</th><th>Printed</th><th>First difference</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ai-difference-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Traversal: what a visit costs and what it can answer</div>' +
      '<div class="card-body"><table class="ref-table" id="ai-visit"><thead><tr>' +
      '<th>Query</th><th>Answer</th><th>Nodes touched</th><th>How it is asked</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ai-visit-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The same tree under three formattings</div>' +
      '<div class="card-body"><table class="ref-table" id="ai-format"><thead><tr>' +
      '<th>Indent</th><th>Characters</th><th>Lines</th><th>Tree unchanged</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ai-format-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
