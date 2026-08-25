/** Markup for "Type checking and inference". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TypeCheckTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const SAMPLES = {
    mismatch: 'let n = 1;\nlet flag = true;\nlet bad = n + flag;',
    polymorphic: 'fn id(x) { return x; }\nlet a = id(1);\nlet b = id(true);\nlet c = id("s");',
    branches: 'let a = if 1 < 2 { 10 } else { false };',
    record: 'let p = { x: 1, y: 2 };\nlet s = p.x + p.y;\nlet miss = p.z;',
    match: 'let opt = some(3);\nlet v = match opt {\n  some(n) => n + 1,\n};',
    closure: 'fn twice(f, x) { return f(f(x)); }\nlet r = twice(fn(n) => n * 2, 5);'
  };

  const CONTROLS = [
    { id: 'tc-sample', kind: 'select', label: 'program', value: 'mismatch',
      options: [
        { value: 'mismatch', label: 'a Bool where a Number was required' },
        { value: 'polymorphic', label: 'one function used at three types' },
        { value: 'branches', label: 'branches that disagree' },
        { value: 'record', label: 'a record, and a field it does not have' },
        { value: 'match', label: 'a match missing a case' },
        { value: 'closure', label: 'a higher-order function' }
      ] },
    { id: 'tc-only-errors', kind: 'checkbox', label: 'show only the constraints that failed',
      value: false, note: 'the failing one is what the message is about' }
  ];

  const METRICS = [
    { id: 'tc-final', label: 'Type of the program',
      note: 'the type of its last binding' },
    { id: 'tc-vars', label: 'Type variables invented',
      note: 'one per unannotated binder and per application' },
    { id: 'tc-constraints', label: 'Constraints solved',
      note: 'each is one equation between two types' },
    { id: 'tc-errors', label: 'Type errors', note: 'each carrying two spans' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A program to check', controls: CONTROLS }) +
      '<div class="card">' +
      '<div class="card-header">The two spans a mismatch reports</div>' +
      '<div class="card-body"><div id="tc-source"></div>' +
      '<p class="note" id="tc-source-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every expression, and the type it was given</div>' +
      '<div class="card-body"><table class="ref-table" id="tc-inline"><thead><tr>' +
      '<th>Expression</th><th>Node</th><th>Type</th><th>Where</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tc-inline-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The constraints, in the order the walk produced them</div>' +
      '<div class="card-body"><table class="ref-table" id="tc-constraint-table"><thead><tr>' +
      '<th>#</th><th>Found</th><th>Required</th><th>Solved</th><th>At</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tc-constraint-table-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The diagnostics, with both ends of the disagreement</div>' +
      '<div class="card-body"><table class="ref-table" id="tc-error-table"><thead><tr>' +
      '<th>Code</th><th>Message</th><th>This expression</th><th>Required by</th>' +
      '<th>Expected</th><th>Found</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tc-error-table-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What an annotation buys: the same mistake, twice</div>' +
      '<div class="card-body"><table class="ref-table" id="tc-annotation-table"><thead><tr>' +
      '<th>Program</th><th>Code</th><th>Blamed span</th><th>What is underlined</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tc-annotation-table-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The conformance suite, against the type each program should have' +
      '</div>' +
      '<div class="card-body"><table class="ref-table" id="tc-suite-table"><thead><tr>' +
      '<th>Program</th><th>Inferred</th><th>Expected</th><th>Agrees</th><th>Constraints</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tc-suite-table-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, SAMPLES: SAMPLES };
}));
