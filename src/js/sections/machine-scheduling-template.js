/** Markup for "Scheduling and peephole at the machine level". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ScheduleTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const SAMPLES = {
    loads: 'fn sum(xs) {\n  let a = xs[0];\n  let b = xs[1];\n  let c = xs[2];\n'
      + '  return a + b + c;\n}\nlet r = sum([1, 2, 3]);',
    chain: 'fn chain(a) {\n  let b = a + 1;\n  let c = b * 2;\n  let d = c - 3;\n'
      + '  return d * d;\n}\nlet r = chain(4);',
    fields: 'fn read(p, q) {\n  let a = p.x;\n  let b = q.y;\n  let c = a * b;\n'
      + '  return c + p.x;\n}\nlet r = read({ x: 2, y: 3 }, { x: 4, y: 5 });',
    mixed: 'fn work(a, b, c, d) {\n  let e = a + b;\n  let f = c * d;\n  let g = e * f;\n'
      + '  return g + a + b + c + d;\n}\nlet r = work(1, 2, 3, 4);',
    loop: 'fn total(k, n) {\n  let t = 0;\n  let i = 0;\n'
      + '  while i < n { t = t + i * k * 2; i = i + 1; }\n  return t;\n}\n'
      + 'let r = total(3, 4);'
  };

  const CONTROLS = [
    { id: 'ms-sample', kind: 'select', label: 'program', value: 'loads',
      options: [
        { value: 'loads', label: 'three loads feeding one sum' },
        { value: 'chain', label: 'a dependence chain with no slack' },
        { value: 'fields', label: 'field loads and a store between them' },
        { value: 'mixed', label: 'independent work either side of a multiply' },
        { value: 'loop', label: 'a loop body' }
      ] },
    { id: 'ms-latency', kind: 'range', label: 'load latency, in cycles', value: 4,
      min: 1, max: 16, step: 1, note: 'every scheduler is mostly a load scheduler' },
    { id: 'ms-priority', kind: 'select', label: 'ready-list priority', value: 'critical',
      options: [
        { value: 'critical', label: 'longest path to the end first' },
        { value: 'source', label: 'source order — the control' }
      ] }
  ];

  const METRICS = [
    { id: 'ms-cycles', label: 'Cycles', note: 'source order against the schedule' },
    { id: 'ms-stalls', label: 'Stall cycles', note: 'waiting for a result to arrive' },
    { id: 'ms-peak', label: 'Peak register pressure', note: 'what the allocator is handed' },
    { id: 'ms-legal', label: 'Schedule legal', note: 'every dependence edge still points forward' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A block, a latency model, an order',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Cycles and pressure, both orders</div>' +
      '<div class="card-body"><div id="ms-chart" class="chart-host"></div>' +
      '<p class="note" id="ms-chart-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The pipeline, cycle by cycle</div>' +
      '<div class="card-body"><table class="ref-table" id="ms-timeline"><thead><tr>' +
      '<th>Step</th><th>Instruction</th><th>Issued at</th><th>Waited</th><th>Latency</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ms-timeline-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The dependence DAG, and why each edge is there</div>' +
      '<div class="card-body"><table class="ref-table" id="ms-dag"><thead><tr>' +
      '<th>Instruction</th><th>Depends on</th><th>Latency</th><th>Longest path to the end</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ms-dag-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every block in the function, both orders</div>' +
      '<div class="card-body"><table class="ref-table" id="ms-blocks"><thead><tr>' +
      '<th>Block</th><th>Instructions</th><th>Cycles before</th><th>Cycles after</th>' +
      '<th>Stalls removed</th><th>Peak pressure before</th><th>After</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ms-blocks-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The trade, as the latency rises</div>' +
      '<div class="card-body"><table class="ref-table" id="ms-sweep"><thead><tr>' +
      '<th>Load latency</th><th>Cycles scheduled</th><th>Cycles saved</th><th>Stalls left</th>' +
      '<th>Peak pressure</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ms-sweep-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, SAMPLES: SAMPLES };
}));
