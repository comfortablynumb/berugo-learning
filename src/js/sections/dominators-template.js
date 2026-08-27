/** Markup for "Dominators". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DominatorsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const SAMPLES = {
    branchInLoop: 'let t = 0;\nfor v in [1, 2, 3, 4] {\n  if v > 2 { t = t + v; } else { t = t - 1; }\n}',
    nested: 'let t = 0;\nfor a in [1, 2] {\n  for b in [3, 4] { t = t + a * b; }\n}',
    diamond: 'let a = 3;\nlet b = if a < 5 { a * 2 } else { a - 1 };\nlet c = b + 1;',
    chain: 'let a = 1;\nlet b = if a < 2 { 1 } else { 2 };\nlet c = if b < 2 { 3 } else { 4 };\nlet d = c + b;',
    early: 'fn find(xs) {\n  for v in xs { if v > 2 { return v; } else { } }\n  return 0;\n}\nlet r = find([1, 3, 5]);'
  };

  const CONTROLS = [
    { id: 'dm-sample', kind: 'select', label: 'program', value: 'branchInLoop',
      options: [
        { value: 'branchInLoop', label: 'a loop with a branch in its body' },
        { value: 'nested', label: 'two nested loops' },
        { value: 'diamond', label: 'one branch and a join — the simplest frontier' },
        { value: 'chain', label: 'two branches in sequence' },
        { value: 'early', label: 'a loop with an early return' }
      ] },
    { id: 'dm-block', kind: 'range', label: 'inspect the nth block', value: 1,
      min: 0, max: 20, step: 1,
      note: 'what it dominates, what dominates it, and where its frontier is' }
  ];

  const METRICS = [
    { id: 'dm-idom', label: 'Immediate dominator', note: 'the nearest block on every path here' },
    { id: 'dm-dominates', label: 'Blocks it dominates',
      note: 'every path to them passes through it' },
    { id: 'dm-frontier', label: 'Its dominance frontier',
      note: 'where its values stop being the only possibility' },
    { id: 'dm-rounds', label: 'Fixpoint rounds',
      note: 'reverse postorder converges in one pass plus a check' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A graph and one block of it', controls: CONTROLS }) +
      '<div class="card">' +
      '<div class="card-header">The graph, with the dominator tree drawn over it</div>' +
      '<div class="card-body"><div id="dm-graph" class="chart-host"></div>' +
      '<p class="note" id="dm-graph-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every block: its dominators, its immediate one, its frontier' +
      '</div>' +
      '<div class="card-body"><table class="ref-table" id="dm-table"><thead><tr>' +
      '<th>Block</th><th>Immediate dominator</th><th>Dominates</th><th>Frontier</th>' +
      '<th>Post-dominated by</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dm-table-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The iterative algorithm, round by round</div>' +
      '<div class="card-body"><table class="ref-table" id="dm-rounds-table"><thead><tr>' +
      '<th>Round</th><th>Blocks whose dominator changed</th><th>What it means</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dm-rounds-table-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Against a brute-force path-enumeration oracle</div>' +
      '<div class="card-body"><table class="ref-table" id="dm-oracle"><thead><tr>' +
      '<th>Block</th><th>Algorithm says</th><th>Oracle says</th><th>Agree</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dm-oracle-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The queries dominance answers</div>' +
      '<div class="card-body"><table class="ref-table" id="dm-queries"><thead><tr>' +
      '<th>Question an optimiser asks</th><th>The dominance form of it</th><th>Used by</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dm-queries-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, SAMPLES: SAMPLES };
}));
