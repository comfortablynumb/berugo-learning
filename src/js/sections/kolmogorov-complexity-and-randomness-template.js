/** Markup for "Kolmogorov complexity and randomness". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.KolmogorovTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'kol-sample', kind: 'select', label: 'the string', value: 'the perfect squares',
      options: [
        { value: 'all zeros', label: 'all zeros' },
        { value: 'alternating', label: 'alternating 0101...' },
        { value: 'the perfect squares', label: 'bit i is 1 when i is a perfect square' },
        { value: 'a fixed pseudo-random string', label: 'a fixed pseudo-random string' }
      ] },
    { id: 'kol-length', kind: 'range', label: 'string length, in bits', value: 32,
      min: 16, max: 64, step: 8 },
    { id: 'kol-n', kind: 'range', label: 'exhaustive check at length n', value: 12,
      min: 8, max: 16, step: 2 },
    { id: 'kol-k', kind: 'range', label: 'compress by at least k bits', value: 2,
      min: 1, max: 5, step: 1 }
  ];

  const METRICS = [
    { id: 'kol-best', label: 'Best upper bound', note: 'the shortest description any codec found' },
    { id: 'kol-ratio', label: 'Compression ratio', note: 'best over the original length' },
    { id: 'kol-bound', label: 'The counting bound', note: 'how many strings COULD compress' },
    { id: 'kol-actual', label: 'How many actually do', note: 'checked over all of them' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'String, length and the exhaustive check',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Every codec on this string</div>' +
      '<div class="card-body"><table class="ref-table" id="kol-codecs"><thead><tr>' +
      '<th>Codec</th><th>Bits</th><th>What it found</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="kol-codecs-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The string itself</div>' +
      '<div class="card-body"><div id="kol-bits" class="mono" ' +
      'style="font-size:.85rem;word-break:break-all"></div>' +
      '<p class="note" id="kol-bits-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The counting bound, checked by brute force</div>' +
      '<div class="card-body"><table class="ref-table" id="kol-counting"><thead><tr>' +
      '<th>n</th><th>k</th><th>Strings of length n</th><th>Compress by k or more</th>' +
      '<th>The bound allows</th><th>Within it</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="kol-counting-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What fraction of strings resist every codec</div>' +
      '<div class="card-body"><table class="ref-table" id="kol-incompressible"><thead><tr>' +
      '<th>Length</th><th>Strings</th><th>Incompressible</th><th>Fraction</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="kol-incompressible-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The claims, and what each is used for</div>' +
      '<div class="card-body"><table class="ref-table" id="kol-claims"><thead><tr>' +
      '<th>Claim</th><th>Why it holds</th><th>What it is used for</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="kol-claims-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
