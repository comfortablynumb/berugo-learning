/** Markup for "Designing the language". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DesignLanguageTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'dl-feature', kind: 'select', label: 'a feature, with all four of its rules',
      value: 'match',
      options: [
        { value: 'literals', label: 'literals — numbers, strings, booleans' },
        { value: 'names', label: 'names and let bindings' },
        { value: 'operators', label: 'operators and precedence' },
        { value: 'functions', label: 'functions and closures' },
        { value: 'records', label: 'records' },
        { value: 'arrays', label: 'arrays' },
        { value: 'conditionals', label: 'conditionals' },
        { value: 'match', label: 'sum types and pattern matching' },
        { value: 'loops', label: 'loops' },
        { value: 'modules', label: 'modules and imports' },
        { value: 'annotations', label: 'type annotations' }
      ] },
    { id: 'dl-order', kind: 'select', label: 'order the cost table by', value: 'later',
      options: [
        { value: 'later', label: 'work after the parser — most expensive first' },
        { value: 'total', label: 'total work' },
        { value: 'ratio', label: 'work after the parser per unit of parser work' },
        { value: 'parse', label: 'parser work alone' }
      ] }
  ];

  const METRICS = [
    { id: 'dl-features', label: 'Features in v1', note: 'each with four rules and an example' },
    { id: 'dl-programs', label: 'Conformance programs',
      note: 'the suite every stage is checked against' },
    { id: 'dl-split', label: 'Where the work lands',
      note: 'parser units against units in every later stage' },
    { id: 'dl-deferred', label: 'Stated non-goals',
      note: 'deferred on purpose, each to a named milestone' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The spec, browsable', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">' +
      'One feature, four rules and the stage that implements it</div>' +
      '<div class="card-body"><table class="ref-table" id="dl-rules"><thead><tr>' +
      '<th>Part of the spec</th><th>What it says</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dl-rules-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What each feature costs, and where the cost lands</div>' +
      '<div class="card-body"><table class="ref-table" id="dl-cost-table"><thead><tr>' +
      '<th>Feature</th><th>Parser</th><th>After the parser</th><th>Total</th>' +
      '<th>Later per parser unit</th><th>Which later stages pay</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dl-cost-table-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The pipeline, stage by stage, across four milestones</div>' +
      '<div class="card-body"><table class="ref-table" id="dl-stage-table"><thead><tr>' +
      '<th>Stage</th><th>Milestone</th><th>Section</th><th>Takes</th><th>Gives</th>' +
      '<th>Features it first has to handle</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dl-stage-table-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every feature, and the conformance programs that cover it</div>' +
      '<div class="card-body"><table class="ref-table" id="dl-coverage-table"><thead><tr>' +
      '<th>Feature</th><th>Programs</th><th>Which ones</th><th>Covered</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dl-coverage-table-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The non-goals, and where each one is met instead</div>' +
      '<div class="card-body"><table class="ref-table" id="dl-goals-table"><thead><tr>' +
      '<th>Not in v1</th><th>Why not</th><th>Where it arrives</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dl-goals-table-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
