/** Markup for "Non-comparison sorting: counting, radix and buckets". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.NonComparisonSortsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ncs-algorithm', kind: 'select', label: 'algorithm', value: 'lsd',
      options: [{ value: 'lsd', label: 'LSD radix — least significant digit first' },
        { value: 'msd', label: 'MSD radix — most significant digit first' },
        { value: 'flag', label: 'American flag — MSD, in place' },
        { value: 'counting', label: 'counting sort' },
        { value: 'bucket', label: 'bucket sort' }] },
    { id: 'ncs-bits', kind: 'select', label: 'digit width', value: '8',
      options: [{ value: '4', label: '4 bits — 16 buckets, 8 passes' },
        { value: '8', label: '8 bits — 256 buckets, 4 passes' },
        { value: '11', label: '11 bits — 2 048 buckets, 3 passes' },
        { value: '16', label: '16 bits — 65 536 buckets, 2 passes' }] },
    { id: 'ncs-range', kind: 'range', label: 'key range (log₂)', value: 20, min: 4, max: 32, step: 1 },
    { id: 'ncs-size', kind: 'range', label: 'elements', value: 20000, min: 2000, max: 60000, step: 2000 },
    { id: 'ncs-stable', kind: 'select', label: 'digit pass', value: 'stable',
      options: [{ value: 'stable', label: 'stable — scatter backwards' },
        { value: 'unstable', label: 'unstable — scatter forwards' }] }
  ];

  const METRICS = [
    { id: 'ncs-comparisons', label: 'Key comparisons', note: 'it is not a comparison sort' },
    { id: 'ncs-moves', label: 'Element moves', note: 'what it spends instead' },
    { id: 'ncs-passes', label: 'Digit passes', note: 'over the whole array' },
    { id: 'ncs-table', label: 'Counter table', note: 'bytes of buckets per pass' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The algorithm, the digit width and the key range', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The bucket histogram for one digit pass</div>' +
      '<div class="card-body"><div id="ncs-histogram"></div>' +
      '<p class="note" id="ncs-histogram-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Digit width against passes, buckets and table size</div>' +
      '<div class="card-body"><table class="ref-table" id="ncs-widths"><thead><tr>' +
      '<th>Digit width</th><th>Buckets</th><th>Passes for 32 bits</th><th>Counter table</th>' +
      '<th>Moves</th><th>Wrong</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ncs-widths-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Where counting sort stops being affordable</div>' +
      '<div class="card-body"><table class="ref-table" id="ncs-counting"><thead><tr>' +
      '<th>Key range</th><th>Counter table</th><th>Counting operations</th>' +
      '<th>n log₂ n comparisons</th><th>Which wins</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ncs-counting-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Stability is not an extra: it is what makes LSD work at all</div>' +
      '<div class="card-body"><table class="ref-table" id="ncs-stability"><thead><tr>' +
      '<th>Key range</th><th>Meaningful passes</th><th>Stable pass</th><th>Unstable pass</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ncs-stability-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
