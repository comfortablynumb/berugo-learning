/** Markup for "Random contraction and Karger's min cut". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RandomContractionTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'krg-family', kind: 'select', label: 'the graph', value: 'clusters',
      options: [
        { value: 'clusters', label: 'two cliques joined by a few edges — one minimum cut' },
        { value: 'cycle', label: 'a cycle — n(n−1)/2 minimum cuts, and the bound is exact' }
      ] },
    { id: 'krg-size', kind: 'range', label: 'vertices', value: 12, min: 8, max: 16, step: 2 },
    { id: 'krg-bridges', kind: 'range', label: 'edges across the cut (two-cliques only)',
      value: 2, min: 1, max: 5, step: 1 },
    { id: 'krg-trials', kind: 'select', label: 'independent contraction runs', value: '2000',
      options: [
        { value: '300', label: '300' },
        { value: '2000', label: '2 000 — enough to measure a 1.5% rate' },
        { value: '8000', label: '8 000' }
      ] },
    { id: 'krg-rule', kind: 'select', label: 'which edge to contract', value: 'edge',
      options: [
        { value: 'edge', label: 'uniformly among surviving edges — the algorithm' },
        { value: 'pair', label: 'a random supernode, then one of its edges — the plausible mistake' }
      ] }
  ];

  const METRICS = [
    { id: 'krg-cut', label: 'Minimum cut', note: 'from the enumeration oracle' },
    { id: 'krg-rate', label: 'This cut, per run', note: 'measured against 2/(n(n−1))' },
    { id: 'krg-any', label: 'Some minimum cut, per run', note: 'a different question, and a different number' },
    { id: 'krg-stein', label: 'Karger–Stein', note: 'the recursive version, one run' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A graph and a contraction rule', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The graph, with the surviving cut highlighted</div>' +
      '<div class="card-body"><div id="krg-canvas" class="chart-host"></div>' +
      '<p class="note" id="krg-canvas-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">One run, contraction by contraction</div>' +
      '<div class="card-body"><table class="ref-table" id="krg-trace"><thead><tr>' +
      '<th>Step</th><th>Merged</th><th>Supernodes left</th><th>Edges surviving</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="krg-trace-note"></p></div></div>' +
      '<div class="grid-even" style="margin-top:.875rem">' +
      '<div class="card"><div class="card-header">Success as the trial budget grows</div>' +
      '<div class="card-body"><div id="krg-chart" class="chart-host"></div>' +
      '<div id="krg-legend"></div><p class="note" id="krg-chart-note"></p></div></div>' +
      '<div class="card"><div class="card-header">The two contraction rules on the same graph</div>' +
      '<div class="card-body"><table class="ref-table" id="krg-rules"><thead><tr>' +
      '<th>Rule</th><th>Runs finding the cut</th><th>Rate</th><th>Bound</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="krg-rules-note"></p></div></div>' +
      '</div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What repetition costs, and what Karger–Stein saves</div>' +
      '<div class="card-body"><table class="ref-table" id="krg-cost"><thead><tr>' +
      '<th>Approach</th><th>Success per run</th><th>Runs for 99% confidence</th>' +
      '<th>Contractions per run</th><th>Total contractions</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="krg-cost-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
