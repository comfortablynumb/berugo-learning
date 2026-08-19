/** Markup for "Choosing and combining sketches". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ChoosingSketchesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'chs-question', kind: 'select', label: 'what are you actually asking?', value: 'membership',
      options: [{ value: 'membership', label: 'is this key present?' },
        { value: 'distinct', label: 'how many distinct keys?' },
        { value: 'frequency', label: 'how often was this key seen?' },
        { value: 'heavy', label: 'which keys are hot?' }] },
    { id: 'chs-budget', kind: 'select', label: 'memory budget', value: '65536',
      options: [{ value: '4096', label: '4 KB' }, { value: '16384', label: '16 KB' },
        { value: '65536', label: '64 KB' }, { value: '1048576', label: '1 MB' }] },
    { id: 'chs-tolerance', kind: 'select', label: 'error you can live with', value: '0.02',
      options: [{ value: '0.2', label: '20%' }, { value: '0.05', label: '5%' },
        { value: '0.02', label: '2%' }, { value: '0.005', label: '0.5%' }] },
    { id: 'chs-attack-target', kind: 'select', label: 'filter the attacker is aiming at', value: '0.01',
      options: [{ value: '0.1', label: '10% false-positive rate' },
        { value: '0.01', label: '1%' }, { value: '0.001', label: '0.1%' }] }
  ];

  const METRICS = [
    { id: 'chs-winner', label: 'Recommendation', note: 'cheapest candidate that meets both constraints' },
    { id: 'chs-cost', label: 'What it costs', note: 'measured on this stream' },
    { id: 'chs-exact', label: 'What exactness would cost', note: 'the option people forget to price' },
    { id: 'chs-attack', label: 'Probes per manufactured false positive', note: 'against a filter with a published seed' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'State the question, the budget and the tolerance', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Every candidate, measured on this stream</div>' +
      '<div class="card-body"><table class="ref-table" id="chs-ranking"><thead><tr>' +
      '<th>Candidate</th><th>Memory</th><th>Error</th><th>Mergeable</th><th>Verdict</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="chs-ranking-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The trade-off table, and what each row is really promising</div>' +
      '<div class="card-body"><table class="ref-table" id="chs-tradeoff"><thead><tr>' +
      '<th>Question</th><th>Structure</th><th>Error is on</th><th>Direction</th><th>Mergeable</th>' +
      '<th>Typical size</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="chs-tradeoff-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Manufacturing false positives against a filter with a known seed</div>' +
      '<div class="card-body"><pre class="step-work" id="chs-filter-attack"></pre>' +
      '<p class="note" id="chs-filter-attack-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Driving one key\'s count-min estimate wherever you like</div>' +
      '<div class="card-body"><pre class="step-work" id="chs-sketch-attack"></pre>' +
      '<p class="note" id="chs-sketch-attack-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Testing a sketch in CI</div>' +
      '<div class="card-body"><pre class="step-work" id="chs-ci"></pre>' +
      '<p class="note" id="chs-ci-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
