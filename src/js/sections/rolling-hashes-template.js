/** Markup for "Rabin-Karp and rolling hashes". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RollingHashesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'rkh-corpus', kind: 'select', label: 'corpus', value: 'english',
      options: [{ value: 'english', label: 'English' },
        { value: 'source', label: 'source code' },
        { value: 'dna', label: 'DNA' },
        { value: 'logs', label: 'log lines' },
        { value: 'binary', label: 'binary' },
        { value: 'repeated', label: 'repeated' }] },
    { id: 'rkh-size', kind: 'range', label: 'text length', value: 4000, min: 500, max: 12000, step: 500 },
    { id: 'rkh-modulus', kind: 'select', label: 'modulus', value: '1000003',
      options: [{ value: '101', label: '101 — deliberately tiny' },
        { value: '1009', label: '1 009' },
        { value: '1000003', label: '1 000 003 — the usual choice' },
        { value: '999999937', label: '999 999 937 — a large prime' }] },
    { id: 'rkh-bits', kind: 'range', label: 'chunk-boundary bits', value: 6, min: 3, max: 9, step: 1 },
    { id: 'rkh-insert', kind: 'range', label: 'byte inserted at (per cent of the file)', value: 33, min: 5, max: 90, step: 5 }
  ];

  const METRICS = [
    { id: 'rkh-spurious', label: 'Spurious hash hits', note: 'windows that matched the fingerprint and not the pattern' },
    { id: 'rkh-attack', label: 'Under the attack', note: 'a fixed base and modulus, and a text built to defeat it' },
    { id: 'rkh-chunks', label: 'Chunks after one inserted byte', note: 'content-defined against fixed-size' },
    { id: 'rkh-shared', label: 'Chunks unchanged', note: 'what a backup tool would not retransmit' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The hash and the file', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The rolling update, window by window</div>' +
      '<div class="card-body"><div id="rkh-window"></div>' +
      '<p class="note" id="rkh-window-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Collision probability against the modulus</div>' +
      '<div class="card-body"><table class="ref-table" id="rkh-moduli"><thead><tr>' +
      '<th>Modulus</th><th>Hash hits</th><th>Real occurrences</th><th>Spurious</th>' +
      '<th>Character comparisons</th><th>Predicted spurious rate</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rkh-moduli-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The attack, and the one-line defence</div>' +
      '<div class="card-body"><table class="ref-table" id="rkh-defence"><thead><tr>' +
      '<th>Setting</th><th>Base</th><th>Spurious hits</th><th>Character comparisons</th>' +
      '<th>Occurrences found</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rkh-defence-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Content-defined chunking: why rsync sends so little</div>' +
      '<div class="card-body"><table class="ref-table" id="rkh-cdc"><thead><tr>' +
      '<th>Chunker</th><th>Chunks before</th><th>Chunks after</th><th>Unchanged</th>' +
      '<th>Fraction reused</th><th>Mean chunk size</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rkh-cdc-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The boundary-bit dial</div>' +
      '<div class="card-body"><div id="rkh-chart"></div><div id="rkh-legend"></div>' +
      '<p class="note" id="rkh-bits-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
