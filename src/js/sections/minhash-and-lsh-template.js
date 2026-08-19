/** Markup for "MinHash, SimHash and LSH". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MinhashAndLshTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'lsh-bands', kind: 'range', label: 'bands b', value: 16, min: 2, max: 64, step: 2 },
    { id: 'lsh-rows', kind: 'range', label: 'rows per band r', value: 8, min: 1, max: 16, step: 1,
      note: 'The signature is b × r hashes, and the curve turns near (1/b)^(1/r).' },
    { id: 'lsh-threshold', kind: 'range', label: 'similarity that counts as a duplicate', value: 50, min: 10, max: 90, step: 5,
      suffix: '% Jaccard' },
    { id: 'lsh-shingle', kind: 'select', label: 'shingle width', value: '5',
      options: [{ value: '3', label: '3 characters' }, { value: '5', label: '5 characters' },
        { value: '9', label: '9 characters' }] },
    { id: 'lsh-groups', kind: 'range', label: 'document families in the corpus', value: 12, min: 4, max: 30, step: 2 },
    { id: 'lsh-target', kind: 'range', label: 'random-projection target dimensions', value: 64, min: 16, max: 512, step: 16 }
  ];

  const METRICS = [
    { id: 'lsh-length', label: 'Signature length', note: 'b × r hashes per document' },
    { id: 'lsh-error', label: 'MinHash standard error', note: '1/√L, and the worst seen' },
    { id: 'lsh-recall', label: 'Recall', note: 'true duplicate pairs the index proposes' },
    { id: 'lsh-work', label: 'Pairs actually compared', note: 'against every pair' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The signature, the bands and the corpus', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The S-curve: probability a pair becomes a candidate</div>' +
      '<div class="card-body"><div id="lsh-curve-chart"></div>' +
      '<div id="lsh-curve-legend"></div>' +
      '<p class="note" id="lsh-curve-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Estimated Jaccard against exact Jaccard, every pair in the corpus</div>' +
      '<div class="card-body"><div id="lsh-scatter-chart"></div>' +
      '<div id="lsh-scatter-legend"></div>' +
      '<p class="note" id="lsh-scatter-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Band and row splits of the same signature budget</div>' +
      '<div class="card-body"><table class="ref-table" id="lsh-splits"><thead><tr>' +
      '<th>b × r</th><th>Curve threshold</th><th>Candidate pairs</th><th>Recall</th><th>Precision</th>' +
      '<th>Work saved</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lsh-splits-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">SimHash: the same corpus, a different question</div>' +
      '<div class="card-body"><table class="ref-table" id="lsh-simhash"><thead><tr>' +
      '<th>Hamming cutoff</th><th>Pairs flagged</th><th>Recall</th><th>Precision</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lsh-simhash-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Random projection: what Johnson-Lindenstrauss promises and what it delivers</div>' +
      '<div class="card-body"><pre class="step-work" id="lsh-projection"></pre>' +
      '<p class="note" id="lsh-projection-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
