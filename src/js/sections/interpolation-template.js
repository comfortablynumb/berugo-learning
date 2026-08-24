/** Markup for "Interpolation and approximation". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.InterpolationTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'itp-target', kind: 'select', label: 'function to interpolate', value: 'runge',
      options: [
        { value: 'runge', label: '1/(1 + 25x²) — Runge’s function' },
        { value: 'gaussian', label: 'exp(−4x²) — a gentle bump' },
        { value: 'step', label: 'a smoothed step' }
      ] },
    { id: 'itp-count', kind: 'range', label: 'number of nodes', value: 13,
      min: 5, max: 25, step: 2 },
    { id: 'itp-curves', kind: 'checkbox', label: 'draw the spline as well', value: true }
  ];

  const METRICS = [
    { id: 'itp-equal', label: 'Worst error, equally spaced', note: 'polynomial through the nodes' },
    { id: 'itp-chebyshev', label: 'Chebyshev nodes', note: 'the same degree, moved endpoints' },
    { id: 'itp-spline', label: 'Cubic spline', note: 'the same equally spaced nodes' },
    { id: 'itp-overshoot-metric', label: 'Overshoot on monotone data', note: 'natural cubic, as a fraction of the range' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A function, a node count and a scheme',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The function and its interpolants</div>' +
      '<div class="card-body"><div id="itp-chart" class="chart-host"></div>' +
      '<div id="itp-legend"></div><p class="note" id="itp-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">More nodes, worse answer — and the two schemes that fix it</div>' +
      '<div class="card-body"><table class="ref-table" id="itp-sweep"><thead><tr>' +
      '<th>Nodes</th><th>Equally spaced polynomial</th><th>Chebyshev polynomial</th>' +
      '<th>Cubic spline</th><th>Verdict</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="itp-sweep-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Overshoot — both curves pass through every point, and one invents a dip</div>' +
      '<div class="card-body"><table class="ref-table" id="itp-overshoot"><thead><tr>' +
      '<th>Scheme</th><th>Above the data</th><th>Below the data</th>' +
      '<th>Worst, as a fraction of the range</th><th>Error at the nodes</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="itp-overshoot-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Where the nodes actually sit</div>' +
      '<div class="card-body"><table class="ref-table" id="itp-nodes"><thead><tr>' +
      '<th>Index</th><th>Equally spaced</th><th>Chebyshev</th><th>Gap to the next</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="itp-nodes-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
