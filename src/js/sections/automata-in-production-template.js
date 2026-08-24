/** Markup for "Automata in production". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ProductionTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'prd-source', kind: 'select', label: 'the source to tokenise', value: 'if x >>= 12',
      options: [
        { value: 'if x >>= 12', label: 'if x >>= 12' },
        { value: 'int intx = 2', label: 'int intx = 2' },
        { value: 'x >> y', label: 'x >> y' },
        { value: 'if in int', label: 'if in int' },
        { value: 'xy012 >>>', label: 'xy012 >>>' }
      ] },
    { id: 'prd-pattern', kind: 'select', label: 'the pattern to analyse', value: '(a+)+b',
      options: [
        { value: '(a+)+b', label: '(a+)+b — the classic' },
        { value: '(a*)*b', label: '(a*)*b — star over a nullable star' },
        { value: '(a|a)*b', label: '(a|a)*b — identical branches' },
        { value: '(aa|a)*b', label: '(aa|a)*b — overlapping alternatives' },
        { value: 'a*b', label: 'a*b — the safe rewrite' },
        { value: '(ab)*c', label: '(ab)*c — unambiguous repetition' }
      ] }
  ];

  const METRICS = [
    { id: 'prd-tokens', label: 'Tokens produced', note: 'after maximal munch and priority' },
    { id: 'prd-longest', label: 'Longest match taken', note: 'where a shorter one already succeeded' },
    { id: 'prd-redos', label: 'ReDoS risk', note: 'from the structure, not from fuzzing' },
    { id: 'prd-ratio', label: 'Backtracking against simulation', note: 'steps for the same answer' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Source and pattern', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The tokens, and the attack string</div>' +
      '<div class="card-body"><div id="prd-summary"></div>' +
      '<p class="note" id="prd-summary-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Maximal munch, decision by decision</div>' +
      '<div class="card-body"><table class="ref-table" id="prd-scan"><thead><tr>' +
      '<th>At</th><th>Chosen rule</th><th>Text</th><th>Shorter matches passed over</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="prd-scan-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Priority: which rules match the same text</div>' +
      '<div class="card-body"><table class="ref-table" id="prd-priority"><thead><tr>' +
      '<th>Text</th><th>Rules that match it</th><th>Chosen</th><th>Why</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="prd-priority-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The ReDoS analyser over a set of known patterns</div>' +
      '<div class="card-body"><table class="ref-table" id="prd-analyser"><thead><tr>' +
      '<th>Pattern</th><th>Shape</th><th>Flagged</th><th>Expected</th><th>Why</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="prd-analyser-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The blow-up, measured against the simulation</div>' +
      '<div class="card-body"><table class="ref-table" id="prd-blowup"><thead><tr>' +
      '<th>Repeats</th><th>Input length</th><th>Backtracking steps</th><th>Simulation steps</th>' +
      '<th>Ratio</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="prd-blowup-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
