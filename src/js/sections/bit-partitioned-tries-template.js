/** Markup for "Bit-partitioned tries: HAMTs, persistent vectors and transients". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BitPartitionedTriesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'bpt-structure', kind: 'select', label: 'structure', value: 'map',
      options: [{ value: 'map', label: 'HAMT — a persistent map' },
        { value: 'vector', label: 'persistent vector — indexed appends' }] },
    { id: 'bpt-count', kind: 'range', label: 'operations', value: 20000, min: 2000, max: 40000, step: 2000 },
    { id: 'bpt-seed', kind: 'range', label: 'key seed', value: 5, min: 1, max: 12, step: 1 }
  ];

  const METRICS = [
    { id: 'bpt-nodes', label: 'Nodes in the trie', note: 'for the whole structure' },
    { id: 'bpt-slots', label: 'Slots actually stored', note: 'against 32 per node if they were dense' },
    { id: 'bpt-depth', label: 'Levels walked', note: '5 bits of hash per level' },
    { id: 'bpt-saving', label: 'Against the naive layout', note: 'dense nodes, or copying without a transient' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The structure and the workload', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Bytes: what the sparse layout is worth</div>' +
      '<div class="card-body"><div id="bpt-bars"></div>' +
      '<p class="note" id="bpt-bars-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The map: a bitmap and a popcount instead of 32 slots</div>' +
      '<div class="card-body"><table class="ref-table" id="bpt-map"><thead><tr>' +
      '<th>Layout</th><th>Nodes</th><th>Slots</th><th>Mean fan-out</th><th>Deepest</th>' +
      '<th>Bytes</th><th>Wrong lookups</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bpt-map-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The vector: the same appends, once persistently and once through a transient</div>' +
      '<div class="card-body"><table class="ref-table" id="bpt-vector"><thead><tr>' +
      '<th>Build</th><th>Nodes allocated</th><th>Nodes mutated in place</th><th>Per append</th>' +
      '<th>Levels</th><th>Tail slots</th><th>Wrong reads</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bpt-vector-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
