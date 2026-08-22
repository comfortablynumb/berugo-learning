/** Markup for "The Z-algorithm and string periodicity". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ZAlgorithmTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'zal-string', kind: 'text', label: 'string for the Z-array', value: 'aabxaabxcaabxaabxay' },
    { id: 'zal-pattern', kind: 'text', label: 'pattern for the matching panel', value: 'aabxaabxay' },
    { id: 'zal-corpus', kind: 'select', label: 'corpus for the scan', value: 'english',
      options: [{ value: 'english', label: 'English' },
        { value: 'dna', label: 'DNA' },
        { value: 'adversarial', label: 'adversarial' },
        { value: 'repeated', label: 'repeated' },
        { value: 'binary', label: 'binary' }] },
    { id: 'zal-size', kind: 'range', label: 'text length', value: 4000, min: 500, max: 12000, step: 500 },
    { id: 'zal-order', kind: 'range', label: 'Fibonacci word order', value: 8, min: 3, max: 14, step: 1 }
  ];

  const METRICS = [
    { id: 'zal-inside', label: 'Positions answered by the mirror', note: 'no comparison needed at all' },
    { id: 'zal-extensions', label: 'Characters compared past the window', note: 'the only real work' },
    { id: 'zal-oracle', label: 'Matches the naive Z-array?', note: 'computed by definition, O(n²)' },
    { id: 'zal-sentinel', label: 'Sentinel chosen', note: 'a character in neither string' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The strings', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The Z-array, and which case answered each position</div>' +
      '<div class="card-body"><div id="zal-table"></div>' +
      '<p class="note" id="zal-table-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The window, and the amortisation that makes it linear</div>' +
      '<div class="card-body"><div id="zal-chart"></div><div id="zal-legend"></div>' +
      '<p class="note" id="zal-window-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Matching by concatenation, and the sentinel that must not appear</div>' +
      '<div class="card-body"><div id="zal-align"></div>' +
      '<table class="ref-table" id="zal-scan"><thead><tr>' +
      '<th>Matcher</th><th>Occurrences</th><th>Comparisons</th><th>Per character</th><th>Agrees?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="zal-scan-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Fine and Wilf: two short periods force a shorter one</div>' +
      '<div class="card-body"><table class="ref-table" id="zal-periods"><thead><tr>' +
      '<th>Fibonacci word</th><th>Length</th><th>p</th><th>q</th><th>p + q − gcd</th>' +
      '<th>Lemma applies?</th><th>gcd is a period?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="zal-periods-note"></p>' +
      '<div id="zal-tight"></div>' +
      '<p class="note" id="zal-tight-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
