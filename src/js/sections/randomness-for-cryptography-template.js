/** Markup for "Randomness for cryptography". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RandomnessTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'rnd-observe', kind: 'select', label: 'outputs the attacker sees', value: '2',
      options: [
        { value: '1', label: '1 output' },
        { value: '2', label: '2 outputs' },
        { value: '4', label: '4 outputs' }
      ] },
    { id: 'rnd-predict', kind: 'range', label: 'values to predict', value: 8, min: 4, max: 20,
      step: 4 }
  ];

  const METRICS = [
    { id: 'rnd-exact', label: 'Predicted exactly', note: 'of the values the attacker guessed next' },
    { id: 'rnd-needed', label: 'Outputs needed', note: 'to recover the generator’s whole state' },
    { id: 'rnd-entropy', label: 'Entropy of the output', note: 'the statistical PRNG, measured — it looks fine' },
    { id: 'rnd-csprng', label: 'CSPRNG predicted', note: 'the same attack against a keyed generator' }
  ];

  function render() {
    return '<div class="callout callout-warning" id="rnd-disclaimer"></div>' +
      '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The attacker’s budget', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Predicted against actual, value by value</div>' +
      '<div class="card-body"><table class="ref-table" id="rnd-forecast"><thead><tr>' +
      '<th>Step</th><th>Predicted</th><th>Actual</th><th>Match</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rnd-forecast-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Statistical PRNG against CSPRNG: what each one promises</div>' +
      '<div class="card-body"><table class="ref-table" id="rnd-compare"><thead><tr>' +
      '<th>Property</th><th>Statistical PRNG</th><th>CSPRNG</th><th>Why the difference matters</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rnd-compare-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Where entropy comes from, and when it is not there yet</div>' +
      '<div class="card-body"><table class="ref-table" id="rnd-sources"><thead><tr>' +
      '<th>Situation</th><th>What happens</th><th>The real-world consequence</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rnd-sources-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
