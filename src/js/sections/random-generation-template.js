/** Markup for "Random number generation". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RandomGenerationTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'rg-generator', kind: 'select', label: 'generator', value: 'randu',
      options: [
        { value: 'randu', label: 'RANDU — IBM, and famously broken' },
        { value: 'minstd', label: 'MINSTD (Park–Miller)' },
        { value: 'minstd-improved', label: 'MINSTD with the 1993 multiplier' },
        { value: 'numerical-recipes', label: 'the Numerical Recipes LCG' },
        { value: 'xorshift32', label: 'xorshift32' },
        { value: 'xorshift128', label: 'xorshift128' },
        { value: 'splitmix64', label: 'splitmix64' },
        { value: 'pcg32', label: 'PCG32' },
        { value: 'mt19937', label: 'Mersenne Twister' }
      ] },
    { id: 'rg-samples', kind: 'range', label: 'samples per uniformity test', value: 200000,
      min: 40000, max: 400000, step: 20000 },
    { id: 'rg-width', kind: 'range', label: 'bits the bounded sampler draws from', value: 8,
      min: 6, max: 16, step: 1 },
    { id: 'rg-bound', kind: 'range', label: 'the bound n', value: 200, min: 20, max: 250, step: 10 }
  ];

  const METRICS = [
    { id: 'rg-high', label: 'High bits, chi-squared', note: 'against the 95th percentile' },
    { id: 'rg-low', label: 'Low bits, chi-squared', note: 'the same generator, the other end of the word' },
    { id: 'rg-bit0', label: 'Period of the lowest bit', note: 'null when no short period was found' },
    { id: 'rg-bias', label: 'Modulo bias, predicted', note: 'derived, with no sampling at all' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A generator, a sample size and a bound',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Consecutive outputs, plotted against each other</div>' +
      '<div class="card-body"><div id="rg-scatter" class="chart-host"></div>' +
      '<p class="note" id="rg-scatter-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">How often each bit position comes up set</div>' +
      '<div class="card-body"><div id="rg-heat"></div>' +
      '<p class="note" id="rg-heat-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every generator on the tests that separate them</div>' +
      '<div class="card-body"><table class="ref-table" id="rg-table"><thead><tr>' +
      '<th>Generator</th><th>State bits</th><th>High bits</th><th>Low 8 bits</th>' +
      '<th>Period of bit 0</th><th>Lies on planes</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rg-table-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Three ways to reduce a random word to a range</div>' +
      '<div class="card-body"><table class="ref-table" id="rg-bounded"><thead><tr>' +
      '<th>Method</th><th>Chi-squared</th><th>95th percentile</th><th>Verdict</th>' +
      '<th>Draws per sample</th><th>Most against least frequent</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rg-bounded-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Two shuffles that look identical in code</div>' +
      '<div class="card-body"><table class="ref-table" id="rg-shuffle"><thead><tr>' +
      '<th>Permutation</th><th>Fisher–Yates count</th><th>Ratio to expected</th>' +
      '<th>Naive count</th><th>Ratio to expected</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rg-shuffle-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
