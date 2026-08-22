/** Markup for "Approximate matching". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ApproximateMatchingTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'apx-corpus', kind: 'select', label: 'corpus', value: 'logs',
      options: [{ value: 'logs', label: 'log lines' },
        { value: 'english', label: 'English' },
        { value: 'dna', label: 'DNA' },
        { value: 'source', label: 'source code' }] },
    { id: 'apx-pattern', kind: 'text', label: 'pattern', value: 'orders' },
    { id: 'apx-errors', kind: 'range', label: 'errors allowed (k)', value: 1, min: 0, max: 4, step: 1 },
    { id: 'apx-size', kind: 'range', label: 'text length', value: 4000, min: 500, max: 12000, step: 500 },
    { id: 'apx-q', kind: 'range', label: 'q-gram size for the prefilter', value: 3, min: 2, max: 5, step: 1 }
  ];

  const METRICS = [
    { id: 'apx-matches', label: 'End positions within k', note: 'bitap, checked against a DP reference' },
    { id: 'apx-words', label: 'Machine words per character', note: 'k + 1, and the pattern must fit in one' },
    { id: 'apx-band', label: 'Cells the band computed', note: 'against the full grid' },
    { id: 'apx-selectivity', label: 'Prefilter selectivity', note: 'candidates admitted per position examined' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The pattern and the budget', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The bit vectors, one per error level</div>' +
      '<div class="card-body"><div id="apx-bits"></div>' +
      '<p class="note" id="apx-bits-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Bitap against the dynamic-programming reference</div>' +
      '<div class="card-body"><table class="ref-table" id="apx-agree"><thead><tr>' +
      '<th>k</th><th>Bitap end positions</th><th>DP end positions</th><th>Agree?</th>' +
      '<th>Bitap words</th><th>DP cells</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="apx-agree-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The word-size cliff</div>' +
      '<div class="card-body"><div id="apx-chart"></div><div id="apx-legend"></div>' +
      '<table class="ref-table" id="apx-cliff"><thead><tr>' +
      '<th>Pattern length</th><th>Bitap</th><th>Words per character</th><th>DP cells</th>' +
      '<th>Ratio</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="apx-cliff-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The band, and the answers it refuses to give</div>' +
      '<div class="card-body"><table class="ref-table" id="apx-banded"><thead><tr>' +
      '<th>Pair</th><th>True distance</th><th>Banded at k</th><th>Exact?</th>' +
      '<th>Cells, banded</th><th>Cells, full</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="apx-banded-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The q-gram prefilter, and the condition nobody checks</div>' +
      '<div class="card-body"><table class="ref-table" id="apx-filter"><thead><tr>' +
      '<th>q</th><th>Threshold m − q + 1 − kq</th><th>Usable?</th><th>Positions</th>' +
      '<th>Candidates</th><th>Results</th><th>Candidates per result</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="apx-filter-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
