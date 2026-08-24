/** Markup for "Proving a language is not regular". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.NonRegularTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'nrg-language', kind: 'select', label: 'the language', value: 'anbn',
      options: [
        { value: 'anbn', label: 'aⁿbⁿ' },
        { value: 'palindrome', label: 'palindromes' },
        { value: 'squares', label: 'a to a square length' },
        { value: 'even-a', label: 'an even number of a — this one IS regular' }
      ] },
    { id: 'nrg-pump', kind: 'range', label: 'the adversary’s pumping length', value: 4, min: 2,
      max: 6, step: 1 },
    { id: 'nrg-family', kind: 'range', label: 'prefixes in the distinguishing family', value: 6,
      min: 3, max: 9, step: 1 }
  ];

  const METRICS = [
    { id: 'nrg-splits', label: 'Decompositions the adversary can pick', note: 'all of them must fail' },
    { id: 'nrg-survivors', label: 'Splits that survive pumping', note: 'one is enough to lose the game' },
    { id: 'nrg-pairs', label: 'Prefix pairs told apart', note: 'by an explicit witness suffix' },
    { id: 'nrg-verdict', label: 'Verdict', note: 'what the two tools conclude' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Language and budgets', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The round, played out</div>' +
      '<div class="card-body"><div id="nrg-round"></div>' +
      '<p class="note" id="nrg-round-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every decomposition the adversary may choose</div>' +
      '<div class="card-body"><table class="ref-table" id="nrg-splits-table"><thead><tr>' +
      '<th>x</th><th>y</th><th>z</th><th>Pumped to</th><th>Leaves the language</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="nrg-splits-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Myhill–Nerode: an infinite family, pairwise distinguishable</div>' +
      '<div class="card-body"><table class="ref-table" id="nrg-family-table"><thead><tr>' +
      '<th>Prefix</th><th>Against</th><th>Witness suffix</th><th>Accepted for</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="nrg-family-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Two tools, and what each one can and cannot do</div>' +
      '<div class="card-body"><table class="ref-table" id="nrg-tools"><thead><tr>' +
      '<th>Tool</th><th>Proves</th><th>Cannot prove</th><th>The usual mistake</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="nrg-tools-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
