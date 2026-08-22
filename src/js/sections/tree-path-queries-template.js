/** Markup for "Trees, LCA and path queries". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TreePathQueriesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'tpq-shape', kind: 'select', label: 'tree shape', value: 'random',
      options: [{ value: 'random', label: 'random — depth about log n' },
        { value: 'path', label: 'path — depth n, the worst case for a climb' },
        { value: 'star', label: 'star — depth 1, the best case' },
        { value: 'caterpillar', label: 'caterpillar — a spine with legs' },
        { value: 'binary', label: 'complete binary — depth exactly log n' }] },
    { id: 'tpq-nodes', kind: 'range', label: 'nodes', value: 200, min: 20, max: 1000, step: 20 },
    { id: 'tpq-queries', kind: 'range', label: 'queries', value: 200, min: 50, max: 800, step: 50 },
    { id: 'tpq-seed', kind: 'range', label: 'tree seed', value: 4, min: 1, max: 40, step: 1 },
    { id: 'tpq-pair', kind: 'range', label: 'traced query (which pair to open up)', value: 1, min: 1, max: 20, step: 1 }
  ];

  const METRICS = [
    { id: 'tpq-wrong', label: 'Answers wrong', note: 'four implementations against the naive climb' },
    { id: 'tpq-depth', label: 'Tree depth', note: 'what the naive climb pays per query' },
    { id: 'tpq-segments', label: 'Worst path decomposition', note: 'chain ranges a path query becomes' },
    { id: 'tpq-cheapest', label: 'Cheapest per query', note: 'measured on this shape, not assumed' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The tree', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The tree, its heavy chains, and the traced path</div>' +
      '<div class="card-body"><div id="tpq-tree"></div>' +
      '<p class="note" id="tpq-tree-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">One query, opened up: every jump binary lifting makes</div>' +
      '<div class="card-body"><table class="ref-table" id="tpq-trace"><thead><tr>' +
      '<th>Step</th><th>Phase</th><th>Jump</th><th>From</th><th>To</th><th>Why</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tpq-trace-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What each approach costs on this tree</div>' +
      '<div class="card-body"><table class="ref-table" id="tpq-costs"><thead><tr>' +
      '<th>Approach</th><th>Preprocessing cells</th><th>Query work</th><th>Per query</th>' +
      '<th>Answers anything but LCA?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tpq-costs-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Heavy-light decomposition across five shapes</div>' +
      '<div class="card-body"><table class="ref-table" id="tpq-shapes"><thead><tr>' +
      '<th>Shape</th><th>Depth</th><th>Chains</th><th>Worst segments</th><th>Mean segments</th>' +
      '<th>2 log n bound</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tpq-shapes-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every implementation against the naive climb</div>' +
      '<div class="card-body"><div id="tpq-agreement"></div>' +
      '<p class="note" id="tpq-agreement-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
