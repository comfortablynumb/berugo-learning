/** Markup for "One-dimensional range structures". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RangeStructuresTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'seg-n', kind: 'select', label: 'array length', value: '8192',
      options: [{ value: '1024', label: '1 024' }, { value: '8192', label: '8 192' },
        { value: '65536', label: '65 536' }] },
    { id: 'seg-ops', kind: 'range', label: 'operations', value: 20000, min: 4000, max: 40000, step: 2000 },
    { id: 'seg-mix', kind: 'range', label: 'share that are updates', value: 50, min: 0, max: 100, step: 10, suffix: '%' },
    { id: 'seg-from', kind: 'range', label: 'decomposition: from', value: 1234, min: 0, max: 8000, step: 1 },
    { id: 'seg-to', kind: 'range', label: 'decomposition: to', value: 6789, min: 0, max: 8000, step: 1 }
  ];

  const METRICS = [
    { id: 'seg-cheapest', label: 'Cheapest by slots touched', note: 'over the whole operation stream' },
    { id: 'seg-fenwick', label: 'Fenwick, per update / query', note: 'array slots read or written' },
    { id: 'seg-segment', label: 'Segment tree, per update / query', note: 'the same operations, any monoid' },
    { id: 'seg-mismatches', label: 'Disagreements', note: 'against a brute replay on a plain array' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The array, the mix and the interval', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Slots touched per operation, by structure</div>' +
      '<div class="card-body"><div id="seg-chart"></div>' +
      '<p class="note" id="seg-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">One array, one operation stream, four sum structures</div>' +
      '<div class="card-body"><table class="ref-table" id="seg-compare"><thead><tr>' +
      '<th>Structure</th><th>Slots / update</th><th>Slots / query</th><th>Total slots</th>' +
      '<th>Bytes per element</th><th>Disagreements</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="seg-compare-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The canonical decomposition of one interval</div>' +
      '<div class="card-body"><pre class="step-work" id="seg-decomposition"></pre>' +
      '<p class="note" id="seg-decomposition-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Three questions a Fenwick tree cannot answer</div>' +
      '<div class="card-body"><table class="ref-table" id="seg-others"><thead><tr>' +
      '<th>Question</th><th>Structure</th><th>Cost per operation</th><th>Memory</th><th>Disagreements</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="seg-others-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
