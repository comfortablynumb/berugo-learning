/** Markup for "Bitmask DP". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BitmaskDpTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'bmk-cities', kind: 'range', label: 'cities in the TSP instance', value: 12, min: 5, max: 16, step: 1 },
    { id: 'bmk-seed', kind: 'range', label: 'instance seed', value: 13, min: 1, max: 40, step: 1 },
    { id: 'bmk-bits', kind: 'range', label: 'bits for the subset sweeps', value: 10, min: 2, max: 14, step: 1 },
    { id: 'bmk-board', kind: 'range', label: 'domino board: columns (2 rows)', value: 12, min: 2, max: 20, step: 1 }
  ];

  const METRICS = [
    { id: 'bmk-tour', label: 'Optimal tour', note: 'Held-Karp, checked against every permutation' },
    { id: 'bmk-cells', label: 'Table cells', note: '2^n x n — the (mask, last) state' },
    { id: 'bmk-perms', label: 'Permutations avoided', note: '(n - 1)! — what the table replaces' },
    { id: 'bmk-wall', label: 'Table bytes at n = 25', note: 'why this family has a hard ceiling' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Instances', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The memory wall, in bytes rather than in adjectives</div>' +
      '<div class="card-body"><table class="ref-table" id="bmk-memory"><thead><tr>' +
      '<th>n</th><th>(mask, last) cells</th><th>Bytes at 8 per cell</th><th>Permutations</th>' +
      '<th>Feasible in a browser?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bmk-memory-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The 3^n identity, measured</div>' +
      '<div class="card-body"><table class="ref-table" id="bmk-submask"><thead><tr>' +
      '<th>n</th><th>Submask steps</th><th>3^n</th><th>Exact?</th><th>4^n (the naive bound)</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bmk-submask-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Sum over subsets: the same aggregate, two costs</div>' +
      '<div class="card-body"><table class="ref-table" id="bmk-sos"><thead><tr>' +
      '<th>Method</th><th>Operations</th><th>Complexity</th><th>Agrees?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bmk-sos-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Two more mask problems on the same idea</div>' +
      '<div class="card-body"><table class="ref-table" id="bmk-family"><thead><tr>' +
      '<th>Problem</th><th>State</th><th>Answer</th><th>Checked against</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bmk-family-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
