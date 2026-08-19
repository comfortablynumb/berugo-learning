/** Markup for "Zippers: a cursor into an immutable structure". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ZippersTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'zip-depth', kind: 'range', label: 'depth of the edited node', value: 12, min: 4, max: 20, step: 1 },
    { id: 'zip-edits', kind: 'range', label: 'edits at that node', value: 50, min: 10, max: 200, step: 10 }
  ];

  const METRICS = [
    { id: 'zip-rebuilt', label: 'Nodes rebuilt, with a zipper', note: 'one walk out, at the end' },
    { id: 'zip-naive', label: 'Nodes rebuilt, from the root each time', note: 'the same edits, no cursor' },
    { id: 'zip-ratio', label: 'Ratio', note: 'the whole reason a zipper exists' },
    { id: 'zip-moves', label: 'Pointer moves', note: 'navigation, with and without the cursor' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Where the edits land, and how many', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Nodes rebuilt as the edited node gets deeper</div>' +
      '<div class="card-body"><div id="zip-chart"></div>' +
      '<div id="zip-chart-legend"></div>' +
      '<p class="note" id="zip-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The same edits, with and without a cursor</div>' +
      '<div class="card-body"><table class="ref-table" id="zip-compare"><thead><tr>' +
      '<th>Approach</th><th>Nodes rebuilt</th><th>Pointer moves</th><th>Walks back to the root</th>' +
      '<th>Per edit</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="zip-compare-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What the cursor holds at each level</div>' +
      '<div class="card-body"><table class="ref-table" id="zip-context"><thead><tr>' +
      '<th>Level</th><th>Focus</th><th>Context kept</th><th>Cost to move up</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="zip-context-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
