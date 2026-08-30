/** Markup for "Memory-level parallelism". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MlpTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CACHES = [
    { value: 'small', label: '256 B — 8 sets x 1 way x 32 B, so the walk always misses' },
    { value: 'default', label: '4 KiB — 16 x 4 x 64 B, which holds the whole buffer' }
  ];

  const CONTROLS = [
    { id: 'mlp-program', kind: 'select', label: 'traversal', value: 'stride',
      options: [
        { value: 'stride', label: 'stride — one load per line, address from a counter' },
        { value: 'chase', label: 'chase — the same lines, each address loaded from the last' }] },
    { id: 'mlp-cache', kind: 'select', label: 'cache', value: 'small', options: CACHES },
    { id: 'mlp-mshrs', kind: 'range', label: 'miss status registers', value: 4, min: 1,
      max: 16, step: 1 },
    { id: 'mlp-window', kind: 'range', label: 'reorder buffer entries', value: 32, min: 8,
      max: 128, step: 8 }
  ];

  const METRICS = [
    { id: 'mlp-cycles', label: 'Cycles', note: 'for the traversal' },
    { id: 'mlp-misses', label: 'Cache misses', note: 'the number both traversals share' },
    { id: 'mlp-value', label: 'Memory-level parallelism', note: 'misses in flight, while any were' },
    { id: 'mlp-peak', label: 'Peak in flight', note: 'the most that overlapped at once' },
    { id: 'mlp-stalls', label: 'Miss-register stalls', note: 'a miss that could not even start' },
    { id: 'mlp-forwarded', label: 'Loads forwarded', note: 'never reached the cache at all' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Two traversals over the same bytes',
        controls: CONTROLS }) +
      scope.DataTable.markup({ id: 'mlp-pair', first: true,
        title: 'Same lines, same misses, four times the cycles',
        columns: ['Traversal', 'Cycles', 'Misses', 'MLP', 'Peak', 'Against the other'] }) +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      chartCard() +
      scope.DataTable.markup({ id: 'mlp-mshr',
        title: 'Miss status registers: what they buy, and on which program',
        columns: ['MSHRs', 'stride cycles', 'stride MLP', 'chase cycles', 'chase MLP'] }) +
      scope.DataTable.markup({ id: 'mlp-window-table',
        title: 'Overlap needs a window as well as registers',
        columns: ['Reorder buffer', 'stride cycles', 'chase cycles', 'What limits stride'] }) +
      scope.DataTable.markup({ id: 'mlp-rules',
        title: 'The load/store queue\'s ordering rules, and what each one is for',
        columns: ['Rule', 'Why', 'What it costs', 'Where it is measured'] }) +
      scope.DataTable.markup({ id: 'mlp-forward',
        title: 'Store-to-load forwarding: the load that never touches memory',
        columns: ['Program', 'Loads', 'Forwarded', 'Cache accesses', 'Cycles'] });
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Misses in flight, cycle by cycle</div>' +
      '<div class="card-body"><div id="mlp-chart" class="chart-host"></div>' +
      '<p class="note" id="mlp-chart-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, CACHES: CACHES };
}));
