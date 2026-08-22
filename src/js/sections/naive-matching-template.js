/** Markup for "The matching problem and the naive algorithm". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.NaiveMatchingTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'nm-corpus', kind: 'select', label: 'corpus', value: 'english',
      options: [{ value: 'english', label: 'English — 26 letters, uneven frequencies' },
        { value: 'source', label: 'source code — punctuation and long identifiers' },
        { value: 'dna', label: 'DNA — a four-letter alphabet' },
        { value: 'logs', label: 'log lines — highly repetitive' },
        { value: 'binary', label: 'binary — two symbols' },
        { value: 'adversarial', label: 'adversarial — aaa…aab in aaa…a' },
        { value: 'repeated', label: 'repeated — one character, matches everywhere' }] },
    { id: 'nm-pattern', kind: 'text', label: 'pattern (blank uses the corpus default)', value: '' },
    { id: 'nm-size', kind: 'range', label: 'text length', value: 4000, min: 500, max: 12000, step: 500 },
    { id: 'nm-offset', kind: 'range', label: 'alignment shown in the picture', value: 0, min: 0, max: 60, step: 1 }
  ];

  const METRICS = [
    { id: 'nm-occurrences', label: 'Occurrences', note: 'found by the naive scan' },
    { id: 'nm-comparisons', label: 'Character comparisons', note: 'per text character' },
    { id: 'nm-entered', label: 'Inner loops entered', note: 'what the first-character filter removes' },
    { id: 'nm-worst', label: 'Against the worst case', note: 'n × m is the bound; this is the fraction of it' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The text and the pattern', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">One alignment, character by character</div>' +
      '<div class="card-body"><div id="nm-align"></div>' +
      '<p class="note" id="nm-align-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Where the comparisons go, alignment by alignment</div>' +
      '<div class="card-body"><div id="nm-chart"></div><div id="nm-legend"></div>' +
      '<p class="note" id="nm-profile-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The same scan on every corpus</div>' +
      '<div class="card-body"><table class="ref-table" id="nm-corpora"><thead><tr>' +
      '<th>Corpus</th><th>Alphabet</th><th>Occurrences</th><th>Comparisons</th>' +
      '<th>Per character</th><th>Inner loops entered</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="nm-corpora-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What the filter actually buys</div>' +
      '<div class="card-body"><table class="ref-table" id="nm-filter"><thead><tr>' +
      '<th>Variant</th><th>Alignments</th><th>Inner loops entered</th><th>Skipped by the filter</th>' +
      '<th>Character comparisons</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="nm-filter-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The families, and which question each answers</div>' +
      '<div class="card-body"><div id="nm-families"></div>' +
      '<p class="note" id="nm-families-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
