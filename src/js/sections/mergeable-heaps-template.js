/** Markup for "Mergeable heaps: leftist, skew and binomial". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MergeableHeapsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'mh-count', kind: 'range', label: 'elements', value: 13, min: 1, max: 100000, step: 1,
      note: 'A binomial heap holds one tree per set bit of this number. Watch the binary reading below.' },
    { id: 'mh-pieces', kind: 'range', label: 'heaps to meld', value: 16, min: 2, max: 64, step: 1 },
    { id: 'mh-each', kind: 'range', label: 'elements per heap', value: 1000, min: 10, max: 20000, step: 10 },
    { id: 'mh-seed', kind: 'range', label: 'seed', value: 3, min: 1, max: 40, step: 1 }
  ];

  const METRICS = [
    { id: 'mh-binary', label: 'Size in binary', note: 'and the trees that spells' },
    { id: 'mh-trees', label: 'Trees in the forest', note: 'one per set bit' },
    { id: 'mh-spine', label: 'Leftist right spine', note: 'against the log₂(n + 1) bound' },
    { id: 'mh-meld', label: 'Comparisons to meld', note: 'folding every heap into one' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Elements and meld workload', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The binomial forest, read as a binary number</div>' +
      '<div class="card-body"><pre class="step-work" id="mh-forest"></pre>' +
      '<p class="note" id="mh-forest-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Folding many heaps into one</div>' +
      '<div class="card-body"><table class="ref-table" id="mh-meld-table"><thead><tr>' +
      '<th>Family</th><th>Comparisons</th><th>Per element</th><th>Meld cost</th><th>What the meld is</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mh-meld-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Leftist against skew: the field, and what dropping it costs</div>' +
      '<div class="card-body"><table class="ref-table" id="mh-leftist"><thead><tr>' +
      '<th>Family</th><th>Right spine</th><th>Bound</th><th>Height</th><th>Child swaps</th><th>Per-node metadata</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mh-leftist-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
