/** Markup for "The memory-management landscape". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LandscapeTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  /** Fifty boxes allocated in a loop, two of them kept: churn plus a chain. */
  function loopSource(count) {
    const items = [];

    for (let at = 1; at <= count; at += 1) items.push(at);
    return 'fn box(v) { return { value: v, tag: 0 }; }\nlet keep = { a: 0, b: 0 };\n'
      + 'let t = 0;\nfor v in [' + items.join(', ') + '] '
      + '{ let o = box(v); keep = { a: o, b: keep.a }; t = t + o.value; }\nlet r = t;';
  }

  const CONTROLS = [
    { id: 'mml-workload', kind: 'select', label: 'workload', value: 'synthetic',
      options: [
        { value: 'synthetic', label: 'a generated trace long enough to measure' },
        { value: 'program', label: 'a real Berugo program, traced instruction by instruction' }
      ] },
    { id: 'mml-quarantine', kind: 'range', label: 'quarantine depth', value: 4,
      min: 0, max: 8, step: 1, note: 'frees a block waits before its address is reused' },
    { id: 'mml-survival', kind: 'range', label: 'survival rate of the generated trace',
      value: 15, min: 0, max: 60, step: 5, note: 'per cent of new objects that outlive their step' }
  ];

  const METRICS = [
    { id: 'mml-caught', label: 'Seeded faults the allocator names', note: 'of the ones planted' },
    { id: 'mml-missed', label: 'Faults that became a wrong answer', note: 'nothing reports these' },
    { id: 'mml-held', label: 'Bytes quarantine holds out of use', note: 'the price of the detector' },
    { id: 'mml-pause', label: 'Worst pause, tracing against counting',
      note: 'objects touched in one collection' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'One workload, three strategies', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Bytes held, as the program runs</div>' +
      '<div class="card-body"><div id="mml-chart" class="chart-host"></div>' +
      '<div id="mml-legend"></div><p class="note" id="mml-chart-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('mml-faults', 'The four ways manual management fails, and who prevents each',
        ['Failure', 'What happens', 'Reference counting', 'Tracing', 'Seen in this run']) +
      card('mml-quar', 'What a deeper quarantine catches, and what it costs',
        ['Depth', 'Caught', 'Missed', 'Bytes held', 'Addresses reused']) +
      card('mml-strategies', 'The triangle: throughput, latency, footprint',
        ['Strategy', 'Collections', 'p50 pause', 'p99 pause', 'Throughput',
          'Peak bytes', 'Dead at the end']) +
      card('mml-header', 'What every managed object pays before it holds anything',
        ['Component', 'Bytes', 'Why it exists', 'What it costs at this heap size']);
  }

  function card(id, title, columns) {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">' + title + '</div>' +
      '<div class="card-body"><table class="ref-table" id="' + id + '"><thead><tr>' +
      columns.map(function (name) { return '<th>' + name + '</th>'; }).join('') +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="' + id + '-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, loopSource: loopSource };
}));
