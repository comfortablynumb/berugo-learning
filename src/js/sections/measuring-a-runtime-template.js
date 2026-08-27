/** Markup for "Measuring a language runtime". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MeasureTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'mr-benchmark', kind: 'select', label: 'benchmark', value: 'loop',
      options: [
        { value: 'loop', label: 'a counted loop doing arithmetic' },
        { value: 'calls', label: 'a function called in a loop' },
        { value: 'branchy', label: 'a loop whose branch goes both ways' },
        { value: 'nested', label: 'two nested loops' }
      ] },
    { id: 'mr-warmup', kind: 'range', label: 'warm-up runs, discarded', value: 3,
      min: 0, max: 10, step: 1, note: 'a tiered runtime is a different program before these' },
    { id: 'mr-runs', kind: 'range', label: 'sampled runs', value: 7,
      min: 1, max: 21, step: 2, note: 'the median of these is the reported figure' },
    { id: 'mr-naive', kind: 'checkbox', label: 'show the naive measurement too', value: true,
      note: 'one run, warm-up counted, result discarded' }
  ];

  const METRICS = [
    { id: 'mr-median', label: 'Median, register VM', note: 'with the run count beside it' },
    { id: 'mr-spread', label: 'Spread across runs', note: 'worst minus best' },
    { id: 'mr-dispatches', label: 'Dispatches', note: 'deterministic, unlike a millisecond' },
    { id: 'mr-scales', label: 'Cost scales with input', note: 'or the benchmark measures itself' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A benchmark and a protocol', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Dispatches per mode, on this benchmark</div>' +
      '<div class="card-body"><div id="mr-chart" class="chart-host"></div>' +
      '<p class="note" id="mr-chart-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The bake-off, measured properly</div>' +
      '<div class="card-body"><table class="ref-table" id="mr-bench"><thead><tr>' +
      '<th>Mode</th><th>Median ms</th><th>Best</th><th>Worst</th><th>Spread</th>' +
      '<th>Runs</th><th>Warm-up</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mr-bench-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Dispatch counts, which are deterministic</div>' +
      '<div class="card-body"><table class="ref-table" id="mr-dispatch"><thead><tr>' +
      '<th>Benchmark</th><th>Stack VM</th><th>Register VM</th><th>JIT</th>' +
      '<th>Run in compiled code</th><th>Stack ÷ register</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mr-dispatch-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Does the cost scale with the input</div>' +
      '<div class="card-body"><table class="ref-table" id="mr-scaling"><thead><tr>' +
      '<th>Iterations</th><th>Dispatches</th><th>Per iteration</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mr-scaling-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Six ways a runtime benchmark lies</div>' +
      '<div class="card-body"><table class="ref-table" id="mr-lies"><thead><tr>' +
      '<th>Mistake</th><th>What gets measured instead</th><th>What the protocol does</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mr-lies-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every mode against the reference, on the whole suite</div>' +
      '<div class="card-body"><table class="ref-table" id="mr-suite"><thead><tr>' +
      '<th>Program</th><th>Stack VM</th><th>Register VM</th><th>JIT</th><th>WebAssembly</th>' +
      '<th>Why not, if not</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mr-suite-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
