/** Markup for "Constants, cache and the failure of asymptotics". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ConstantsAndCacheTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'cross-max', kind: 'range', label: 'largest n', value: 256, min: 32, max: 1024, step: 32 },
    { id: 'cross-cutoff', kind: 'range', label: 'insertion cutoff inside merge sort', value: 0, min: 0, max: 64, step: 4,
      note: '0 disables the hybrid. Real library sorts set this between 16 and 32.' },
    { id: 'cross-runs', kind: 'range', label: 'timed runs per size', value: 7, min: 3, max: 21, step: 2 },
    { id: 'cross-run', kind: 'button', label: 'Measure', primary: true }
  ];

  const METRICS = [
    { id: 'cross-ops', label: 'Crossover by comparisons', note: 'where merge sort starts counting fewer' },
    { id: 'cross-time', label: 'Crossover by measured time', note: 'medians, same inputs' },
    { id: 'cross-gap', label: 'Gap between the two', note: 'constants live in this gap' },
    { id: 'cross-hybrid', label: 'Hybrid vs plain merge', note: 'time at the largest size' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Insertion sort vs merge sort', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Measured time, and counted comparisons</div>' +
      '<div class="card-body"><div id="cross-chart"></div><div id="cross-legend"></div>' +
      '<p class="note">Both series are medians over repeated runs on identical seeded inputs. ' +
      'Comparisons are counted through the instrumented comparator, not estimated.</p>' +
      '</div></div></div>' +
      scope.MetricGrid.markup(METRICS);
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
