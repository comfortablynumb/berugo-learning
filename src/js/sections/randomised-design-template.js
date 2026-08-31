/** Markup for "Randomised algorithm design". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RandomisedDesignTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'rzd-composite', kind: 'select', label: 'the composite being tested', value: '561',
      options: [
        { value: '561', label: '561 = 3·11·17 — the smallest Carmichael number' },
        { value: '1105', label: '1105 = 5·13·17' },
        { value: '1729', label: '1729 = 7·13·19 — the taxicab number' },
        { value: '8911', label: '8911 = 7·19·67' }
      ] },
    { id: 'rzd-trials', kind: 'select', label: 'independent runs per round count', value: '20000',
      options: [
        { value: '5000', label: '5 000' },
        { value: '20000', label: '20 000 — enough to see a 2e-4 rate' },
        { value: '50000', label: '50 000' }
      ] },
    { id: 'rzd-success', kind: 'select', label: 'Las Vegas success probability per attempt',
      value: '0.2',
      options: [
        { value: '0.5', label: '0.5 — a coin flip' },
        { value: '0.2', label: '0.2 — mean 5 attempts' },
        { value: '0.05', label: '0.05 — mean 20 attempts' }
      ] }
  ];

  const METRICS = [
    { id: 'rzd-fermat', label: 'Fermat liars', note: 'bases that fail to expose this composite' },
    { id: 'rzd-miller', label: 'Miller–Rabin liars', note: 'the same count for the stronger test' },
    { id: 'rzd-failure', label: 'Failure after 3 rounds', note: 'measured, against the bound' },
    { id: 'rzd-attempts', label: 'Las Vegas mean', note: 'attempts before the first success' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A composite, a round budget and a coin', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Failure rate against the two bounds</div>' +
      '<div class="card-body"><div id="rzd-chart" class="chart-host"></div>' +
      '<div id="rzd-legend"></div><p class="note" id="rzd-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Monte Carlo — fixed work, and the error that decays with repetition</div>' +
      '<div class="card-body"><table class="ref-table" id="rzd-amplify"><thead><tr>' +
      '<th>Rounds</th><th>Runs fooled</th><th>Measured rate</th>' +
      '<th>This composite’s bound</th><th>Rabin’s universal 4⁻ᵏ</th><th>Standard error</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rzd-amplify-note"></p></div></div>' +
      '<div class="grid-even" style="margin-top:.875rem">' +
      '<div class="card"><div class="card-header">Las Vegas — always correct, and the runtime is the random variable</div>' +
      '<div class="card-body"><table class="ref-table" id="rzd-vegas-table"><thead><tr>' +
      '<th>Statistic</th><th>Measured</th><th>Predicted</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rzd-vegas-note"></p></div></div>' +
      '<div class="card"><div class="card-header">Where the attempts actually landed</div>' +
      '<div class="card-body"><div id="rzd-histogram" class="chart-host"></div>' +
      '<p class="note" id="rzd-histogram-note"></p></div></div>' +
      '</div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The two liar densities, side by side</div>' +
      '<div class="card-body"><table class="ref-table" id="rzd-liars"><thead><tr>' +
      '<th>Test</th><th>Liars</th><th>Bases tried</th><th>Liar density</th>' +
      '<th>Bounded by</th><th>Usable?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rzd-liars-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
