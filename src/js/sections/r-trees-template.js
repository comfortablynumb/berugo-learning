/** Markup for "R-trees and rectangle indexes". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RTreesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'rt-split', kind: 'select', label: 'split heuristic', value: 'quadratic',
      options: [{ value: 'firstfit', label: 'first-fit — cut the list in half' },
        { value: 'linear', label: 'Guttman linear — O(M) seeds' },
        { value: 'quadratic', label: 'Guttman quadratic — O(M²) seeds' },
        { value: 'rstar', label: 'R* — perimeter, overlap, reinsertion' },
        { value: 'str', label: 'STR bulk load — no splits at all' }] },
    { id: 'rt-fanout', kind: 'range', label: 'entries per node', value: 9, min: 4, max: 32, step: 1 },
    { id: 'rt-size', kind: 'range', label: 'rectangle side', value: 12, min: 4, max: 40, step: 2 },
    { id: 'rt-window', kind: 'range', label: 'query window side', value: 60, min: 20, max: 160, step: 10 },
    { id: 'rt-level', kind: 'range', label: 'level drawn', value: 2, min: 0, max: 5, step: 1 }
  ];

  const METRICS = [
    { id: 'rt-overlap', label: 'Sibling overlap', note: 'as a fraction of the area the tree covers' },
    { id: 'rt-visits', label: 'Nodes visited per query', note: 'the number overlap actually costs' },
    { id: 'rt-fill', label: 'Leaf fill', note: 'how full the pages are, and how tall the tree is' },
    { id: 'rt-candidates', label: 'Candidates per query', note: 'rectangles tested against the window' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The heuristic, the fan-out and the window', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The bounding rectangles at one level, drawn over the data</div>' +
      '<div class="card-body"><div id="rt-map"></div>' +
      '<p class="note" id="rt-map-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Five builds of the same rectangles: overlap decides, not height</div>' +
      '<div class="card-body"><table class="ref-table" id="rt-compare"><thead><tr>' +
      '<th>Build</th><th>Height</th><th>Nodes</th><th>Leaf fill</th><th>Overlap</th>' +
      '<th>Nodes / query</th><th>Candidates / query</th><th>Results / query</th><th>Wrong</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rt-compare-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Overlap against query cost, one point per build</div>' +
      '<div class="card-body"><div id="rt-chart"></div>' +
      '<div id="rt-chart-legend"></div>' +
      '<p class="note" id="rt-chart-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What the selected build is doing</div>' +
      '<div class="card-body"><pre class="step-work" id="rt-report"></pre>' +
      '<p class="note" id="rt-report-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
