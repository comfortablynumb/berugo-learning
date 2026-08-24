/** Markup for "Bin packing and resource allocation". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BinPackingTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'bpk-count', kind: 'range', label: 'items', value: 200, min: 50, max: 400, step: 50 },
    { id: 'bpk-seed', kind: 'select', label: 'workload seed', value: '1',
      options: [
        { value: '1', label: 'seed 1' },
        { value: '5', label: 'seed 5' },
        { value: '9', label: 'seed 9' }
      ] },
    { id: 'bpk-skew', kind: 'select', label: 'two-dimensional tilt', value: '0.8',
      options: [
        { value: '0.4', label: '0.4 — mildly lopsided jobs' },
        { value: '0.8', label: '0.8' },
        { value: '1.0', label: '1.0 — strongly anti-correlated' }
      ] }
  ];

  const METRICS = [
    { id: 'bpk-best', label: 'Fewest bins', note: 'and which policy used them' },
    { id: 'bpk-bound', label: 'The LP lower bound', note: 'total size over bin capacity' },
    { id: 'bpk-ffd', label: 'First-fit-decreasing against exact', note: 'worst over many small instances' },
    { id: 'bpk-lopsided', label: 'Bins full on one axis only', note: 'in two dimensions' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A workload and a policy', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">First-fit against its worst case, at rising size</div>' +
      '<div class="card-body"><div id="bpk-chart" class="chart-host"></div>' +
      '<p class="note" id="bpk-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Five policies on one workload, against the lower bound</div>' +
      '<div class="card-body"><table class="ref-table" id="bpk-policies"><thead><tr>' +
      '<th>Policy</th><th>Bins</th><th>Ratio to the bound</th><th>Utilisation</th>' +
      '<th>Wasted capacity</th><th>Stranded (too small for anything left)</th><th>Online</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bpk-policies-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Against the exact optimum, on instances small enough to solve</div>' +
      '<div class="card-body"><table class="ref-table" id="bpk-exact"><thead><tr>' +
      '<th>Measurement</th><th>Worst ratio</th><th>Proved bound</th><th>Inside it</th>' +
      '<th>Instances</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bpk-exact-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">One dimension against two, on the same jobs</div>' +
      '<div class="card-body"><table class="ref-table" id="bpk-dims"><thead><tr>' +
      '<th>Policy</th><th>Bins, one dimension</th><th>Ratio</th><th>Bins, two dimensions</th>' +
      '<th>Ratio</th><th>CPU used</th><th>Memory used</th><th>Lopsided bins</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bpk-dims-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
