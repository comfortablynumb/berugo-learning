/** Markup for "Topological order and DAGs". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TopologicalOrderTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'tpo-packages', kind: 'range', label: 'packages', value: 40, min: 6, max: 200, step: 2 },
    { id: 'tpo-density', kind: 'range', label: 'dependencies per package', value: 2, min: 1, max: 6, step: 1 },
    { id: 'tpo-seed', kind: 'range', label: 'instance seed', value: 5, min: 1, max: 40, step: 1 },
    { id: 'tpo-workers', kind: 'range', label: 'build workers', value: 4, min: 1, max: 32, step: 1 },
    { id: 'tpo-cycle', kind: 'select', label: 'inject a dependency cycle', value: 'off',
      options: [{ value: 'off', label: 'no — a clean DAG' },
        { value: 'on', label: 'yes — one back edge added' }] }
  ];

  const METRICS = [
    { id: 'tpo-order', label: 'Packages ordered', note: 'placed before the algorithm stalled, if it did' },
    { id: 'tpo-critical', label: 'Critical path', note: 'the makespan no worker count beats' },
    { id: 'tpo-makespan', label: 'Makespan at this worker count', note: 'a list schedule over the same graph' },
    { id: 'tpo-serial', label: 'Total work', note: 'what one worker would take' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Package graph and build', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The dependency graph, with the critical path drawn</div>' +
      '<div class="card-body"><div id="tpo-canvas"></div>' +
      '<p class="note" id="tpo-canvas-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">"Returns null on a cycle" against "returns the cycle"</div>' +
      '<div class="card-body"><div id="tpo-cycle-view"></div>' +
      '<p class="note" id="tpo-cycle-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Two orders, two failure modes</div>' +
      '<div class="card-body"><table class="ref-table" id="tpo-methods"><thead><tr>' +
      '<th>Method</th><th>Order valid?</th><th>Nodes placed</th><th>Fails by</th>' +
      '<th>Cycle verified edge by edge?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tpo-methods-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">More workers, up to the point where they stop helping</div>' +
      '<div class="card-body"><table class="ref-table" id="tpo-schedule"><thead><tr>' +
      '<th>Workers</th><th>Makespan</th><th>Against one worker</th><th>Against the critical path</th>' +
      '<th>Peak workers actually busy</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tpo-schedule-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What the order unlocks</div>' +
      '<div class="card-body"><table class="ref-table" id="tpo-unlocks"><thead><tr>' +
      '<th>Question</th><th>Answer</th><th>Why the order makes it easy</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tpo-unlocks-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
