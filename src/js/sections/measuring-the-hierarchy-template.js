/** Markup for "Measuring the hierarchy". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HierarchyMeasureTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'msr-pattern', kind: 'select', label: 'pattern the harness uses', value: 'chase',
      options: [
        { value: 'chase', label: 'shuffled pointer chase — the correct one' },
        { value: 'ordered', label: 'a chase laid out in address order — the disguised one' },
        { value: 'stream', label: 'sequential — measures bandwidth, not latency' }] },
    { id: 'msr-warm', kind: 'checkbox', label: 'discard the first pass', value: true },
    { id: 'msr-threshold', kind: 'range', label: 'step threshold (ratio)', value: 1.35,
      min: 1.05, max: 2, step: 0.05 },
    { id: 'msr-ways', kind: 'select', label: 'configured associativity to recover', value: '8',
      options: [2, 4, 8, 16].map(function (value) {
        return { value: String(value), label: value + '-way' };
      }) }
  ];

  const METRICS = [
    { id: 'msr-found', label: 'Capacities found', note: 'from the curve alone' },
    { id: 'msr-truth', label: 'Capacities configured', note: 'what the machine actually has' },
    { id: 'msr-match', label: 'Recovered exactly', note: 'the acceptance criterion' },
    { id: 'msr-assoc', label: 'Associativity found', note: 'by conflict-set construction' },
    { id: 'msr-assoc-truth', label: 'Associativity configured', note: 'the answer to check against' },
    { id: 'msr-line', label: 'Line size found', note: 'from where the stride stops mattering' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Discover the machine from timing alone',
        controls: CONTROLS }) +
      scope.DataTable.markup({ id: 'msr-method', first: true,
        title: 'The method, and what each step must avoid',
        columns: ['Step', 'What it measures', 'The confounder'] }) +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      chartCard() +
      scope.DataTable.markup({ id: 'msr-steps',
        title: 'Every step the curve took, against the configuration',
        columns: ['Step at', 'Before', 'After', 'Ratio', 'Matches a configured level?'] }) +
      scope.DataTable.markup({ id: 'msr-assoc-table',
        title: 'Associativity, by building a conflict set one line at a time',
        columns: ['Lines in the set', 'All hit on re-reference?', 'What it means'] }) +
      scope.DataTable.markup({ id: 'msr-line-table',
        title: 'Line size, from the stride at which every access starts missing',
        columns: ['Stride', 'Misses per pass', 'Accesses per line', 'What it implies'] }) +
      scope.DataTable.markup({ id: 'msr-blind',
        title: 'What the method cannot see',
        columns: ['Blind spot', 'Why the timing hides it', 'What to use instead'] });
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The curve the method reads, under the selected pattern</div>' +
      '<div class="card-body"><div id="msr-chart" class="chart-host"></div>' +
      '<p class="note" id="msr-chart-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
