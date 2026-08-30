/** Markup for "Superscalar issue". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.WidthTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function controls() {
    return [
      { id: 'wid-program', kind: 'select', label: 'program', value: 'independent',
        options: scope.OooLab.programOptions() },
      { id: 'wid-width', kind: 'range', label: 'issue width', value: 4, min: 1, max: 8,
        step: 1 },
      { id: 'wid-queue', kind: 'range', label: 'issue queue entries', value: 32, min: 4,
        max: 64, step: 4 }
    ];
  }

  const METRICS = [
    { id: 'wid-cycles', label: 'Cycles', note: 'at this width' },
    { id: 'wid-ipc', label: 'IPC', note: 'instructions retired per cycle' },
    { id: 'wid-bound', label: 'ILP bound', note: 'what the code allows (36.1)' },
    { id: 'wid-peak', label: 'Busiest cycle', note: 'most instructions issued in one cycle' },
    { id: 'wid-idle', label: 'Cycles issuing nothing', note: 'the slots that were never used' },
    { id: 'wid-limit', label: 'What is limiting it', note: 'named, not guessed' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Widen the machine and watch it stop helping',
        controls: controls() }) +
      scope.DataTable.markup({ id: 'wid-ports', first: true,
        title: 'What each port did',
        columns: ['Port', 'Serves', 'Issued', 'Busy in', 'Utilisation'] }) +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      chartCard() +
      scope.DataTable.markup({ id: 'wid-sweep',
        title: 'The same program at every width, and why it stopped rising',
        columns: ['Width', 'Cycles', 'IPC', 'Against width 1', 'Port conflicts',
          'Dispatch stalls', 'Limiting factor'] }) +
      scope.DataTable.markup({ id: 'wid-hist',
        title: 'How many instructions issued in a cycle, and how often',
        columns: ['Instructions issued', 'Cycles', 'Share of cycles'] }) +
      scope.DataTable.markup({ id: 'wid-all',
        title: 'Twelve programs, four widths: the speed-up nobody gets',
        columns: ['Program', 'w=1', 'w=2', 'w=4', 'w=8', 'w=8 against w=1',
          'ILP bound'] }) +
      scope.DataTable.markup({ id: 'wid-cost',
        title: 'What the width costs the hardware',
        columns: ['Structure', 'Grows as', 'At width 4', 'At width 8', 'Why it is on the critical path'] });
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">IPC against issue width — the curve that flattens</div>' +
      '<div class="card-body"><div id="wid-chart" class="chart-host"></div>' +
      '<p class="note" id="wid-chart-note"></p></div></div>';
  }

  return { render: render, controls: controls, metrics: METRICS };
}));
