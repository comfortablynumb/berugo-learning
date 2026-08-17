/** Markup for "d-ary heaps and cache behaviour". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DaryHeapsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'da-mix', kind: 'select', label: 'operation mix', value: 'balanced',
      options: [{ value: 'balanced', label: 'balanced — half push, half pop' },
        { value: 'push-heavy', label: 'push-heavy — 90% push' },
        { value: 'pop-heavy', label: 'pop-heavy — 65% pop' },
        { value: 'decrease-key', label: 'decrease-key-heavy — the Dijkstra shape' }] },
    { id: 'da-count', kind: 'range', label: 'operations', value: 50000, min: 2000, max: 200000, step: 1000 },
    { id: 'da-seed', kind: 'range', label: 'seed', value: 6, min: 1, max: 40, step: 1,
      note: 'Every arity replays the identical operation list, so the difference is the structure.' }
  ];

  const METRICS = [
    { id: 'da-best-cmp', label: 'Fewest comparisons', note: 'and the arity that gets there' },
    { id: 'da-best-swaps', label: 'Fewest swaps', note: 'data movement falls monotonically with d' },
    { id: 'da-height', label: 'Height at d = 4', note: 'against the binary height' },
    { id: 'da-lines', label: 'Children per cache line', note: '64 bytes ÷ 4-byte keys' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Workload', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Cost against arity: the two curves go opposite ways</div>' +
      '<div class="card-body"><div id="da-chart"></div><div id="da-legend"></div></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every arity on the identical operation list</div>' +
      '<div class="card-body"><table class="ref-table" id="da-table"><thead><tr>' +
      '<th>d</th><th>Comparisons</th><th>Swaps</th><th>Sift distance</th><th>Height at 10⁶</th><th>Sift-up depth</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="da-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
