/** Markup for "Authenticated encryption". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AeadTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'aea-suite', kind: 'select', label: 'AEAD suite', value: 'aes-gcm',
      options: [
        { value: 'aes-gcm', label: 'AES-GCM' },
        { value: 'chacha20-poly1305', label: 'ChaCha20-Poly1305' }
      ] },
    { id: 'aea-messages', kind: 'range', label: 'messages per key (log2)', value: 32, min: 16,
      max: 56, step: 4 }
  ];

  const METRICS = [
    { id: 'aea-keystream', label: 'Keystream identical', note: 'two messages, one nonce' },
    { id: 'aea-recovered', label: 'Second plaintext recovered', note: 'from the ciphertexts alone' },
    { id: 'aea-forged', label: 'Forged tag accepted', note: 'after the authentication key is known' },
    { id: 'aea-collision', label: 'Nonce collision probability', note: 'random 96-bit nonces at this volume' }
  ];

  function render() {
    return '<div class="callout callout-warning" id="aea-disclaimer"></div>' +
      '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Suite and traffic volume', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">What the eavesdropper reconstructed</div>' +
      '<div class="card-body"><div id="aea-reveal"></div>' +
      '<p class="note" id="aea-reveal-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The nonce-reuse attack, arithmetic included</div>' +
      '<div class="card-body"><table class="ref-table" id="aea-steps"><thead><tr>' +
      '<th>Step</th><th>The arithmetic</th><th>What it produces</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="aea-steps-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Composition order: three ways to combine, one that is right</div>' +
      '<div class="card-body"><table class="ref-table" id="aea-order"><thead><tr>' +
      '<th>Order</th><th>Verify before decrypting</th><th>Used by</th><th>Verdict</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="aea-order-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Tamper tests, each one run against the suite above</div>' +
      '<div class="card-body"><table class="ref-table" id="aea-tamper"><thead><tr>' +
      '<th>What the attacker changed</th><th>Accepted</th><th>Why</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="aea-tamper-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Nonce strategies and the volume each one survives</div>' +
      '<div class="card-body"><table class="ref-table" id="aea-nonce"><thead><tr>' +
      '<th>Strategy</th><th>Collision risk</th><th>Fails when</th><th>Use it when</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="aea-nonce-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
