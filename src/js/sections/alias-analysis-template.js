/** Markup for "Memory and alias analysis". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AliasTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const SAMPLES = {
    merge: 'let p = { x: 1 };\nlet q = { x: 2 };\nlet r = if 1 < 2 { p } else { q };\n'
      + 'let v = r.x + p.x;',
    distinct: 'let p = { x: 1 };\nlet q = { x: 2 };\nlet v = p.x + q.x;',
    aliased: 'let p = { x: 1 };\nlet q = p;\nlet v = p.x + q.x;',
    loop: 'let acc = { x: 0 };\nlet t = 0;\nfor v in [1, 2, 3] { t = t + acc.x + v; }',
    store: 'let p = { x: 1 };\nlet q = { x: 2 };\nlet a = p.x;\nlet b = p.x;\nlet c = q.x;'
  };

  const CONTROLS = [
    { id: 'aa-sample', kind: 'select', label: 'program', value: 'merge',
      options: [
        { value: 'merge', label: 'two records merged at a join — where the two analyses differ' },
        { value: 'distinct', label: 'two records never mixed' },
        { value: 'aliased', label: 'two names for one record' },
        { value: 'loop', label: 'a record read inside a loop' },
        { value: 'store', label: 'the same field loaded twice' }
      ] },
    { id: 'aa-analysis', kind: 'select', label: 'analysis', value: 'andersen',
      options: [
        { value: 'andersen', label: 'Andersen — inclusion-based, precise, cubic' },
        { value: 'steensgaard', label: 'Steensgaard — unification-based, coarse, near-linear' }
      ] }
  ];

  const METRICS = [
    { id: 'aa-sites', label: 'Allocation sites', note: 'what a pointer can point at' },
    { id: 'aa-pairs', label: 'May-alias pairs', note: 'reported by the chosen analysis' },
    { id: 'aa-lost', label: 'Precision lost by unification',
      note: 'pairs Steensgaard reports and Andersen does not' },
    { id: 'aa-sound', label: 'Sound against the dynamic oracle',
      note: 'every alias that really happened is reported' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A program and an analysis', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">What each register can point at</div>' +
      '<div class="card-body"><table class="ref-table" id="aa-points"><thead><tr>' +
      '<th>Register</th><th>Points at</th><th>Sites</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="aa-points-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The two analyses on the same program</div>' +
      '<div class="card-body"><table class="ref-table" id="aa-compare"><thead><tr>' +
      '<th>Analysis</th><th>Method</th><th>May-alias pairs</th><th>Loads it could eliminate</th>' +
      '<th>Cost</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="aa-compare-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Soundness: every alias that really happened</div>' +
      '<div class="card-body"><table class="ref-table" id="aa-sound-table"><thead><tr>' +
      '<th>Analysis</th><th>Pairs reported</th><th>Pairs observed</th><th>Missed</th>' +
      '<th>Sound</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="aa-sound-table-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Across the fixtures: precision and what it buys</div>' +
      '<div class="card-body"><table class="ref-table" id="aa-suite"><thead><tr>' +
      '<th>Program</th><th>Sites</th><th>Andersen pairs</th><th>Steensgaard pairs</th>' +
      '<th>Lost</th><th>Loads eliminable</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="aa-suite-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What a language can guarantee for free</div>' +
      '<div class="card-body"><table class="ref-table" id="aa-language"><thead><tr>' +
      '<th>Language feature</th><th>What the optimiser gets</th><th>Without it</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="aa-language-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, SAMPLES: SAMPLES };
}));
