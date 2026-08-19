/** Markup for "Suffix arrays and LCP". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SuffixArraysTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'sa-text', kind: 'text', label: 'text', value: 'mississippi', maxLength: 40 },
    { id: 'sa-method', kind: 'select', label: 'construction', value: 'doubling',
      options: [{ value: 'doubling', label: 'prefix doubling — sort by 1, 2, 4, 8 … characters' },
        { value: 'sais', label: 'SA-IS — induced sorting, linear' },
        { value: 'naive', label: 'naive — sort the suffixes as strings' }] },
    { id: 'sa-pattern', kind: 'text', label: 'pattern', value: 'ssi', maxLength: 20,
      note: 'Found by binary search over the array: O(m log n), no index of positions needed.' },
    { id: 'sa-corpus', kind: 'select', label: 'measure construction on', value: 'dna',
      options: [{ value: 'dna', label: 'DNA, 4 000 characters' },
        { value: 'english', label: 'English, 4 000 characters' },
        { value: 'repeat', label: '4 000 copies of one letter' },
        { value: 'binary', label: 'a two-letter alphabet, 4 000 characters' }] }
  ];

  const METRICS = [
    { id: 'sa-rounds', label: 'Doubling rounds', note: 'ceil(log2 n) of them' },
    { id: 'sa-distinct', label: 'Distinct substrings', note: 'n(n+1)/2 − Σ lcp' },
    { id: 'sa-occurrences', label: 'Occurrences', note: 'one contiguous range of the array' },
    { id: 'sa-repeated', label: 'Longest repeated substring', note: 'the largest LCP entry' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Text, construction and a pattern', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The array, the LCPs and the matching range</div>' +
      '<div class="card-body"><div id="sa-table"></div>' +
      '<p class="note" id="sa-table-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Prefix doubling: the rank table after each round</div>' +
      '<div class="card-body"><div id="sa-rounds-table"></div>' +
      '<p class="note" id="sa-rounds-table-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The three constructions on a real input</div>' +
      '<div class="card-body"><table class="ref-table" id="sa-methods"><thead><tr>' +
      '<th>Method</th><th>Comparisons</th><th>Character comparisons</th><th>Rounds / recursions</th>' +
      '<th>Same array</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="sa-methods-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
