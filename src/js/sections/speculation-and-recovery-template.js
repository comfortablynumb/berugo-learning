/** Markup for "Speculation and recovery". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SpeculationTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const PREDICTORS = [
    { value: 'bimodal', label: 'bimodal — a saturating counter per site' },
    { value: 'gshare', label: 'gshare — global history, XORed into the index' },
    { value: 'tournament', label: 'tournament — a chooser between two' },
    { value: 'tage', label: 'TAGE — tagged, geometric history lengths' }
  ];

  function controls() {
    return [
      { id: 'spk-program', kind: 'select', label: 'program', value: 'hiddenDisjoint',
        options: scope.OooLab.programOptions() },
      { id: 'spk-predictor', kind: 'select', label: 'branch predictor', value: 'bimodal',
        options: PREDICTORS },
      { id: 'spk-memory', kind: 'checkbox', label: 'speculate past unresolved stores',
        value: true },
      { id: 'spk-window', kind: 'range', label: 'reorder buffer entries', value: 32,
        min: 8, max: 128, step: 8 }
    ];
  }

  const METRICS = [
    { id: 'spk-cycles', label: 'Cycles', note: 'with these settings' },
    { id: 'spk-ipc', label: 'IPC', note: 'instructions retired per cycle' },
    { id: 'spk-wasted', label: 'Wasted work', note: 'fetched and then squashed' },
    { id: 'spk-recoveries', label: 'Recoveries', note: 'branch, and memory misspeculation' },
    { id: 'spk-unwound', label: 'Entries unwound', note: 'the cost of having no checkpoint' },
    { id: 'spk-storesets', label: 'Store sets learned', note: 'loads that will wait next time' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Speculate, be wrong, and pay for it',
        controls: controls() }) +
      scope.DataTable.markup({ id: 'spk-recovery', first: true,
        title: 'Two recovery mechanisms, and why both exist',
        columns: ['Mechanism', 'Used for', 'Cost', 'Restores'] }) +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      windowCard() +
      scope.DataTable.markup({ id: 'spk-memory-table',
        title: 'Memory dependence speculation, switched off and on',
        columns: ['Program', 'Conservative', 'Speculative', 'Gain', 'Loads that waited',
          'Misspeculations', 'Store sets learned'] }) +
      chartCard() +
      scope.DataTable.markup({ id: 'spk-wasted-table',
        title: 'Work fetched and thrown away, per program',
        columns: ['Program', 'Retired', 'Fetched', 'Squashed', 'Wasted', 'Redirects'] }) +
      scope.DataTable.markup({ id: 'spk-window-table',
        title: 'A deeper window speculates further — and throws more away',
        columns: ['Entries', 'Cycles', 'Squashed', 'Against 32 entries', 'Wasted work'] }) +
      scope.DataTable.markup({ id: 'spk-kinds',
        title: 'Everything this machine guesses, and what it costs to be wrong',
        columns: ['Guess', 'Made by', 'Detected by', 'Recovery', 'Measured here'] });
  }

  function windowCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The squash, as a block of discarded instructions</div>' +
      '<div class="card-body"><div id="spk-timeline"></div>' +
      '<div class="pipe-legend" id="spk-legend"></div>' +
      '<p class="note" id="spk-timeline-note"></p></div></div>';
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Instructions retired against instructions fetched</div>' +
      '<div class="card-body"><div id="spk-chart" class="chart-host"></div>' +
      '<p class="note" id="spk-chart-note"></p></div></div>';
  }

  return { render: render, controls: controls, metrics: METRICS, PREDICTORS: PREDICTORS };
}));
