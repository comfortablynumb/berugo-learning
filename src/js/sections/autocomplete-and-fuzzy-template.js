/** Markup for "Autocomplete and fuzzy search". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AutocompleteAndFuzzyTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'af-query', kind: 'text', label: 'search box', value: 'cat', maxLength: 20,
      note: 'Three back-ends answer this in parallel; two are exact and one is not.' },
    { id: 'af-budget', kind: 'range', label: 'edit distance allowed', value: 1, min: 0, max: 3, step: 1 },
    { id: 'af-gram', kind: 'range', label: 'n-gram size', value: 2, min: 2, max: 4, step: 1,
      note: 'Bigger grams mean fewer candidates and worse recall.' },
    { id: 'af-prefix', kind: 'text', label: 'completion prefix', value: 'con', maxLength: 12,
      note: 'Top-k completion is a different query from fuzzy match, so it gets its own box.' },
    { id: 'af-topk', kind: 'range', label: 'completions to return', value: 8, min: 1, max: 25, step: 1 },
    { id: 'af-words', kind: 'range', label: 'dictionary size', value: 883, min: 50, max: 883, step: 1 }
  ];

  const METRICS = [
    { id: 'af-exact', label: 'Correct answers', note: 'brute force over the whole dictionary' },
    { id: 'af-cheapest', label: 'Fewest visits', note: 'among the exact back-ends' },
    { id: 'af-recall', label: 'n-gram recall', note: 'the price of being approximate' },
    { id: 'af-completions', label: 'Top-k completions', note: 'and the subtrees the maxima pruned' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Query, budget and dictionary', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Visits against edit budget, per back-end</div>' +
      '<div class="card-body"><div id="af-chart"></div><div id="af-legend"></div></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Three back-ends, one query</div>' +
      '<div class="card-body"><table class="ref-table" id="af-table"><thead><tr>' +
      '<th>Back-end</th><th>Visits</th><th>Correct answers found</th><th>Recall</th><th>Exact</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="af-table-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What each one returned</div>' +
      '<div class="card-body"><pre class="step-work" id="af-results"></pre>' +
      '<p class="note" id="af-results-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Top-k completion, with and without the subtree maxima</div>' +
      '<div class="card-body"><pre class="step-work" id="af-complete"></pre>' +
      '<p class="note" id="af-complete-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
