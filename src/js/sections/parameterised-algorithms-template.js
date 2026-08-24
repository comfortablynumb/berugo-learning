/** Markup for "Exact exponential and parameterised algorithms". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ParameterisedAlgorithmsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'fpt-n', kind: 'range', label: 'vertices', value: 20, min: 14, max: 26, step: 2 },
    { id: 'fpt-density', kind: 'select', label: 'edges per vertex', value: '2.25',
      options: [
        { value: '1.5', label: '1.5 — sparse' },
        { value: '2.25', label: '2.25' },
        { value: '3.5', label: '3.5 — dense' }
      ] },
    { id: 'fpt-k', kind: 'range', label: 'cover budget k', value: 12, min: 4, max: 20, step: 1 },
    { id: 'fpt-seed', kind: 'select', label: 'graph seed', value: '4',
      options: [
        { value: '4', label: 'seed 4' },
        { value: '8', label: 'seed 8' },
        { value: '15', label: 'seed 15' }
      ] }
  ];

  const METRICS = [
    { id: 'fpt-brute', label: 'Brute force', note: 'subsets examined, and the exact optimum' },
    { id: 'fpt-branch', label: 'Branch and reduce', note: 'search nodes for the same answer' },
    { id: 'fpt-base', label: 'Measured branching base', note: 'fitted through the NO runs only' },
    { id: 'fpt-kernel', label: 'Buss kernel', note: 'what survives the reduction rules' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A graph, and a budget for the cover', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Search nodes against k, four ways</div>' +
      '<div class="card-body"><div id="fpt-chart" class="chart-host"></div>' +
      '<p class="note" id="fpt-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Five ways to answer the same question</div>' +
      '<div class="card-body"><table class="ref-table" id="fpt-methods"><thead><tr>' +
      '<th>Method</th><th>Answer</th><th>Cover size</th><th>Really covers every edge</th>' +
      '<th>Search nodes</th><th>What it is exponential in</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="fpt-methods-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The measured branching base, and what the reduction rules do to it</div>' +
      '<div class="card-body"><table class="ref-table" id="fpt-bases"><thead><tr>' +
      '<th>Branching rule</th><th>Reduction rules</th><th>Measured base</th><th>NO runs used</th>' +
      '<th>Nodes at the smallest k</th><th>Nodes at the largest NO k</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="fpt-bases-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The kernel does not grow with the instance</div>' +
      '<div class="card-body"><table class="ref-table" id="fpt-kernels"><thead><tr>' +
      '<th>Vertices</th><th>Edges</th><th>Kernel vertices</th><th>Kernel edges</th>' +
      '<th>Forced into the cover</th><th>Shrink factor</th><th>k² bound</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="fpt-kernels-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">A different parameter: the width of the graph rather than the size of the answer</div>' +
      '<div class="card-body"><table class="ref-table" id="fpt-treewidth"><thead><tr>' +
      '<th>Edges per vertex</th><th>Edges</th><th>Width found</th><th>Bags</th>' +
      '<th>States per bag</th><th>Minimum cover</th><th>Branch-and-reduce nodes</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="fpt-treewidth-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
