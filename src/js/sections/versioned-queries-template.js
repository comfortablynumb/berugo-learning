/** Markup for "Versioned range queries and prefix-version order statistics". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.VersionedQueriesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'vq-size', kind: 'range', label: 'array length', value: 1024, min: 256, max: 4096, step: 256 },
    { id: 'vq-updates', kind: 'range', label: 'point updates (one version each)', value: 500, min: 100, max: 1000, step: 100 },
    { id: 'vq-probes', kind: 'range', label: 'quantile queries', value: 300, min: 50, max: 600, step: 50 },
    { id: 'vq-domain', kind: 'select', label: 'value domain for the quantile index', value: '1000',
      options: [{ value: '250', label: '250 distinct values' }, { value: '1000', label: '1 000 distinct values' },
        { value: '4000', label: '4 000 distinct values' }] }
  ];

  const METRICS = [
    { id: 'vq-nodes', label: 'Nodes built per update', note: 'against the ⌈log₂ n⌉ + 1 bound' },
    { id: 'vq-bytes', label: 'Bytes for every version', note: 'the whole history, still queryable' },
    { id: 'vq-saving', label: 'Against a snapshot per version', note: 'same answers, same queries' },
    { id: 'vq-wrong', label: 'Wrong answers', note: 'every version checked against a replayed array' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The array, the history and the queries', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Memory as the history grows</div>' +
      '<div class="card-body"><div id="vq-chart"></div>' +
      '<div id="vq-chart-legend"></div>' +
      '<p class="note" id="vq-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Keeping the history against throwing it away</div>' +
      '<div class="card-body"><table class="ref-table" id="vq-compare"><thead><tr>' +
      '<th>Structure</th><th>Bytes</th><th>Per version</th><th>Update cost</th>' +
      '<th>Query at version v</th><th>Answers old versions</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="vq-compare-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The same trick, a different question: the k-th smallest in a range</div>' +
      '<div class="card-body"><table class="ref-table" id="vq-quantile"><thead><tr>' +
      '<th>Values</th><th>Domain</th><th>Versions</th><th>Nodes / value</th>' +
      '<th>Descents / query</th><th>Bytes</th><th>Wrong</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="vq-quantile-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
