/** Markup for "Symmetric encryption and block cipher modes". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SymmetricTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'sym-mode', kind: 'select', label: 'mode under the picture', value: 'ecb',
      options: [
        { value: 'ecb', label: 'ECB — every block independently' },
        { value: 'cbc', label: 'CBC — each block XORed with the last ciphertext' },
        { value: 'ctr', label: 'CTR — a keystream, XORed' }
      ] },
    { id: 'sym-message', kind: 'select', label: 'the ciphertext the oracle attacks',
      value: 'transfer 100 to alice; auth=ok',
      options: [
        { value: 'transfer 100 to alice; auth=ok', label: 'transfer 100 to alice; auth=ok' },
        { value: 'user=bob;role=guest', label: 'user=bob;role=guest' },
        { value: 'BEGIN;amount=25;END', label: 'BEGIN;amount=25;END' }
      ] }
  ];

  const METRICS = [
    { id: 'sym-distinct', label: 'Distinct ciphertext blocks', note: 'out of the blocks in the picture' },
    { id: 'sym-recovered', label: 'Plaintext bytes recovered', note: 'by an oracle that answers one bit' },
    { id: 'sym-queries', label: 'Oracle queries', note: 'to decrypt the whole message without the key' },
    { id: 'sym-flip', label: 'Bit-flip attack', note: 'changing plaintext through an unauthenticated ciphertext' }
  ];

  function render() {
    return '<div class="callout callout-warning" id="sym-disclaimer"></div>' +
      '<div class="card"><div class="card-header">The same picture, encrypted three ways</div>' +
      '<div class="card-body"><div id="sym-picture" class="chart-host"></div>' +
      '<p class="note" id="sym-picture-note"></p></div></div>' +
      '<div class="grid-2" style="margin-top:.875rem">' +
      scope.ControlPanel.markup({ title: 'Mode and target', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">What the padding oracle recovered</div>' +
      '<div class="card-body"><div id="sym-recovery"></div>' +
      '<p class="note" id="sym-recovery-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The modes, and what each one leaks</div>' +
      '<div class="card-body"><table class="ref-table" id="sym-modes"><thead><tr>' +
      '<th>Mode</th><th>Needs</th><th>Reusing that value</th><th>Parallel</th>' +
      '<th>What it leaks</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="sym-modes-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The padding oracle, block by block</div>' +
      '<div class="card-body"><table class="ref-table" id="sym-oracle"><thead><tr>' +
      '<th>Block</th><th>Queries</th><th>Recovered bytes</th><th>As text</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="sym-oracle-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Bit flipping: the ciphertext is malleable and nobody checks</div>' +
      '<div class="card-body"><table class="ref-table" id="sym-malleable"><thead><tr>' +
      '<th>Stage</th><th>Bytes</th><th>What the recipient sees</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="sym-malleable-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
