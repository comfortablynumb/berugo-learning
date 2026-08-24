/** Markup for "Weighted and probabilistic automata". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.WeightedTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'wgt-observations', kind: 'select', label: 'the observed sequence',
      value: 'walk,shop,clean',
      options: [
        { value: 'walk,shop,clean', label: 'walk, shop, clean' },
        { value: 'clean,clean,clean', label: 'clean, clean, clean' },
        { value: 'walk,walk,walk,shop,clean,clean', label: 'walk × 3, shop, clean × 2' },
        { value: 'shop,walk,clean,shop,walk', label: 'shop, walk, clean, shop, walk' }
      ] },
    { id: 'wgt-symbol', kind: 'select', label: 'symbol to repeat for the underflow test',
      value: 'clean',
      options: [
        { value: 'walk', label: 'walk' },
        { value: 'shop', label: 'shop' },
        { value: 'clean', label: 'clean' }
      ] }
  ];

  const METRICS = [
    { id: 'wgt-path', label: 'The Viterbi path', note: 'the most probable state sequence' },
    { id: 'wgt-brute', label: 'Agrees with brute force', note: 'every path enumerated' },
    { id: 'wgt-total', label: 'Probability of the observations', note: 'summed over every path' },
    { id: 'wgt-underflow', label: 'Naive version underflows at', note: 'sequence length, in plain probabilities' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Sequence and stress test', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The decoding</div>' +
      '<div class="card-body"><div id="wgt-decode"></div>' +
      '<p class="note" id="wgt-decode-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The trellis: one column per observation</div>' +
      '<div class="card-body"><table class="ref-table" id="wgt-trellis"><thead><tr>' +
      '<th>Step</th><th>Observation</th><th>Best score, sunny</th><th>Best score, rainy</th>' +
      '<th>On the best path</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="wgt-trellis-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The best path against the posterior, which answer different questions</div>' +
      '<div class="card-body"><table class="ref-table" id="wgt-posterior"><thead><tr>' +
      '<th>Step</th><th>Viterbi says</th><th>P(sunny | everything)</th><th>P(rainy | everything)</th>' +
      '<th>Most likely alone</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="wgt-posterior-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Log domain against plain probabilities</div>' +
      '<div class="card-body"><table class="ref-table" id="wgt-underflow-table"><thead><tr>' +
      '<th>Sequence length</th><th>Plain probability</th><th>Log domain</th><th>Usable</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="wgt-underflow-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Semirings: what changes when the weights change meaning</div>' +
      '<div class="card-body"><table class="ref-table" id="wgt-semirings"><thead><tr>' +
      '<th>Semiring</th><th>Along a path</th><th>Between paths</th><th>What it computes</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="wgt-semirings-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
