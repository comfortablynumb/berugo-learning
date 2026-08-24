/** Markup for "Bottom-up parsing: shift-reduce and LR(0)/SLR". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LrTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'slr-grammar', kind: 'select', label: 'the grammar', value: 'precedenceSum',
      options: [
        { value: 'leftRecursive', label: 'E to E + T, or T — left recursion is fine here' },
        { value: 'precedenceSum', label: 'E/T/F with precedence' },
        { value: 'danglingElse', label: 'if-then-else — one shift/reduce conflict' },
        { value: 'ambiguousSum', label: 'E to E + E, or a — ambiguous' },
        { value: 'balanced', label: 'balanced brackets' }
      ] },
    { id: 'slr-mode', kind: 'select', label: 'lookahead rule', value: 'slr',
      options: [
        { value: 'lr0', label: 'LR(0) — reduce on every terminal' },
        { value: 'slr', label: 'SLR(1) — reduce on FOLLOW of the left-hand side' }
      ] },
    { id: 'slr-input', kind: 'text', label: 'the input, space separated', value: 'a + a * a',
      maxLength: 40 },
    { id: 'slr-state', kind: 'range', label: 'inspect item set', value: 0, min: 0, max: 20,
      step: 1 }
  ];

  const METRICS = [
    { id: 'slr-states', label: 'Item sets', note: 'reachable states of the LR automaton' },
    { id: 'slr-conflicts', label: 'Conflicts', note: 'cells wanting two actions' },
    { id: 'slr-gain', label: 'What SLR removed', note: 'LR(0) conflicts FOLLOW resolves' },
    { id: 'slr-parse', label: 'Parse result', note: 'shift-reduce, no backtracking' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Grammar, lookahead and input', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">One item set, closed</div>' +
      '<div class="card-body"><div id="slr-items" class="mono" style="font-size:.82rem"></div>' +
      '<p class="note" id="slr-items-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The automaton of item sets</div>' +
      '<div class="card-body"><div id="slr-graph"></div>' +
      '<p class="note" id="slr-graph-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">ACTION and GOTO</div>' +
      '<div class="card-body"><div id="slr-table"></div>' +
      '<p class="note" id="slr-table-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The parse, stack against input</div>' +
      '<div class="card-body"><table class="ref-table" id="slr-trace"><thead><tr>' +
      '<th>Step</th><th>Stack</th><th>Remaining input</th><th>Action</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="slr-trace-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every conflict, with the items responsible</div>' +
      '<div class="card-body"><table class="ref-table" id="slr-conflict-table"><thead><tr>' +
      '<th>State and token</th><th>Kind</th><th>Competing actions</th><th>Items responsible</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="slr-conflict-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
