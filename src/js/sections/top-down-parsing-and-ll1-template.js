/** Markup for "Top-down parsing and LL(1)". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LlTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'llp-grammar', kind: 'select', label: 'the grammar', value: 'leftRecursive',
      options: [
        { value: 'll1Ready', label: 'E to T R, R to + T R or nothing — LL(1)' },
        { value: 'leftRecursive', label: 'E to E + T, or T — left recursive' },
        { value: 'precedenceSum', label: 'E/T/F with precedence — left recursive twice' },
        { value: 'danglingElse', label: 'if-then-else — a shared prefix' },
        { value: 'balanced', label: 'balanced brackets — LL(1) already' }
      ] },
    { id: 'llp-input', kind: 'text', label: 'the input, space separated', value: 'a + a + a',
      maxLength: 40 },
    { id: 'llp-fix', kind: 'select', label: 'apply before building the table', value: 'none',
      options: [
        { value: 'none', label: 'nothing — build the table as written' },
        { value: 'left-recursion', label: 'eliminate left recursion' },
        { value: 'left-factor', label: 'left factor shared prefixes' },
        { value: 'both', label: 'eliminate left recursion, then left factor' }
      ] }
  ];

  const METRICS = [
    { id: 'llp-isll1', label: 'LL(1)', note: 'no cell holds two productions' },
    { id: 'llp-conflicts', label: 'Table conflicts', note: 'each with the two rules that collide' },
    { id: 'llp-cause', label: 'Why it conflicts', note: 'left recursion, shared prefix or nullable' },
    { id: 'llp-parse', label: 'Parse result', note: 'predictive, one token of lookahead' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Grammar, input and repair', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">FIRST and FOLLOW, which the table is made of</div>' +
      '<div class="card-body"><table class="ref-table" id="llp-sets"><thead><tr>' +
      '<th>Nonterminal</th><th>Nullable</th><th>FIRST</th><th>FOLLOW</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="llp-sets-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The LL(1) table, with every cell traceable</div>' +
      '<div class="card-body"><div id="llp-table"></div>' +
      '<p class="note" id="llp-table-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The predictive parse, stack against input</div>' +
      '<div class="card-body"><table class="ref-table" id="llp-trace"><thead><tr>' +
      '<th>Step</th><th>Stack, top first</th><th>Remaining input</th><th>Action</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="llp-trace-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Each conflict, with a minimal input that reaches it</div>' +
      '<div class="card-body"><table class="ref-table" id="llp-conflict-table"><thead><tr>' +
      '<th>Cell</th><th>Competing productions</th><th>Reason</th><th>Minimal input</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="llp-conflict-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What each repair does to the table</div>' +
      '<div class="card-body"><table class="ref-table" id="llp-repairs"><thead><tr>' +
      '<th>Repair</th><th>Productions</th><th>Conflicts</th><th>LL(1)</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="llp-repairs-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
