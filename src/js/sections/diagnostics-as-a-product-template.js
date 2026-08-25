/** Markup for "Diagnostics as a product". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DiagnosticsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const SAMPLES = {
    cascade: 'let s = "oops;\nlet n = valu + 1;\nlet b = 1 + true;',
    typo: 'let value = 1;\nlet doubled = valu * 2;',
    semicolon: 'let a = 1 let b = 2;',
    clean: 'let a = 1;\nfn twice(n) { return n * 2; }\nlet b = twice(a);',
    everything: 'let s = "oops;\nlet a = (1 + 2;\nlet b = c + 1;\nlet d = 1 + true;\nlet e = if 1 { 2 } else { 3 };'
  };

  const CONTROLS = [
    { id: 'dx-sample', kind: 'select', label: 'source', value: 'cascade',
      options: [
        { value: 'cascade', label: 'three mistakes in three stages' },
        { value: 'everything', label: 'five mistakes, one per stage and two in one' },
        { value: 'typo', label: 'a misspelled name with a fix available' },
        { value: 'semicolon', label: 'a missing semicolon with a fix available' },
        { value: 'clean', label: 'a program with nothing wrong' }
      ] },
    { id: 'dx-gate', kind: 'checkbox', label: 'gate later stages behind earlier failures',
      value: true, note: 'names resolved against a broken tree are guesses' },
    { id: 'dx-contain', kind: 'checkbox', label: 'drop a diagnostic inside another one',
      value: true },
    { id: 'dx-dedupe', kind: 'checkbox', label: 'drop the same code at the same span',
      value: true },
    { id: 'dx-editor', kind: 'range', label: 'cursor: the nth identifier', value: 0,
      min: 0, max: 30, step: 1, note: 'drives hover, definition and completion' }
  ];

  const METRICS = [
    { id: 'dx-raw', label: 'Diagnostics produced', note: 'before any suppression' },
    { id: 'dx-reported', label: 'Diagnostics reported', note: 'what the user is shown' },
    { id: 'dx-suppressed', label: 'Suppressed', note: 'and by which rule' },
    { id: 'dx-recheck', label: 'Stages rerun on the last edit',
      note: 'an unchanged file reuses everything' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A file, three rules and a cursor',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">What the editor would draw</div>' +
      '<div class="card-body"><div id="dx-source"></div>' +
      '<p class="note" id="dx-source-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The diagnostics, rendered</div>' +
      '<div class="card-body"><div id="dx-rendered"></div>' +
      '<p class="note" id="dx-rendered-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Everything produced, and what happened to it</div>' +
      '<div class="card-body"><table class="ref-table" id="dx-all"><thead><tr>' +
      '<th>Stage</th><th>Code</th><th>Where</th><th>Message</th><th>Kept</th><th>Dropped by</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dx-all-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Machine-applicable fixes, applied and rechecked</div>' +
      '<div class="card-body"><table class="ref-table" id="dx-fixes"><thead><tr>' +
      '<th>Program</th><th>Fix offered</th><th>Its diagnostic removed</th>' +
      '<th>File then clean</th><th>Result</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dx-fixes-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The editor questions, answered from the compiler tables</div>' +
      '<div class="card-body"><table class="ref-table" id="dx-editor-table"><thead><tr>' +
      '<th>Request</th><th>Answer</th><th>Which table answered it</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dx-editor-table-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The error suite: exactly one diagnostic each</div>' +
      '<div class="card-body"><table class="ref-table" id="dx-suite"><thead><tr>' +
      '<th>Program</th><th>Expected</th><th>Reported</th><th>Count</th><th>Suppressed</th>' +
      '<th>Correct</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dx-suite-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, SAMPLES: SAMPLES };
}));
