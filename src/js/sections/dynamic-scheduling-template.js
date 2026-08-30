/** Markup for "Dynamic scheduling: scoreboarding and Tomasulo". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RenameTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const PHYSICAL = [
    { value: '34', label: '34 — two spare, so renaming is two deep' },
    { value: '40', label: '40 — eight spare' },
    { value: '48', label: '48 — sixteen spare' },
    { value: '64', label: '64 — thirty-two spare, the default' },
    { value: '96', label: '96 — sixty-four spare' },
    { value: '192', label: '192 — a modern figure' }
  ];

  function controls() {
    return [
      { id: 'ren-program', kind: 'select', label: 'program', value: 'independent',
        options: scope.OooLab.programOptions() },
      { id: 'ren-physical', kind: 'select', label: 'physical registers', value: '64',
        options: PHYSICAL },
      { id: 'ren-cycles', kind: 'range', label: 'cycles shown in the window', value: 24,
        min: 8, max: 48, step: 1 }
    ];
  }

  const METRICS = [
    { id: 'ren-cycles-total', label: 'Cycles', note: 'for the whole program' },
    { id: 'ren-ipc', label: 'IPC', note: 'instructions retired per cycle' },
    { id: 'ren-allocated', label: 'Registers allocated', note: 'one per instruction that writes' },
    { id: 'ren-stalls', label: 'Dispatch stalls', note: 'no free physical register' },
    { id: 'ren-removed', label: 'Name dependences', note: 'WAR and WAW, all removed by renaming' },
    { id: 'ren-worth', label: 'Renaming is worth', note: 'ILP bound, renamed against unrenamed' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Rename, and see what it removed',
        controls: controls() }) +
      scope.DataTable.markup({ id: 'ren-alias', first: true,
        title: 'The alias table after the run — a name, and what it currently means',
        columns: ['Register', 'Physical', 'Value', 'Renamed?'] }) +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      windowCard() +
      scope.DataTable.markup({ id: 'ren-hazards',
        title: 'The three dependence kinds, counted on this trace',
        columns: ['Kind', 'Count', 'A dependence on', 'What a scoreboard does',
          'What Tomasulo does'] }) +
      chartCard() +
      scope.DataTable.markup({ id: 'ren-depth',
        title: 'How deep the machine may rename, measured',
        columns: ['Physical registers', 'Spare', 'Cycles', 'IPC', 'Dispatch stalls',
          'Against the default'] }) +
      scope.DataTable.markup({ id: 'ren-pair',
        title: 'The matched pair: identical arithmetic, opposite dependence structure',
        columns: ['Program', 'Instructions', 'Cycles', 'IPC', 'ILP renamed', 'ILP unrenamed'] });
  }

  function windowCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The window: instructions down, cycles across</div>' +
      '<div class="card-body"><div id="ren-window"></div>' +
      '<div class="pipe-legend" id="ren-legend"></div>' +
      '<p class="note" id="ren-window-note"></p></div></div>';
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Cycles against the size of the physical register file</div>' +
      '<div class="card-body"><div id="ren-chart" class="chart-host"></div>' +
      '<p class="note" id="ren-chart-note"></p></div></div>';
  }

  return { render: render, controls: controls, metrics: METRICS, PHYSICAL: PHYSICAL };
}));
