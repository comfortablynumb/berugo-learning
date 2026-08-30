/** Markup for "Control hazards". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ControlHazardTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'chz-program', kind: 'select', label: 'program', value: 'sum',
      options: [
        { value: 'sum', label: 'sum 1..10 — a branch and a jump every iteration' },
        { value: 'arrayMax', label: 'array maximum — two branches per element' },
        { value: 'strlen', label: 'string length — a tight loop' },
        { value: 'factorial', label: 'factorial — branches, calls and returns' }] },
    { id: 'chz-resolve', kind: 'select', label: 'where a branch resolves', value: 'EX',
      options: [
        { value: 'EX', label: 'execute — two instructions thrown away' },
        { value: 'ID', label: 'decode — one thrown away, and a comparator in decode' }] },
    { id: 'chz-predict', kind: 'select', label: 'prediction', value: 'none',
      options: [
        { value: 'none', label: 'none: assume the next address in order' },
        { value: 'static-not-taken', label: 'static: never taken, with a target buffer' },
        { value: 'static-backward', label: 'static: backward branches are taken' },
        { value: 'bimodal', label: 'bimodal: a two-bit counter per site' }] },
    { id: 'chz-cycles', kind: 'range', label: 'cycles shown in the diagram', value: 22,
      min: 8, max: 44, step: 1 }
  ];

  const METRICS = [
    { id: 'chz-cycles-total', label: 'Cycles', note: 'for the whole program' },
    { id: 'chz-flushes', label: 'Flush cycles', note: 'instructions fetched down the wrong path' },
    { id: 'chz-redirects', label: 'Redirects', note: 'times fetch had to be sent elsewhere' },
    { id: 'chz-penalty', label: 'Penalty per redirect', note: 'and where it comes from' },
    { id: 'chz-ipc', label: 'IPC', note: 'instructions retired per cycle' },
    { id: 'chz-share', label: 'Share of cycles lost', note: 'to control hazards alone' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Move the resolution point, and predict or not',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Where the cycles went</div>' +
      '<div class="card-body"><table class="ref-table" id="chz-attribution"><thead><tr>' +
      '<th>Cause</th><th>Cycles</th><th>Share</th><th>What it is</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="chz-attribution-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      diagramCard() +
      card('chz-resolve-table', 'Resolving in execute against resolving in decode',
        ['Program', 'EX: cycles', 'EX: flushes', 'ID: cycles', 'ID: flushes', 'What decode costs']) +
      chartCard() +
      card('chz-strategies', 'What can be done about a branch you have not resolved yet',
        ['Strategy', 'What it assumes', 'What it costs', 'Who used it']) +
      card('chz-depth', 'The penalty grows with the pipeline, and so does the argument',
        ['Depth', 'Resolution stage', 'Penalty', 'Cost at a 5% mispredict rate']);
  }

  function diagramCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The stage diagram, with the flushed instructions marked</div>' +
      '<div class="card-body"><div id="chz-diagram"></div>' +
      '<p class="note" id="chz-diagram-note"></p></div></div>';
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Flush cycles per program, by resolution point</div>' +
      '<div class="card-body"><div id="chz-chart" class="chart-host"></div>' +
      '<p class="note" id="chz-chart-note"></p></div></div>';
  }

  function card(id, title, columns) {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">' + title + '</div>' +
      '<div class="card-body"><table class="ref-table" id="' + id + '"><thead><tr>' +
      columns.map(function (name) { return '<th>' + name + '</th>'; }).join('') +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="' + id + '-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
