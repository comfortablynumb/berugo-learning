/** Markup for "Bipartite matching". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BipartiteMatchingTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'bmt-shape', kind: 'select', label: 'bipartite graph', value: 'random',
      options: [{ value: 'random', label: 'random — three partners each' },
        { value: 'sparse', label: 'sparse — two partners each' },
        { value: 'dense', label: 'dense — five partners each' },
        { value: 'unbalanced', label: 'unbalanced — half as many on the right' },
        { value: 'deficiency', label: 'deficiency — three sharing two' },
        { value: 'regular', label: 'regular — d disjoint perfect matchings' }] },
    { id: 'bmt-left', kind: 'range', label: 'vertices on each side', value: 9, min: 4, max: 16, step: 1 },
    { id: 'bmt-seed', kind: 'range', label: 'graph seed', value: 1, min: 1, max: 40, step: 1 },
    { id: 'bmt-stable', kind: 'range', label: 'people per side, stable matching', value: 8, min: 4, max: 16, step: 1 },
    { id: 'bmt-proposer', kind: 'select', label: 'who proposes', value: 'left',
      options: [{ value: 'left', label: 'the left side proposes' },
        { value: 'right', label: 'the right side proposes' }] }
  ];

  const METRICS = [
    { id: 'bmt-size', label: 'Maximum matching', note: 'and whether it is perfect' },
    { id: 'bmt-cover', label: 'Minimum vertex cover', note: 'Koenig says it is the same number' },
    { id: 'bmt-hall', label: 'Hall violator', note: 'the set that proves no perfect matching exists' },
    { id: 'bmt-agree', label: 'Do all three agree?', note: 'Kuhn, Hopcroft-Karp and a unit-capacity flow' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The graph and the proposals', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The matching, with the chosen edges drawn strongly</div>' +
      '<div class="card-body"><div id="bmt-map"></div>' +
      '<p class="note" id="bmt-map-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Three derivations of one number</div>' +
      '<div class="card-body"><table class="ref-table" id="bmt-compare"><thead><tr>' +
      '<th>Method</th><th>Size</th><th>Augmenting paths</th><th>Phases</th>' +
      '<th>Edges examined</th><th>Valid matching?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bmt-compare-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Koenig and Hall, read off the same alternating search</div>' +
      '<div class="card-body"><div id="bmt-structure"></div>' +
      '<p class="note" id="bmt-structure-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The phase count, against the square root it is supposed to follow</div>' +
      '<div class="card-body"><div id="bmt-chart"></div><div id="bmt-legend"></div>' +
      '<table class="ref-table" id="bmt-sweep"><thead><tr>' +
      '<th>Vertices per side</th><th>Matching</th><th>Hopcroft-Karp phases</th><th>√V</th>' +
      '<th>Kuhn edges examined</th><th>Hopcroft-Karp edges</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bmt-sweep-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Stable matching is a different problem with a different optimum</div>' +
      '<div class="card-body"><table class="ref-table" id="bmt-stable-table"><thead><tr>' +
      '<th>Run</th><th>Proposals</th><th>Rejections</th><th>Blocking pairs</th>' +
      '<th>Total rank of the left side</th><th>Pairs shared with the other run</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bmt-stable-note"></p>' +
      '<div id="bmt-ranks"></div>' +
      '<p class="note" id="bmt-ranks-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
