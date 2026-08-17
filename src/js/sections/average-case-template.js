/** Markup for "Average-case and probabilistic analysis". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AverageCaseTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'avg-n', kind: 'range', label: 'input size n', value: 200, min: 20, max: 1000, step: 20 },
    { id: 'avg-trials', kind: 'range', label: 'trials', value: 200, min: 20, max: 1000, step: 20 },
    { id: 'avg-seed', kind: 'number', label: 'seed', value: 1, min: 1, max: 9999, step: 1,
      note: 'Same seed, same experiment. Change it to see how much the distribution itself moves.' },
    { id: 'avg-run', kind: 'button', label: 'Run the experiment', primary: true }
  ];

  const METRICS = [
    { id: 'avg-measured', label: 'Measured mean', note: 'comparisons, averaged over trials' },
    { id: 'avg-exact', label: 'Exact expectation', note: 'Σ 2/(j−i+1) over all pairs' },
    { id: 'avg-asymptotic', label: '2n ln n', note: 'the familiar approximation' },
    { id: 'avg-error', label: 'Measured vs exact', note: 'relative difference' },
    { id: 'avg-spread', label: 'Spread', note: 'standard deviation over trials' },
    { id: 'avg-tail', label: 'Worst trial', note: 'and the Chebyshev bound for it' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Randomised quicksort', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Distribution of comparison counts</div>' +
      '<div class="card-body"><div id="avg-chart"></div><div id="avg-legend"></div></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS);
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
