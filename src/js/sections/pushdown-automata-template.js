/** Markup for "Pushdown automata". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PdaTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'pda-machine', kind: 'select', label: 'the machine', value: 'brackets',
      options: [
        { value: 'brackets', label: 'balanced brackets, by empty stack' },
        { value: 'anbn', label: 'a to the n, b to the n' },
        { value: 'fromGrammar', label: 'built from a grammar by the CFG to PDA construction' }
      ] },
    { id: 'pda-grammar', kind: 'select', label: 'grammar for the construction', value: 'balanced',
      options: [
        { value: 'balanced', label: 'S to ( S ) S, or nothing' },
        { value: 'll1Ready', label: 'E to T R with R to + T R — right recursive' },
        { value: 'ambiguousSum', label: 'E to E + E, or a — left recursive' }
      ] },
    { id: 'pda-input', kind: 'text', label: 'the input, space separated', value: '( ( ) ) ( )',
      maxLength: 32 }
  ];

  const METRICS = [
    { id: 'pda-accept', label: 'Accepted', note: 'by empty stack, after the whole input' },
    { id: 'pda-configs', label: 'Configurations explored', note: 'state plus stack plus position' },
    { id: 'pda-depth', label: 'Deepest stack', note: 'the unbounded resource, actually used' },
    { id: 'pda-agrees', label: 'Agrees with Earley', note: 'over every string up to length 6' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Machine and input', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The stack beside the tape</div>' +
      '<div class="card-body"><div id="pda-tape" class="mono" style="font-size:.85rem"></div>' +
      '<p class="note" id="pda-tape-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The transition table</div>' +
      '<div class="card-body"><table class="ref-table" id="pda-transitions"><thead><tr>' +
      '<th>From</th><th>Read</th><th>Pop</th><th>Push</th><th>To</th><th>Why</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="pda-transitions-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Configurations explored in parallel</div>' +
      '<div class="card-body"><table class="ref-table" id="pda-trace"><thead><tr>' +
      '<th>Step</th><th>State</th><th>Stack, top first</th><th>Input consumed</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="pda-trace-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The construction checked against a general parser</div>' +
      '<div class="card-body"><table class="ref-table" id="pda-agreement"><thead><tr>' +
      '<th>Input</th><th>PDA</th><th>Earley</th><th>Agree</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="pda-agreement-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What the stack buys, and what it does not</div>' +
      '<div class="card-body"><table class="ref-table" id="pda-closure"><thead><tr>' +
      '<th>Operation</th><th>Regular languages</th><th>Context-free</th><th>Deterministic CFL</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="pda-closure-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
