/** Markup for "Error recovery and diagnostics". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RecoveryTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'erc-source', kind: 'select', label: 'the broken source', value: 'three',
      options: [
        { value: 'three', label: 'three independent errors, four good statements' },
        { value: 'missing', label: 'one missing semicolon between two statements' },
        { value: 'cascade', label: 'a run of nonsense that invites a cascade' },
        { value: 'clean', label: 'nothing wrong — the control case' }
      ] },
    { id: 'erc-strategy', kind: 'select', label: 'recovery strategy', value: 'panic',
      options: [
        { value: 'stop', label: 'stop — report the first error and give up' },
        { value: 'panic', label: 'panic mode — skip to a synchronising token' },
        { value: 'repair', label: 'repair — insert or delete one token, by cost' }
      ] },
    { id: 'erc-window', kind: 'range', label: 'cascade suppression window, in tokens', value: 2,
      min: 0, max: 6, step: 1 }
  ];

  const METRICS = [
    { id: 'erc-errors', label: 'Diagnostics reported', note: 'one per real mistake, ideally' },
    { id: 'erc-suppressed', label: 'Cascades suppressed', note: 'the same mistake seen twice' },
    { id: 'erc-survived', label: 'Declarations recovered', note: 'what a language server still has' },
    { id: 'erc-repairs', label: 'Repairs applied', note: 'single-token insertions and deletions' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Source, strategy and window', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The source, with the errors marked</div>' +
      '<div class="card-body"><div id="erc-source-view" class="mono" ' +
      'style="font-size:.82rem"></div>' +
      '<p class="note" id="erc-source-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The diagnostics this strategy produced</div>' +
      '<div class="card-body"><table class="ref-table" id="erc-diagnostics"><thead><tr>' +
      '<th>At token</th><th>Message</th><th>Expected</th><th>Found</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="erc-diagnostics-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The three strategies side by side</div>' +
      '<div class="card-body"><table class="ref-table" id="erc-compare"><thead><tr>' +
      '<th>Strategy</th><th>Diagnostics</th><th>Suppressed</th><th>Declarations kept</th>' +
      '<th>Repairs</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="erc-compare-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What survived into the tree</div>' +
      '<div class="card-body"><table class="ref-table" id="erc-survivors"><thead><tr>' +
      '<th>Kind</th><th>Name</th><th>Value</th><th>Available to a language server</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="erc-survivors-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What makes a diagnostic useful</div>' +
      '<div class="card-body"><table class="ref-table" id="erc-quality"><thead><tr>' +
      '<th>Element</th><th>Bad</th><th>Good</th><th>Where it comes from</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="erc-quality-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
