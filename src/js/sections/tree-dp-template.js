/** Markup for "Tree DP and rerooting". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TreeDpTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'trd-shape', kind: 'select', label: 'tree shape', value: 'random',
      options: [{ value: 'random', label: 'random' },
        { value: 'path', label: 'path — deep and thin' },
        { value: 'star', label: 'star — one enormous degree' },
        { value: 'caterpillar', label: 'caterpillar' }] },
    { id: 'trd-nodes', kind: 'range', label: 'nodes', value: 2000, min: 50, max: 20000, step: 50 },
    { id: 'trd-seed', kind: 'range', label: 'tree seed', value: 4, min: 1, max: 40, step: 1 },
    { id: 'trd-check', kind: 'range', label: 'oracle size (n BFS runs)', value: 400, min: 40, max: 1200, step: 40 }
  ];

  const METRICS = [
    { id: 'trd-combines', label: 'Combine operations', note: 'the rerooting pass, both directions' },
    { id: 'trd-per', label: 'Per node', note: 'the O(n) claim, as a number' },
    { id: 'trd-naive', label: 'Naive combines', note: 'recomputing "all but one" by looping' },
    { id: 'trd-wrong', label: 'Disagreements', note: 'against a BFS from every node' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Tree shape and size', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Rerooting against the n-BFS oracle</div>' +
      '<div class="card-body"><table class="ref-table" id="trd-oracle"><thead><tr>' +
      '<th>Node</th><th>Rerooted answer</th><th>BFS from that node</th><th>Agrees?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="trd-oracle-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Four shapes, and why the star is the one that matters</div>' +
      '<div class="card-body"><table class="ref-table" id="trd-shapes"><thead><tr>' +
      '<th>Shape</th><th>Depth</th><th>Largest degree</th><th>Rerooting combines</th>' +
      '<th>Naive "all but one"</th><th>Ratio</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="trd-shapes-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Three rooted tree DPs on the same tree</div>' +
      '<div class="card-body"><table class="ref-table" id="trd-family"><thead><tr>' +
      '<th>Problem</th><th>State</th><th>Answer</th><th>Passes</th><th>Checked against</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="trd-family-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The prefix/suffix trick, spelled out on one node</div>' +
      '<div class="card-body"><div id="trd-prefix"></div>' +
      '<p class="note" id="trd-prefix-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
