/** Markup for "Weight-balanced and scapegoat trees". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ScapegoatTreesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'sg-alpha', kind: 'range', label: 'α', value: 0.65, min: 0.55, max: 0.9, step: 0.05,
      note: 'Closer to 0.5 is a stricter tree and more rebuilding; closer to 1 is a looser tree and less.' },
    { id: 'sg-count', kind: 'range', label: 'keys', value: 31, min: 7, max: 20000, step: 1 },
    { id: 'sg-order', kind: 'select', label: 'insertion order', value: 'sorted',
      options: [{ value: 'sorted', label: 'sorted' },
        { value: 'random', label: 'random (shuffled)' }] },
    { id: 'sg-seed', kind: 'range', label: 'seed', value: 1, min: 1, max: 40, step: 1 },
    { id: 'sg-deletes', kind: 'range', label: 'then delete this share', value: 0, min: 0, max: 90, step: 5,
      suffix: '%', note: 'Deletion never rebuilds a subtree — it waits until the whole tree is α-thin, then rebuilds all of it.' }
  ];

  const METRICS = [
    { id: 'sg-height', label: 'Height', note: 'against the α depth limit' },
    { id: 'sg-rebuilds', label: 'Subtree rebuilds', note: 'how often a scapegoat was found' },
    { id: 'sg-moved', label: 'Nodes rebuilt', note: 'total nodes touched by rebuilding' },
    { id: 'sg-amortised', label: 'Rebuilt per operation', note: 'the amortised cost, which is the whole argument' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'α and workload', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The tree — no balance field on any node</div>' +
      '<div class="card-body"><div id="sg-tree"></div>' +
      '<p class="note" id="sg-tree-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What α buys and what it costs</div>' +
      '<div class="card-body"><table class="ref-table" id="sg-alpha-table"><thead><tr>' +
      '<th>α</th><th>Depth limit</th><th>Height</th><th>Rebuilds</th><th>Nodes rebuilt per insert</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="sg-alpha-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Against the families that store balance metadata</div>' +
      '<div class="card-body"><table class="ref-table" id="sg-compare"><thead><tr>' +
      '<th>Family</th><th>Height</th><th>Per-node metadata</th><th>Structural work</th><th>Worst single operation</th>' +
      '</tr></thead><tbody></tbody></table></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
