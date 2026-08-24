/** Markup for "Quantum computation". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.QuantumTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'qbt-algorithm', kind: 'select', label: 'what to run', value: 'grover',
      options: [
        { value: 'grover', label: 'Grover search — the quadratic speed-up' },
        { value: 'deutsch', label: 'Deutsch-Jozsa — the smallest speed-up there is' },
        { value: 'bell', label: 'a Bell pair — entanglement in two gates' },
        { value: 'ghz', label: 'a GHZ state — three qubits correlated' }
      ] },
    { id: 'qbt-qubits', kind: 'range', label: 'qubits', value: 4, min: 2, max: 6, step: 1 },
    { id: 'qbt-target', kind: 'range', label: 'the marked item, for Grover', value: 3,
      min: 0, max: 31, step: 1 },
    { id: 'qbt-oracle', kind: 'select', label: 'the oracle, for Deutsch-Jozsa',
      value: 'balanced',
      options: [
        { value: 'balanced', label: 'balanced — half the inputs give 1' },
        { value: 'constant0', label: 'constant 0' },
        { value: 'constant1', label: 'constant 1' }
      ] }
  ];

  const METRICS = [
    { id: 'qbt-answer', label: 'The answer', note: 'what the measurement would report' },
    { id: 'qbt-queries', label: 'Queries used', note: 'against the classical worst case' },
    { id: 'qbt-error', label: 'Largest amplitude error', note: 'measured against the formula' },
    { id: 'qbt-norm', label: 'Total probability', note: 'must stay at exactly one' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Algorithm, qubits and oracle', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The state, as measurement probabilities</div>' +
      '<div class="card-body"><div id="qbt-state" class="mono" ' +
      'style="font-size:.78rem;line-height:1.35"></div>' +
      '<p class="note" id="qbt-state-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Amplitude amplification, iteration by iteration</div>' +
      '<div class="card-body"><table class="ref-table" id="qbt-iterations"><thead><tr>' +
      '<th>Iteration</th><th>Marked probability</th><th>Predicted sin²((2k+1)θ)</th>' +
      '<th>Difference</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="qbt-iterations-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The quantum advantage, by size</div>' +
      '<div class="card-body"><table class="ref-table" id="qbt-advantage"><thead><tr>' +
      '<th>Qubits</th><th>Search space</th><th>Classical average</th><th>Grover iterations</th>' +
      '<th>Peak probability</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="qbt-advantage-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What a quantum computer does to each primitive</div>' +
      '<div class="card-body"><table class="ref-table" id="qbt-impact"><thead><tr>' +
      '<th>Primitive</th><th>Classical</th><th>Quantum</th><th>The fix</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="qbt-impact-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Where BQP actually sits</div>' +
      '<div class="card-body"><table class="ref-table" id="qbt-classes"><thead><tr>' +
      '<th>Claim</th><th>Status</th><th>Why</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="qbt-classes-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
