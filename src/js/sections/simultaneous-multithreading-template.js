/** Markup for "Simultaneous multithreading". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MultithreadingTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const KERNELS = ['chase', 'chain', 'independent', 'stride', 'factorial', 'sum'];

  function kernelOptions() {
    return scope.OooLab.programOptions(KERNELS);
  }

  function controls() {
    return [
      { id: 'smx-thread0', kind: 'select', label: 'thread 0', value: 'chase',
        options: kernelOptions() },
      { id: 'smx-thread1', kind: 'select', label: 'thread 1', value: 'chain',
        options: kernelOptions() },
      { id: 'smx-policy', kind: 'select', label: 'fetch policy', value: 'priority',
        options: [
          { value: 'icount', label: 'ICOUNT — serve the thread with fewest in flight' },
          { value: 'roundRobin', label: 'round robin — alternate every cycle' },
          { value: 'priority', label: 'strict priority — thread 0 always wins' }] },
      { id: 'smx-partition', kind: 'select', label: 'window and issue queue', value: 'shared',
        options: [
          { value: 'shared', label: 'shared — whoever asks first' },
          { value: 'partitioned', label: 'partitioned — a fixed half each' }] },
      { id: 'smx-guard', kind: 'range', label: 'starvation guard (0 = none)', value: 8,
        min: 0, max: 24, step: 2 },
      { id: 'smx-cycles', kind: 'range', label: 'cycles measured', value: 200, min: 60,
        max: 400, step: 20 }
    ];
  }

  const METRICS = [
    { id: 'smx-throughput', label: 'Throughput', note: 'both threads, instructions per cycle' },
    { id: 'smx-t0', label: 'Thread 0 retired', note: 'in the measured window' },
    { id: 'smx-t1', label: 'Thread 1 retired', note: 'in the same window' },
    { id: 'smx-starve', label: 'Longest starvation', note: 'cycles without a fetch slot' },
    { id: 'smx-forced', label: 'Guard interventions', note: 'the policy overruled' },
    { id: 'smx-verdict', label: 'Both making progress', note: 'the starvation test' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Two threads, one core', controls: controls() }) +
      scope.DataTable.markup({ id: 'smx-threads', first: true,
        title: 'What each thread got',
        columns: ['Thread', 'Retired', 'IPC shared', 'Fetch slots', 'Longest starve',
          'Window'] }) +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      chartCard() +
      scope.DataTable.markup({ id: 'smx-policies',
        title: 'Every policy and partition, on this pair',
        columns: ['Policy', 'Window', 'Guard', 'Thread 0', 'Thread 1', 'Throughput',
          'Starved?'] }) +
      scope.DataTable.markup({ id: 'smx-pairs',
        title: 'Which pairs gain, and what each thread pays',
        columns: ['Pair', 'Alone, in total', 'Together', 'Speed-up', 'Thread 0 slowdown',
          'Thread 1 slowdown'] }) +
      scope.DataTable.markup({ id: 'smx-structures',
        title: 'What is shared, what is duplicated, and what it means',
        columns: ['Structure', 'In this model', 'On a real core', 'Consequence'] });
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Throughput against single-thread slowdown, per pair</div>' +
      '<div class="card-body"><div id="smx-chart" class="chart-host"></div>' +
      '<p class="note" id="smx-chart-note"></p></div></div>';
  }

  return { render: render, controls: controls, metrics: METRICS, KERNELS: KERNELS };
}));
