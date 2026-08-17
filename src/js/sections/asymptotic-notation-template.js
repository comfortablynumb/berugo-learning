/** Markup for "Asymptotic notation, precisely". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AsymptoticNotationTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function growthOptions() {
    return scope.Asymptotics.names().map(function (name) {
      return { value: name, label: scope.Asymptotics.growth(name).label };
    });
  }

  const CONTROLS = function () {
    return [
      { id: 'asym-f', kind: 'select', label: 'f(n)', value: 'linearithmic', options: growthOptions() },
      { id: 'asym-g', kind: 'select', label: 'g(n)', value: 'quadratic', options: growthOptions() },
      { id: 'asym-c', kind: 'range', label: 'witness c', value: 1, min: 0.1, max: 10, step: 0.1 },
      { id: 'asym-n0', kind: 'range', label: 'witness n₀', value: 1, min: 1, max: 60, step: 1 },
      { id: 'asym-upto', kind: 'range', label: 'check up to n', value: 120, min: 20, max: 400, step: 10,
        note: 'This is an empirical check over a finite range, not a proof.' }
    ];
  };

  const METRICS = [
    { id: 'asym-verdict', label: 'f = O(g) with this witness', note: 'checked over the whole range' },
    { id: 'asym-failure', label: 'First n where it fails', note: 'the counter-example, if any' },
    { id: 'asym-smallest', label: 'Smallest c that works', note: 'over the same range, from n₀' },
    { id: 'asym-crossover', label: 'Crossover', note: 'where f overtakes g with c = 1' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Witness', controls: CONTROLS() }) +
      '<div class="card"><div class="card-header">f(n) against c·g(n)</div>' +
      '<div class="card-body"><div id="asym-chart"></div><div id="asym-legend"></div></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS);
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
