/** Markup for "Signatures, certificates and PKI". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SignaturesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'sig-nonce', kind: 'select', label: 'how the signer picks its nonce', value: 'reused',
      options: [
        { value: 'reused', label: 'the same k twice — the bug' },
        { value: 'deterministic', label: 'deterministic, RFC 6979 style' }
      ] },
    { id: 'sig-chain', kind: 'select', label: 'the certificate chain presented', value: 'valid',
      options: [
        { value: 'valid', label: 'a well-formed chain' },
        { value: 'expired', label: 'the leaf has expired' },
        { value: 'wrong-host', label: 'the name does not match' },
        { value: 'leaf-signs-leaf', label: 'a leaf signed another certificate' },
        { value: 'tampered', label: 'the leaf was edited after signing' }
      ] }
  ];

  const METRICS = [
    { id: 'sig-shared', label: 'Signatures share r', note: 'the visible symptom of a repeated nonce' },
    { id: 'sig-recovered', label: 'Private key recovered', note: 'from two signatures and nothing else' },
    { id: 'sig-checks', label: 'Chain checks passing', note: 'signature, window, constraints, name' },
    { id: 'sig-valid', label: 'Chain accepted', note: 'what a client would conclude' }
  ];

  function render() {
    return '<div class="callout callout-warning" id="sig-disclaimer"></div>' +
      '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The signer and the chain', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">What two signatures gave away</div>' +
      '<div class="card-body"><div id="sig-leak"></div>' +
      '<p class="note" id="sig-leak-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Recovering the private key, arithmetic included</div>' +
      '<div class="card-body"><table class="ref-table" id="sig-recover"><thead><tr>' +
      '<th>Step</th><th>The arithmetic</th><th>Value</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="sig-recover-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every check the chain validator applied</div>' +
      '<div class="card-body"><table class="ref-table" id="sig-chain-checks"><thead><tr>' +
      '<th>Check</th><th>Result</th><th>Detail</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="sig-chain-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Signatures against MACs, and where each one belongs</div>' +
      '<div class="card-body"><table class="ref-table" id="sig-kinds"><thead><tr>' +
      '<th>Property</th><th>MAC</th><th>Signature</th><th>Consequence</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="sig-kinds-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Revocation, and why it barely works</div>' +
      '<div class="card-body"><table class="ref-table" id="sig-revocation"><thead><tr>' +
      '<th>Mechanism</th><th>How the client learns</th><th>What goes wrong</th><th>Status</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="sig-revocation-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
