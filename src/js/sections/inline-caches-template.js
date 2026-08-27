/** Markup for "Inline caches and object shapes". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ShapesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const SAMPLES = {
    sameOrder: 'let a = { x: 1, y: 2 };\nlet b = { x: 3, y: 4 };\nlet c = { x: 5, y: 6 };\n'
      + 'let s = a.x + b.x + c.x;',
    twoOrders: 'let a = { x: 1, y: 2 };\nlet b = { y: 3, x: 4 };\nlet c = { x: 5, y: 6 };\n'
      + 'let s = a.x + b.x + c.x;',
    growing: 'let a = { x: 1 };\nlet b = { x: 1, y: 2 };\nlet c = { x: 1, y: 2, z: 3 };\n'
      + 'let s = a.x + b.x + c.x;',
    nested: 'let r = { p: { x: 1 }, q: { x: 2 } };\nlet s = r.p.x + r.q.x;',
    single: 'let p = { x: 1, y: 2 };\nlet s = p.x + p.y;'
  };

  const CONTROLS = [
    { id: 'ic-sample', kind: 'select', label: 'program', value: 'twoOrders',
      options: [
        { value: 'sameOrder', label: 'three records, same two fields, same order' },
        { value: 'twoOrders', label: 'the same fields, one of them in the other order' },
        { value: 'growing', label: 'one field, then two, then three' },
        { value: 'nested', label: 'records inside a record' },
        { value: 'single', label: 'one record read twice' }
      ] },
    { id: 'ic-fields', kind: 'range', label: 'fields in the study', value: 3,
      min: 2, max: 5, step: 1, note: 'every ordering of them is a distinct shape' },
    { id: 'ic-accesses', kind: 'range', label: 'accesses to measure', value: 1000,
      min: 100, max: 4000, step: 100 }
  ];

  const METRICS = [
    { id: 'ic-shapes', label: 'Shapes this program builds', note: 'nodes in the transition tree' },
    { id: 'ic-state', label: 'Cache state at the site', note: 'after every access in the study' },
    { id: 'ic-cost', label: 'Cost per access', note: 'a hit is 1; the rest is the scan' },
    { id: 'ic-penalty', label: 'What the second order costs', note: 'same fields, same reads' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Records, orders and one call site',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Cost per access as a site sees more shapes</div>' +
      '<div class="card-body"><div id="ic-chart" class="chart-host"></div>' +
      '<p class="note" id="ic-chart-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The transition tree this program builds</div>' +
      '<div class="card-body"><table class="ref-table" id="ic-tree"><thead><tr>' +
      '<th>Shape</th><th>Depth</th><th>Fields</th><th>Reached from</th><th>By adding</th>' +
      '<th>Objects</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ic-tree-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every record the program allocates, and its shape</div>' +
      '<div class="card-body"><table class="ref-table" id="ic-sites"><thead><tr>' +
      '<th>Function</th><th>Block</th><th>Fields, in the order written</th><th>Shape</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ic-sites-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">One order, two orders, every order</div>' +
      '<div class="card-body"><table class="ref-table" id="ic-orders"><thead><tr>' +
      '<th>Construction</th><th>Distinct orders</th><th>Shapes</th><th>Cache state</th>' +
      '<th>Hits</th><th>Misses</th><th>Cost per access</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ic-orders-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The four cache states, and the cliff between two of them</div>' +
      '<div class="card-body"><table class="ref-table" id="ic-states"><thead><tr>' +
      '<th>Shapes seen</th><th>State</th><th>Hits</th><th>Misses</th><th>Cost per access</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ic-states-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, SAMPLES: SAMPLES };
}));
