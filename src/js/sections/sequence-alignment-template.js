/** Markup for "Sequence alignment DP". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SequenceAlignmentTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'seq-left', kind: 'select', label: 'first string', value: 'kitten',
      options: [{ value: 'kitten', label: 'kitten' },
        { value: 'intention', label: 'intention' },
        { value: 'ACACACTA', label: 'ACACACTA (a sequence)' },
        { value: 'abcabba', label: 'abcabba' }] },
    { id: 'seq-right', kind: 'select', label: 'second string', value: 'sitting',
      options: [{ value: 'sitting', label: 'sitting' },
        { value: 'execution', label: 'execution' },
        { value: 'AGCACACA', label: 'AGCACACA (a sequence)' },
        { value: 'cbabac', label: 'cbabac' }] },
    { id: 'seq-transpose', kind: 'select', label: 'transposition cost', value: 'off',
      options: [{ value: 'off', label: 'off — plain Levenshtein' },
        { value: '1', label: '1 — Damerau' }] },
    { id: 'seq-scale', kind: 'range', label: 'space comparison at length', value: 600, min: 50, max: 2000, step: 50 }
  ];

  const METRICS = [
    { id: 'seq-distance', label: 'Edit distance', note: 'checked against exhaustive recursion' },
    { id: 'seq-full', label: 'Full-table cells', note: '(m + 1) x (n + 1)' },
    { id: 'seq-linear', label: 'Hirschberg peak cells', note: 'two rows, whatever m is' },
    { id: 'seq-saving', label: 'Memory ratio', note: 'at the comparison length' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Strings and scoring', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The alignment, printed</div>' +
      '<div class="card-body"><div id="seq-alignment"></div>' +
      '<p class="note" id="seq-alignment-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The table, with the traceback drawn</div>' +
      '<div class="card-body"><div id="seq-table"></div>' +
      '<p class="note" id="seq-table-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Four ways to compute the same distance</div>' +
      '<div class="card-body"><table class="ref-table" id="seq-methods"><thead><tr>' +
      '<th>Method</th><th>Distance</th><th>Peak cells</th><th>Returns an alignment?</th>' +
      '<th>Alignment valid?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="seq-methods-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Global, local and affine on the same pair</div>' +
      '<div class="card-body"><table class="ref-table" id="seq-scoring"><thead><tr>' +
      '<th>Scheme</th><th>Score</th><th>What it optimises</th><th>Where the best cell is</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="seq-scoring-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">LCS as a diff</div>' +
      '<div class="card-body"><table class="ref-table" id="seq-diff"><thead><tr>' +
      '<th>Operation</th><th>Symbol</th><th>Count</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="seq-diff-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
