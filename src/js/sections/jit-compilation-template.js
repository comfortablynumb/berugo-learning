/** Markup for "JIT compilation". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.JitTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const SAMPLES = {
    hot: 'let t = 0;\nlet i = 0;\nwhile i < 400 { t = t + i * 2; i = i + 1; }',
    /* The deopt fixture: `plus` runs on numbers three hundred times, gets
       speculated on, and is then called with two strings. The guard fires. */
    deopt: 'fn plus(a, b) { return a + b; }\nlet t = 0;\nlet i = 0;\n'
      + 'while i < 300 { t = plus(t, i); i = i + 1; }\nlet s = plus("a", "b");',
    calls: 'fn step(a, b) { return a + b * 2; }\nlet t = 0;\nlet i = 0;\n'
      + 'while i < 200 { t = step(t, i); i = i + 1; }',
    cold: 'let a = 1;\nlet b = a + 2;\nlet c = b * 3;',
    nested: 'let t = 0;\nlet a = 0;\nwhile a < 20 {\n  let b = 0;\n'
      + '  while b < 20 { t = t + a * b; b = b + 1; }\n  a = a + 1;\n}'
  };

  const CONTROLS = [
    { id: 'jc-sample', kind: 'select', label: 'program', value: 'hot',
      options: [
        { value: 'hot', label: 'a hot loop — nothing ever leaves the function' },
        { value: 'deopt', label: 'numbers three hundred times, then two strings' },
        { value: 'calls', label: 'a function called in a loop' },
        { value: 'nested', label: 'two nested loops' },
        { value: 'cold', label: 'straight-line code — never gets warm' }
      ] },
    { id: 'jc-baseline', kind: 'range', label: 'baseline threshold', value: 20,
      min: 5, max: 200, step: 5, note: 'entries or back edges before the first compile' },
    { id: 'jc-optimise', kind: 'range', label: 'optimising threshold', value: 200,
      min: 20, max: 800, step: 20, note: 'and before the profile is speculated on' },
    { id: 'jc-speculate', kind: 'checkbox', label: 'speculate on the profile', value: true,
      note: 'the guards are what deoptimisation exists to undo' }
  ];

  const METRICS = [
    { id: 'jc-compiles', label: 'Compilations', note: 'each one is time not spent running' },
    { id: 'jc-fast', label: 'Guarded fast paths', note: 'instructions the profile justified' },
    { id: 'jc-deopts', label: 'Deoptimisations', note: 'a guard that did not hold' },
    { id: 'jc-agrees', label: 'Same answer as never compiling', note: 'value, output and bindings' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A program and a tiering policy', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Tier transitions along the dispatch axis</div>' +
      '<div class="card-body"><div id="jc-timeline" class="chart-host"></div>' +
      '<p class="note" id="jc-timeline-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every tier transition, and what caused it</div>' +
      '<div class="card-body"><table class="ref-table" id="jc-events"><thead><tr>' +
      '<th>At dispatch</th><th>Function</th><th>Tier</th><th>Why</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="jc-events-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The three tiers, and what each one costs to enter</div>' +
      '<div class="card-body"><table class="ref-table" id="jc-tiers"><thead><tr>' +
      '<th>Tier</th><th>What it is</th><th>Compile cost</th><th>Can be wrong about</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="jc-tiers-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The profile: what each speculated site actually saw</div>' +
      '<div class="card-body"><table class="ref-table" id="jc-profile"><thead><tr>' +
      '<th>Site</th><th>Samples</th><th>Kinds seen</th><th>Cache state</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="jc-profile-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Warm-up: the threshold against what it buys</div>' +
      '<div class="card-body"><table class="ref-table" id="jc-sweep"><thead><tr>' +
      '<th>Threshold</th><th>Compilations</th><th>Deopts</th><th>OSR transfers</th>' +
      '<th>Dispatches run compiled</th><th>Share</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="jc-sweep-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, SAMPLES: SAMPLES };
}));
