/** Markup for "Dataflow analysis". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DataflowTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const SAMPLES = {
    loop: 'let t = 0;\nfor v in [1, 2, 3] { t = t + v * 2; }',
    branch: 'let a = 3;\nlet b = if a < 5 { a * 2 } else { a - 1 };\nlet c = b + a;',
    both: 'let t = 0;\nfor v in [1, 2, 3, 4] {\n  if v > 2 { t = t + v; } else { t = t - 1; }\n}',
    reuse: 'let a = 1;\nlet b = 2;\nlet c = a + b;\nlet d = a + b;\nlet e = c + d;',
    straight: 'let a = 1;\nlet b = a + 2;\nlet c = b * 3;'
  };

  const CONTROLS = [
    { id: 'df-analysis', kind: 'select', label: 'analysis', value: 'liveness',
      options: [
        { value: 'liveness', label: 'liveness — backward, union' },
        { value: 'reaching', label: 'reaching definitions — forward, union' },
        { value: 'available', label: 'available expressions — forward, intersect' },
        { value: 'busy', label: 'very busy expressions — backward, intersect' }
      ] },
    { id: 'df-sample', kind: 'select', label: 'program', value: 'loop',
      options: [
        { value: 'loop', label: 'a loop' },
        { value: 'branch', label: 'a branch and a join' },
        { value: 'both', label: 'a branch inside a loop' },
        { value: 'reuse', label: 'the same expression computed twice' },
        { value: 'straight', label: 'straight-line code' }
      ] },
    { id: 'df-ssa', kind: 'checkbox', label: 'run SSA construction first', value: true,
      note: 'liveness over slots is a different question from liveness over registers' }
  ];

  const METRICS = [
    { id: 'df-direction', label: 'Direction and meet', note: 'the two halves of the framework' },
    { id: 'df-rounds', label: 'Worklist visits', note: 'a block is re-examined when a neighbour moves' },
    { id: 'df-facts', label: 'Facts at the fixpoint', note: 'summed over every block' },
    { id: 'df-oracle', label: 'Against the oracle', note: 'liveness by path enumeration' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'One algorithm, four lattices', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The graph, with the fact size per block</div>' +
      '<div class="card-body"><div id="df-graph" class="chart-host"></div>' +
      '<p class="note" id="df-graph-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The fixpoint: what holds at the start and end of each block' +
      '</div>' +
      '<div class="card-body"><table class="ref-table" id="df-sets"><thead><tr>' +
      '<th>Block</th><th>In</th><th>Out</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="df-sets-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The four analyses are one algorithm</div>' +
      '<div class="card-body"><table class="ref-table" id="df-framework"><thead><tr>' +
      '<th>Analysis</th><th>Direction</th><th>Meet</th><th>Initial value</th>' +
      '<th>What it answers</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="df-framework-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Liveness against a brute-force path enumeration</div>' +
      '<div class="card-body"><table class="ref-table" id="df-check"><thead><tr>' +
      '<th>Program</th><th>Blocks</th><th>Worklist visits</th><th>Live registers</th>' +
      '<th>Agrees with the oracle</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="df-check-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What the worklist saves over sweeping</div>' +
      '<div class="card-body"><table class="ref-table" id="df-cost"><thead><tr>' +
      '<th>Analysis</th><th>Visits</th><th>Blocks</th><th>Visits per block</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="df-cost-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, SAMPLES: SAMPLES };
}));
