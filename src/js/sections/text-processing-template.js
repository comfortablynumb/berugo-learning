/** Markup for "Text processing in production". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TextProcessingTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'txp-lines', kind: 'range', label: 'log lines', value: 300, min: 50, max: 1200, step: 50 },
    { id: 'txp-threshold', kind: 'range', label: 'template similarity threshold ×100', value: 50, min: 20, max: 95, step: 5 },
    { id: 'txp-merges', kind: 'range', label: 'byte-pair merges', value: 60, min: 0, max: 200, step: 10 },
    { id: 'txp-query', kind: 'text', label: 'name to match', value: 'Jon Smyth' },
    { id: 'txp-cutoff', kind: 'range', label: 'Jaro-Winkler cutoff ×100', value: 85, min: 60, max: 99, step: 1 },
    { id: 'txp-block', kind: 'checkbox', label: 'block by q-gram before verifying', value: true }
  ];

  const METRICS = [
    { id: 'txp-templates', label: 'Log templates extracted', note: 'from the raw lines' },
    { id: 'txp-compression', label: 'Characters per token', note: 'after byte-pair merging' },
    { id: 'txp-selectivity', label: 'Candidates per result', note: 'the number that decides throughput' },
    { id: 'txp-quality', label: 'Precision and recall', note: 'against a labelled fixture' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The corpus and the pipeline', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The templates, and what became a wildcard</div>' +
      '<div class="card-body"><div id="txp-groups"></div>' +
      '<p class="note" id="txp-groups-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The threshold is the whole tuning surface</div>' +
      '<div class="card-body"><div id="txp-chart"></div><div id="txp-legend"></div>' +
      '<table class="ref-table" id="txp-sweep"><thead><tr>' +
      '<th>Threshold</th><th>Templates</th><th>Largest template covers</th>' +
      '<th>Wildcards in it</th><th>Comparisons</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="txp-sweep-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Three tokenisers on the same line</div>' +
      '<div class="card-body"><div id="txp-tokens"></div>' +
      '<p class="note" id="txp-tokens-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Four similarity metrics, and where each one lies</div>' +
      '<div class="card-body"><table class="ref-table" id="txp-similarity"><thead><tr>' +
      '<th>Pair</th><th>Levenshtein ratio</th><th>Jaro-Winkler</th><th>Jaccard on 2-grams</th>' +
      '<th>Cosine on 2-grams</th><th>Should these match?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="txp-similarity-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The pipeline: normalise, block, verify</div>' +
      '<div class="card-body"><table class="ref-table" id="txp-pipeline"><thead><tr>' +
      '<th>Stage</th><th>Records in</th><th>Records out</th><th>Selectivity</th>' +
      '<th>Precision</th><th>Recall</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="txp-pipeline-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
