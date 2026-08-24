/** Markup for "Protocol construction". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ProtocolTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'pro-compromise', kind: 'range', label: 'the attacker steals the state at message',
      value: 3, min: 0, max: 9, step: 1 },
    { id: 'pro-ratchet', kind: 'range', label: 'a new DH ratchet happens at message', value: 6,
      min: 1, max: 9, step: 1 }
  ];

  const METRICS = [
    { id: 'pro-past', label: 'Earlier messages still secure', note: 'forward secrecy, counted' },
    { id: 'pro-future', label: 'Later messages exposed', note: 'until the ratchet turns' },
    { id: 'pro-recover', label: 'Security recovered at', note: 'post-compromise security, measured' },
    { id: 'pro-delivered', label: 'Conversation delivered', note: 'both sides derived the same key every turn' }
  ];

  function render() {
    return '<div class="callout callout-warning" id="pro-disclaimer"></div>' +
      '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'When things go wrong', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The blast radius of one stolen state</div>' +
      '<div class="card-body"><div id="pro-radius"></div>' +
      '<p class="note" id="pro-radius-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Message by message: who sent it and who can read it</div>' +
      '<div class="card-body"><table class="ref-table" id="pro-timeline"><thead><tr>' +
      '<th>Message</th><th>Ratchets so far</th><th>Readable with the stolen state</th>' +
      '<th>Why</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="pro-timeline-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">A real conversation, both sides ratcheting on every turn change</div>' +
      '<div class="card-body"><table class="ref-table" id="pro-conversation"><thead><tr>' +
      '<th>#</th><th>From</th><th>Turn changed</th><th>Keys matched</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="pro-conversation-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Four properties a protocol adds over primitives</div>' +
      '<div class="card-body"><table class="ref-table" id="pro-properties"><thead><tr>' +
      '<th>Property</th><th>The question it answers</th><th>The mechanism</th>' +
      '<th>What has it</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="pro-properties-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The TLS 1.3 handshake, cryptographically</div>' +
      '<div class="card-body"><table class="ref-table" id="pro-handshake"><thead><tr>' +
      '<th>Step</th><th>What is sent</th><th>What it establishes</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="pro-handshake-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
