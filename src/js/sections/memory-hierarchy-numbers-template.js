/** Markup for "The hierarchy and the numbers". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LadderTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'lad-pattern', kind: 'select', label: 'access pattern', value: 'chase',
      options: [
        { value: 'chase', label: 'pointer chase — measures latency, defeats the prefetcher' },
        { value: 'ordered', label: 'the same chase in address order — the prefetcher answers' },
        { value: 'stream', label: 'sequential — measures bandwidth, and hides every step' }] },
    { id: 'lad-passes', kind: 'range', label: 'passes over each working set', value: 4,
      min: 2, max: 8, step: 1 },
    { id: 'lad-warm', kind: 'checkbox', label: 'discard the first pass (compulsory misses)',
      value: true }
  ];

  const METRICS = [
    { id: 'lad-l1', label: 'L1 hit', note: 'cycles, and the unit everything else is in' },
    { id: 'lad-l2', label: 'L2 hit', note: 'against the L1 figure' },
    { id: 'lad-l3', label: 'L3 hit', note: 'against the L1 figure' },
    { id: 'lad-dram', label: 'DRAM', note: 'against the L1 figure' },
    { id: 'lad-found', label: 'Sizes discovered', note: 'from the curve alone' },
    { id: 'lad-exact', label: 'Against the configuration', note: 'did the method get it right' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Walk the working set and time it',
        controls: CONTROLS }) +
      scope.DataTable.markup({ id: 'lad-levels', first: true,
        title: 'The hierarchy this machine has',
        columns: ['Level', 'Capacity', 'Hit cycles', 'Against L1', 'Organisation'] }) +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      chartCard() +
      scope.DataTable.markup({ id: 'lad-curve',
        title: 'Cycles per access at each working-set size',
        columns: ['Working set', 'Cycles per access', 'Against the previous size',
          'Served mostly by'] }) +
      scope.DataTable.markup({ id: 'lad-steps',
        title: 'Where the curve stepped, and what the machine actually has',
        columns: ['Step at', 'Before', 'After', 'Ratio', 'The configured level'] }) +
      scope.DataTable.markup({ id: 'lad-ratios',
        title: 'The ratios, which are what transfer',
        columns: ['Level', 'Here', 'A real machine, roughly', 'What it means for a design'] });
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The latency ladder — every step is a level running out</div>' +
      '<div class="card-body"><div id="lad-chart" class="chart-host"></div>' +
      '<p class="note" id="lad-chart-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
