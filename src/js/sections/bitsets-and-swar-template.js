/** Markup for "Bitsets and SWAR algorithms". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BitsetsAndSwarTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'bs-universe', kind: 'select', label: 'universe', value: '1000000',
      options: [
        { value: '100000', label: '100 000 elements — 12.5 KB as bits' },
        { value: '1000000', label: '1 000 000 elements — 125 KB, fits in L2' },
        { value: '8000000', label: '8 000 000 elements — 1 MB, past most L2' }
      ] },
    { id: 'bs-population', kind: 'range', label: 'elements actually present', value: 20000,
      min: 1000, max: 200000, step: 1000 },
    { id: 'bs-piece', kind: 'select', label: 'bitboard piece', value: 'knight',
      options: [
        { value: 'king', label: 'king — one step in eight directions' },
        { value: 'knight', label: 'knight — the two-file jumps need a wider mask' },
        { value: 'rook', label: 'rook — a slider, so it needs the occupancy' }
      ] },
    { id: 'bs-file', kind: 'range', label: 'piece file (a = 0)', value: 3, min: 0, max: 7, step: 1 },
    { id: 'bs-rank', kind: 'range', label: 'piece rank (1 = 0)', value: 3, min: 0, max: 7, step: 1 }
  ];

  const METRICS = [
    { id: 'bs-bytes', label: 'Bitset bytes', note: 'one bit per element, whatever the population' },
    { id: 'bs-setbytes', label: 'Set bytes, modelled', note: 'at 32 bytes an entry' },
    { id: 'bs-crossover', label: 'Crossover density', note: 'below this the Set is smaller' },
    { id: 'bs-iteration', label: 'Iteration saving', note: 'population against universe' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A universe, a population, and a chess board',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Memory against density</div>' +
      '<div class="card-body"><div id="bs-chart" class="chart-host"></div>' +
      '<div id="bs-legend"></div><p class="note" id="bs-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Where the bitset stops winning</div>' +
      '<div class="card-body"><table class="ref-table" id="bs-density"><thead><tr>' +
      '<th>Density</th><th>Elements present</th><th>Bitset bytes</th><th>Set bytes</th>' +
      '<th>Ratio</th><th>Smaller</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bs-density-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Set operations, checked against a real Set</div>' +
      '<div class="card-body"><table class="ref-table" id="bs-ops"><thead><tr>' +
      '<th>Operation</th><th>Result size</th><th>Reference size</th><th>Disagreements</th>' +
      '<th>Words touched</th><th>Set probes</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bs-ops-note"></p></div></div>' +
      '<div class="grid-even" style="margin-top:.875rem">' +
      '<div class="card"><div class="card-header">A sieve, both ways</div>' +
      '<div class="card-body"><table class="ref-table" id="bs-sieve"><thead><tr>' +
      '<th>Representation</th><th>Marks written</th><th>Bytes</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bs-sieve-note"></p></div></div>' +
      '<div class="card"><div class="card-header">The bitboard, and the same answer by walking</div>' +
      '<div class="card-body"><div id="bs-board"></div>' +
      '<p class="note" id="bs-board-note"></p></div></div>' +
      '</div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
