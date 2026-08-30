/** Markup for "Instruction-level parallelism and its limits". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.IlpTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const MODELS = [
    { value: 'renamed', label: 'renamed — values and real memory dependences only' },
    { value: 'unrenamed', label: 'unrenamed — name dependences count too' },
    { value: 'conservative', label: 'conservative memory — every load waits for every store' }
  ];

  const LATENCIES = [
    { value: 'unit', label: 'unit — one cycle each, the classic ILP study' },
    { value: 'machine', label: 'machine — the simulator\'s own latencies' }
  ];

  function controls() {
    return [
      { id: 'ilp-program', kind: 'select', label: 'program', value: 'chain',
        options: scope.OooLab.programOptions() },
      { id: 'ilp-model', kind: 'select', label: 'what the machine must obey',
        value: 'renamed', options: MODELS },
      { id: 'ilp-latency', kind: 'select', label: 'latency model', value: 'unit',
        options: LATENCIES },
      { id: 'ilp-width', kind: 'range', label: 'issue width of the measured machine',
        value: 4, min: 1, max: 8, step: 1 }
    ];
  }

  const METRICS = [
    { id: 'ilp-instructions', label: 'Instructions', note: 'in the trace, not in the source' },
    { id: 'ilp-critical', label: 'Critical path', note: 'cycles, unlimited resources' },
    { id: 'ilp-bound', label: 'ILP bound', note: 'instructions / critical path' },
    { id: 'ilp-measured', label: 'Measured IPC', note: 'what the simulator did' },
    { id: 'ilp-headroom', label: 'Headroom', note: 'bound / measured — what resources cost' },
    { id: 'ilp-respects', label: 'Bound respected', note: 'measured IPC never exceeds it' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Analyse a run, then measure it',
        controls: controls() }) +
      scope.DataTable.markup({ id: 'ilp-models', first: true,
        title: 'The same trace, three machines',
        columns: ['Machine', 'Critical path', 'ILP bound', 'Against renamed'] }) +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      chartCard() +
      scope.DataTable.markup({ id: 'ilp-edges',
        title: 'Every dependence in the trace, and whether it is real',
        columns: ['Kind', 'Count', 'A dependence on', 'What removes it'] }) +
      scope.DataTable.markup({ id: 'ilp-path',
        title: 'The critical path itself — the chain that decides the cycle count',
        columns: ['Step', 'Address', 'Instruction', 'Waited for', 'Through'] }) +
      scope.DataTable.markup({ id: 'ilp-programs',
        title: 'Twelve programs: the bound, the measurement, and the gap',
        columns: ['Program', 'Instructions', 'Critical path', 'ILP bound', 'Measured IPC',
          'Headroom', 'Bound respected'] });
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">How many instructions could start in each cycle</div>' +
      '<div class="card-body"><div id="ilp-profile" class="chart-host"></div>' +
      '<p class="note" id="ilp-profile-note"></p></div></div>';
  }

  return { render: render, controls: controls, metrics: METRICS, MODELS: MODELS };
}));
