/** Markup for "Control-flow graphs". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CfgTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const SAMPLES = {
    nested: 'let t = 0;\nfor a in [1, 2] {\n  for b in [3, 4] { t = t + a * b; }\n}',
    conditional: 'let t = 0;\nfor v in [1, 2, 3, 4] {\n  if v > 2 { t = t + v; } else { t = t - 1; }\n}',
    /* The `continue` is the whole fixture. Without it both arms of the `if`
       join before the latch and the loop has ONE back edge — which is what
       this sample used to be, under a name that promised two. A loop finder
       that treats each back edge as its own loop needs a program with two of
       them to be wrong on, and `continue` is the only way to write one. */
    twoLatches: 'let t = 0;\nlet i = 0;\nwhile i < 5 {\n  i = i + 1;\n  if i == 2 { continue; } else { t = t + i; }\n}',
    straight: 'let a = 1;\nlet b = a + 2;\nlet c = b * 3;',
    early: 'fn find(xs) {\n  for v in xs { if v > 2 { return v; } else { } }\n  return 0;\n}\nlet r = find([1, 3, 5]);'
  };

  const CONTROLS = [
    { id: 'cf-sample', kind: 'select', label: 'program', value: 'nested',
      options: [
        { value: 'nested', label: 'two nested loops' },
        { value: 'conditional', label: 'a loop with a branch in its body' },
        { value: 'twoLatches', label: 'one loop, two paths back to the header' },
        { value: 'early', label: 'a loop with an early return' },
        { value: 'straight', label: 'straight-line code — one block' },
        { value: 'handmade', label: 'a hand-built graph — Berugo cannot produce these' }
      ] },
    { id: 'cf-split', kind: 'checkbox', label: 'split critical edges', value: false,
      note: 'looks like bookkeeping, is a correctness requirement for SSA destruction' },
    { id: 'cf-block', kind: 'range', label: 'inspect the nth block', value: 0,
      min: 0, max: 20, step: 1 }
  ];

  const METRICS = [
    { id: 'cf-blocks', label: 'Blocks and edges', note: 'the graph the tree did not have' },
    { id: 'cf-loops', label: 'Natural loops', note: 'one per header, however many latches' },
    { id: 'cf-critical', label: 'Critical edges', note: 'no block runs on exactly that path' },
    { id: 'cf-reducible', label: 'Reducible', note: 'removing the back edges leaves a DAG' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A program and its graph', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The graph, loops shaded by depth</div>' +
      '<div class="card-body"><div id="cf-graph" class="chart-host"></div>' +
      '<p class="note" id="cf-graph-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every block: who reaches it, where it goes, how deep it is' +
      '</div>' +
      '<div class="card-body"><table class="ref-table" id="cf-blocks-table"><thead><tr>' +
      '<th>Block</th><th>From</th><th>To</th><th>Instructions</th><th>Loop depth</th>' +
      '<th>Header</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="cf-blocks-table-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The loops, found from their back edges</div>' +
      '<div class="card-body"><table class="ref-table" id="cf-loops-table"><thead><tr>' +
      '<th>Header</th><th>Latches</th><th>Blocks</th><th>Depth</th><th>Inside</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="cf-loops-table-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Loop membership, against a brute-force reachability oracle' +
      '</div>' +
      '<div class="card-body"><table class="ref-table" id="cf-oracle"><thead><tr>' +
      '<th>Header</th><th>Algorithm says</th><th>Oracle says</th><th>Agree</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="cf-oracle-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Simplification: what each one removes</div>' +
      '<div class="card-body"><table class="ref-table" id="cf-simplify"><thead><tr>' +
      '<th>Program</th><th>Blocks</th><th>Edges</th><th>Critical</th><th>Unreachable</th>' +
      '<th>Loops</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="cf-simplify-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, SAMPLES: SAMPLES };
}));
