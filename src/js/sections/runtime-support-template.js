/** Markup for "Runtime support". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RuntimeTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const SAMPLES = {
    fault: 'fn pick(xs, at) { return xs[at]; }\nfn go(xs) { return pick(xs, 5); }\n'
      + 'let r = go([1, 2]);',
    records: 'let r = { p: { x: 1 }, q: [1, 2] };\nlet v = r.p.x + r.q[1];',
    closures: 'fn adder(n) { return fn(x) => x + n; }\nlet inc = adder(1);\nlet r = inc(41);',
    loop: 'let acc = { total: 0 };\nlet t = 0;\nfor v in [1, 2, 3] { t = t + acc.total + v; }',
    calls: 'fn wrap(n) { return { value: n }; }\nfn sum(a, b) { return wrap(a).value + b; }\n'
      + 'let r = sum(1, 2);'
  };

  const CONTROLS = [
    { id: 'su-sample', kind: 'select', label: 'program', value: 'fault',
      options: [
        { value: 'fault', label: 'an index outside its array, two calls deep' },
        { value: 'records', label: 'a record holding a record and an array' },
        { value: 'closures', label: 'a closure allocated and called' },
        { value: 'loop', label: 'a record read inside a loop' },
        { value: 'calls', label: 'an allocation returned across a call' }
      ] },
    { id: 'su-mode', kind: 'select', label: 'instruction set', value: 'register',
      options: [
        { value: 'register', label: 'register — the map is a set of registers' },
        { value: 'stack', label: 'stack — the map is a stack depth' }
      ] }
  ];

  const METRICS = [
    { id: 'su-safepoints', label: 'Safepoints', note: 'calls and allocations need a map' },
    { id: 'su-mapped', label: 'Locations mapped', note: 'summed over every safepoint' },
    { id: 'su-missed', label: 'Live values the map missed', note: 'the direction that is a bug' },
    { id: 'su-spans', label: 'Instructions with a source span', note: 'carried from M28' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A program, its metadata and its trace',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The stack trace where it faulted</div>' +
      '<div class="card-body"><table class="ref-table" id="su-trace"><thead><tr>' +
      '<th>Depth</th><th>Function</th><th>Construct</th><th>Line</th><th>Locals held</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="su-trace-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The stack map at every safepoint</div>' +
      '<div class="card-body"><table class="ref-table" id="su-maps"><thead><tr>' +
      '<th>At</th><th>Instruction</th><th>Came from</th><th>Live registers</th>' +
      '<th>Slots</th><th>Stack depth</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="su-maps-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The source map: every instruction back to a line</div>' +
      '<div class="card-body"><table class="ref-table" id="su-source"><thead><tr>' +
      '<th>At</th><th>Instruction</th><th>Construct</th><th>Line</th><th>Source text</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="su-source-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The calling convention, written down</div>' +
      '<div class="card-body"><table class="ref-table" id="su-convention"><thead><tr>' +
      '<th>Rule</th><th>Why</th><th>What breaks without it</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="su-convention-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every conformance program, checked against a live run</div>' +
      '<div class="card-body"><table class="ref-table" id="su-suite"><thead><tr>' +
      '<th>Program</th><th>Safepoints</th><th>Reads observed after them</th>' +
      '<th>Missed by the map</th><th>Mapped but never read</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="su-suite-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, SAMPLES: SAMPLES };
}));
