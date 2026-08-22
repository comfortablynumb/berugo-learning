/** Markup for "Diff and merge". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DiffAndMergeTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'dfm-case', kind: 'select', label: 'the two files', value: 'reorder',
      options: [{ value: 'reorder', label: 'a function moved — where minimal is unreadable' },
        { value: 'insert', label: 'a block inserted' },
        { value: 'rewrite', label: 'a body rewritten' },
        { value: 'shuffle', label: 'lines shuffled — the worst case for both' }] },
    { id: 'dfm-algorithm', kind: 'select', label: 'algorithm drawn side by side', value: 'myers',
      options: [{ value: 'myers', label: 'Myers — the shortest edit script' },
        { value: 'patience', label: 'patience — anchored on unique lines' }] },
    { id: 'dfm-size', kind: 'range', label: 'file length for the growth panel', value: 200, min: 40, max: 600, step: 40 },
    { id: 'dfm-change', kind: 'range', label: 'lines changed, per cent', value: 10, min: 1, max: 60, step: 1 }
  ];

  const METRICS = [
    { id: 'dfm-distance', label: 'Edit script length', note: 'insertions plus deletions' },
    { id: 'dfm-hunks', label: 'Hunks', note: 'what a reviewer counts as changes' },
    { id: 'dfm-roundtrip', label: 'Applies A to B exactly?', note: 'the only claim worth asserting' },
    { id: 'dfm-conflicts', label: 'Merge conflicts', note: 'on the three-way fixture' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The files', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The diff, side by side</div>' +
      '<div class="card-body"><div id="dfm-side"></div>' +
      '<p class="note" id="dfm-side-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Minimal against readable</div>' +
      '<div class="card-body"><table class="ref-table" id="dfm-compare"><thead><tr>' +
      '<th>Algorithm</th><th>Edit operations</th><th>Hunks</th><th>Anchors used</th>' +
      '<th>Round-trips?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dfm-compare-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Myers costs the size of the ANSWER, not the size of the input</div>' +
      '<div class="card-body"><div id="dfm-chart"></div><div id="dfm-legend"></div>' +
      '<table class="ref-table" id="dfm-growth"><thead><tr>' +
      '<th>Lines changed</th><th>Edit distance D</th><th>Diagonals visited</th>' +
      '<th>Snake comparisons</th><th>Against N × M</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dfm-growth-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Three-way merge, and the cases that are not conflicts</div>' +
      '<div class="card-body"><div id="dfm-merge"></div>' +
      '<p class="note" id="dfm-merge-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
