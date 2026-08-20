/** Markup for "Two pointers, sliding windows and monotonic structures". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TwoPointersTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'tpw-shape', kind: 'select', label: 'input shape', value: 'random',
      options: [{ value: 'random', label: 'random' },
        { value: 'ascending', label: 'ascending' },
        { value: 'descending', label: 'descending' },
        { value: 'sawtooth', label: 'sawtooth' }] },
    { id: 'tpw-size', kind: 'range', label: 'elements', value: 5000, min: 500, max: 20000, step: 500 },
    { id: 'tpw-window', kind: 'range', label: 'window width k', value: 50, min: 2, max: 200, step: 2 },
    { id: 'tpw-bars', kind: 'range', label: 'bars in the histogram instance', value: 2000, min: 200, max: 8000, step: 200 }
  ];

  const METRICS = [
    { id: 'tpw-ops', label: 'Deque operations', note: 'pushes plus pops over the whole sweep' },
    { id: 'tpw-per', label: 'Per element', note: 'the amortisation claim, as a number' },
    { id: 'tpw-max', label: 'Largest deque', note: 'how much of the window is ever held' },
    { id: 'tpw-naive', label: 'Naive comparisons', note: 'the quadratic version, on the same input' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Input, window and instance sizes', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The window, and what the deque is holding</div>' +
      '<div class="card-body"><div id="tpw-window-view"></div>' +
      '<p class="note" id="tpw-window-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Four shapes, one bound</div>' +
      '<div class="card-body"><table class="ref-table" id="tpw-shapes"><thead><tr>' +
      '<th>Shape</th><th>Pushes</th><th>Pops</th><th>Total</th><th>Per element</th><th>Largest deque</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tpw-shapes-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The monotonic stack: next greater element, and the largest rectangle</div>' +
      '<div class="card-body"><table class="ref-table" id="tpw-stack"><thead><tr>' +
      '<th>Problem</th><th>Stack operations</th><th>Naive operations</th><th>Ratio</th>' +
      '<th>Agrees with brute force?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tpw-stack-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">A monotonic stack settling a histogram, step by step</div>' +
      '<div class="card-body"><table class="ref-table" id="tpw-trace"><thead><tr>' +
      '<th>i</th><th>Height</th><th>Popped</th><th>Stack after</th><th>Best area so far</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tpw-trace-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
