/** Markup for "Skip lists". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SkipListsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'sk-p', kind: 'select', label: 'promotion probability p', value: '0.5',
      options: [{ value: '0.5', label: '0.5 — a coin flip per level' },
        { value: '0.25', label: '0.25 — Redis and LevelDB' },
        { value: '0.368', label: '0.368 — 1/e, the theoretical optimum' }] },
    { id: 'sk-count', kind: 'range', label: 'keys', value: 20000, min: 100, max: 100000, step: 100 },
    { id: 'sk-seed', kind: 'range', label: 'seed', value: 5, min: 1, max: 40, step: 1 },
    { id: 'sk-deterministic', kind: 'checkbox', label: 'deterministic levels (1-2-3 skip list)', value: false,
      note: 'Promote every 1/p-th insertion instead of flipping. No variance, and no tall towers.' }
  ];

  const METRICS = [
    { id: 'sk-levels', label: 'Levels', note: 'against log_{1/p}(n)' },
    { id: 'sk-comparisons', label: 'Comparisons per search', note: 'measured, against Pugh’s bound' },
    { id: 'sk-tower', label: 'Average tower height', note: 'this is the memory, and it is 1/(1 − p)' },
    { id: 'sk-tree', label: 'Balanced tree comparisons', note: 'the same keys in an AVL tree' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Levels and keys', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Tower heights: the geometric distribution p decides</div>' +
      '<div class="card-body"><div id="sk-chart"></div><div id="sk-legend"></div></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The express lanes, and the path a search takes through them</div>' +
      '<div class="card-body"><pre class="step-work" id="sk-path"></pre>' +
      '<p class="note" id="sk-path-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What p actually trades</div>' +
      '<div class="card-body"><table class="ref-table" id="sk-p-table"><thead><tr>' +
      '<th>p</th><th>Levels</th><th>Comparisons per search</th><th>Pointers per node</th><th>Total pointers</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="sk-p-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
