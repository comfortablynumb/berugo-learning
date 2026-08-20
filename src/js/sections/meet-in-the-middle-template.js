/** Markup for "Meet in the middle and bidirectional search". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MeetInTheMiddleTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'mim-items', kind: 'range', label: 'items in the subset-sum instance', value: 40, min: 12, max: 44, step: 2 },
    { id: 'mim-seed', kind: 'range', label: 'instance seed', value: 5, min: 1, max: 40, step: 1 },
    { id: 'mim-branch', kind: 'range', label: 'branching factor of the graph', value: 3, min: 2, max: 5, step: 1 },
    { id: 'mim-depth', kind: 'range', label: 'depth of the graph', value: 8, min: 4, max: 11, step: 1 }
  ];

  const METRICS = [
    { id: 'mim-states', label: 'States generated', note: 'both halves, enumerated and sorted' },
    { id: 'mim-brute', label: 'States a full search needs', note: '2^n, for the same instance' },
    { id: 'mim-saving', label: 'Saving', note: 'the exponent halved, as a ratio' },
    { id: 'mim-memory', label: 'Partial sums held', note: 'the price, and the reason n stops near 50' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Instance sizes', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The two halves, and where they meet</div>' +
      '<div class="card-body"><table class="ref-table" id="mim-halves"><thead><tr>' +
      '<th>Half</th><th>Items</th><th>Subsets enumerated</th><th>Smallest sum</th><th>Largest sum</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mim-halves-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Meet in the middle against brute force, where brute force can still run</div>' +
      '<div class="card-body"><table class="ref-table" id="mim-compare"><thead><tr>' +
      '<th>n</th><th>Meet in the middle</th><th>Brute force</th><th>Ratio</th><th>Best sum found</th>' +
      '<th>Same answer?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mim-compare-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What the exhaustive search would have cost</div>' +
      '<div class="card-body"><table class="ref-table" id="mim-projection"><thead><tr>' +
      '<th>n</th><th>States</th><th>Projected time</th><th>Meet in the middle states</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mim-projection-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Bidirectional search: two frontiers of half the radius</div>' +
      '<div class="card-body"><table class="ref-table" id="mim-bidi"><thead><tr>' +
      '<th>Search</th><th>States expanded</th><th>Peak frontier</th><th>Distance found</th><th>b^d prediction</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mim-bidi-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
