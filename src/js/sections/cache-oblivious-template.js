/** Markup for "Cache-oblivious algorithms". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CacheObliviousTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'cob-size', kind: 'select', label: 'matrix side', value: '64',
      options: [
        { value: '32', label: '32 × 32' },
        { value: '64', label: '64 × 64' },
        { value: '96', label: '96 × 96' }
      ] },
    { id: 'cob-cutoff', kind: 'select', label: 'recursion base case', value: '8',
      options: [
        { value: '2', label: '2 × 2' },
        { value: '4', label: '4 × 4' },
        { value: '8', label: '8 × 8' },
        { value: '16', label: '16 × 16' }
      ] },
    { id: 'cob-height', kind: 'range', label: 'search tree height', value: 16, min: 10, max: 20,
      step: 2 }
  ];

  const METRICS = [
    { id: 'cob-tuned', label: 'The tuned tile changes', note: 'best tile size, smallest cache to largest' },
    { id: 'cob-penalty', label: 'Recursive against tuned', note: 'worst penalty across every cache size' },
    { id: 'cob-naive', label: 'The unblocked loop', note: 'misses against the tuned version' },
    { id: 'cob-veb', label: 'van Emde Boas layout', note: 'misses per search against a sorted array' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A matrix, a base case and a tree', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Misses against cache size: tuned, oblivious and naive</div>' +
      '<div class="card-body"><div id="cob-chart" class="chart-host"></div>' +
      '<p class="note" id="cob-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Matrix multiplication at four cache sizes, with the tile retuned each time</div>' +
      '<div class="card-body"><table class="ref-table" id="cob-multiply"><thead><tr>' +
      '<th>Cache</th><th>Unblocked loop</th><th>Best tile</th><th>Misses at that tile</th>' +
      '<th>Recursive, no parameter</th><th>Recursive ÷ tuned</th><th>Naive ÷ tuned</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="cob-multiply-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every tile size at every cache size, so the retuning is visible</div>' +
      '<div class="card-body"><table class="ref-table" id="cob-tiles"><thead><tr>' +
      '<th>Cache</th><th>tile 4</th><th>tile 8</th><th>tile 16</th><th>tile 32</th>' +
      '<th>recursive</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="cob-tiles-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Three layouts of the same tree, and the same comparisons</div>' +
      '<div class="card-body"><table class="ref-table" id="cob-layout"><thead><tr>' +
      '<th>Height</th><th>Nodes</th><th>Comparisons per search</th><th>Level order</th>' +
      '<th>Sorted array</th><th>van Emde Boas</th><th>log_B n</th><th>Saving</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="cob-layout-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
