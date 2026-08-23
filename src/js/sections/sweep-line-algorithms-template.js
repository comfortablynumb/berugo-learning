/** Markup for "Sweep-line algorithms". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SweepLineAlgorithmsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'sl-case', kind: 'select', label: 'segments', value: 'random',
      options: [
        { value: 'random', label: 'random — ordinary input, nothing degenerate' },
        { value: 'shared-endpoints', label: 'shared endpoints — three segments meeting at a point' },
        { value: 'vertical', label: 'vertical — no single y at the sweep position' },
        { value: 'three-through-one', label: 'three through one point — one event, three segments' },
        { value: 'collinear-overlap', label: 'collinear overlap — the meeting is an interval' },
        { value: 'grid', label: 'grid — every horizontal crosses every vertical' },
        { value: 'sparse', label: 'sparse — near-parallel, almost no crossings' }
      ] },
    { id: 'sl-count', kind: 'range', label: 'segments (random and sparse)', value: 12,
      min: 3, max: 60, step: 1 },
    { id: 'sl-position', kind: 'range', label: 'sweep position, percent across', value: 45,
      min: 0, max: 100, step: 1 },
    { id: 'sl-rects', kind: 'range', label: 'rectangles in the union', value: 6,
      min: 2, max: 14, step: 1 }
  ];

  const METRICS = [
    { id: 'sl-found', label: 'Intersections found', note: 'by the sweep' },
    { id: 'sl-disagree', label: 'Disagreements with brute force', note: 'reported, never thrown' },
    { id: 'sl-events', label: 'Events processed', note: 'against pairs the brute force tested' },
    { id: 'sl-degenerate', label: 'Degeneracies met', note: 'verticals, shared endpoints, multi-points' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The segments and the sweep', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The sweep line, the active set, and the crossings</div>' +
      '<div class="card-body"><div id="sl-scene"></div>' +
      '<p class="note" id="sl-scene-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What is on the sweep line right now</div>' +
      '<div class="card-body"><table class="ref-table" id="sl-status"><thead><tr>' +
      '<th>Order on the line</th><th>Segment</th><th>y at the sweep</th><th>Vertical</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="sl-status-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every degenerate case, sweep against brute force</div>' +
      '<div class="card-body"><table class="ref-table" id="sl-cases"><thead><tr>' +
      '<th>Case</th><th>Segments</th><th>Brute force</th><th>Sweep</th><th>Disagreements</th>' +
      '<th>What makes it awkward</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="sl-cases-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Rectangle union: a sweep against inclusion-exclusion</div>' +
      '<div class="card-body"><table class="ref-table" id="sl-union"><thead><tr>' +
      '<th>Rectangles</th><th>Sweep area</th><th>Inclusion-exclusion</th><th>Terms summed</th>' +
      '<th>Slabs</th><th>Agree</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="sl-union-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
