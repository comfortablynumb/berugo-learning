/** Markup for "Modular arithmetic and number theory". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ModularArithmeticTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ma-number', kind: 'select', label: 'number to test and factor', value: '561',
      options: [
        { value: '561', label: '561 — the smallest Carmichael number' },
        { value: '1729', label: '1 729 — the taxicab number, also Carmichael' },
        { value: '1000003', label: '1 000 003 — a prime' },
        { value: '1000000007', label: '1 000 000 007 — the competitive-programming prime' },
        { value: '158346127852483', label: 'a semiprime of two seven-digit primes' },
        { value: '2147483647', label: '2³¹ − 1 — a Mersenne prime' }
      ] },
    { id: 'ma-limit', kind: 'select', label: 'sieve limit', value: '1000000',
      options: [
        { value: '100000', label: '100 000' },
        { value: '1000000', label: '1 000 000' },
        { value: '4000000', label: '4 000 000' }
      ] },
    { id: 'ma-gcd-bits', kind: 'range', label: 'operand bits for the gcd race', value: 64,
      min: 8, max: 256, step: 8 },
    { id: 'ma-crt', kind: 'number', label: 'value to split and rebuild by CRT', value: 1234567,
      step: 1 }
  ];

  const METRICS = [
    { id: 'ma-verdict', label: 'Miller–Rabin verdict', note: 'deterministic below 2⁶⁴' },
    { id: 'ma-fermat', label: 'Bases the Fermat test is fooled by', note: 'of the coprime bases tried' },
    { id: 'ma-speedup', label: 'Trial division against Pollard rho', note: 'operations, same answer' },
    { id: 'ma-sieve', label: 'Sieve writes saved by the linear sieve', note: 'each composite marked once' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A number, a sieve limit and a modulus set',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Miller–Rabin, witness by witness</div>' +
      '<div class="card-body"><table class="ref-table" id="ma-trail"><thead><tr>' +
      '<th>Base</th><th>Squarings</th><th>Sequence of residues</th><th>Verdict</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ma-trail-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Carmichael numbers — where the Fermat test is not probabilistic at all</div>' +
      '<div class="card-body"><table class="ref-table" id="ma-carmichael"><thead><tr>' +
      '<th>n</th><th>Factors</th><th>Coprime bases tried</th><th>Fermat fooled</th>' +
      '<th>Rate</th><th>Miller–Rabin</th><th>Witness</th><th>How the witness caught it</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ma-carmichael-note"></p></div></div>' +
      '<div class="grid-even" style="margin-top:.875rem">' +
      '<div class="card"><div class="card-header">Factoring: two methods, one answer</div>' +
      '<div class="card-body"><table class="ref-table" id="ma-factor"><thead><tr>' +
      '<th>Quantity</th><th>The number selected</th><th>A fixed 15-digit semiprime</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ma-factor-note"></p></div></div>' +
      '<div class="card"><div class="card-header">Two sieves, and two gcds</div>' +
      '<div class="card-body"><table class="ref-table" id="ma-sieves"><thead><tr>' +
      '<th>Algorithm</th><th>Work</th><th>Memory</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ma-sieves-note"></p></div></div>' +
      '</div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The Chinese remainder theorem, as a round trip</div>' +
      '<div class="card-body"><table class="ref-table" id="ma-crt-table"><thead><tr>' +
      '<th>Modulus</th><th>Residue</th><th>Value pinned down so far</th>' +
      '<th>Range covered so far</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ma-crt-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
