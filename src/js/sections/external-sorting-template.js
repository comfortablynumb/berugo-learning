/** Markup for "External, parallel and network sorting". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ExternalSortingTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ext-generation', kind: 'select', label: 'run generation', value: 'replacement-selection',
      options: [{ value: 'sort-and-flush', label: 'fill memory, sort, flush' },
        { value: 'replacement-selection', label: 'replacement selection' }] },
    { id: 'ext-memory', kind: 'range', label: 'records resident', value: 100, min: 20, max: 500, step: 20 },
    { id: 'ext-order', kind: 'range', label: 'merge order', value: 4, min: 2, max: 32, step: 1 },
    { id: 'ext-records', kind: 'range', label: 'records', value: 10000, min: 2000, max: 40000, step: 2000 },
    { id: 'ext-network', kind: 'select', label: 'sorting network', value: 'bitonic',
      options: [{ value: 'bitonic', label: 'bitonic (Batcher)' },
        { value: 'odd-even', label: 'odd-even merge (Batcher)' },
        { value: 'insertion', label: 'insertion network' }] },
    { id: 'ext-wires', kind: 'select', label: 'network size', value: '8',
      options: [{ value: '4', label: '4 wires' },
        { value: '8', label: '8 wires' },
        { value: '16', label: '16 wires' }] }
  ];

  const METRICS = [
    { id: 'ext-runs', label: 'Initial runs', note: 'what run generation produced' },
    { id: 'ext-runlength', label: 'Mean run length', note: 'against the records resident' },
    { id: 'ext-passes', label: 'Merge passes', note: 'each one reads and writes everything' },
    { id: 'ext-transfers', label: 'Record transfers', note: 'reads plus writes, the whole sort' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Memory, merge order and the network', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The comparator lattice — one column per parallel round</div>' +
      '<div class="card-body"><div id="ext-network-view"></div>' +
      '<p class="note" id="ext-network-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Run generation, and the pass it can remove</div>' +
      '<div class="card-body"><table class="ref-table" id="ext-generation-table"><thead><tr>' +
      '<th>Run generation</th><th>Runs</th><th>Mean run</th><th>Merge passes</th>' +
      '<th>Record transfers</th><th>Wrong</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ext-generation-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Merge order against passes — the only lever in the I/O model</div>' +
      '<div class="card-body"><table class="ref-table" id="ext-order-table"><thead><tr>' +
      '<th>Merge order</th><th>Passes</th><th>Record transfers</th><th>Comparisons</th>' +
      '<th>Against 2-way</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ext-order-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Networks: comparators, depth, and an exhaustive proof of correctness</div>' +
      '<div class="card-body"><table class="ref-table" id="ext-networks"><thead><tr>' +
      '<th>Network</th><th>Wires</th><th>Comparators</th><th>Depth</th>' +
      '<th>Zero-one inputs checked</th><th>Failures</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ext-networks-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
