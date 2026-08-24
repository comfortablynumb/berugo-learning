/** Markup for "Error detection: checksums and CRC". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ChecksumsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'crc-message', kind: 'select', label: 'message', value: 'pangram',
      options: [
        { value: 'pangram', label: 'a 72-byte pangram' },
        { value: 'json', label: 'a JSON record' },
        { value: 'zeros', label: 'a run of one repeated byte' }
      ] },
    { id: 'crc-length', kind: 'select', label: 'longest burst searched', value: '34',
      options: [
        { value: '20', label: '20 bits' },
        { value: '34', label: '34 bits' },
        { value: '40', label: '40 bits' }
      ] }
  ];

  const METRICS = [
    { id: 'crc-vectors', label: 'Published test vectors', note: 'table-driven and bit-at-a-time, against the standard' },
    { id: 'crc-burst', label: 'CRC-32 burst guarantee', note: 'the longest burst nothing got through' },
    { id: 'crc-reorder', label: 'The Internet checksum on swapped bytes', note: 'addition is commutative' },
    { id: 'crc-forge', label: 'Bytes needed to forge a CRC', note: 'appended to make it come out to any target' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'What to corrupt', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Burst length against the fraction caught</div>' +
      '<div class="card-body"><div id="crc-chart" class="chart-host"></div>' +
      '<p class="note" id="crc-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Six detectors, three error models, searched rather than quoted</div>' +
      '<div class="card-body"><table class="ref-table" id="crc-detect"><thead><tr>' +
      '<th>Detector</th><th>Width</th><th>Single-bit flips</th><th>Double-bit flips</th>' +
      '<th>Two bytes swapped</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="crc-detect-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Bursts: where each detector stops being certain</div>' +
      '<div class="card-body"><table class="ref-table" id="crc-bursts"><thead><tr>' +
      '<th>Detector</th><th>Width</th><th>Exhaustively verified to</th>' +
      '<th>Nothing missed up to</th><th>First length with a miss</th><th>Its catch rate</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="crc-bursts-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">CRC-32 against the published vectors</div>' +
      '<div class="card-body"><table class="ref-table" id="crc-standard"><thead><tr>' +
      '<th>Input</th><th>Expected</th><th>Table-driven</th><th>Bit-at-a-time</th><th>Matches</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="crc-standard-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
