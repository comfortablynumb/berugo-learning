/** Markup for "Stacks and the call stack". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StacksAndFramesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'stack-shape', kind: 'select', label: 'tree shape', value: 'balanced',
      options: [{ value: 'balanced', label: 'balanced (depth ≈ log n)' },
        { value: 'degenerate', label: 'degenerate (depth = n)' }] },
    { id: 'stack-nodes', kind: 'range', label: 'nodes', value: 63, min: 7, max: 4095, step: 8 },
    { id: 'stack-measure', kind: 'button', label: 'Measure this engine\'s recursion limit' }
  ];

  const METRICS = [
    { id: 'stack-depth', label: 'Peak recursion depth', note: 'frames live at once' },
    { id: 'stack-bytes', label: 'Stack bytes at the peak', note: 'depth × frame size' },
    { id: 'stack-iter', label: 'Explicit-stack peak', note: 'same traversal, heap-allocated' },
    { id: 'stack-same', label: 'Same visit order', note: 'the conversion must not change behaviour' },
    { id: 'stack-limit', label: 'Engine recursion limit', note: 'measured, not looked up' },
    { id: 'stack-headroom', label: 'Headroom at this shape', note: 'nodes before the limit bites' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Traversal', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Stack depth over the traversal</div>' +
      '<div class="card-body"><div id="stack-chart"></div><div id="stack-legend"></div></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS);
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
