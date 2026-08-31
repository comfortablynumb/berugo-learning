/** Markup for "Prefetching". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PrefetchTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'pfe-workload', kind: 'select', label: 'access pattern', value: 'strided',
      options: scope.MemoryLab.options(['sequential', 'strided', 'random', 'chase',
        'conflicting']) },
    { id: 'pfe-kind', kind: 'select', label: 'prefetcher', value: 'stride',
      options: Object.keys(scope.Prefetchers.KINDS).map(function (key) {
        return { value: key, label: scope.Prefetchers.KINDS[key].name };
      }) },
    { id: 'pfe-degree', kind: 'range', label: 'stride: lines fetched per detection', value: 1,
      min: 1, max: 4, step: 1 },
    { id: 'pfe-distance', kind: 'range', label: 'stream: how far ahead to run', value: 4,
      min: 1, max: 12, step: 1 },
    { id: 'pfe-confidence', kind: 'range', label: 'stride: repeats before acting', value: 2,
      min: 1, max: 3, step: 1 }
  ];

  const METRICS = [
    { id: 'pfe-coverage', label: 'Coverage', note: 'the misses it removed' },
    { id: 'pfe-accuracy', label: 'Accuracy', note: 'the prefetches anybody used' },
    { id: 'pfe-issued', label: 'Prefetches issued', note: 'lines fetched nobody asked for yet' },
    { id: 'pfe-misses', label: 'Demand misses', note: 'against the baseline' },
    { id: 'pfe-traffic', label: 'Traffic', note: 'demand misses plus prefetches' },
    { id: 'pfe-verdict', label: 'Was it worth it', note: 'misses removed against traffic added' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Guess the next address, and count the guesses',
        controls: CONTROLS }) +
      scope.DataTable.markup({ id: 'pfe-designs', first: true,
        title: 'Every design on this pattern',
        columns: ['Prefetcher', 'Demand misses', 'Issued', 'Accuracy', 'Coverage', 'Verdict'] }) +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      chartCard() +
      scope.DataTable.markup({ id: 'pfe-matrix',
        title: 'Every design against every pattern: coverage, and what it cost',
        columns: ['Pattern', 'next line', 'stride', 'stream', 'Which one belongs here'] }) +
      scope.DataTable.markup({ id: 'pfe-confidence-table',
        title: 'The confidence counter, on a pattern with no stride to find',
        columns: ['Repeats required', 'Issued on random', 'Accuracy', 'Issued on strided',
          'Coverage there'] }) +
      scope.DataTable.markup({ id: 'pfe-limits',
        title: 'What a prefetcher cannot do, and why',
        columns: ['Case', 'Why it fails', 'What helps instead'] });
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Coverage against traffic — the two numbers together</div>' +
      '<div class="card-body"><div id="pfe-chart" class="chart-host"></div>' +
      '<p class="note" id="pfe-chart-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
