/** Markup for "Sorting in practice". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SortingInPracticeTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'sip-shape', kind: 'select', label: 'what the data looks like', value: 'nearly-sorted',
      options: [{ value: 'random', label: 'random' },
        { value: 'nearly-sorted', label: 'nearly sorted — a re-sorted list' },
        { value: 'sorted', label: 'already sorted' },
        { value: 'reversed', label: 'reversed' },
        { value: 'few-unique', label: 'few unique — a status column' },
        { value: 'organ-pipe', label: 'organ pipe' },
        { value: 'adversarial', label: 'adversarial' }] },
    { id: 'sip-size', kind: 'range', label: 'rows', value: 5000, min: 500, max: 30000, step: 500 },
    { id: 'sip-stability', kind: 'select', label: 'must equal rows keep their order?', value: 'required',
      options: [{ value: 'required', label: 'yes — required' },
        { value: 'optional', label: 'no — do not care' }] },
    { id: 'sip-key', kind: 'select', label: 'key type', value: 'integer',
      options: [{ value: 'integer', label: 'small integer' },
        { value: 'string', label: 'string, locale-aware' },
        { value: 'composite', label: 'three keys with tie-breaking' }] }
  ];

  const METRICS = [
    { id: 'sip-winner', label: 'Fewest comparisons', note: 'among the sorts that meet the requirement' },
    { id: 'sip-margin', label: 'Against the runner-up', note: 'the size of the decision' },
    { id: 'sip-default', label: 'The platform default', note: 'Array.prototype.sort with a comparator' },
    { id: 'sip-rejected', label: 'Ruled out', note: 'sorts that fail the stability requirement' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The workload, stated as requirements', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Comparisons and moves for every candidate</div>' +
      '<div class="card-body"><div id="sip-chart"></div>' +
      '<p class="note" id="sip-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The chooser — every sort in this milestone, ranked on your workload</div>' +
      '<div class="card-body"><table class="ref-table" id="sip-chooser"><thead><tr>' +
      '<th>Sort</th><th>Comparisons</th><th>Per element</th><th>Moves</th>' +
      '<th>Allocations</th><th>Stable</th><th>Eligible</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="sip-chooser-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The default sort, and the bug that survives review</div>' +
      '<div class="card-body"><table class="ref-table" id="sip-default"><thead><tr>' +
      '<th>Call</th><th>Input</th><th>Result</th><th>Correct?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="sip-default-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Sorting a table by three keys, with the tie-breaking written down</div>' +
      '<div class="card-body"><table class="ref-table" id="sip-table"><thead><tr>' +
      '<th>#</th><th>Team</th><th>Points</th><th>Name</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="sip-table-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
