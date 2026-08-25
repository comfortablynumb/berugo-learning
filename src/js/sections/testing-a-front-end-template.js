/** Markup for "Testing the front end". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TestFrontEndTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'tf-count', kind: 'range', label: 'generated programs per property',
      value: 2000, min: 250, max: 10000, step: 250,
      note: 'the round trip and the fuzzer each get this many' },
    { id: 'tf-seed', kind: 'range', label: 'seed', value: 1, min: 1, max: 40, step: 1,
      note: 'a different corpus, same properties' },
    { id: 'tf-depth', kind: 'range', label: 'maximum expression depth', value: 4,
      min: 2, max: 7, step: 1 },
    { id: 'tf-loops', kind: 'checkbox', label: 'let the generator emit loops', value: true,
      note: 'loops are where the desugaring has something to get wrong' }
  ];

  const METRICS = [
    { id: 'tf-roundtrip', label: 'Round-trip failures',
      note: 'parse, print, reparse, compare the trees' },
    { id: 'tf-crashes', label: 'Parser crashes under mutation',
      note: 'a corrupted file must still return a tree' },
    { id: 'tf-lost', label: 'Spans lost under mutation',
      note: 'the quiet failure: a diagnostic that underlines nothing' },
    { id: 'tf-differential', label: 'Surface and core disagreements',
      note: 'both run, all observables compared' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A corpus, and four properties over it',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">What the generator produces</div>' +
      '<div class="card-body"><table class="ref-table" id="tf-corpus"><thead><tr>' +
      '<th>#</th><th>Program</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tf-corpus-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The four properties, and what each one is worth</div>' +
      '<div class="card-body"><table class="ref-table" id="tf-properties"><thead><tr>' +
      '<th>Property</th><th>Checked</th><th>Failures</th><th>What it tests</th>' +
      '<th>Deliberately broken, it catches</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tf-properties-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Mutation fuzzing, by the kind of corruption</div>' +
      '<div class="card-body"><table class="ref-table" id="tf-mutations"><thead><tr>' +
      '<th>Mutation</th><th>Applied</th><th>Share</th><th>What it produces</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tf-mutations-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Golden files: every conformance program at every stage</div>' +
      '<div class="card-body"><table class="ref-table" id="tf-golden"><thead><tr>' +
      '<th>Program</th><th>Tokens</th><th>Nodes</th><th>Bindings</th><th>Types</th>' +
      '<th>Core</th><th>Diagnostics</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tf-golden-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Purity: every stage run twice and compared</div>' +
      '<div class="card-body"><table class="ref-table" id="tf-purity"><thead><tr>' +
      '<th>Program</th><th>Stages compared</th><th>Differing</th><th>Pure</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tf-purity-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The oracles, and what each one can and cannot see</div>' +
      '<div class="card-body"><table class="ref-table" id="tf-oracles"><thead><tr>' +
      '<th>Oracle</th><th>Answers</th><th>Blind to</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tf-oracles-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
