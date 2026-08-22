/** Markup for "Palindromes: Manacher and the palindromic tree". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PalindromesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'pal-string', kind: 'text', label: 'string', value: 'abacabadabacaba' },
    { id: 'pal-family', kind: 'select', label: 'family for the growth panel', value: 'random',
      options: [{ value: 'random', label: 'random over two letters' },
        { value: 'repeated', label: 'one repeated character — every substring is a palindrome' },
        { value: 'distinct', label: 'all distinct — no palindrome longer than one' },
        { value: 'nested', label: 'nested — abacabadabacaba and its extensions' }] },
    { id: 'pal-size', kind: 'range', label: 'length for the growth panel', value: 200, min: 20, max: 800, step: 20 },
    { id: 'pal-seed', kind: 'range', label: 'seed', value: 1, min: 1, max: 20, step: 1 }
  ];

  const METRICS = [
    { id: 'pal-longest', label: 'Longest palindrome', note: 'and where it starts' },
    { id: 'pal-reuse', label: 'Positions answered by the mirror', note: 'no comparison needed at all' },
    { id: 'pal-count', label: 'Palindromic substrings', note: 'counting multiplicity' },
    { id: 'pal-distinct', label: 'Distinct palindromic substrings', note: 'the eertree node count' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The string', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The radius array, and the mirror it reused</div>' +
      '<div class="card-body"><div id="pal-radii"></div>' +
      '<p class="note" id="pal-radii-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The longest palindrome, drawn</div>' +
      '<div class="card-body"><div id="pal-align"></div>' +
      '<p class="note" id="pal-align-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Against expanding around every centre</div>' +
      '<div class="card-body"><div id="pal-chart"></div><div id="pal-legend"></div>' +
      '<table class="ref-table" id="pal-growth"><thead><tr>' +
      '<th>Length</th><th>Manacher comparisons</th><th>Expand-around-centre</th><th>Ratio</th>' +
      '<th>Palindromic substrings</th><th>Distinct</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="pal-growth-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The eertree, and its two roots</div>' +
      '<div class="card-body"><div id="pal-tree"></div>' +
      '<p class="note" id="pal-tree-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
