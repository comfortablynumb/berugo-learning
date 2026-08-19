/** Markup for "Succinct trees: LOUDS, balanced parentheses and wavelet trees". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SuccinctTreesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'sct-nodes', kind: 'range', label: 'nodes in the tree', value: 5000, min: 1000, max: 20000, step: 1000 },
    { id: 'sct-payload', kind: 'range', label: 'payload bytes per node', value: 8, min: 0, max: 64, step: 4 },
    { id: 'sct-length', kind: 'range', label: 'symbols in the wavelet sequence', value: 4000, min: 1000, max: 8000, step: 1000 },
    { id: 'sct-alphabet', kind: 'select', label: 'alphabet', value: '256',
      options: [{ value: '16', label: '16 symbols' }, { value: '64', label: '64 symbols' },
        { value: '256', label: '256 symbols' }] }
  ];

  const METRICS = [
    { id: 'sct-bits', label: 'Bits per node', note: 'the 2n bound is the target' },
    { id: 'sct-bytes', label: 'Bytes for the whole tree', note: 'structure only, no payload' },
    { id: 'sct-saving', label: 'Against a pointer tree', note: 'same navigation, same answers' },
    { id: 'sct-ops', label: 'rank + select per navigation', note: 'firstChild, nextSibling, parent' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The tree, its payload and the sequence', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Bytes: structure, and structure plus payload</div>' +
      '<div class="card-body"><div id="sct-bars"></div>' +
      '<p class="note" id="sct-bars-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">One tree, three encodings</div>' +
      '<div class="card-body"><table class="ref-table" id="sct-encodings"><thead><tr>' +
      '<th>Encoding</th><th>Bits</th><th>Bits / node</th><th>Data bytes</th>' +
      '<th>Index bytes</th><th>Total</th><th>Against pointers</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="sct-encodings-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The wavelet tree: the same trick applied to a sequence</div>' +
      '<div class="card-body"><table class="ref-table" id="sct-wavelet"><thead><tr>' +
      '<th>Symbols</th><th>Alphabet</th><th>Levels</th><th>Bit vectors</th>' +
      '<th>Bits / symbol</th><th>Bound</th><th>rank calls / quantile</th><th>Wrong</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="sct-wavelet-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
