/** Markup for "Loop optimisations". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LoopOptTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const SAMPLES = {
    trap: 'let d = 0;\nlet n = 0;\nlet acc = 0;\nwhile n < d {\n  acc = acc + 100 / d;\n  n = n + 1;\n}',
    invariant: 'let k = 3;\nlet t = 0;\nfor v in [1, 2, 3, 4] { t = t + v * k * 2; }',
    nested: 'let k = 5;\nlet t = 0;\nfor a in [1, 2] {\n  for b in [3, 4] { t = t + a * b * k; }\n}',
    guarded: 'let d = 4;\nlet n = 0;\nlet acc = 0;\nwhile n < 3 {\n  acc = acc + 100 / d;\n  n = n + 1;\n}',
    unswitch: 'let flag = true;\nlet t = 0;\nfor v in [1, 2, 3] {\n  if flag { t = t + v; } else { t = t - v; }\n}'
  };

  const CONTROLS = [
    { id: 'lo-sample', kind: 'select', label: 'program', value: 'trap',
      options: [
        { value: 'trap', label: 'a division whose guard is the loop condition' },
        { value: 'guarded', label: 'the same division, but the loop always runs' },
        { value: 'invariant', label: 'an invariant product inside the body' },
        { value: 'nested', label: 'two nested loops with an invariant in the inner one' },
        { value: 'unswitch', label: 'a loop-invariant branch inside the body' }
      ] },
    { id: 'lo-safe', kind: 'checkbox', label: 'check the fault condition before hoisting',
      value: true,
      note: 'turn this off and watch a working program divide by zero' }
  ];

  const METRICS = [
    { id: 'lo-hoisted', label: 'Computations hoisted', note: 'moved to the preheader' },
    { id: 'lo-refused', label: 'Refused', note: 'invariant, and not safe to speculate' },
    { id: 'lo-body', label: 'Loop body instructions', note: 'what the trip count multiplies' },
    { id: 'lo-agrees', label: 'Behaviour preserved', note: 'the whole question' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A loop, and one safety check', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The loop after the pass</div>' +
      '<div class="card-body"><div id="lo-listing"></div>' +
      '<p class="note" id="lo-listing-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Safe against naive, on the same program</div>' +
      '<div class="card-body"><table class="ref-table" id="lo-compare"><thead><tr>' +
      '<th>Version</th><th>Hoisted</th><th>Refused</th><th>Outcome before</th>' +
      '<th>Outcome after</th><th>Same answer</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lo-compare-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What was refused, and why</div>' +
      '<div class="card-body"><table class="ref-table" id="lo-refusals"><thead><tr>' +
      '<th>Register</th><th>Reason</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lo-refusals-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every loop: its cost, its invariants and its induction variables' +
      '</div>' +
      '<div class="card-body"><table class="ref-table" id="lo-loops"><thead><tr>' +
      '<th>Header</th><th>Depth</th><th>Body</th><th>Weighted</th><th>Invariant values</th>' +
      '<th>Induction variables</th><th>Exits</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lo-loops-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Induction variables, recognised from their phi</div>' +
      '<div class="card-body"><table class="ref-table" id="lo-induction"><thead><tr>' +
      '<th>Register</th><th>Starts at</th><th>Step</th><th>By</th><th>In the loop at</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lo-induction-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Unswitching opportunities, reported rather than taken</div>' +
      '<div class="card-body"><table class="ref-table" id="lo-unswitch"><thead><tr>' +
      '<th>Loop</th><th>Branch in</th><th>Invariant condition</th><th>Body size</th>' +
      '<th>Code after duplicating</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lo-unswitch-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, SAMPLES: SAMPLES };
}));
