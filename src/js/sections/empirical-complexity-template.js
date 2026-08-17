/** Markup for "Empirical complexity". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.EmpiricalComplexityTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'emp-subject', kind: 'select', label: 'unlabelled subject', value: 'a',
      options: [{ value: 'a', label: 'Subject A' }, { value: 'b', label: 'Subject B' },
        { value: 'c', label: 'Subject C' }, { value: 'd', label: 'Subject D' }] },
    { id: 'emp-start', kind: 'range', label: 'starting n', value: 256, min: 64, max: 2048, step: 64 },
    { id: 'emp-doublings', kind: 'range', label: 'doublings', value: 6, min: 3, max: 8, step: 1 },
    { id: 'emp-runs', kind: 'range', label: 'runs per size', value: 7, min: 3, max: 15, step: 2 },
    { id: 'emp-measure', kind: 'button', label: 'Run the doubling experiment', primary: true },
    { id: 'emp-reveal', kind: 'button', label: 'Reveal the answer' }
  ];

  const METRICS = [
    { id: 'emp-exponent', label: 'Estimated exponent', note: 'from the last three doublings' },
    { id: 'emp-verdict', label: 'Reading', note: 'what that exponent means' },
    { id: 'emp-fit', label: 'Best-fitting curve', note: 'least squares over the candidate basis' },
    { id: 'emp-runner', label: 'Runner-up', note: 'how close the second candidate is' },
    { id: 'emp-truth', label: 'Ground truth', note: 'hidden until you commit' },
    { id: 'emp-quality', label: 'Measurement quality', note: 'anything suspicious about this run' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Doubling experiment', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Measured cost, log-log</div>' +
      '<div class="card-body"><div id="emp-chart"></div><div id="emp-legend"></div></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem"><div class="card-header">Ratio table</div>' +
      '<div class="card-body"><table class="ref-table" id="emp-table"><thead><tr>' +
      '<th>n</th><th>median</th><th>T(2n)/T(n)</th><th>implied exponent</th>' +
      '</tr></thead><tbody></tbody></table></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
