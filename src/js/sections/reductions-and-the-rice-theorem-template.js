/** Markup for "Reductions and the Rice theorem". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RiceTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ric-target', kind: 'select', label: 'the problem to prove undecidable', value: '0',
      options: [
        { value: '0', label: 'does this program ever print?' },
        { value: '1', label: 'is this variable ever assigned?' },
        { value: '2', label: 'is this line dead code?' },
        { value: '3', label: 'do these two programs compute the same function?' },
        { value: '4', label: 'does this program terminate on every input?' }
      ] },
    { id: 'ric-source', kind: 'text', label: 'the program being reduced from',
      value: 'while (x > 0) { x = step(x); }', maxLength: 48 },
    { id: 'ric-filter', kind: 'select', label: 'show which properties', value: 'all',
      options: [
        { value: 'all', label: 'all of them' },
        { value: 'undecidable', label: 'only the undecidable ones' },
        { value: 'decidable', label: 'only the decidable ones' }
      ] }
  ];

  const METRICS = [
    { id: 'ric-verdict', label: 'The target problem', note: 'decidable or not, and why' },
    { id: 'ric-undecidable', label: 'Undecidable properties', note: 'of the ten in the table' },
    { id: 'ric-semantic', label: 'Semantic properties', note: 'about what the program computes' },
    { id: 'ric-escape', label: 'The syntactic escape', note: 'decidable because it is not semantic' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Target, source and filter', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The reduction, as a program transformation</div>' +
      '<div class="card-body"><pre class="mono" id="ric-transformed" ' +
      'style="font-size:.78rem;margin:0;white-space:pre-wrap"></pre>' +
      '<p class="note" id="ric-transformed-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Why a decider for the target would decide halting</div>' +
      '<div class="card-body"><div id="ric-argument" class="mono" ' +
      'style="font-size:.82rem"></div>' +
      '<p class="note" id="ric-argument-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every property, classified</div>' +
      '<div class="card-body"><table class="ref-table" id="ric-properties"><thead><tr>' +
      '<th>Property</th><th>Semantic</th><th>Trivial</th><th>Decidable</th><th>Why</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ric-properties-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every reduction in the builder</div>' +
      '<div class="card-body"><table class="ref-table" id="ric-reductions"><thead><tr>' +
      '<th>Target problem</th><th>The equivalence</th><th>The consequence</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ric-reductions-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What a static analyser has to give up</div>' +
      '<div class="card-body"><table class="ref-table" id="ric-analysers"><thead><tr>' +
      '<th>Tool</th><th>Gives up</th><th>So it reports</th><th>What that costs you</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ric-analysers-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
