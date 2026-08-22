/** Markup for "KMP and the prefix function". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.KmpPrefixFunctionTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'kpf-pattern', kind: 'text', label: 'pattern', value: 'ababcabab' },
    { id: 'kpf-corpus', kind: 'select', label: 'corpus for the scan', value: 'english',
      options: [{ value: 'english', label: 'English' },
        { value: 'dna', label: 'DNA — four letters' },
        { value: 'logs', label: 'log lines' },
        { value: 'binary', label: 'binary' },
        { value: 'adversarial', label: 'adversarial — aaa…aab in aaa…a' },
        { value: 'repeated', label: 'repeated — matches everywhere' }] },
    { id: 'kpf-size', kind: 'range', label: 'text length', value: 4000, min: 500, max: 12000, step: 500 },
    { id: 'kpf-word', kind: 'select', label: 'periodicity fixture', value: 'fibonacci',
      options: [{ value: 'fibonacci', label: 'Fibonacci words' },
        { value: 'powers', label: 'exact powers — abcabcabc…' },
        { value: 'nearly', label: 'nearly periodic — one character changed' }] }
  ];

  const METRICS = [
    { id: 'kpf-border', label: 'Longest border', note: 'of the whole pattern' },
    { id: 'kpf-period', label: 'Smallest period', note: 'n minus the longest border' },
    { id: 'kpf-comparisons', label: 'Comparisons on the scan', note: 'per text character' },
    { id: 'kpf-backup', label: 'Text positions re-read', note: 'KMP never goes backwards' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The pattern and the text', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The border array, cell by cell</div>' +
      '<div class="card-body"><div id="kpf-array"></div>' +
      '<p class="note" id="kpf-array-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What the border of the whole pattern actually is</div>' +
      '<div class="card-body"><div id="kpf-align"></div>' +
      '<p class="note" id="kpf-align-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The scan, against the naive one it replaces</div>' +
      '<div class="card-body"><table class="ref-table" id="kpf-scan"><thead><tr>' +
      '<th>Matcher</th><th>Occurrences</th><th>Comparisons</th><th>Per character</th>' +
      '<th>Preprocessing</th><th>Agrees?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="kpf-scan-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Four things the border array answers that are not matching</div>' +
      '<div class="card-body"><div id="kpf-uses"></div>' +
      '<p class="note" id="kpf-uses-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Periods, on the family the question is about</div>' +
      '<div class="card-body"><table class="ref-table" id="kpf-periods"><thead><tr>' +
      '<th>String</th><th>Length</th><th>Longest border</th><th>Smallest period</th>' +
      '<th>Exact power?</th><th>Preprocessing steps</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="kpf-periods-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The automaton view: one lookup per character, paid for in cells</div>' +
      '<div class="card-body"><table class="ref-table" id="kpf-automaton"><thead><tr>' +
      '<th>Corpus</th><th>Alphabet</th><th>States</th><th>Table cells</th>' +
      '<th>Comparisons, border array</th><th>Comparisons, table</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="kpf-automaton-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
