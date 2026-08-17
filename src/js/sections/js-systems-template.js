/** Markup for "JavaScript as a systems language". */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.JsSystemsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function controls() {
    return '' +
      '<div class="card"><div class="card-header">Value</div><div class="card-body">' +
      '  <div class="field-row">' +
      '    <label class="field-label" for="bytes-input">Enter a number</label>' +
      '    <input type="text" id="bytes-input" value="1.5" autocomplete="off">' +
      '  </div>' +
      '  <div class="field-row">' +
      '    <label class="field-label" for="bytes-type">Write it as</label>' +
      '    <select id="bytes-type">' +
      '      <option value="float64">Float64 (a JavaScript number)</option>' +
      '      <option value="float32">Float32</option>' +
      '      <option value="int32">Int32</option>' +
      '      <option value="uint32">Uint32</option>' +
      '      <option value="int8">Int8</option>' +
      '      <option value="bigint64">BigInt64</option>' +
      '    </select>' +
      '  </div>' +
      '  <div class="field-row">' +
      '    <label class="field-label"><input type="checkbox" id="bytes-le" checked> little-endian</label>' +
      '  </div>' +
      '  <p class="note">Click any bit to flip it. Every interpretation updates from the same bytes.</p>' +
      '</div></div>';
  }

  function bytesPanel() {
    return '' +
      '<div class="card"><div class="card-header">Bytes and bits</div><div class="card-body">' +
      '  <div id="bytes-grid" class="mono" style="font-size:.75rem;overflow-x:auto"></div>' +
      '  <div id="bytes-fields" style="margin-top:.75rem"></div>' +
      '</div></div>';
  }

  function interpretations() {
    return '' +
      '<div class="card" style="margin-top:.875rem"><div class="card-header">The same eight bytes, read six ways</div>' +
      '  <div class="card-body"><table class="ref-table" id="bytes-readings">' +
      '    <thead><tr><th>View</th><th>Value</th><th>Note</th></tr></thead><tbody></tbody>' +
      '  </table></div></div>';
  }

  function ulpChart() {
    return '' +
      '<div class="card" style="margin-top:.875rem">' +
      '  <div class="card-header">Spacing between representable doubles</div>' +
      '  <div class="card-body">' +
      '    <div id="ulp-chart"></div>' +
      '    <p class="note">Both axes are log scale. The marked point is 2⁵³, where the gap reaches 2 ' +
      '      and consecutive integers stop being representable.</p>' +
      '  </div>' +
      '</div>';
  }

  function render() {
    return '<div class="grid-2">' + controls() + bytesPanel() + '</div>' + interpretations() + ulpChart();
  }

  return { render: render };
}));
