/** Markup for "Constant-time programming and side channels". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ConstantTimeTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ctp-compare', kind: 'select', label: 'the comparison under attack', value: 'naive',
      options: [
        { value: 'naive', label: 'early-exit — what === compiles to' },
        { value: 'constant', label: 'branchless, bit-masked' }
      ] },
    { id: 'ctp-noise', kind: 'select', label: 'measurement noise', value: '1.2',
      options: [
        { value: '0.4', label: 'same machine — very low noise' },
        { value: '1.2', label: 'same data centre' },
        { value: '3', label: 'across the internet' },
        { value: '6', label: 'across the internet, congested' }
      ] },
    { id: 'ctp-samples', kind: 'select', label: 'measurements averaged per guess', value: '40',
      options: [
        { value: '10', label: '10' },
        { value: '20', label: '20' },
        { value: '40', label: '40' },
        { value: '80', label: '80' },
        { value: '160', label: '160' },
        { value: '320', label: '320' }
      ] }
  ];

  const METRICS = [
    { id: 'ctp-recovered', label: 'Secret bytes recovered', note: 'from timing alone, no key material' },
    { id: 'ctp-separation', label: 'Signal separation', note: 'right byte against wrong, in deviations' },
    { id: 'ctp-cost', label: 'Guesses the attacker made', note: 'against the brute-force space' },
    { id: 'ctp-verdict', label: 'Attack succeeded', note: 'the recovered token matched exactly' }
  ];

  function render() {
    return '<div class="callout callout-warning" id="ctp-disclaimer"></div>' +
      '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The attacker’s conditions', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The token, and what the timing gave up</div>' +
      '<div class="card-body"><div id="ctp-token"></div>' +
      '<p class="note" id="ctp-token-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The two timing distributions, measured</div>' +
      '<div class="card-body"><table class="ref-table" id="ctp-profile"><thead><tr>' +
      '<th>Comparison</th><th>Right first byte</th><th>Wrong first byte</th>' +
      '<th>Separation</th><th>Leaks</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ctp-profile-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Noise against averaging: how far away the attacker can stand</div>' +
      '<div class="card-body"><table class="ref-table" id="ctp-sweep"><thead><tr>' +
      '<th>Noise</th><th>10</th><th>20</th><th>40</th><th>80</th><th>160</th><th>320</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ctp-sweep-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The two rules, and the patterns that follow them</div>' +
      '<div class="card-body"><table class="ref-table" id="ctp-rules"><thead><tr>' +
      '<th>Instead of</th><th>Write</th><th>Why it is constant time</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ctp-rules-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Side channels beyond timing</div>' +
      '<div class="card-body"><table class="ref-table" id="ctp-channels"><thead><tr>' +
      '<th>Channel</th><th>What it observes</th><th>Needs</th><th>Defence</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ctp-channels-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
