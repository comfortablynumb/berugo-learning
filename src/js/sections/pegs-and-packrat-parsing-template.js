/** Markup for "PEGs and packrat parsing". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PegTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'peg-depth', kind: 'range', label: 'fixture depth', value: 10, min: 2, max: 14,
      step: 2 },
    { id: 'peg-memo', kind: 'select', label: 'memoisation', value: 'on',
      options: [
        { value: 'on', label: 'on — packrat, one entry per rule and position' },
        { value: 'off', label: 'off — plain recursive backtracking' }
      ] },
    { id: 'peg-order', kind: 'select', label: 'ordered choice fixture', value: 'shortFirst',
      options: [
        { value: 'shortFirst', label: 'S to "a" / "ab" — the short one first' },
        { value: 'longFirst', label: 'S to "ab" / "a" — the long one first' }
      ] },
    { id: 'peg-input', kind: 'text', label: 'input for the choice fixture', value: 'ab',
      maxLength: 12 }
  ];

  const METRICS = [
    { id: 'peg-steps', label: 'Evaluation steps', note: 'the measurement, not an estimate' },
    { id: 'peg-ratio', label: 'Cost without the cache', note: 'plain steps over memoised steps' },
    { id: 'peg-entries', label: 'Memo entries', note: 'the memory packrat trades for time' },
    { id: 'peg-same', label: 'Same result either way', note: 'the cache must change only speed' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Fixture, cache and input', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Ordered choice, and what it commits to</div>' +
      '<div class="card-body"><div id="peg-choice" class="mono" style="font-size:.85rem"></div>' +
      '<p class="note" id="peg-choice-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Steps against depth, with and without the cache</div>' +
      '<div class="card-body"><table class="ref-table" id="peg-growth"><thead><tr>' +
      '<th>Depth</th><th>Memoised steps</th><th>Memo entries</th><th>Plain steps</th>' +
      '<th>Ratio</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="peg-growth-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The unreachable-alternative check</div>' +
      '<div class="card-body"><table class="ref-table" id="peg-unreachable"><thead><tr>' +
      '<th>Rule</th><th>Alternative</th><th>Shadowed by</th><th>Why</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="peg-unreachable-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The same rules as a CFG and as a PEG</div>' +
      '<div class="card-body"><table class="ref-table" id="peg-versus"><thead><tr>' +
      '<th>Input</th><th>As a CFG</th><th>As a PEG</th><th>They differ because</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="peg-versus-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Where PEG and CFG semantics part company</div>' +
      '<div class="card-body"><table class="ref-table" id="peg-semantics"><thead><tr>' +
      '<th>Construct</th><th>In a CFG</th><th>In a PEG</th><th>Consequence</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="peg-semantics-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
