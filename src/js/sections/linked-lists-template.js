/** Markup for "Linked lists and pointer chasing". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LinkedListsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'list-order', kind: 'select', label: 'node placement', value: 'sequential',
      options: [{ value: 'sequential', label: 'sequential (allocated in order)' },
        { value: 'scattered', label: 'scattered (allocated over time)' },
        { value: 'reversed', label: 'reversed' }] },
    { id: 'list-nodes', kind: 'range', label: 'nodes', value: 16384, min: 512, max: 65536, step: 512,
      note: 'Below about 4 000 nodes the whole list fits in a 32 KB cache and placement stops mattering.' },
    { id: 'list-compare', kind: 'checkbox', label: 'compare against an array of the same data', value: true,
      note: 'Both hold the same values and do the same sum; only the layout differs.' }
  ];

  const METRICS = [
    { id: 'list-lines', label: 'Cache misses', note: 'line fetches for one full walk' },
    { id: 'list-jumps', label: 'Non-sequential steps', note: 'where the prefetcher gives up' },
    { id: 'list-array', label: 'Array equivalent', note: 'same values, contiguous' },
    { id: 'list-ratio', label: 'Misses list ÷ array', note: 'the cost of the pointers' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'List and layout', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Where the walk goes in memory</div>' +
      '<div class="card-body"><canvas id="list-canvas" height="160" ' +
      'aria-label="Memory addresses visited in order during the traversal"></canvas>' +
      '<p class="note">Each point is one step of the walk: x is step order, y is the address it ' +
      'landed on. A diagonal line is sequential; a cloud is pointer chasing. Misses are counted ' +
      'against a 32 KB fully associative LRU cache, so a list that fits in cache shows no ' +
      'difference at all - which is itself the useful result.</p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem"><div class="card-header">Cycle detection</div>' +
      '<div class="card-body">' +
      '<p class="note">Brent\'s algorithm finds a cycle with one pointer and a doubling step limit, ' +
      'and reports the cycle length and where it starts.</p>' +
      '<div id="list-cycle" class="mono" style="font-size:.8125rem;margin-top:.5rem"></div>' +
      '</div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
