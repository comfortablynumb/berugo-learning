/** Markup for "Circuits and non-uniform computation". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CircuitTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'cir-family', kind: 'select', label: 'the circuit family', value: 'rippleCarry',
      options: [
        { value: 'rippleCarry', label: 'ripple-carry out — small and deep' },
        { value: 'carryLookahead', label: 'carry-lookahead out — large and shallow' },
        { value: 'orChain', label: 'OR as a chain' },
        { value: 'orTree', label: 'OR as a tree' },
        { value: 'orFlat', label: 'OR with unbounded fan-in' },
        { value: 'parityChain', label: 'PARITY as a chain' },
        { value: 'parityTree', label: 'PARITY as a tree' }
      ] },
    { id: 'cir-width', kind: 'range', label: 'input width', value: 4, min: 2, max: 8, step: 1 },
    { id: 'cir-latency', kind: 'range', label: 'gate delay, in picoseconds', value: 20,
      min: 5, max: 100, step: 5 }
  ];

  const METRICS = [
    { id: 'cir-size', label: 'Size', note: 'gates — the area' },
    { id: 'cir-depth', label: 'Depth', note: 'longest path — the latency' },
    { id: 'cir-correct', label: 'Correct on every input', note: 'the truth table, exhaustively' },
    { id: 'cir-delay', label: 'Propagation delay', note: 'depth times the gate delay' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Family, width and gate delay', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The circuit, by level</div>' +
      '<div class="card-body"><div id="cir-layers" class="mono" style="font-size:.8rem"></div>' +
      '<p class="note" id="cir-layers-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Size and depth against width</div>' +
      '<div class="card-body"><table class="ref-table" id="cir-growth"><thead><tr>' +
      '<th>Width</th><th>Size</th><th>Depth</th><th>Delay</th><th>Correct</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="cir-growth-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The same function, three arrangements</div>' +
      '<div class="card-body"><table class="ref-table" id="cir-arrangements"><thead><tr>' +
      '<th>Arrangement</th><th>Size</th><th>Depth</th><th>Fan-in</th><th>What it costs</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="cir-arrangements-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The truth table, checked exhaustively</div>' +
      '<div class="card-body"><table class="ref-table" id="cir-truth"><thead><tr>' +
      '<th>Inputs</th><th>Circuit says</th><th>The function says</th><th>Agree</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="cir-truth-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The circuit classes</div>' +
      '<div class="card-body"><table class="ref-table" id="cir-classes"><thead><tr>' +
      '<th>Class</th><th>Depth</th><th>Fan-in</th><th>Contains</th><th>Provably excludes</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="cir-classes-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
