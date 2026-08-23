/** Markup for "IEEE 754". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Ieee754Template = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ie-value', kind: 'text', label: 'value to dissect', value: '0.1', maxLength: 28,
      placeholder: '0.1' },
    { id: 'ie-preset', kind: 'select', label: 'or pick a landmark', value: 'none',
      options: [
        { value: 'none', label: '— use the value above —' },
        { value: '0.1', label: '0.1 — the one everybody quotes' },
        { value: '1.5', label: '1.5 — exact, and the easiest to read' },
        { value: '9007199254740993', label: '2⁵³ + 1 — the first integer a double loses' },
        { value: '2.2250738585072014e-308', label: 'the smallest normal number' },
        { value: '5e-324', label: 'the smallest subnormal' },
        { value: '1e16', label: '10¹⁶ — where the gap between doubles is 2' }
      ] },
    { id: 'ie-epsilon', kind: 'select', label: 'tolerance for the comparison table', value: '1e-9',
      options: [
        { value: '1e-15', label: '1e-15' },
        { value: '1e-12', label: '1e-12' },
        { value: '1e-9', label: '1e-9 — the number people reach for' },
        { value: '1e-6', label: '1e-6' }
      ] }
  ];

  const METRICS = [
    { id: 'ie-class', label: 'What this value is', note: 'normal, subnormal, zero, infinity or NaN' },
    { id: 'ie-ulp', label: 'Gap to the next double', note: 'the local spacing, one unit in the last place' },
    { id: 'ie-exponent', label: 'Unbiased exponent', note: 'stored exponent minus 1023' },
    { id: 'ie-f32', label: 'Cost of narrowing to binary32', note: 'in units in the last place' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'One value, taken apart', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The 64 bits, and the exact number they are</div>' +
      '<div class="card-body"><div id="ie-word"></div>' +
      '<p class="note" id="ie-word-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="grid-2" style="margin-top:.875rem">' +
      '<div class="card"><div class="card-header">The neighbours on either side</div>' +
      '<div class="card-body"><table class="ref-table" id="ie-neighbours"><thead><tr>' +
      '<th>Position</th><th>Value</th><th>Exact decimal</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ie-neighbours-note"></p></div></div>' +
      '<div class="card"><div class="card-header">nextAfter at the four places it usually breaks</div>' +
      '<div class="card-body"><table class="ref-table" id="ie-audit"><thead><tr>' +
      '<th>Property</th><th>Value</th><th>Holds</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ie-audit-note"></p></div></div>' +
      '</div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The spacing ladder — where integers stop being exact</div>' +
      '<div class="card-body"><div id="ie-chart" class="chart-host"></div>' +
      '<div id="ie-legend"></div>' +
      '<table class="ref-table" id="ie-ladder"><thead><tr>' +
      '<th>Magnitude</th><th>Gap between neighbouring doubles</th><th>Gap is 1 or finer</th>' +
      '<th>x + 1 changes x</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ie-ladder-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Three ways to ask whether two floats are equal</div>' +
      '<div class="card-body"><table class="ref-table" id="ie-compare"><thead><tr>' +
      '<th>Pair</th><th>Absolute tolerance</th><th>Relative tolerance</th>' +
      '<th>Distance in doubles</th><th>Within 4 doubles</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ie-compare-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
