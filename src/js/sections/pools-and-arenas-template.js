/** Markup for "Free lists, pools and arenas". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PoolsAndArenasTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'alloc-kind', kind: 'select', label: 'allocator', value: 'firstFit',
      options: [{ value: 'bump', label: 'bump (allocate only, reset frees all)' },
        { value: 'freeList', label: 'free list (fixed-size slots)' },
        { value: 'firstFit', label: 'first fit (variable sizes)' }] },
    { id: 'alloc-rounds', kind: 'range', label: 'operations', value: 2000, min: 200, max: 20000, step: 200 },
    { id: 'alloc-free', kind: 'range', label: 'free bias', value: 0.45, min: 0, max: 0.9, step: 0.05,
      note: 'The share of operations that free instead of allocate. Above 0.5 the heap drains.' },
    { id: 'alloc-run', kind: 'button', label: 'Run the churn', primary: true }
  ];

  const METRICS = [
    { id: 'alloc-live', label: 'Live allocations', note: 'still held at the end' },
    { id: 'alloc-failed', label: 'Failed allocations', note: 'no block large enough' },
    { id: 'alloc-frag', label: 'Fragmentation', note: 'free bytes outside the largest run' },
    { id: 'alloc-largest', label: 'Largest free run', note: 'the biggest request that can still succeed' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Allocator and workload', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The heap after the churn</div>' +
      '<div class="card-body"><div id="alloc-map"></div>' +
      '<p class="note">Each bar is a block: filled is allocated, hollow is free. Fragmentation is ' +
      'free space you cannot use because it is not contiguous.</p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS);
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
