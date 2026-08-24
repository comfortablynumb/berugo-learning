/** Markup for "Choosing a cost model". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ChoosingACostModelTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ccm-records', kind: 'select', label: 'records to sort', value: '65536',
      options: [
        { value: '16384', label: '16 384' },
        { value: '65536', label: '65 536' },
        { value: '262144', label: '262 144' }
      ] },
    { id: 'ccm-memory', kind: 'select', label: 'memory M', value: '4096',
      options: [
        { value: '1024', label: '1 024 records' },
        { value: '4096', label: '4 096 records' },
        { value: '16384', label: '16 384 records' }
      ] },
    { id: 'ccm-cache', kind: 'select', label: 'cache for the access study', value: '64',
      options: [
        { value: '16', label: '1 KB' },
        { value: '64', label: '4 KB' },
        { value: '512', label: '32 KB' }
      ] }
  ];

  const METRICS = [
    { id: 'ccm-spread', label: 'The four predictions', note: 'largest over smallest, same workload' },
    { id: 'ccm-measured', label: 'Measured transfers', note: 'against the external-memory prediction' },
    { id: 'ccm-binding', label: 'Access patterns that are memory-bound', note: 'of the four measured' },
    { id: 'ccm-waste', label: 'Bytes fetched per useful byte', note: 'worst access pattern' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'One workload, four models', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Four predictions of the same sort, side by side</div>' +
      '<div class="card-body"><div id="ccm-chart" class="chart-host"></div>' +
      '<p class="note" id="ccm-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The bake-off: four models, four units, one workload</div>' +
      '<div class="card-body"><table class="ref-table" id="ccm-models"><thead><tr>' +
      '<th>Model</th><th>What it counts</th><th>Prediction</th><th>Unit</th>' +
      '<th>When it is the right one</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ccm-models-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Which resource binds, by access pattern</div>' +
      '<div class="card-body"><table class="ref-table" id="ccm-patterns"><thead><tr>' +
      '<th>Access pattern</th><th>Accesses</th><th>Misses</th><th>Miss rate</th>' +
      '<th>Bytes fetched</th><th>Bytes used</th><th>Waste</th><th>Binding resource</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ccm-patterns-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">A checklist, in the order the questions are worth asking</div>' +
      '<div class="card-body"><table class="ref-table" id="ccm-checklist"><thead><tr>' +
      '<th>Question</th><th>If yes</th><th>If no</th><th>How to tell</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ccm-checklist-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
