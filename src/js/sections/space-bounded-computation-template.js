/** Markup for "Space-bounded computation". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SpaceBoundedTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'spa-graph', kind: 'select', label: 'the graph', value: 'path',
      options: [
        { value: 'path', label: 'a path — every vertex leads to the next' },
        { value: 'bushy', label: 'a path with a dead end at every step' },
        { value: 'split', label: 'two components — the answer is no' }
      ] },
    { id: 'spa-size', kind: 'range', label: 'vertices on the main path', value: 8,
      min: 4, max: 12, step: 1 },
    { id: 'spa-projected', kind: 'range', label: 'project the memory out to n', value: 256,
      min: 16, max: 4096, step: 16 }
  ];

  const METRICS = [
    { id: 'spa-agree', label: 'Both answer the same', note: 'the algorithms must agree' },
    { id: 'spa-bfs', label: 'BFS working memory', note: 'measured, in bits held at once' },
    { id: 'spa-savitch', label: 'Savitch working memory', note: 'measured the same way' },
    { id: 'spa-trade', label: 'Time paid for the space', note: 'Savitch steps over BFS steps' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Graph, size and projection', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Two algorithms, one question</div>' +
      '<div class="card-body"><table class="ref-table" id="spa-compare"><thead><tr>' +
      '<th>Algorithm</th><th>Reachable</th><th>Steps</th><th>Peak bits held</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="spa-compare-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">How the two memory curves diverge</div>' +
      '<div class="card-body"><table class="ref-table" id="spa-growth"><thead><tr>' +
      '<th>Vertices</th><th>BFS bits (measured)</th><th>Savitch bound (bits)</th>' +
      '<th>Ratio</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="spa-growth-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Savitch, recursing on the midpoint</div>' +
      '<div class="card-body"><div id="spa-recursion" class="mono" ' +
      'style="font-size:.82rem"></div>' +
      '<p class="note" id="spa-recursion-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The space classes</div>' +
      '<div class="card-body"><table class="ref-table" id="spa-classes"><thead><tr>' +
      '<th>Class</th><th>Definition</th><th>Canonical problem</th><th>The thing to know</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="spa-classes-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Recomputation against caching, in practice</div>' +
      '<div class="card-body"><table class="ref-table" id="spa-practice"><thead><tr>' +
      '<th>System</th><th>Stores</th><th>Or re-derives</th><th>Why it chose that</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="spa-practice-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
