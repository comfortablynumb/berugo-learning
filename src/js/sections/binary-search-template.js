/** Markup for "Binary search, correctly". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BinarySearchTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'bin-mutation', kind: 'select', label: 'implementation', value: 'correct',
      options: [{ value: 'correct', label: 'the invariant version' },
        { value: 'closed-interval', label: 'high = length − 1' },
        { value: 'lte-probe', label: '<= instead of <' },
        { value: 'high-mid-minus-one', label: 'high = mid − 1' },
        { value: 'low-mid', label: 'low = mid' },
        { value: 'inclusive-loop', label: 'while (low <= high)' },
        { value: 'rounded-mid', label: 'mid rounds up' }] },
    { id: 'bin-array', kind: 'select', label: 'array', value: 'duplicates',
      options: [{ value: 'duplicates', label: '1, 3, 3, 3, 5, 8, 13, 21' },
        { value: 'empty', label: 'empty' },
        { value: 'single', label: 'a single element' },
        { value: 'all-equal', label: 'all equal' },
        { value: 'even', label: '2, 4, 6, 8' }] },
    { id: 'bin-target', kind: 'range', label: 'target', value: 3, min: 0, max: 22, step: 1 },
    { id: 'bin-variant', kind: 'select', label: 'variant to profile', value: 'plain',
      options: [{ value: 'plain', label: 'lower bound' },
        { value: 'branchless', label: 'branchless lower bound' },
        { value: 'interpolation', label: 'interpolation search' },
        { value: 'exponential', label: 'exponential search' }] }
  ];

  const METRICS = [
    { id: 'bin-result', label: 'Result', note: 'what this implementation returned' },
    { id: 'bin-expected', label: 'Correct answer', note: 'from a linear scan' },
    { id: 'bin-steps', label: 'Iterations', note: 'against ⌈log₂ n⌉ + 1' },
    { id: 'bin-caught', label: 'Probes that catch it', note: 'of thirteen' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The implementation, the array and the target', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The interval, one iteration per row</div>' +
      '<div class="card-body"><table class="ref-table" id="bin-trace"><thead><tr>' +
      '<th>Step</th><th>[low, high)</th><th>Width</th><th>mid</th><th>a[mid]</th>' +
      '<th>Went</th><th>Invariant</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bin-trace-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Seven implementations, thirteen probe cases, and which catches which</div>' +
      '<div class="card-body"><table class="ref-table" id="bin-mutations"><thead><tr>' +
      '<th>Implementation</th><th>What changed</th><th>Caught by</th><th>First failing case</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bin-mutations-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The variants, and the assumption each one needs</div>' +
      '<div class="card-body"><table class="ref-table" id="bin-variants"><thead><tr>' +
      '<th>Variant</th><th>Probes on uniform keys</th><th>Probes on skewed keys</th><th>Assumes</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bin-variants-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The midpoint, through 32 bits</div>' +
      '<div class="card-body"><table class="ref-table" id="bin-midpoint"><thead><tr>' +
      '<th>low</th><th>high</th><th>(low + high) / 2</th><th>low + (high − low) / 2</th>' +
      '<th>Through 32 bits</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bin-midpoint-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
