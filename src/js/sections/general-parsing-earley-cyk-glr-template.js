/** Markup for "General parsing: Earley, CYK and GLR". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GeneralTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ear-grammar', kind: 'select', label: 'the grammar', value: 'ambiguousSum',
      options: [
        { value: 'ambiguousSum', label: 'E to E + E, or a — ambiguous, exponentially so' },
        { value: 'precedenceSum', label: 'E/T/F with precedence — unambiguous' },
        { value: 'nullable', label: 'S to A A A A with A nullable — breaks naive Earley' },
        { value: 'leftRecursive', label: 'E to E + T, or T — left recursive' },
        { value: 'balanced', label: 'balanced brackets — nullable and recursive' }
      ] },
    { id: 'ear-input', kind: 'text', label: 'the input, space separated', value: 'a + a + a',
      maxLength: 40 },
    { id: 'ear-column', kind: 'range', label: 'inspect chart column', value: 0, min: 0, max: 12,
      step: 1 }
  ];

  const METRICS = [
    { id: 'ear-accept', label: 'Accepted', note: 'Earley, CYK and GLR must agree' },
    { id: 'ear-trees', label: 'Distinct trees', note: 'unfolded from the forest, capped' },
    { id: 'ear-forest', label: 'Forest nodes', note: 'one per symbol and span, shared' },
    { id: 'ear-work', label: 'Chart items', note: 'the work Earley actually did' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Grammar, input and chart column', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Three general parsers on one input</div>' +
      '<div class="card-body"><table class="ref-table" id="ear-agree"><thead><tr>' +
      '<th>Parser</th><th>Verdict</th><th>Work</th><th>What it produced</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ear-agree-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The Earley chart, one column at a time</div>' +
      '<div class="card-body"><table class="ref-table" id="ear-chart"><thead><tr>' +
      '<th>Item</th><th>Origin</th><th>Added by</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ear-chart-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The shared packed parse forest</div>' +
      '<div class="card-body"><div id="ear-forest-view"></div>' +
      '<table class="ref-table" id="ear-packings"><thead><tr>' +
      '<th>Node</th><th>Derivations</th><th>Productions packed there</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ear-forest-note-2"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Sharing against unfolding, as the input grows</div>' +
      '<div class="card-body"><table class="ref-table" id="ear-growth"><thead><tr>' +
      '<th>Operands</th><th>Tokens</th><th>Forest nodes</th><th>Distinct trees</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ear-growth-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What generality costs</div>' +
      '<div class="card-body"><table class="ref-table" id="ear-costs"><thead><tr>' +
      '<th>Parser</th><th>Worst case</th><th>Unambiguous grammars</th><th>Accepts</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ear-costs-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
