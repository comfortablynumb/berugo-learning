/** Markup for "Error correction". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ErrorCorrectionTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ecc-parity', kind: 'select', label: 'Reed–Solomon parity symbols', value: '6',
      options: [
        { value: '4', label: '4 parity symbols' },
        { value: '6', label: '6 parity symbols' },
        { value: '8', label: '8 parity symbols' }
      ] },
    { id: 'ecc-data', kind: 'range', label: 'data symbols', value: 10, min: 6, max: 16, step: 2 }
  ];

  const METRICS = [
    { id: 'ecc-hamming', label: 'Hamming single-bit errors', note: 'every data word, every position, corrected' },
    { id: 'ecc-secded', label: 'SECDED double-bit errors', note: 'detected rather than miscorrected' },
    { id: 'ecc-limit', label: 'Reed–Solomon correction limit', note: 'unknown errors, observed rather than cited' },
    { id: 'ecc-erasures', label: 'Erasures repairable', note: 'positions known to be wrong: twice as many' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The code', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Storage overhead against losses tolerated</div>' +
      '<div class="card-body"><div id="ecc-chart" class="chart-host"></div>' +
      '<p class="note" id="ecc-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Reed–Solomon under rising corruption</div>' +
      '<div class="card-body"><table class="ref-table" id="ecc-rs"><thead><tr>' +
      '<th>Symbols corrupted</th><th>Within the limit</th><th>Decoder says</th>' +
      '<th>Data recovered</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ecc-rs-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Erasures: the same code, told where the damage is</div>' +
      '<div class="card-body"><table class="ref-table" id="ecc-repair"><thead><tr>' +
      '<th>Symbols erased</th><th>Within the limit</th><th>Repaired exactly</th><th>If not, why</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ecc-repair-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Erasure coding against replication, at equal durability</div>' +
      '<div class="card-body"><table class="ref-table" id="ecc-durability"><thead><tr>' +
      '<th>Scheme</th><th>Storage</th><th>Losses tolerated</th><th>Reads to reconstruct one loss</th>' +
      '<th>Storage against 3× replication</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ecc-durability-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
