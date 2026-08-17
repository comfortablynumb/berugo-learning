/** Markup for "Benchmarking methodology". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BenchmarkingTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'bench-warmup', kind: 'range', label: 'warm-up runs', value: 3, min: 0, max: 20, step: 1 },
    { id: 'bench-runs', kind: 'range', label: 'measured runs', value: 15, min: 1, max: 60, step: 1 },
    { id: 'bench-trim', kind: 'range', label: 'outlier trim', value: 0.2, min: 0, max: 0.5, step: 0.1 },
    { id: 'bench-sink', kind: 'checkbox', label: 'consume the result (sink)', value: true,
      note: 'Turn the sink off and the engine may delete the work entirely. The number gets better.' },
    { id: 'bench-run', kind: 'button', label: 'Measure', primary: true }
  ];

  const METRICS = [
    { id: 'bench-median', label: 'Reported median', note: 'with the run count' },
    { id: 'bench-mad', label: 'MAD', note: 'spread; a big one means the median hides a story' },
    { id: 'bench-range', label: 'Min … max', note: 'the honest picture' },
    { id: 'bench-mean', label: 'Mean', note: 'for comparison — not what to report' },
    { id: 'bench-vs', label: 'Versus the honest run', note: 'how much this configuration flatters it' },
    { id: 'bench-warnings', label: 'Warnings', note: 'what this measurement may be lying about' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Harness configuration', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Every sample, in run order</div>' +
      '<div class="card-body"><div id="bench-chart"></div><div id="bench-legend"></div>' +
      '<p class="note">The first runs are the warm-up; watch them fall as the engine tiers up.</p>' +
      '</div></div></div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem"><div class="card-header">The same workload, four ways</div>' +
      '<div class="card-body"><table class="ref-table" id="bench-compare"><thead><tr>' +
      '<th>Configuration</th><th>Reported</th><th>Versus honest</th><th>What it hides</th>' +
      '</tr></thead><tbody></tbody></table></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
