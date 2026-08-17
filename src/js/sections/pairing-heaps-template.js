/** Markup for "Pairing heaps and rank-pairing heaps". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PairingHeapsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ph-mix', kind: 'select', label: 'operation mix', value: 'balanced',
      options: [{ value: 'balanced', label: 'balanced' },
        { value: 'push-heavy', label: 'push-heavy' },
        { value: 'pop-heavy', label: 'pop-heavy — where the merge is exercised' },
        { value: 'decrease-key', label: 'decrease-key-heavy' }] },
    { id: 'ph-count', kind: 'range', label: 'operations', value: 30000, min: 2000, max: 200000, step: 1000 },
    { id: 'ph-seed', kind: 'range', label: 'seed', value: 11, min: 1, max: 40, step: 1,
      note: 'The one-pass row is the same structure with the pairing pass removed — the control.' }
  ];

  const METRICS = [
    { id: 'ph-two', label: 'Two-pass comparisons', note: 'pair left to right, fold right to left' },
    { id: 'ph-one', label: 'One-pass comparisons', note: 'fold left to right, no pairing' },
    { id: 'ph-saving', label: 'What the pairing pass saves', note: 'on this mix' },
    { id: 'ph-children', label: 'Root children after the run', note: 'the list the merge has to fold' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Workload', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The two passes, on a root with eight children</div>' +
      '<div class="card-body"><pre class="step-work" id="ph-passes"></pre>' +
      '<p class="note" id="ph-passes-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Pairing against the families it sits between</div>' +
      '<div class="card-body"><table class="ref-table" id="ph-table"><thead><tr>' +
      '<th>Family</th><th>Comparisons</th><th>Links</th><th>Cuts</th><th>Per-node fields</th><th>decrease-key bound</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ph-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
