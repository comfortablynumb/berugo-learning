/** Markup for "Password hashing and key derivation". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PasswordTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'pwd-algorithm', kind: 'select', label: 'how the password is stored', value: 'argon2id',
      options: [
        { value: 'sha256', label: 'SHA-256, unsalted' },
        { value: 'sha256-salted', label: 'SHA-256 with a salt' },
        { value: 'pbkdf2', label: 'PBKDF2-HMAC-SHA-256, 600 000' },
        { value: 'bcrypt', label: 'bcrypt, cost 12' },
        { value: 'scrypt', label: 'scrypt, N = 2^15' },
        { value: 'argon2id', label: 'Argon2id' }
      ] },
    { id: 'pwd-memory', kind: 'range', label: 'memory parameter (MiB)', value: 64, min: 4,
      max: 256, step: 4 }
  ];

  const METRICS = [
    { id: 'pwd-verify', label: 'Verification budget', note: 'what one login is allowed to cost' },
    { id: 'pwd-tuned', label: 'Iterations measured here', note: 'PBKDF2 tuned to that budget in this browser' },
    { id: 'pwd-guesses', label: 'Attacker guesses per second', note: 'on a 4 096-core, 16 GiB rig' },
    { id: 'pwd-days', label: 'Days for a random 8-character password', note: '62^8 candidates at that rate' }
  ];

  function render() {
    return '<div class="callout callout-warning" id="pwd-disclaimer"></div>' +
      '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The choice and its parameter', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">What this setting costs each side</div>' +
      '<div class="card-body"><div id="pwd-verdict"></div>' +
      '<p class="note" id="pwd-verdict-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every option at the same 250 ms verification budget</div>' +
      '<div class="card-body"><table class="ref-table" id="pwd-compare"><thead><tr>' +
      '<th>Storage</th><th>Verify</th><th>Memory each</th><th>Attacker cores</th>' +
      '<th>Guesses/second</th><th>Days for 8 characters</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="pwd-compare-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The memory parameter is the control that constrains hardware</div>' +
      '<div class="card-body"><table class="ref-table" id="pwd-sweep"><thead><tr>' +
      '<th>Memory each</th><th>Instances in 16 GiB</th><th>Guesses/second</th>' +
      '<th>Days for 8 characters</th><th>Limited by</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="pwd-sweep-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The stored record, and the path most systems never build</div>' +
      '<div class="card-body"><table class="ref-table" id="pwd-record"><thead><tr>' +
      '<th>Part</th><th>Where it lives</th><th>What it defends against</th><th>Measured here</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="pwd-record-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
