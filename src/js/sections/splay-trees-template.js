/** Markup for "Splay trees and self-adjustment". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SplayTreesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'splay-pattern', kind: 'select', label: 'access pattern', value: 'zipf',
      options: [{ value: 'zipf', label: 'Zipf — a few keys take most of the traffic' },
        { value: 'uniform', label: 'uniform — every key equally likely' },
        { value: 'sequential', label: 'sequential — a scan through the key space' }] },
    { id: 'splay-skew', kind: 'range', label: 'Zipf skew', value: 1.2, min: 0.6, max: 2, step: 0.1,
      note: 'Higher skew concentrates the traffic further. It is the dial the whole comparison turns on.' },
    { id: 'splay-span', kind: 'range', label: 'keys in the tree', value: 2000, min: 200, max: 8000, step: 100 },
    { id: 'splay-accesses', kind: 'range', label: 'accesses', value: 20000, min: 2000, max: 60000, step: 1000 },
    { id: 'splay-seed', kind: 'range', label: 'seed', value: 9, min: 1, max: 40, step: 1 }
  ];

  const METRICS = [
    { id: 'splay-cost', label: 'Splay comparisons', note: 'over the access phase only' },
    { id: 'splay-avl', label: 'AVL comparisons', note: 'the balanced baseline, same accesses' },
    { id: 'splay-ratio', label: 'Splay ÷ AVL', note: 'below 1 means splaying paid' },
    { id: 'splay-height', label: 'Splay height after the run', note: 'self-adjusting, so the shape follows the workload' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Access pattern', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Cost against skew: where self-adjustment starts paying</div>' +
      '<div class="card-body"><div id="splay-chart"></div><div id="splay-legend"></div></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The tree after the run — the hot keys have risen</div>' +
      '<div class="card-body"><div id="splay-tree"></div>' +
      '<p class="note" id="splay-tree-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What the splaying cost, step by step</div>' +
      '<div class="card-body"><table class="ref-table" id="splay-steps"><thead><tr>' +
      '<th>Step kind</th><th>Count</th><th>Rotations each</th><th>What it is</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="splay-steps-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
