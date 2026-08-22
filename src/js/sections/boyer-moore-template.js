/** Markup for "Boyer-Moore and skipping algorithms". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BoyerMooreTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'bmr-corpus', kind: 'select', label: 'corpus', value: 'english',
      options: [{ value: 'english', label: 'English — 26 letters' },
        { value: 'source', label: 'source code' },
        { value: 'dna', label: 'DNA — four letters' },
        { value: 'logs', label: 'log lines' },
        { value: 'binary', label: 'binary — two symbols' },
        { value: 'adversarial', label: 'adversarial' },
        { value: 'repeated', label: 'repeated — matches everywhere' }] },
    { id: 'bmr-pattern', kind: 'text', label: 'pattern (blank uses the corpus default)', value: '' },
    { id: 'bmr-size', kind: 'range', label: 'text length', value: 4000, min: 500, max: 12000, step: 500 },
    { id: 'bmr-offset', kind: 'range', label: 'alignment shown in the picture', value: 0, min: 0, max: 80, step: 1 }
  ];

  const METRICS = [
    { id: 'bmr-rate', label: 'Characters examined', note: 'per text character — under 1 is sublinear' },
    { id: 'bmr-shift', label: 'Mean shift', note: 'how far the pattern moves per alignment' },
    { id: 'bmr-decider', label: 'Which rule decided', note: 'bad character against good suffix' },
    { id: 'bmr-agree', label: 'Agrees with the naive scan?', note: 'occurrence lists compared position by position' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The text and the pattern', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">One alignment, compared right to left</div>' +
      '<div class="card-body"><div id="bmr-align"></div>' +
      '<p class="note" id="bmr-align-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The only matcher that gets faster as the pattern grows</div>' +
      '<div class="card-body"><div id="bmr-chart"></div><div id="bmr-legend"></div>' +
      '<table class="ref-table" id="bmr-lengths"><thead><tr>' +
      '<th>Pattern length</th><th>Occurrences</th><th>Boyer-Moore</th><th>KMP</th>' +
      '<th>naive</th><th>Rabin-Karp</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bmr-lengths-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What each rule is worth, alone and together</div>' +
      '<div class="card-body"><table class="ref-table" id="bmr-rules"><thead><tr>' +
      '<th>Rules in use</th><th>Comparisons</th><th>Alignments</th><th>Comparisons per alignment</th>' +
      '<th>Bad character decided</th><th>Good suffix decided</th><th>Tied</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bmr-rules-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The bad-character table, and the jumps it licenses</div>' +
      '<div class="card-body"><div id="bmr-table"></div>' +
      '<p class="note" id="bmr-table-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Boyer-Moore, Horspool and Sunday on every corpus</div>' +
      '<div class="card-body"><table class="ref-table" id="bmr-corpora"><thead><tr>' +
      '<th>Corpus</th><th>Alphabet</th><th>Boyer-Moore</th><th>Horspool</th><th>Sunday</th>' +
      '<th>Best of the three</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bmr-corpora-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
