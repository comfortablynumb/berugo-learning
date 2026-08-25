/** Markup for "Semantic analysis and desugaring". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DesugarTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const SAMPLES = {
    forLoop: 'let total = 0;\nfor v in [1, 2, 3, 4] {\n  if v == 2 { continue; } else {};\n  total = total + v;\n}',
    shadowed: 'fn add(a, b) { return a * b; }\nlet s = add(3, 4) + 1;',
    guard: 'let d = 0;\nlet safe = d != 0 && 10 / d > 1;',
    match: 'let opt = some(7);\nlet out = match opt {\n  some(n) => n * 2,\n  none => 0,\n};',
    folding: 'let a = 2 * 3 + 4;\nlet b = a + 1 * 1;'
  };

  const CONTROLS = [
    { id: 'dg-sample', kind: 'select', label: 'program', value: 'forLoop',
      options: [
        { value: 'forLoop', label: 'a for loop with a continue — the case that breaks lowerings' },
        { value: 'shadowed', label: 'a user function called add, which the core also needs' },
        { value: 'guard', label: 'the guard idiom, which strict lowering divides by zero' },
        { value: 'match', label: 'a match with two arms' },
        { value: 'folding', label: 'arithmetic on literals' }
      ] },
    { id: 'dg-for', kind: 'checkbox', label: 'lower for loops to while loops', value: true },
    { id: 'dg-operators', kind: 'checkbox', label: 'lower operators to calls', value: true },
    { id: 'dg-match', kind: 'checkbox', label: 'lower match to nested tests', value: true },
    { id: 'dg-fold', kind: 'checkbox', label: 'fold arithmetic on literals', value: true }
  ];

  const METRICS = [
    { id: 'dg-rewrites', label: 'Rewrites applied', note: 'each one traceable to a source span' },
    { id: 'dg-size', label: 'Nodes, surface to core',
      note: 'lowering usually grows the tree' },
    { id: 'dg-agree', label: 'Surface and core agree',
      note: 'both run, and the value, output and bindings are compared' },
    { id: 'dg-spans', label: 'Synthesised nodes with an origin',
      note: 'a node with no origin points at code nobody wrote' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A program, and which lowerings run',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Surface on the left, core on the right</div>' +
      '<div class="card-body"><table class="ref-table" id="dg-compare"><thead><tr>' +
      '<th>Surface</th><th>Core</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dg-compare-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every rewrite, and the surface construct it came from</div>' +
      '<div class="card-body"><table class="ref-table" id="dg-rewrite-table"><thead><tr>' +
      '<th>Pass</th><th>From</th><th>To</th><th>Span kept</th><th>Produced</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dg-rewrite-table-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Both programs run, and compared</div>' +
      '<div class="card-body"><table class="ref-table" id="dg-behaviour"><thead><tr>' +
      '<th>Measure</th><th>Surface</th><th>Core</th><th>Same</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dg-behaviour-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The whole conformance suite, lowered and run both ways</div>' +
      '<div class="card-body"><table class="ref-table" id="dg-suite"><thead><tr>' +
      '<th>Program</th><th>Nodes</th><th>Core</th><th>Growth</th><th>Observations</th>' +
      '<th>Agree</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dg-suite-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Three lowerings that were wrong, and what each one did</div>' +
      '<div class="card-body"><table class="ref-table" id="dg-traps"><thead><tr>' +
      '<th>Program</th><th>Naive lowering</th><th>What went wrong</th><th>The fix</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dg-traps-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, SAMPLES: SAMPLES };
}));
