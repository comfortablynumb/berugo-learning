/** Markup for "Dynamic arrays and growth policies". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DynamicArraysTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'dyn-factor', kind: 'range', label: 'growth factor', value: 2, min: 1.25, max: 4, step: 0.25 },
    { id: 'dyn-pushes', kind: 'range', label: 'pushes', value: 2000, min: 100, max: 20000, step: 100 },
    { id: 'dyn-op', kind: 'select', label: 'then perform', value: 'append',
      options: [{ value: 'append', label: '1000 more appends' },
        { value: 'front', label: '1000 inserts at the front' },
        { value: 'middle', label: '1000 inserts in the middle' },
        { value: 'removeFront', label: '1000 removals from the front' }] }
  ];

  const METRICS = [
    { id: 'dyn-copies', label: 'Bytes copied by growth', note: 'counted through the memory model' },
    { id: 'dyn-shift', label: 'Bytes moved by the operation', note: 'the cost the position implies' },
    { id: 'dyn-grows', label: 'Reallocations', note: 'and the final capacity' },
    { id: 'dyn-waste', label: 'Capacity wasted', note: 'allocated but unused' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Array and workload', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Capacity over time, and where the copies happen</div>' +
      '<div class="card-body"><div id="dyn-chart"></div><div id="dyn-legend"></div></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Cost of the same 1000 operations at each position</div>' +
      '<div class="card-body"><table class="ref-table" id="dyn-positions"><thead><tr>' +
      '<th>Operation</th><th>Bytes moved</th><th>Per operation</th><th>Why</th>' +
      '</tr></thead><tbody></tbody></table></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
