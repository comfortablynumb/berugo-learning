/** Markup for "Ternary search trees and dictionary automata". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DictionaryAutomataTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'da-count', kind: 'range', label: 'words', value: 883, min: 20, max: 883, step: 1 },
    { id: 'da-order', kind: 'select', label: 'ternary insertion order', value: 'sorted',
      options: [{ value: 'sorted', label: 'sorted — the degenerate case' },
        { value: 'balanced', label: 'recursive median — what a real build does' },
        { value: 'shuffled', label: 'shuffled' }] },
    { id: 'da-neighbour', kind: 'text', label: 'near-neighbour query', value: 'cat', maxLength: 16,
      note: 'Words within the substitution budget below, found by pruning rather than by scanning.' },
    { id: 'da-budget', kind: 'range', label: 'substitutions allowed', value: 1, min: 0, max: 3, step: 1 },
    { id: 'da-seed', kind: 'range', label: 'shuffle seed', value: 5, min: 1, max: 40, step: 1 }
  ];

  const METRICS = [
    { id: 'da-nodes', label: 'DAWG states', note: 'against the trie over the same words' },
    { id: 'da-merged', label: 'States merged', note: 'suffixes shared during minimisation' },
    { id: 'da-height', label: 'Ternary height', note: 'insertion order decides this' },
    { id: 'da-neighbours', label: 'Near neighbours', note: 'and the nodes visited to find them' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Words, insertion order and a near-neighbour query', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Minimisation: the register merging equivalent states</div>' +
      '<div class="card-body"><div id="da-chart"></div>' +
      '<div id="da-legend"></div></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Four dictionaries over the identical word list</div>' +
      '<div class="card-body"><table class="ref-table" id="da-table"><thead><tr>' +
      '<th>Structure</th><th>Nodes / states</th><th>Bytes</th><th>Bytes per key</th>' +
      '<th>Work per lookup</th><th>Correct</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="da-table-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The near-neighbour query, and what the pruning saved</div>' +
      '<div class="card-body"><pre class="step-work" id="da-neighbour-out"></pre>' +
      '<p class="note" id="da-neighbour-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
