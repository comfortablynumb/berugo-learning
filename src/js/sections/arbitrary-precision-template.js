/** Markup for "Arbitrary-precision arithmetic". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ArbitraryPrecisionTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ap-bits', kind: 'select', label: 'operand size', value: '512',
      options: [
        { value: '64', label: '64 bits — 4 limbs' },
        { value: '128', label: '128 bits — 8 limbs, the recursion floor' },
        { value: '512', label: '512 bits — 32 limbs' },
        { value: '2048', label: '2 048 bits — an RSA modulus' },
        { value: '4096', label: '4 096 bits' }
      ] },
    { id: 'ap-left', kind: 'number', label: 'small multiplication: left operand', value: 123456789,
      step: 1 },
    { id: 'ap-right', kind: 'number', label: 'small multiplication: right operand', value: 987654321,
      step: 1 },
    { id: 'ap-exponent', kind: 'select', label: 'exponent for the modular power', value: '65537',
      options: [
        { value: '65537', label: '65 537 — the standard public exponent, two set bits' },
        { value: '131071', label: '131 071 — the same width, seventeen set bits' },
        { value: '123456789', label: '123 456 789 — an ordinary exponent' }
      ] },
    { id: 'ap-trials', kind: 'range', label: 'randomised divisions in the audit', value: 4000,
      min: 500, max: 8000, step: 500 }
  ];

  const METRICS = [
    { id: 'ap-ops-ratio', label: 'Karatsuba saving, multiplications only', note: 'the flattering column' },
    { id: 'ap-total-ratio', label: 'Karatsuba saving, all limb work', note: 'multiplications plus additions' },
    { id: 'ap-time-ratio', label: 'Karatsuba saving, wall clock', note: 'what the caller actually pays' },
    { id: 'ap-division', label: 'Divisions disagreeing with BigInt', note: 'quotient or remainder' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Operand size, a small product, an exponent',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Cost against operand size</div>' +
      '<div class="card-body"><div id="ap-chart" class="chart-host"></div>' +
      '<div id="ap-legend"></div><p class="note" id="ap-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Three columns, three different crossovers</div>' +
      '<div class="card-body"><table class="ref-table" id="ap-crossover"><thead><tr>' +
      '<th>Bits</th><th>Limbs</th><th>Limb multiplies (school / Karatsuba)</th>' +
      '<th>All limb work</th><th>Median ms (school / Karatsuba)</th><th>BigInt ms</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ap-crossover-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">A small multiplication, limb by limb</div>' +
      '<div class="card-body"><table class="ref-table" id="ap-limbs"><thead><tr>' +
      '<th>Left limb</th><th>Digit</th><th>Partial products</th><th>Carries out</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ap-limbs-note"></p></div></div>' +
      '<div class="grid-2" style="margin-top:.875rem">' +
      '<div class="card"><div class="card-header">Division, and the correction nobody reaches</div>' +
      '<div class="card-body"><table class="ref-table" id="ap-div-table"><thead><tr>' +
      '<th>Check</th><th>Result</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ap-div-note"></p></div></div>' +
      '<div class="card"><div class="card-header">Modular exponentiation, and what the exponent leaks</div>' +
      '<div class="card-body"><table class="ref-table" id="ap-modpow"><thead><tr>' +
      '<th>Quantity</th><th>Value</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ap-modpow-note"></p></div></div>' +
      '</div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
