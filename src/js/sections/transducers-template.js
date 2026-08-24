/** Markup for "Transducers". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TransducerTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'fst-input', kind: 'select', label: 'the input text', value: 'Hello   World .',
      options: [
        { value: 'Hello   World .', label: '"Hello   World ."' },
        { value: 'A  B   C', label: '"A  B   C"' },
        { value: '   spaced   out   ', label: '"   spaced   out   "' },
        { value: 'NoChangeHere', label: '"NoChangeHere"' }
      ] },
    { id: 'fst-stage', kind: 'select', label: 'which machine to trace', value: 'composed',
      options: [
        { value: 'fold', label: 'case folding alone' },
        { value: 'collapse', label: 'space collapsing alone' },
        { value: 'composed', label: 'the composed machine — one pass' }
      ] }
  ];

  const METRICS = [
    { id: 'fst-output', label: 'Output length', note: 'against the input length' },
    { id: 'fst-passes', label: 'Passes over the text', note: 'composed against chained' },
    { id: 'fst-states', label: 'Composed states', note: 'the pair reachable from the two starts' },
    { id: 'fst-same', label: 'Composition matches chaining', note: 'over every sample and 200 random strings' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Text and machine', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">In, and out</div>' +
      '<div class="card-body"><div id="fst-text"></div>' +
      '<p class="note" id="fst-text-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The run, one transition per character</div>' +
      '<div class="card-body"><table class="ref-table" id="fst-run"><thead><tr>' +
      '<th>#</th><th>Read</th><th>From</th><th>To</th><th>Wrote</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="fst-run-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Chained against composed, on every sample</div>' +
      '<div class="card-body"><table class="ref-table" id="fst-compare"><thead><tr>' +
      '<th>Input</th><th>Chained through two machines</th><th>Composed, one pass</th>' +
      '<th>Same</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="fst-compare-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Mealy against Moore, and where each one belongs</div>' +
      '<div class="card-body"><table class="ref-table" id="fst-shapes"><thead><tr>' +
      '<th>Shape</th><th>Output hangs off</th><th>States for case folding</th><th>Suits</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="fst-shapes-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Where transducers turn up</div>' +
      '<div class="card-body"><table class="ref-table" id="fst-uses"><thead><tr>' +
      '<th>Application</th><th>What the machine reads</th><th>What it writes</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="fst-uses-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
