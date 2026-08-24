/** Markup for "LALR and canonical LR(1)". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LalrTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'lal-grammar', kind: 'select', label: 'the grammar', value: 'nonLalr',
      options: [
        { value: 'nonLalr', label: 'S to a E c or a F d or b F c or b E d — LR(1) not LALR(1)' },
        { value: 'precedenceSum', label: 'E/T/F with precedence' },
        { value: 'danglingElse', label: 'if-then-else — the conflict every flavour keeps' },
        { value: 'balanced', label: 'balanced brackets' },
        { value: 'leftRecursive', label: 'E to E + T, or T' }
      ] },
    { id: 'lal-mode', kind: 'select', label: 'inspect which table', value: 'lalr',
      options: [
        { value: 'lr1', label: 'canonical LR(1) — a lookahead per item' },
        { value: 'lalr', label: 'LALR(1) — LR(1) states merged by core' },
        { value: 'slr', label: 'SLR(1) — FOLLOW of the left-hand side' },
        { value: 'lr0', label: 'LR(0) — no lookahead at all' }
      ] },
    { id: 'lal-input', kind: 'text', label: 'the input, space separated', value: 'a e c',
      maxLength: 32 }
  ];

  const METRICS = [
    { id: 'lal-states', label: 'States', note: 'this flavour against canonical LR(1)' },
    { id: 'lal-merged', label: 'Cores merged', note: 'LR(1) states pooled into one' },
    { id: 'lal-induced', label: 'Conflicts the merge caused', note: 'LALR minus LR(1)' },
    { id: 'lal-parse', label: 'Parse result', note: 'the table actually run on the input' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Grammar, flavour and input', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The four flavours on this grammar</div>' +
      '<div class="card-body"><table class="ref-table" id="lal-compare"><thead><tr>' +
      '<th>Flavour</th><th>States</th><th>Shift/reduce</th><th>Reduce/reduce</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lal-compare-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The states that merged, and what their lookaheads became</div>' +
      '<div class="card-body"><table class="ref-table" id="lal-merges"><thead><tr>' +
      '<th>LALR state</th><th>Merged from</th><th>Items with pooled lookaheads</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lal-merges-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The table for the selected flavour</div>' +
      '<div class="card-body"><div id="lal-table"></div>' +
      '<p class="note" id="lal-table-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every conflict, and whether the merge caused it</div>' +
      '<div class="card-body"><table class="ref-table" id="lal-conflicts"><thead><tr>' +
      '<th>State and token</th><th>Kind</th><th>Competing actions</th><th>Present in LR(1)</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lal-conflicts-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Choosing between them</div>' +
      '<div class="card-body"><table class="ref-table" id="lal-choice"><thead><tr>' +
      '<th>Technique</th><th>Table size</th><th>Grammars accepted</th><th>Used by</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lal-choice-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
