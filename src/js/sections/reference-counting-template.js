/** Markup for "Reference counting". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RefcountTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'rfc-cycles', kind: 'range', label: 'cycles in the workload', value: 6,
      min: 0, max: 20, step: 2, note: 'per cent of allocations that make a two-object cycle' },
    { id: 'rfc-threshold', kind: 'range', label: 'candidates before a cycle collection',
      value: 32, min: 8, max: 256, step: 8,
      note: 'a count reaching zero is not a signal, so something else has to be' },
    { id: 'rfc-chain', kind: 'range', label: 'length of the chain to drop', value: 200,
      min: 1, max: 2000, step: 1, note: 'one store, and everything below it' }
  ];

  const METRICS = [
    { id: 'rfc-traffic', label: 'Count adjustments per pointer store',
      note: 'the throughput cost, paid whether or not anything dies' },
    { id: 'rfc-immediate', label: 'Objects freed without a collection',
      note: 'at the store that made them unreachable' },
    { id: 'rfc-leaked', label: 'Objects counting cannot reach', note: 'every one of them a cycle' },
    { id: 'rfc-worst', label: 'Worst single store', note: 'the pause a counter is said not to have' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A counted heap and the cycle in it',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Bytes held: counting, counting with cycle '
      + 'collection, tracing</div>' +
      '<div class="card-body"><div id="rfc-chart" class="chart-host"></div>' +
      '<div id="rfc-legend"></div><p class="note" id="rfc-chart-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('rfc-walk', 'A cycle, one store at a time',
        ['Step', 'count(a)', 'count(b)', 'count(outside)', 'Objects alive',
          'Unreachable from the roots']) +
      card('rfc-trial', 'Trial deletion on the candidates',
        ['Group', 'Members', 'Internal references', 'Referenced from outside', 'Verdict']) +
      card('rfc-cascade', 'One store, and everything below it',
        ['Chain length', 'Objects freed at that store', 'Decrements', 'Left in the heap']) +
      card('rfc-compare', 'Counting against tracing on the same trace',
        ['Strategy', 'Collections', 'Worst pause', 'Worst single store', 'Throughput',
          'Dead at the end', 'Freed no live object']);
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
