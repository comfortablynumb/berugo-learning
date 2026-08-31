/** Markup for "Fingerprinting and identity testing". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.FingerprintingTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'frv-size', kind: 'select', label: 'matrix size', value: '60',
      options: [
        { value: '30', label: '30 × 30' },
        { value: '60', label: '60 × 60' },
        { value: '120', label: '120 × 120' }
      ] },
    { id: 'frv-cells', kind: 'range', label: 'entries corrupted in the claimed product',
      value: 1, min: 1, max: 6, step: 1 },
    { id: 'frv-field', kind: 'select', label: 'field for the identity test', value: '1009',
      options: [
        { value: '101', label: 'ℤ mod 101 — small enough that the bound bites' },
        { value: '1009', label: 'ℤ mod 1009' },
        { value: '10007', label: 'ℤ mod 10007' },
        { value: '1000003', label: 'ℤ mod 1000003' }
      ] }
  ];

  const METRICS = [
    { id: 'frv-detect', label: 'Caught in one round', note: 'measured, against the 1/2 bound' },
    { id: 'frv-alarms', label: 'False alarms', note: 'a correct product wrongly rejected' },
    { id: 'frv-cost', label: 'Verify against multiply', note: 'operations, at this size' },
    { id: 'frv-proof', label: 'Merkle proof length', note: 'hashes to verify one chunk' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A claimed product and a field', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Detection probability against 1 − 2⁻ᵏ</div>' +
      '<div class="card-body"><div id="frv-chart" class="chart-host"></div>' +
      '<div id="frv-legend"></div><p class="note" id="frv-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Freivalds, round by round</div>' +
      '<div class="card-body"><table class="ref-table" id="frv-rounds"><thead><tr>' +
      '<th>Rounds</th><th>Corruptions missed</th><th>Measured failure</th><th>Bound 2⁻ᵏ</th>' +
      '<th>False alarms on a correct product</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="frv-rounds-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Polynomial identities, one random point at a time</div>' +
      '<div class="card-body"><table class="ref-table" id="frv-identity"><thead><tr>' +
      '<th>Claim</th><th>True?</th><th>Degree</th><th>Accepted</th>' +
      '<th>Measured accept rate</th><th>Schwartz–Zippel bound d/|F|</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="frv-identity-note"></p></div></div>' +
      '<div class="grid-even" style="margin-top:.875rem">' +
      '<div class="card"><div class="card-header">Comparing two long sequences by one number</div>' +
      '<div class="card-body"><table class="ref-table" id="frv-strings"><thead><tr>' +
      '<th>Field</th><th>Bits compared</th><th>One position differs</th>' +
      '<th>Built to collide on 8 bases</th><th>Its bound d/p</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="frv-strings-note"></p></div></div>' +
      '<div class="card"><div class="card-header">Verifying one chunk of a large object</div>' +
      '<div class="card-body"><table class="ref-table" id="frv-merkle"><thead><tr>' +
      '<th>Check</th><th>Data touched</th><th>Result</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="frv-merkle-note"></p></div></div>' +
      '</div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
