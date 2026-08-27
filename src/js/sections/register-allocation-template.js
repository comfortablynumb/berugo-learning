/** Markup for "Register allocation". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RegallocTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  /*
   * Every fixture allocates a FUNCTION with parameters rather than the top
   * level, and that is not presentation. `main` on a program of literals is
   * folded away by M29's SCCP before the allocator sees it, so the
   * interference graph is empty and the section measures nothing — which is
   * what the first version of this table did. A parameter is the cheapest
   * value this language has that no pass can prove constant.
   */
  const SAMPLES = {
    pressure: 'fn work(a, b, c, d) {\n  let e = a + b;\n  let f = c * d;\n'
      + '  let g = e * f;\n  return g + a + b + c + d;\n}\nlet r = work(1, 2, 3, 4);',
    loop: 'fn total(k, n) {\n  let t = 0;\n  let i = 0;\n'
      + '  while i < n { t = t + i * k * 2; i = i + 1; }\n  return t;\n}\n'
      + 'let r = total(3, 4);',
    branch: 'fn pick(a, b) {\n  let c = if a < b { a * 2 } else { b - 1 };\n'
      + '  let d = c + a;\n  return d * c + b;\n}\nlet r = pick(3, 5);',
    calls: 'fn step(a, b) { return a + b * 2; }\n'
      + 'fn run(n) {\n  let t = 0;\n  let i = 0;\n'
      + '  while i < n { t = step(t, i); i = i + 1; }\n  return t;\n}\nlet r = run(4);',
    straight: 'fn chain(a) {\n  let b = a + 2;\n  let c = b * 3;\n  return c - a;\n}\n'
      + 'let r = chain(1);'
  };

  const CONTROLS = [
    { id: 'ra-sample', kind: 'select', label: 'program', value: 'pressure',
      options: [
        { value: 'pressure', label: 'eight values live at once' },
        { value: 'loop', label: 'a loop with an invariant' },
        { value: 'branch', label: 'a branch and a join' },
        { value: 'calls', label: 'a call in a loop' },
        { value: 'straight', label: 'straight-line code — nothing interferes' }
      ] },
    { id: 'ra-registers', kind: 'range', label: 'machine registers', value: 4,
      min: 1, max: 12, step: 1, note: 'the whole allocator is a function of this number' },
    { id: 'ra-coalesce', kind: 'checkbox', label: 'coalesce moves', value: true,
      note: 'conservative, so it cannot make spilling worse' },
    { id: 'ra-split', kind: 'checkbox', label: 'split intervals on spill', value: true,
      note: 'what recovers most of linear scan\'s quality gap' }
  ];

  const METRICS = [
    { id: 'ra-spills', label: 'Points spent in memory',
      note: 'colouring against linear scan; a spill count is not comparable' },
    { id: 'ra-degree', label: 'Highest degree', note: 'the most-contended value' },
    { id: 'ra-values', label: 'Values to place', note: 'live ranges in the function' },
    { id: 'ra-sound', label: 'Independently verified', note: 'no two live values share one' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A function and a register file',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The interference graph, coloured</div>' +
      '<div class="card-body"><div id="ra-graph" class="chart-host"></div>' +
      '<p class="note" id="ra-graph-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The two allocators on this function</div>' +
      '<div class="card-body"><table class="ref-table" id="ra-compare"><thead><tr>' +
      '<th>Points in memory</th><th>Allocator</th><th>Spilled intervals</th><th>Splits</th>' +
      '<th>Moves coalesced</th><th>Values</th><th>Verified sound</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ra-compare-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Points spent in memory, against the number of registers</div>' +
      '<div class="card-body"><div id="ra-chart" class="chart-host"></div>' +
      '<p class="note" id="ra-chart-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every live range, its interference and where it landed</div>' +
      '<div class="card-body"><table class="ref-table" id="ra-ranges"><thead><tr>' +
      '<th>Value</th><th>Live from</th><th>To</th><th>Degree</th><th>Colouring</th>' +
      '<th>Linear scan</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ra-ranges-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every conformance program, both allocators, verified</div>' +
      '<div class="card-body"><table class="ref-table" id="ra-suite"><thead><tr>' +
      '<th>Program</th><th>Values</th><th>Colouring spills</th><th>Linear-scan spills</th>' +
      '<th>Both sound</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ra-suite-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, SAMPLES: SAMPLES };
}));
