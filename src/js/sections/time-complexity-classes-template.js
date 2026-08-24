/** Markup for "Time complexity classes". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TimeClassTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'tim-filter', kind: 'select', label: 'show problems', value: 'all',
      options: [
        { value: 'all', label: 'all of them' },
        { value: 'unconditional', label: 'only where the bound is PROVED' },
        { value: 'P', label: 'in P' },
        { value: 'NP-complete', label: 'NP-complete' },
        { value: 'BQP', label: 'in BQP' }
      ] },
    { id: 'tim-n', kind: 'range', label: 'input size for the cost table', value: 40,
      min: 10, max: 100, step: 5 },
    { id: 'tim-rate', kind: 'range', label: 'operations per second, as a power of ten',
      value: 9, min: 6, max: 15, step: 1 }
  ];

  const METRICS = [
    { id: 'tim-shown', label: 'Problems shown', note: 'of the fifteen in the atlas' },
    { id: 'tim-proved', label: 'With a proved lower bound', note: 'unconditional, not "unless P=NP"' },
    { id: 'tim-open', label: 'Still open', note: 'no matching upper and lower bound' },
    { id: 'tim-feasible', label: 'Largest feasible n', note: 'for 2 to the n, within a year' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Filter, size and machine speed', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">What each growth rate costs at this size</div>' +
      '<div class="card-body"><table class="ref-table" id="tim-costs"><thead><tr>' +
      '<th>Growth</th><th>Operations</th><th>Wall clock</th><th>Verdict</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tim-costs-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The atlas: class, best algorithm, best lower bound, what is open</div>' +
      '<div class="card-body"><table class="ref-table" id="tim-atlas"><thead><tr>' +
      '<th>Problem</th><th>Class</th><th>Best known algorithm</th><th>Best known lower bound</th>' +
      '<th>Open</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tim-atlas-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The class tower, and which containments are strict</div>' +
      '<div class="card-body"><table class="ref-table" id="tim-tower"><thead><tr>' +
      '<th>Containment</th><th>Strict?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tim-tower-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The padding argument, run</div>' +
      '<div class="card-body"><table class="ref-table" id="tim-padding"><thead><tr>' +
      '<th>Original size</th><th>Padded size</th><th>Steps allowed</th><th>Steps needed</th>' +
      '<th>Separates</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tim-padding-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What a complexity claim is actually saying</div>' +
      '<div class="card-body"><table class="ref-table" id="tim-claims"><thead><tr>' +
      '<th>What people say</th><th>What is true</th><th>What it rests on</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tim-claims-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
