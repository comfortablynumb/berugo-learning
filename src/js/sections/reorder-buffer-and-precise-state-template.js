/** Markup for "The reorder buffer and precise state". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RobTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const FAULTS = [
    { value: 'ecall', label: 'ecall — an environment call, detected in execute' },
    { value: 'illegal', label: 'an illegal instruction — detected in decode' },
    { value: 'misalignedLoad', label: 'a misaligned load — detected when the address is computed' },
    { value: 'misalignedStore', label: 'a misaligned store — the same, and it must not write' },
    { value: 'unmapped', label: 'a load from unmapped memory' }
  ];

  const SIZES = [
    { value: '4', label: '4 entries' }, { value: '8', label: '8 entries' },
    { value: '16', label: '16 entries' }, { value: '32', label: '32 entries — the default' },
    { value: '64', label: '64 entries' }, { value: '128', label: '128 entries' }
  ];

  const CONTROLS = [
    { id: 'rob-fault', kind: 'select', label: 'what goes wrong, 40 instructions in',
      value: 'misalignedStore', options: FAULTS },
    { id: 'rob-capacity', kind: 'select', label: 'reorder buffer size', value: '32',
      options: SIZES },
    { id: 'rob-cycles', kind: 'range', label: 'cycles shown in the window', value: 28,
      min: 8, max: 48, step: 1 }
  ];

  const METRICS = [
    { id: 'rob-cause', label: 'mcause', note: 'why control left the program' },
    { id: 'rob-epc', label: 'mepc', note: 'the instruction that faulted, exactly' },
    { id: 'rob-tval', label: 'mtval', note: 'the offending value' },
    { id: 'rob-inflight', label: 'In flight at the fault', note: 'instructions the machine had started' },
    { id: 'rob-squashed', label: 'Squashed', note: 'younger than the fault, discarded' },
    { id: 'rob-precise', label: 'State against the reference', note: 'at the same retire count' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Fault with the window full', controls: CONTROLS }) +
      scope.DataTable.markup({ id: 'rob-faults', first: true,
        title: 'Five fault classes, each raised with the window full',
        columns: ['Fault', 'mcause', 'mepc', 'In flight', 'Squashed', 'Differences'] }) +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      windowCard() +
      chartCard() +
      scope.DataTable.markup({ id: 'rob-states',
        title: 'Where an instruction\'s result lives, at each stage of its life',
        columns: ['State', 'Result is in', 'Visible to the program?', 'What a squash does to it'] }) +
      scope.DataTable.markup({ id: 'rob-capacity-table',
        title: 'How far ahead the machine may run: cycles against buffer size',
        columns: ['Entries', 'chain', 'independent', 'stride', 'chase', 'factorial'] });
  }

  function windowCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Completion is out of order; commit is not</div>' +
      '<div class="card-body"><div id="rob-window"></div>' +
      '<div class="pipe-legend" id="rob-legend"></div>' +
      '<p class="note" id="rob-window-note"></p></div></div>';
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">How full the buffer was, cycle by cycle</div>' +
      '<div class="card-body"><div id="rob-chart" class="chart-host"></div>' +
      '<p class="note" id="rob-chart-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, FAULTS: FAULTS };
}));
