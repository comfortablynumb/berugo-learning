/** Markup for "Languages and the hierarchy". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HierarchyTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'hier-language', kind: 'select', label: 'the language', value: 'ends-abb',
      options: [
        { value: 'even-a', label: 'an even number of a' },
        { value: 'ends-abb', label: 'ends in abb' },
        { value: 'div3', label: 'binary numerals divisible by 3' },
        { value: 'anbn', label: 'aⁿbⁿ' },
        { value: 'palindrome', label: 'palindromes' },
        { value: 'anbncn', label: 'aⁿbⁿcⁿ' },
        { value: 'squares', label: 'a to a square length' },
        { value: 'halting', label: 'programs that halt on their own source' }
      ] },
    { id: 'hier-length', kind: 'range', label: 'test every string up to length', value: 6,
      min: 3, max: 9, step: 1 }
  ];

  const METRICS = [
    { id: 'hier-class', label: 'Language class', note: 'the weakest one that contains it' },
    { id: 'hier-machine', label: 'The machine that recognises it', note: 'and what it must remember' },
    { id: 'hier-accepted', label: 'Strings accepted', note: 'of every string tested' },
    { id: 'hier-agrees', label: 'A finite automaton agrees', note: 'checked string by string' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Pick a language', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">What the recogniser has to remember</div>' +
      '<div class="card-body"><div id="hier-verdict"></div>' +
      '<p class="note" id="hier-verdict-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The recogniser run, string by string</div>' +
      '<div class="card-body"><table class="ref-table" id="hier-run"><thead><tr>' +
      '<th>String</th><th>In the language</th><th>The finite automaton says</th><th>Agree</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="hier-run-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The whole catalogue, each with the weakest machine that works</div>' +
      '<div class="card-body"><table class="ref-table" id="hier-catalogue"><thead><tr>' +
      '<th>Language</th><th>Class</th><th>Machine</th><th>What it must remember</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="hier-catalogue-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The hierarchy, and the tooling each level maps onto</div>' +
      '<div class="card-body"><table class="ref-table" id="hier-levels"><thead><tr>' +
      '<th>Class</th><th>Machine</th><th>Closed under</th><th>Where you meet it</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="hier-levels-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
