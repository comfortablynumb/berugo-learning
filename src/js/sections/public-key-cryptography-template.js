/** Markup for "Public-key cryptography". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PublicKeyTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'pkc-modulus', kind: 'select', label: 'Diffie–Hellman modulus', value: '104729',
      options: [
        { value: '7919', label: '7 919 — 13 bits' },
        { value: '104729', label: '104 729 — 17 bits' },
        { value: '1299709', label: '1 299 709 — 21 bits' },
        { value: '2147483647', label: '2 147 483 647 — 31 bits' }
      ] },
    { id: 'pkc-blind', kind: 'range', label: 'blinding factor for the RSA attack', value: 3,
      min: 2, max: 9, step: 1 }
  ];

  const METRICS = [
    { id: 'pkc-agree', label: 'Both parties agree', note: 'the shared secret neither of them sent' },
    { id: 'pkc-break', label: 'Eavesdropper steps', note: 'brute-force discrete log at this size' },
    { id: 'pkc-factor', label: 'Steps to factor the RSA key', note: 'trial division on a 21-bit modulus' },
    { id: 'pkc-recovered', label: 'Textbook RSA plaintext recovered', note: 'by one chosen-ciphertext query' }
  ];

  function render() {
    return '<div class="callout callout-warning" id="pkc-disclaimer"></div>' +
      '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Parameters', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The eavesdropper’s result</div>' +
      '<div class="card-body"><div id="pkc-eve"></div>' +
      '<p class="note" id="pkc-eve-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The exchange, and what each participant can see</div>' +
      '<div class="card-body"><table class="ref-table" id="pkc-exchange"><thead><tr>' +
      '<th>Step</th><th>Alice</th><th>Bob</th><th>On the wire</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="pkc-exchange-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The parameter size is the security, measured</div>' +
      '<div class="card-body"><table class="ref-table" id="pkc-sizes"><thead><tr>' +
      '<th>Modulus</th><th>Bits</th><th>Eavesdropper steps</th><th>Broke it</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="pkc-sizes-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Textbook RSA is malleable, and one query is enough</div>' +
      '<div class="card-body"><table class="ref-table" id="pkc-rsa"><thead><tr>' +
      '<th>Step</th><th>The arithmetic</th><th>Value</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="pkc-rsa-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Equivalent strengths across the families</div>' +
      '<div class="card-body"><table class="ref-table" id="pkc-strength"><thead><tr>' +
      '<th>Security level</th><th>RSA modulus</th><th>Finite-field DH</th><th>Elliptic curve</th>' +
      '<th>Where it stands</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="pkc-strength-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
