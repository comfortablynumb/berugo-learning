/** Markup for "Suffix trees". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SuffixTreesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'st-text', kind: 'text', label: 'text', value: 'banana', maxLength: 40,
      note: 'A terminator is appended, so every suffix ends at its own leaf.' },
    { id: 'st-phase', kind: 'range', label: 'phase (characters added)', value: 7, min: 1, max: 41, step: 1,
      note: 'Step through Ukkonen’s construction one character at a time.' },
    { id: 'st-pattern', kind: 'text', label: 'pattern', value: 'ana', maxLength: 20 },
    { id: 'st-corpus', kind: 'select', label: 'measure on', value: 'dna',
      options: [{ value: 'dna', label: 'DNA, 2 000 characters — a 4-letter alphabet' },
        { value: 'english', label: 'English, 2 000 characters' },
        { value: 'repeat', label: '2 000 copies of one letter — the blow-up case' }] }
  ];

  const METRICS = [
    { id: 'st-nodes', label: 'Nodes', note: 'against the suffix trie this compresses' },
    { id: 'st-bytes', label: 'Bytes per character', note: 'against a suffix array’s 9' },
    { id: 'st-occurrences', label: 'Occurrences', note: 'leaves below the match point' },
    { id: 'st-repeated', label: 'Longest repeated substring', note: 'the deepest internal node' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Text, phase and a pattern to find', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The tree at this phase</div>' +
      '<div class="card-body"><div id="st-chart"></div>' +
      '<p class="note" id="st-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Ukkonen, phase by phase: the active point and the remainder</div>' +
      '<div class="card-body"><div id="st-trace"></div>' +
      '<p class="note" id="st-trace-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What the tree costs, and what a suffix array costs instead</div>' +
      '<div class="card-body"><table class="ref-table" id="st-size-table"><thead><tr>' +
      '<th>Structure</th><th>Units</th><th>Per character</th><th>Bytes per character</th><th>Invariants</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="st-size-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
