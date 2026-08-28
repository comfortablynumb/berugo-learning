/** Markup for "Incremental and concurrent collection". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.IncrementalTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'icm-barrier', kind: 'select', label: 'write barrier', value: 'none',
      options: [
        { value: 'none', label: 'none — watch the object be lost' },
        { value: 'update', label: 'incremental update (Dijkstra) — shade the new target' },
        { value: 'satb', label: 'snapshot at the beginning (Yuasa) — shade the old one' }
      ] },
    { id: 'icm-slice', kind: 'range', label: 'objects marked per slice', value: 8,
      min: 1, max: 64, step: 1, note: 'the pause; the program runs between slices' },
    { id: 'icm-runs', kind: 'range', label: 'randomised interleavings', value: 2000,
      min: 250, max: 10000, step: 250, note: 'random graph, random order of store and slice' }
  ];

  const METRICS = [
    { id: 'icm-lost', label: 'Runs that freed a reachable object',
      note: 'over the randomised interleavings' },
    { id: 'icm-floating', label: 'Dead objects left behind, against Dijkstra',
      note: 'summed over the randomised interleavings' },
    { id: 'icm-p99', label: 'p99 pause against stop-the-world',
      note: 'objects touched, same trace, same heap' },
    { id: 'icm-throughput', label: 'Extra work the barrier costs',
      note: 'units, against the same collector with it off' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A mark the program is allowed to interrupt',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Pause length: one slice at a time</div>' +
      '<div class="card-body"><div id="icm-chart" class="chart-host"></div>' +
      '<p class="note" id="icm-chart-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('icm-lost-table', 'The lost object, built deliberately',
        ['Barrier', 'What it does on a store', 'The value survived', 'Objects reclaimed',
          'Objects shaded']) +
      card('icm-stress', 'Randomised interleavings of mutation and marking',
        ['Barrier', 'Invariant it maintains', 'Runs', 'Runs losing a live object',
          'Live objects lost', 'Dead objects left behind']) +
      card('icm-slices', 'What the slice size trades',
        ['Slice', 'Collections', 'p50 pause', 'p99 pause', 'Max pause', 'GC work',
          'Throughput']) +
      card('icm-invariant', 'The tri-colour invariant, and the two ways to keep it',
        ['Rule', 'Held by', 'What it costs', 'What it keeps alive']);
  }

  function card(id, title, columns) {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">' + title + '</div>' +
      '<div class="card-body"><table class="ref-table" id="' + id + '"><thead><tr>' +
      columns.map(function (name) { return '<th>' + name + '</th>'; }).join('') +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="' + id + '-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
