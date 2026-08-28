/** Markup for "Avoiding the collector". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AvoidTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function items(count) {
    const rows = [];

    for (let at = 1; at <= count; at += 1) rows.push(at);
    return '[' + rows.join(', ') + ']';
  }

  /**
   * Three programs, one answer. They are written as one function of the
   * iteration count so the sweep can grow them without the source and the
   * measurement drifting apart.
   */
  function sources(count) {
    return {
      heavy: 'fn box(v) { return { value: v, tag: 0 }; }\n'
        + 'fn pair(a, b) { return { lo: a, hi: b }; }\n'
        + 'let acc = pair(0, 0);\n'
        + 'for v in ' + items(count) + ' { let b = box(v); '
        + 'acc = pair(acc.lo + b.value, acc.hi + 1); }\nlet r = acc.lo;',
      pooled: 'fn pair(a, b) { return { lo: a, hi: b }; }\n'
        + 'let lo = 0;\nlet hi = 0;\n'
        + 'for v in ' + items(count) + ' { lo = lo + v; hi = hi + 1; }\n'
        + 'let out = pair(lo, hi);\nlet r = out.lo;',
      light: 'let lo = 0;\nlet hi = 0;\n'
        + 'for v in ' + items(count) + ' { lo = lo + v; hi = hi + 1; }\nlet r = lo;'
    };
  }

  const NAMES = {
    heavy: 'a record per iteration, and a new accumulator each time',
    pooled: 'the same loop with one record built at the end',
    light: 'no records at all'
  };

  const CONTROLS = [
    { id: 'avc-count', kind: 'range', label: 'iterations', value: 40,
      min: 10, max: 80, step: 10, note: 'the loop the three programs share' },
    { id: 'avc-program', kind: 'select', label: 'programme to inspect', value: 'heavy',
      options: [
        { value: 'heavy', label: 'allocation-heavy' },
        { value: 'pooled', label: 'one allocation at the end' },
        { value: 'light', label: 'allocation-free' }
      ] },
    { id: 'avc-collector', kind: 'select', label: 'collector', value: 'generational',
      options: [
        { value: 'generational', label: 'generational copying' },
        { value: 'mark-sweep', label: 'stop-the-world mark-sweep' },
        { value: 'refcount', label: 'reference counting' }
      ] }
  ];

  const METRICS = [
    { id: 'avc-allocs', label: 'Allocations, heavy against light',
      note: 'the same answer from both' },
    { id: 'avc-gcwork', label: 'Collector work removed', note: 'by not allocating' },
    { id: 'avc-stack', label: 'Allocations the compiler can stack-allocate',
      note: 'escape analysis, from M29' },
    { id: 'avc-answer', label: 'The answer both programs compute',
      note: 'if this ever differs, the optimisation is a bug' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Three programs, one answer', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Allocation rate as the loop grows</div>' +
      '<div class="card-body"><div id="avc-chart" class="chart-host"></div>' +
      '<div id="avc-legend"></div><p class="note" id="avc-chart-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The program under inspection</div>' +
      '<div class="card-body"><pre class="code-block" id="avc-source"></pre>' +
      '<p class="note" id="avc-source-caption"></p></div></div>' +
      card('avc-compare', 'The same answer, three allocation rates',
        ['Programme', 'Answer', 'Allocations', 'Bytes', 'Collections', 'GC work',
          'Throughput']) +
      card('avc-sites', 'Where the allocations come from',
        ['Site', 'Construct', 'Allocations', 'Bytes', 'Share of the heap']) +
      card('avc-escape', 'What escape analysis can remove without being asked',
        ['Function', 'Allocation', 'Escapes', 'Why', 'What the compiler may do']) +
      card('avc-levers', 'The levers, in the order worth pulling',
        ['Lever', 'What it removes', 'What it costs', 'When it backfires']);
  }

  function card(id, title, columns) {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">' + title + '</div>' +
      '<div class="card-body"><table class="ref-table" id="' + id + '"><thead><tr>' +
      columns.map(function (name) { return '<th>' + name + '</th>'; }).join('') +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="' + id + '-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS,
    sources: sources, NAMES: NAMES };
}));
