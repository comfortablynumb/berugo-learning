/** Markup for "Arithmetic coding and ANS". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ArithmeticCodingTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ari-corpus', kind: 'select', label: 'corpus', value: 'English text',
      options: [
        { value: 'English text', label: 'English text' },
        { value: 'source code', label: 'source code' },
        { value: 'JSON logs', label: 'JSON logs' },
        { value: 'mixed prose', label: 'mixed prose' },
        { value: 'image-like', label: 'image-like' }
      ] },
    { id: 'ari-size', kind: 'range', label: 'bytes', value: 3000, min: 1000, max: 6000,
      step: 1000 },
    { id: 'ari-word', kind: 'select', label: 'message for the interval walk', value: 'bananas',
      options: [
        { value: 'bananas', label: 'bananas' },
        { value: 'aaaaab', label: 'aaaaab' },
        { value: 'mississippi', label: 'mississippi' }
      ] }
  ];

  const METRICS = [
    { id: 'ari-bits', label: 'Arithmetic coder', note: 'bits for the whole message' },
    { id: 'ari-ideal', label: 'The information content', note: 'the sum of −log₂(p) over the message' },
    { id: 'ari-over', label: 'Overhead above it', note: 'the cost of terminating the interval' },
    { id: 'ari-rans', label: 'rANS against the same model', note: 'bits, and what the difference is' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'What to code', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The adaptive model’s learning curve</div>' +
      '<div class="card-body"><div id="ari-chart" class="chart-host"></div>' +
      '<p class="note" id="ari-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">One message as one number: the interval narrowing per symbol</div>' +
      '<div class="card-body"><div id="ari-intervals"></div>' +
      '<p class="note" id="ari-intervals-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Three coders against the same model and the same message</div>' +
      '<div class="card-body"><table class="ref-table" id="ari-coders"><thead><tr>' +
      '<th>Coder</th><th>Bits</th><th>Bits per symbol</th><th>Above the information content</th>' +
      '<th>Per symbol</th><th>Round-trip</th><th>What it pays for</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ari-coders-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The integer implementation, and the counter that is easy to omit</div>' +
      '<div class="card-body"><table class="ref-table" id="ari-integer"><thead><tr>' +
      '<th>Quantity</th><th>Value</th><th>Why it is there</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ari-integer-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
