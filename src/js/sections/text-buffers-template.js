/** Markup for "Ropes, gap buffers and piece tables". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TextBuffersTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'text-pattern', kind: 'select', label: 'edit pattern', value: 'typing',
      options: [{ value: 'typing', label: 'sequential typing at the cursor' },
        { value: 'scattered', label: 'scattered edits across the document' },
        { value: 'pasteThenEdit', label: 'large paste, then scattered edits' },
        { value: 'backspace', label: 'typing then backspacing' }] },
    { id: 'text-edits', kind: 'range', label: 'edits', value: 400, min: 50, max: 2000, step: 50 },
    { id: 'text-doc', kind: 'range', label: 'starting document (KB)', value: 8, min: 1, max: 64, step: 1 }
  ];

  const METRICS = [
    { id: 'text-gap', label: 'Gap buffer: characters moved', note: 'cursor movement is the cost' },
    { id: 'text-piece', label: 'Piece table: pieces created', note: 'no text is ever moved' },
    { id: 'text-rope', label: 'Rope: characters copied', note: 'splits and joins near the edit' },
    { id: 'text-agree', label: 'All three agree', note: 'same document after the same script' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Edit script', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Work done per structure</div>' +
      '<div class="card-body"><div id="text-chart"></div><div id="text-legend"></div>' +
      '<p class="note">Lower is better, and the winner changes with the pattern — which is the ' +
      'reason all three structures still exist.</p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem"><div class="card-header">Every pattern, side by side</div>' +
      '<div class="card-body"><table class="ref-table" id="text-table"><thead><tr>' +
      '<th>Pattern</th><th>Gap buffer</th><th>Piece table</th><th>Rope</th><th>Best</th>' +
      '</tr></thead><tbody></tbody></table></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
