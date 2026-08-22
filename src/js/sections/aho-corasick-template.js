/** Markup for "Aho-Corasick multi-pattern matching". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AhoCorasickTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ahc-set', kind: 'select', label: 'pattern set', value: 'suffix',
      options: [{ value: 'suffix', label: 'he, she, his, hers, her — one is a suffix of another' },
        { value: 'corpus', label: 'words taken from the corpus' },
        { value: 'dna', label: 'DNA motifs' },
        { value: 'logs', label: 'log keywords' }] },
    { id: 'ahc-corpus', kind: 'select', label: 'corpus', value: 'fixture',
      options: [{ value: 'fixture', label: 'the ushers line — the nested case, on purpose' },
        { value: 'english', label: 'English' },
        { value: 'source', label: 'source code' },
        { value: 'dna', label: 'DNA' },
        { value: 'logs', label: 'log lines' }] },
    { id: 'ahc-size', kind: 'range', label: 'text length', value: 4000, min: 500, max: 12000, step: 500 },
    { id: 'ahc-output', kind: 'checkbox', label: 'follow output links (turn off to see what breaks)', value: true }
  ];

  const METRICS = [
    { id: 'ahc-matches', label: 'Matches reported', note: 'against a brute-force multi-pattern oracle' },
    { id: 'ahc-missing', label: 'Matches missed', note: 'what dropping the output links costs' },
    { id: 'ahc-states', label: 'States in the automaton', note: 'one per distinct prefix of any pattern' },
    { id: 'ahc-saving', label: 'Against one scan per pattern', note: 'the whole point of the automaton' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The patterns and the text', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The automaton: goto edges, failure links, output links</div>' +
      '<div class="card-body"><div id="ahc-automaton"></div>' +
      '<p class="note" id="ahc-automaton-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The matches, and the ones the output chain is responsible for</div>' +
      '<div class="card-body"><div id="ahc-found"></div>' +
      '<p class="note" id="ahc-found-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">One pass against one scan per pattern</div>' +
      '<div class="card-body"><div id="ahc-chart"></div><div id="ahc-legend"></div>' +
      '<table class="ref-table" id="ahc-scaling"><thead><tr>' +
      '<th>Patterns</th><th>States</th><th>Automaton comparisons</th>' +
      '<th>One naive scan each</th><th>Saving</th><th>Matches agree?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ahc-scaling-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What the output links cost when they are missing</div>' +
      '<div class="card-body"><table class="ref-table" id="ahc-links"><thead><tr>' +
      '<th>Configuration</th><th>Matches reported</th><th>Truth</th><th>Missed</th>' +
      '<th>Failure links followed</th><th>Output links followed</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ahc-links-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The goto table, and what it costs per alphabet</div>' +
      '<div class="card-body"><table class="ref-table" id="ahc-table"><thead><tr>' +
      '<th>Corpus</th><th>Alphabet</th><th>States</th><th>Sparse edges</th>' +
      '<th>Dense table cells</th><th>Ratio</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ahc-table-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
