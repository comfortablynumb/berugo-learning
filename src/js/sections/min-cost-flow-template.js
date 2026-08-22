/** Markup for "Minimum-cost flow and assignment". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MinCostFlowTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'mcf-size', kind: 'range', label: 'workers and jobs', value: 6, min: 2, max: 9, step: 1 },
    { id: 'mcf-spread', kind: 'range', label: 'largest cost in the matrix', value: 20, min: 2, max: 99, step: 1 },
    { id: 'mcf-seed', kind: 'range', label: 'cost matrix seed', value: 1, min: 1, max: 40, step: 1 },
    { id: 'mcf-nodes', kind: 'range', label: 'nodes in the general network', value: 14, min: 6, max: 24, step: 2 },
    { id: 'mcf-negative', kind: 'checkbox', label: 'give the general network negative costs', value: true }
  ];

  const METRICS = [
    { id: 'mcf-cost', label: 'Assignment cost', note: 'the cheapest way to cover every job' },
    { id: 'mcf-brute', label: 'Brute force agrees?', note: 'every permutation, below eight workers' },
    { id: 'mcf-dijkstras', label: 'Dijkstra runs', note: 'one per unit of flow, after one Bellman-Ford' },
    { id: 'mcf-optimal', label: 'No negative residual cycle?', note: 'the optimality theorem, checked' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The problem', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The cost matrix, with the chosen assignment marked</div>' +
      '<div class="card-body"><div id="mcf-matrix"></div>' +
      '<p class="note" id="mcf-matrix-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Three routes to the same assignment</div>' +
      '<div class="card-body"><table class="ref-table" id="mcf-routes"><thead><tr>' +
      '<th>Method</th><th>Cost</th><th>Work</th><th>Certificate</th><th>Agrees?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mcf-routes-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Reduced costs: the potential doing its job</div>' +
      '<div class="card-body"><table class="ref-table" id="mcf-reduced"><thead><tr>' +
      '<th>Arc</th><th>Cost</th><th>Potential at the tail</th><th>Potential at the head</th>' +
      '<th>Reduced cost</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mcf-reduced-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">A general network, and what happens when the costs go negative</div>' +
      '<div class="card-body"><div id="mcf-general"></div>' +
      '<p class="note" id="mcf-general-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Cost against flow: every extra unit costs at least as much</div>' +
      '<div class="card-body"><table class="ref-table" id="mcf-curve"><thead><tr>' +
      '<th>Flow sent</th><th>Total cost</th><th>Marginal cost of the last unit</th>' +
      '<th>Dijkstra runs</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mcf-curve-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
