/** Markup for "Hash functions and MACs". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HashMacTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'hsh-secret', kind: 'select', label: 'length of the secret the attacker never sees',
      value: '16',
      options: [
        { value: '8', label: '8 bytes' },
        { value: '16', label: '16 bytes' },
        { value: '32', label: '32 bytes' },
        { value: '64', label: '64 bytes' }
      ] },
    { id: 'hsh-suffix', kind: 'select', label: 'what the attacker appends',
      value: '&role=admin',
      options: [
        { value: '&role=admin', label: '&role=admin' },
        { value: '&limit=999999', label: '&limit=999999' },
        { value: '&expires=never', label: '&expires=never' }
      ] }
  ];

  const METRICS = [
    { id: 'hsh-forged', label: 'Naive tag forged', note: 'hash(secret ‖ message), attacked live' },
    { id: 'hsh-glue', label: 'Glue bytes guessed', note: 'padding depends only on the length' },
    { id: 'hsh-hmac', label: 'HMAC tag forged', note: 'the identical attack against HMAC' },
    { id: 'hsh-half', label: 'Collisions at even odds', note: 'samples needed against SHA-256' }
  ];

  function render() {
    return '<div class="callout callout-warning" id="hsh-disclaimer"></div>' +
      '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The attacker’s knowledge', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The forged message and its valid tag</div>' +
      '<div class="card-body"><div id="hsh-forgery"></div>' +
      '<p class="note" id="hsh-forgery-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The attack, step by step — nothing here needs the secret</div>' +
      '<div class="card-body"><table class="ref-table" id="hsh-steps"><thead><tr>' +
      '<th>Step</th><th>What the attacker does</th><th>What it needs</th><th>Result</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="hsh-steps-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Keyed constructions: which ones extend</div>' +
      '<div class="card-body"><table class="ref-table" id="hsh-macs"><thead><tr>' +
      '<th>Construction</th><th>Extendable</th><th>Why</th><th>Verdict</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="hsh-macs-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Three resistances and the birthday bound, measured</div>' +
      '<div class="card-body"><table class="ref-table" id="hsh-bounds"><thead><tr>' +
      '<th>Digest bits</th><th>Preimage work</th><th>Collision work</th>' +
      '<th>Samples for even odds</th><th>What that buys</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="hsh-bounds-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
