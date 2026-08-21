/** Markup for "DP optimisations". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DpOptimisationsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'dop-size', kind: 'range', label: 'sequence length', value: 400, min: 40, max: 2000, step: 20 },
    { id: 'dop-penalty', kind: 'range', label: 'penalty per group', value: 50, min: 0, max: 400, step: 10 },
    { id: 'dop-seed', kind: 'range', label: 'sequence seed', value: 7, min: 1, max: 40, step: 1 },
    { id: 'dop-groups', kind: 'range', label: 'groups for the exactly-k variants', value: 4, min: 2, max: 10, step: 1 }
  ];

  const METRICS = [
    { id: 'dop-value', label: 'DP value', note: 'identical under every optimisation that ran' },
    { id: 'dop-naive', label: 'Naive transitions', note: 'every (i, j) pair' },
    { id: 'dop-hull', label: 'Hull transitions', note: 'the convex hull trick' },
    { id: 'dop-factor', label: 'Factor', note: 'what the lower envelope is worth here' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Instance', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Four narrowings of the same transition</div>' +
      '<div class="card-body"><table class="ref-table" id="dop-methods"><thead><tr>' +
      '<th>Method</th><th>Precondition</th><th>Holds?</th><th>Value</th><th>Transitions</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dop-methods-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What the hull is holding</div>' +
      '<div class="card-body"><table class="ref-table" id="dop-lines"><thead><tr>' +
      '<th>Position on the hull</th><th>Slope</th><th>Intercept</th><th>Beats the next line until x =</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dop-lines-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">When the precondition fails</div>' +
      '<div class="card-body"><div id="dop-broken"></div>' +
      '<p class="note" id="dop-broken-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Exactly k groups: a second dimension, or a Lagrangian penalty</div>' +
      '<div class="card-body"><table class="ref-table" id="dop-aliens"><thead><tr>' +
      '<th>Approach</th><th>Value</th><th>Transitions</th><th>Landed on exactly k?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dop-aliens-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">A sliding transition, with and without the deque</div>' +
      '<div class="card-body"><table class="ref-table" id="dop-window"><thead><tr>' +
      '<th>Method</th><th>Value</th><th>Transitions</th><th>Deque pops</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dop-window-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
