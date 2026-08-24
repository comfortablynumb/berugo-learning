/** Markup for "Differential equations and simulation". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DifferentialEquationsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'de-step', kind: 'select', label: 'step size for the orbit', value: '0.1',
      options: [
        { value: '0.01', label: '0.01 — small enough that nothing goes wrong' },
        { value: '0.05', label: '0.05' },
        { value: '0.1', label: '0.1 — where the difference is visible' }
      ] },
    { id: 'de-eccentricity', kind: 'range', label: 'orbit eccentricity (÷100)', value: 0,
      min: 0, max: 70, step: 5 },
    { id: 'de-fast', kind: 'select', label: 'the fast mode’s rate', value: '1000',
      options: [
        { value: '100', label: '100' },
        { value: '1000', label: '1000' },
        { value: '10000', label: '10 000 — properly stiff' }
      ] }
  ];

  const METRICS = [
    { id: 'de-euler-drift', label: 'Euler’s energy drift', note: 'over the whole run' },
    { id: 'de-rk4-drift', label: 'RK4’s energy drift', note: 'fourth order, and it still decays' },
    { id: 'de-verlet-drift', label: 'Verlet’s energy drift', note: 'second order, and it does not' },
    { id: 'de-stiff', label: 'Explicit steps the stiff problem needs', note: 'against ten implicit ones' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A step size, an orbit and a stiff system',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Orbital radius over 200 000 steps</div>' +
      '<div class="card-body"><div id="de-chart" class="chart-host"></div>' +
      '<div id="de-legend"></div><p class="note" id="de-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Halve the step, watch the error fall by 2ᵖ</div>' +
      '<div class="card-body"><table class="ref-table" id="de-order"><thead><tr>' +
      '<th>Method</th><th>Order claimed</th><th>Order measured</th><th>Agrees</th>' +
      '<th>Error at the finest step</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="de-order-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The orbit — where the energy went</div>' +
      '<div class="card-body"><table class="ref-table" id="de-orbit"><thead><tr>' +
      '<th>Method</th><th>Symplectic</th><th>Radius at the start</th><th>At the end</th>' +
      '<th>Smallest</th><th>Largest</th><th>Energy drift</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="de-orbit-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Stiffness — the step is bounded by a mode that has already died</div>' +
      '<div class="card-body"><table class="ref-table" id="de-implicit"><thead><tr>' +
      '<th>Method and step</th><th>Fraction of the stability limit</th><th>Steps taken</th>' +
      '<th>Stable</th><th>Error</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="de-implicit-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
