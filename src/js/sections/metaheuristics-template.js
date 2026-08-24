/** Markup for "Heuristics and metaheuristics". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MetaheuristicsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'mth-cities', kind: 'range', label: 'cities', value: 30, min: 20, max: 60, step: 5 },
    { id: 'mth-budget', kind: 'select', label: 'evaluation budget', value: '40000',
      options: [
        { value: '2000', label: '2 000 — a short run' },
        { value: '10000', label: '10 000' },
        { value: '40000', label: '40 000' },
        { value: '160000', label: '160 000 — a long run' }
      ] },
    { id: 'mth-seed', kind: 'select', label: 'instance seed', value: '7',
      options: [
        { value: '7', label: 'seed 7' },
        { value: '19', label: 'seed 19' },
        { value: '31', label: 'seed 31' }
      ] }
  ];

  const METRICS = [
    { id: 'mth-best', label: 'Best tour found', note: 'the winner under this budget' },
    { id: 'mth-spent', label: 'Evaluations offered', note: 'and whether every method got the same' },
    { id: 'mth-cheap', label: 'Cheapest route to the best', note: 'evaluations the winner actually used' },
    { id: 'mth-bound', label: 'Lower bound', note: 'the MST, which no tour can beat' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'One instance, one budget', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Best-so-far against evaluations spent</div>' +
      '<div class="card-body"><div id="mth-chart" class="chart-host"></div>' +
      '<p class="note" id="mth-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Eight methods, one budget, one instance</div>' +
      '<div class="card-body"><table class="ref-table" id="mth-table"><thead><tr>' +
      '<th>Method</th><th>Tour length</th><th>Above the best found</th><th>Evaluations offered</th>' +
      '<th>Evaluations used</th><th>Wall clock</th><th>Valid tour</th><th>What it does about local optima</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mth-table-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The ranking changes with the budget, which is why a budget-free comparison says nothing</div>' +
      '<div class="card-body"><table class="ref-table" id="mth-budgets"><thead><tr>' +
      '<th>Budget</th><th>Winner</th><th>Best</th><th>Nearest neighbour</th><th>2-opt</th>' +
      '<th>Annealing</th><th>Tabu</th><th>Genetic</th><th>Ant colony</th><th>GRASP</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mth-budgets-note"></p></div></div>' +
      '<div class="grid-2" style="margin-top:.875rem">' +
      '<div class="card"><div class="card-header">Annealing at five temperatures, including zero</div>' +
      '<div class="card-body"><table class="ref-table" id="mth-cooling"><thead><tr>' +
      '<th>Starting temperature</th><th>Tour</th><th>Moves accepted</th><th>Of which worsening</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mth-cooling-note"></p></div></div>' +
      '<div class="card"><div class="card-header">Scored against a known optimum</div>' +
      '<div class="card-body"><table class="ref-table" id="mth-exact"><thead><tr>' +
      '<th>Method</th><th>Tour</th><th>Ratio to the optimum</th><th>Optimal</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mth-exact-note"></p></div></div>' +
      '</div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
