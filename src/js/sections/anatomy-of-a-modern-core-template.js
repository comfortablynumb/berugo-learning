/** Markup for "Anatomy of a modern core". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TopdownTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CHANGES = [
    { value: 'chase', label: 'a pointer chase — the address comes from the last load' },
    { value: 'chain', label: 'one dependence chain — every add waits for the one before' },
    { value: 'hiddenAlias', label: 'a load that keeps aliasing a store' },
    { value: 'alias', label: 'a store and a load on one address' },
    { value: 'arrayMax', label: 'a scan with a data-dependent branch' }
  ];

  function controls() {
    return [
      { id: 'tdn-program', kind: 'select', label: 'program', value: 'chase',
        options: CHANGES },
      { id: 'tdn-cache', kind: 'checkbox', label: 'small cache (256 B), so memory bites',
        value: true },
      { id: 'tdn-width', kind: 'range', label: 'issue width', value: 4, min: 1, max: 8,
        step: 1 }
    ];
  }

  const METRICS = [
    { id: 'tdn-retiring', label: 'Retiring', note: 'slots that did useful work' },
    { id: 'tdn-badspec', label: 'Bad speculation', note: 'slots used by work thrown away' },
    { id: 'tdn-frontend', label: 'Front-end bound', note: 'slots the back end would have taken' },
    { id: 'tdn-backend', label: 'Back-end bound', note: 'slots the back end refused' },
    { id: 'tdn-total', label: 'Categories sum to', note: 'by construction, not by luck' },
    { id: 'tdn-verdict', label: 'Where to look', note: 'the largest non-retiring category' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Classify every issue slot', controls: controls() }) +
      scope.DataTable.markup({ id: 'tdn-categories', first: true,
        title: 'The four categories, and what each one means',
        columns: ['Category', 'Slots', 'Share', 'What it means', 'What to do about it'] }) +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      chartCard() +
      scope.DataTable.markup({ id: 'tdn-drill',
        title: 'Drill-down: the reasons inside each category',
        columns: ['Category', 'Reason', 'Slots', 'Share of the category'] }) +
      scope.DataTable.markup({ id: 'tdn-fixes',
        title: 'Apply the change the breakdown suggests, and watch the category move',
        columns: ['Before', 'After', 'The change', 'Cycles', 'Retiring', 'The category that moved'] }) +
      scope.DataTable.markup({ id: 'tdn-all',
        title: 'Every program, classified',
        columns: ['Program', 'Cycles', 'IPC', 'Retiring', 'Bad speculation', 'Front end',
          'Back end', 'Verdict'] }) +
      scope.DataTable.markup({ id: 'tdn-dimensions',
        title: 'This simulator against a contemporary core, in orders of magnitude',
        columns: ['Structure', 'Here', 'A big core, roughly', 'Why the real one is larger'] });
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Where every issue slot went, per program</div>' +
      '<div class="card-body"><div id="tdn-chart" class="chart-host"></div>' +
      '<p class="note" id="tdn-chart-note"></p></div></div>';
  }

  return { render: render, controls: controls, metrics: METRICS, CHANGES: CHANGES };
}));
