/** Markup for "Amortised analysis". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AmortisedAnalysisTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'amort-factor', kind: 'range', label: 'growth factor', value: 2, min: 1.25, max: 4, step: 0.25 },
    { id: 'amort-pushes', kind: 'range', label: 'pushes', value: 600, min: 50, max: 4000, step: 50 },
    { id: 'amort-charge', kind: 'range', label: 'accounting charge per push', value: 3, min: 1, max: 6, step: 1,
      note: 'The bank must never go negative, or the accounting argument is wrong.' }
  ];

  const METRICS = [
    { id: 'amort-total', label: 'Total cost', note: 'writes plus copies, counted' },
    { id: 'amort-average', label: 'Amortised per push', note: 'total ÷ operations' },
    { id: 'amort-copies', label: 'Elements copied', note: 'the expensive part' },
    { id: 'amort-potential', label: 'Minimum potential', note: 'Φ = 2·size − capacity, must stay ≥ 0' },
    { id: 'amort-waste', label: 'Wasted capacity', note: 'allocated but unused at the end' },
    { id: 'amort-reuse', label: 'Allocator can reuse', note: 'do the freed blocks sum past the next one' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Dynamic array', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Cost per operation, and the credit balance</div>' +
      '<div class="card-body"><div id="amort-chart"></div><div id="amort-legend"></div></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Growth factors compared, same 4 000 pushes</div>' +
      '<div class="card-body"><table class="ref-table" id="amort-factors"><thead><tr>' +
      '<th>Factor</th><th>Copies</th><th>Copies per push</th><th>Final capacity</th>' +
      '<th>Wasted</th><th>Freed blocks reusable</th></tr></thead><tbody></tbody></table>' +
      '<p class="note">Reuse is the real argument for a factor below the golden ratio: with 2, the ' +
      'sum of every freed block is always just short of the next allocation.</p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
