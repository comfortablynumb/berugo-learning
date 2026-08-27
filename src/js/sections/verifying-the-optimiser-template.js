/** Markup for "Verifying the optimiser". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.VerifyOptTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'vo-count', kind: 'range', label: 'generated programs', value: 400,
      min: 50, max: 2000, step: 50,
      note: 'each compiled, optimised and run against the reference' },
    { id: 'vo-seed', kind: 'range', label: 'seed', value: 1, min: 1, max: 40, step: 1 },
    { id: 'vo-pipeline', kind: 'select', label: 'pipeline', value: 'full',
      options: [
        { value: 'full', label: 'the full pipeline — every pass, every gate' },
        { value: 'broken', label: 'with naive LICM — a pass that is genuinely wrong' },
        { value: 'minimal', label: 'SSA construction only' }
      ] }
  ];

  const METRICS = [
    { id: 'vo-checked', label: 'Programs compiled', note: 'generated from the grammar' },
    { id: 'vo-failures', label: 'Failures found', note: 'a gate that did not hold' },
    { id: 'vo-shrunk', label: 'Shrunk to', note: 'from the size it was found at' },
    { id: 'vo-suite', label: 'Conformance suite', note: 'every gate after every pass' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A corpus and a pipeline', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The minimal failing program, if there is one' +
      '</div>' +
      '<div class="card-body"><pre class="ast-source" id="vo-minimal"></pre>' +
      '<p class="note" id="vo-minimal-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The three gates, and what each one can see</div>' +
      '<div class="card-body"><table class="ref-table" id="vo-gates"><thead><tr>' +
      '<th>Gate</th><th>What it checks</th><th>Catches</th><th>Blind to</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="vo-gates-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The shrinker, step by step</div>' +
      '<div class="card-body"><table class="ref-table" id="vo-shrink"><thead><tr>' +
      '<th>Measure</th><th>Before</th><th>After</th><th>What it means</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="vo-shrink-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every pass over the conformance suite, gated</div>' +
      '<div class="card-body"><table class="ref-table" id="vo-conformance"><thead><tr>' +
      '<th>Program</th><th>Before</th><th>After</th><th>Removed</th><th>Every gate held</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="vo-conformance-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Where a bug in each pass would be caught</div>' +
      '<div class="card-body"><table class="ref-table" id="vo-coverage"><thead><tr>' +
      '<th>Pass</th><th>Verifier</th><th>SSA check</th><th>Differential run</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="vo-coverage-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
