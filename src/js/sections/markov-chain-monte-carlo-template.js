/** Markup for "Markov chain Monte Carlo". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MarkovChainMonteCarloTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'mcm-width', kind: 'select', label: 'proposal width', value: '0.1',
      options: [
        { value: '0.1', label: '0.1 — tiny steps, 93% accepted, and the chain never leaves' },
        { value: '0.3', label: '0.3' },
        { value: '1', label: '1' },
        { value: '2.4', label: '2.4 — near the optimum for this target' },
        { value: '5', label: '5' },
        { value: '12', label: '12 — almost everything rejected' }
      ] },
    { id: 'mcm-steps', kind: 'select', label: 'chain length', value: '20000',
      options: [
        { value: '5000', label: '5 000' },
        { value: '20000', label: '20 000' },
        { value: '50000', label: '50 000' }
      ] },
    { id: 'mcm-target', kind: 'select', label: 'target distribution', value: 'mixture',
      options: [
        { value: 'mixture', label: 'a two-mode mixture — the chain has to cross a valley' },
        { value: 'correlated', label: 'a correlated normal, ρ = 0.9 — a ridge, not a valley' }
      ] }
  ];

  const METRICS = [
    { id: 'mcm-accept', label: 'Acceptance rate', note: 'the number that looks like health and is not' },
    { id: 'mcm-ess', label: 'Effective sample size', note: 'independent draws this chain is worth' },
    { id: 'mcm-bars', label: 'Naive vs honest error bar', note: 'how much too narrow the usual formula is' },
    { id: 'mcm-modes', label: 'Time on the second mode', note: 'measured share against its true weight' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A target and a step size', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The trace — where the chain actually went</div>' +
      '<div class="card-body"><div id="mcm-trace" class="chart-host"></div>' +
      '<div id="mcm-trace-legend"></div><p class="note" id="mcm-trace-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The proposal width, either side of the optimum</div>' +
      '<div class="card-body"><table class="ref-table" id="mcm-widths"><thead><tr>' +
      '<th>Width</th><th>Accepted</th><th>Estimated mean</th><th>Error</th>' +
      '<th>Correlation time</th><th>Effective samples</th><th>Naive error bar</th>' +
      '<th>Honest error bar</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mcm-widths-note"></p></div></div>' +
      '<div class="grid-even" style="margin-top:.875rem">' +
      '<div class="card"><div class="card-header">Autocorrelation, lag by lag</div>' +
      '<div class="card-body"><div id="mcm-acf" class="chart-host"></div>' +
      '<div id="mcm-acf-legend"></div><p class="note" id="mcm-acf-note"></p></div></div>' +
      '<div class="card"><div class="card-header">Four chains from four starting points</div>' +
      '<div class="card-body"><table class="ref-table" id="mcm-chains"><thead><tr>' +
      '<th>Started at</th><th>Mean</th><th>Second-mode share</th><th>Effective samples</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mcm-chains-note"></p></div></div>' +
      '</div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What each diagnostic can and cannot see</div>' +
      '<div class="card-body"><table class="ref-table" id="mcm-diagnostics"><thead><tr>' +
      '<th>Diagnostic</th><th>Reading</th><th>Verdict</th><th>What it would miss</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mcm-diagnostics-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
