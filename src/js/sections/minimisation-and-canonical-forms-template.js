/** Markup for "Minimisation and canonical forms". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MinimiseTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'min-pattern', kind: 'select', label: 'the language', value: '(a|b)*abb',
      options: [
        { value: '(a|b)*abb', label: '(a|b)*abb' },
        { value: '((a|b)(a|b))*', label: '((a|b)(a|b))* — even length' },
        { value: 'a*b*', label: 'a*b*' },
        { value: '(a|b)*a(a|b)(a|b)', label: '(a|b)*a(a|b)(a|b)' },
        { value: '(b|ab*a)*', label: '(b|ab*a)* — an even number of a' }
      ] },
    { id: 'min-algorithm', kind: 'select', label: 'algorithm to show', value: 'moore',
      options: [
        { value: 'moore', label: 'Moore — partition refinement' },
        { value: 'hopcroft', label: 'Hopcroft — worklist of splitters' },
        { value: 'brzozowski', label: 'Brzozowski — reverse, determinise, twice' }
      ] }
  ];

  const METRICS = [
    { id: 'min-before', label: 'States before', note: 'from the subset construction' },
    { id: 'min-after', label: 'States after', note: 'by the selected algorithm' },
    { id: 'min-classes', label: 'Myhill–Nerode classes', note: 'computed from the language itself' },
    { id: 'min-same', label: 'All three agree', note: 'Moore, Hopcroft and Brzozowski' }
  ];

  function render() {
    return '<div class="card"><div class="card-header">The minimal machine</div>' +
      '<div class="card-body"><div id="min-graph" class="chart-host"></div>' +
      '<p class="note" id="min-graph-note"></p></div></div>' +
      '<div class="grid-2" style="margin-top:.875rem">' +
      scope.ControlPanel.markup({ title: 'Language and algorithm', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Where each algorithm ended up</div>' +
      '<div class="card-body"><div id="min-verdict"></div>' +
      '<p class="note" id="min-verdict-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Partition refinement, round by round</div>' +
      '<div class="card-body"><table class="ref-table" id="min-rounds"><thead><tr>' +
      '<th>Round</th><th>Blocks</th><th>The partition</th><th>Split on</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="min-rounds-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The equivalence classes, and the suffix that separates each pair</div>' +
      '<div class="card-body"><table class="ref-table" id="min-classes-table"><thead><tr>' +
      '<th>Prefix</th><th>Against</th><th>Told apart by</th><th>Which one accepts</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="min-classes-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Three algorithms on the same machine</div>' +
      '<div class="card-body"><table class="ref-table" id="min-algorithms"><thead><tr>' +
      '<th>Algorithm</th><th>Result</th><th>Cost</th><th>What it is good for</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="min-algorithms-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
