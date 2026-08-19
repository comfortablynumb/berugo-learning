/** Markup for "Persistence: path copying, fat nodes and node copying". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PersistenceBasicsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'pb-strategy', kind: 'select', label: 'persistence strategy', value: 'path-copying',
      options: [{ value: 'path-copying', label: 'path copying' },
        { value: 'fat-node', label: 'fat nodes' },
        { value: 'node-copying', label: 'node copying' }] },
    { id: 'pb-count', kind: 'range', label: 'updates (one version each)', value: 400, min: 100, max: 800, step: 50 },
    { id: 'pb-spread', kind: 'select', label: 'key pool', value: '3',
      options: [{ value: '1', label: 'as many keys as updates — few repeats' },
        { value: '3', label: '3× the updates — some repeats' },
        { value: '8', label: '8× the updates — almost no repeats' }] },
    { id: 'pb-draw', kind: 'range', label: 'version to draw (24-key tree)', value: 18, min: 2, max: 24, step: 1 }
  ];

  const METRICS = [
    { id: 'pb-nodes', label: 'Distinct nodes kept', note: 'reachable from any version' },
    { id: 'pb-per-update', label: 'Nodes built per update', note: 'the write cost of persistence' },
    { id: 'pb-bytes', label: 'Bytes for the whole history', note: 'against copying every version' },
    { id: 'pb-probes', label: 'Probes per read', note: '2 000 queries spread over every version' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The strategy, the workload and the picture', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">One update, drawn: what it built and what it inherited</div>' +
      '<div class="card-body"><div id="pb-tree"></div>' +
      '<p class="note" id="pb-tree-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Three strategies, the same history, every version checked</div>' +
      '<div class="card-body"><table class="ref-table" id="pb-compare"><thead><tr>' +
      '<th>Strategy</th><th>Distinct nodes</th><th>Built / update</th><th>Bytes</th>' +
      '<th>vs copying</th><th>Probes / read</th><th>Wrong versions</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="pb-compare-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every version: what it had to build against what it already had</div>' +
      '<div class="card-body"><div id="pb-dag"></div>' +
      '<p class="note" id="pb-dag-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
