/** Markup for "Integer representation". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.IntegerRepresentationTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ir-width', kind: 'select', label: 'width', value: '8',
      options: [
        { value: '8', label: '8 bits — small enough to read every bit' },
        { value: '16', label: '16 bits' },
        { value: '32', label: '32 bits — what JavaScript’s bitwise operators use' },
        { value: '64', label: '64 bits — past what a double can hold exactly' }
      ] },
    { id: 'ir-signed', kind: 'checkbox', label: 'read the pattern as signed', value: true },
    { id: 'ir-a', kind: 'number', label: 'a', value: 100, step: 1 },
    { id: 'ir-b', kind: 'number', label: 'b', value: 100, step: 1 }
  ];

  const METRICS = [
    { id: 'ir-stored', label: 'What the width stores', note: 'the value read back' },
    { id: 'ir-flags', label: 'Flags the adder raises', note: 'carry and overflow are different' },
    { id: 'ir-span', label: 'Representable range', note: 'one more negative than positive' },
    { id: 'ir-negmin', label: 'Negating the minimum', note: 'the asymmetry, as a value' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A value, a width, and a second operand',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The pattern, and both readings of it</div>' +
      '<div class="card-body"><div id="ir-word"></div>' +
      '<p class="note" id="ir-word-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="grid-even" style="margin-top:.875rem">' +
      '<div class="card"><div class="card-header">The wheel, and where the cut is</div>' +
      '<div class="card-body"><div id="ir-wheel"></div>' +
      '<p class="note" id="ir-wheel-note"></p></div></div>' +
      '<div class="card"><div class="card-header">The same bytes, written two ways</div>' +
      '<div class="card-body"><table class="ref-table" id="ir-endian"><thead><tr>' +
      '<th>Order</th><th>Bytes in memory</th><th>Read back the other way</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ir-endian-note"></p></div></div>' +
      '</div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Four operations, three overflow policies</div>' +
      '<div class="card-body"><table class="ref-table" id="ir-ops"><thead><tr>' +
      '<th>Operation</th><th>Exact answer</th><th>Wrapping</th><th>Saturating</th>' +
      '<th>Checked</th><th>Carry</th><th>Overflow</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ir-ops-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What JavaScript does to an integer that will not fit</div>' +
      '<div class="card-body"><table class="ref-table" id="ir-coerce"><thead><tr>' +
      '<th>Expression</th><th>Value</th><th>Why</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ir-coerce-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
