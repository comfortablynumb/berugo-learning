/** Markup for "Library sorts: Timsort and pattern-defeating quicksort". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LibrarySortsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'lib-shape', kind: 'select', label: 'input shape', value: 'nearly-sorted',
      options: [{ value: 'nearly-sorted', label: 'nearly sorted' },
        { value: 'random', label: 'random' },
        { value: 'sorted', label: 'already sorted' },
        { value: 'reversed', label: 'reversed' },
        { value: 'few-unique', label: 'few unique' },
        { value: 'organ-pipe', label: 'organ pipe' },
        { value: 'adversarial', label: 'adversarial' }] },
    { id: 'lib-size', kind: 'range', label: 'elements', value: 4000, min: 1000, max: 20000, step: 1000 },
    { id: 'lib-collapse', kind: 'select', label: 'Timsort merge-stack rule', value: 'fixed',
      options: [{ value: 'fixed', label: 'the 2015 fix — checks four runs deep' },
        { value: 'buggy', label: 'the original — checks only the top three' }] }
  ];

  const METRICS = [
    { id: 'lib-runs', label: 'Runs pushed', note: 'after minrun padding' },
    { id: 'lib-minrun', label: 'minrun', note: 'the computed run floor for this size' },
    { id: 'lib-stack', label: 'Deepest merge stack', note: 'bounded by the invariants' },
    { id: 'lib-violations', label: 'Invariant violations', note: 'surviving a collapse' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The input, the size and the collapse rule', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The runs Timsort found before it merged anything</div>' +
      '<div class="card-body"><div id="lib-runs-view"></div>' +
      '<p class="note" id="lib-runs-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The merge stack after every push, and whether the invariants hold</div>' +
      '<div class="card-body"><table class="ref-table" id="lib-stack-table"><thead><tr>' +
      '<th>#</th><th>Stack (run lengths, deepest first)</th><th>Z &gt; Y + X</th><th>Y &gt; X</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lib-stack-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Timsort against pdqsort against introsort, on the same input</div>' +
      '<div class="card-body"><table class="ref-table" id="lib-compare"><thead><tr>' +
      '<th>Sort</th><th>Comparisons</th><th>Per element</th><th>Moves</th>' +
      '<th>Allocations</th><th>Stable</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lib-compare-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">pdqsort\'s four mechanisms, and which input makes each one fire</div>' +
      '<div class="card-body"><table class="ref-table" id="lib-pdq"><thead><tr>' +
      '<th>Shape</th><th>Comparisons</th><th>Depth</th><th>Already partitioned</th>' +
      '<th>Bounded-insertion wins</th><th>Pattern breaks</th><th>Equal blocks</th><th>Heapsort escapes</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lib-pdq-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
