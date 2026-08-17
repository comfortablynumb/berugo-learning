/** Markup for "Disjoint set union". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DisjointSetsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'dsu-compress', kind: 'select', label: 'find strategy', value: 'compression',
      options: [{ value: 'none', label: 'none — union by rank only' },
        { value: 'compression', label: 'full path compression' },
        { value: 'splitting', label: 'path splitting' },
        { value: 'halving', label: 'path halving' }] },
    { id: 'dsu-byrank', kind: 'checkbox', label: 'union by rank (otherwise by size)', value: true },
    { id: 'dsu-size', kind: 'range', label: 'elements', value: 40, min: 8, max: 100000, step: 1 },
    { id: 'dsu-unions', kind: 'range', label: 'unions', value: 20, min: 1, max: 100000, step: 1 },
    { id: 'dsu-seed', kind: 'range', label: 'seed', value: 3, min: 1, max: 40, step: 1 },
    { id: 'dsu-find-all', kind: 'button', label: 'Run a find on every element', primary: true },
    { id: 'dsu-reset', kind: 'button', label: 'Rebuild' }
  ];

  const METRICS = [
    { id: 'dsu-components', label: 'Components', note: 'disjoint sets remaining' },
    { id: 'dsu-depth', label: 'Deepest node', note: 'pointer hops to reach its root' },
    { id: 'dsu-visits', label: 'Hops per find', note: 'averaged over the last sweep' },
    { id: 'dsu-writes', label: 'Pointer writes', note: 'what the compression cost' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Strategy and workload', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The forest — roots in green, depth downwards</div>' +
      '<div class="card-body"><div id="dsu-forest"></div>' +
      '<p class="note" id="dsu-forest-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The four find strategies on the identical operation stream</div>' +
      '<div class="card-body"><table class="ref-table" id="dsu-strategies"><thead><tr>' +
      '<th>Strategy</th><th>Deepest node</th><th>Hops per find</th><th>Pointer writes</th><th>What it does</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dsu-strategy-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The inverse Ackermann function, in full</div>' +
      '<div class="card-body"><table class="ref-table" id="dsu-ackermann"><thead><tr>' +
      '<th>n up to</th><th>α(n)</th><th>What that size is</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note">This is the whole function. "Effectively constant" is the honest description; ' +
      '"constant" is not, and the difference has never mattered to anyone.</p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
