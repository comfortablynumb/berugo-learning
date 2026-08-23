/** Markup for "The bit-manipulation toolkit". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BitManipulationTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'bm-trick', kind: 'select', label: 'trick', value: 'popcount',
      options: [
        { value: 'popcount', label: 'population count, by SWAR' },
        { value: 'popcount-kernighan', label: 'population count, Kernighan’s loop' },
        { value: 'popcount-table', label: 'population count, byte table' },
        { value: 'ctz', label: 'count trailing zeros, De Bruijn' },
        { value: 'clz', label: 'count leading zeros' },
        { value: 'next-pow2', label: 'round up to a power of two' },
        { value: 'reverse', label: 'reverse the bits' }
      ] },
    { id: 'bm-value', kind: 'text', label: 'input word (hexadecimal)', value: 'deadbeef',
      maxLength: 8, placeholder: 'deadbeef' },
    { id: 'bm-samples', kind: 'range', label: 'random 32-bit words in the sweep', value: 20000,
      min: 2000, max: 60000, step: 2000 }
  ];

  const METRICS = [
    { id: 'bm-checked', label: 'Inputs checked', note: 'every 16-bit word, then random 32-bit ones' },
    { id: 'bm-disagree', label: 'Disagreements with the loop', note: 'a count, not an exception' },
    { id: 'bm-mean', label: 'Mean operations saved', note: 'what a profile would report' },
    { id: 'bm-worst', label: 'Worst case saved', note: 'what a latency budget has to hold' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Pick a trick and an input', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The word going in, and the answer coming out</div>' +
      '<div class="card-body"><div id="bm-word"></div>' +
      '<p class="note" id="bm-word-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The SWAR reduction, stage by stage</div>' +
      '<div class="card-body"><div id="bm-stages"></div>' +
      '<p class="note" id="bm-stages-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every trick against the loop it replaces</div>' +
      '<div class="card-body"><table class="ref-table" id="bm-sweep"><thead><tr>' +
      '<th>Trick</th><th>Inputs checked</th><th>Disagreements</th><th>Mean ops (trick / loop)</th>' +
      '<th>Mean saving</th><th>Worst ops (trick / loop)</th><th>Worst saving</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bm-sweep-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The identities everything else is built on</div>' +
      '<div class="card-body"><table class="ref-table" id="bm-identities"><thead><tr>' +
      '<th>Identity</th><th>Inputs</th><th>Failures</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bm-identities-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
