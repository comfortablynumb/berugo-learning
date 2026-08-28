/** Markup for "Finalisation and weak references". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.WeakTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'wkr-close', kind: 'select', label: 'how the handle is released', value: 'finaliser',
      options: [
        { value: 'finaliser', label: 'by the finaliser, when a collection happens' },
        { value: 'explicit', label: 'explicitly, at the end of the block' }
      ] },
    { id: 'wkr-limit', kind: 'range', label: 'handles the process may hold', value: 16,
      min: 4, max: 64, step: 4, note: 'the resource that is scarce; memory is not' },
    { id: 'wkr-pressure', kind: 'select', label: 'memory pressure', value: 'none',
      options: [
        { value: 'none', label: 'none — the heap is nearly empty' },
        { value: 'high', label: 'high — soft references are cleared' }
      ] },
    { id: 'wkr-resurrect', kind: 'select', label: 'the finaliser', value: 'clean',
      options: [
        { value: 'clean', label: 'releases the resource and returns' },
        { value: 'resurrect', label: 'stores `this` somewhere reachable' }
      ] }
  ];

  const METRICS = [
    { id: 'wkr-failed', label: 'Iteration the handles ran out',
      note: 'while the heap had room to spare' },
    { id: 'wkr-collections', label: 'Collections triggered', note: 'memory is the only trigger' },
    { id: 'wkr-cleared', label: 'Cache entries cleared', note: 'of the keys that became garbage' },
    { id: 'wkr-cycles', label: 'Collections a finalisable object costs',
      note: 'one to notice, one to free' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A scarce resource the collector cannot see',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Handles open, and bytes held, per iteration</div>' +
      '<div class="card-body"><div id="wkr-chart" class="chart-host"></div>' +
      '<div id="wkr-legend"></div><p class="note" id="wkr-chart-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('wkr-strengths', 'The four strengths, and what each one keeps alive',
        ['Strength', 'Keeps the referent', 'Cleared when', 'Cache entries cleared',
          'Objects reclaimed', 'Bytes left']) +
      card('wkr-handles', 'The same loop, two ways of releasing the handle',
        ['Release', 'Iterations run', 'Handles opened', 'Peak open', 'Collections',
          'Failed at']) +
      card('wkr-final', 'A finalisable object, cycle by cycle',
        ['Cycle', 'Finalisers run', 'Resurrected', 'Objects freed', 'Objects alive',
          'Awaiting finalisation']) +
      card('wkr-advice', 'What to use instead, and what it costs',
        ['Mechanism', 'When the cleanup runs', 'Ordering', 'Can resurrect', 'Use it for']);
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
