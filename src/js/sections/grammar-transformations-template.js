/** Markup for "Grammar transformations". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TransformTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'gtr-grammar', kind: 'select', label: 'the grammar', value: 'precedenceSum',
      options: [
        { value: 'leftRecursive', label: 'E to E + T, or T — directly left recursive' },
        { value: 'precedenceSum', label: 'E/T/F with precedence — left recursive twice' },
        { value: 'nullable', label: 'S to A A A A with A nullable — four epsilons' },
        { value: 'balanced', label: 'balanced brackets — nullable start symbol' }
      ] },
    { id: 'gtr-step', kind: 'select', label: 'transformation', value: 'left-recursion',
      options: [
        { value: 'useless', label: 'remove useless and unreachable symbols' },
        { value: 'epsilon', label: 'remove epsilon productions' },
        { value: 'unit', label: 'remove unit productions' },
        { value: 'left-recursion', label: 'eliminate left recursion' },
        { value: 'left-factor', label: 'left factor shared prefixes' },
        { value: 'cnf', label: 'convert to Chomsky normal form' }
      ] },
    { id: 'gtr-length', kind: 'range', label: 'check strings up to length', value: 6,
      min: 3, max: 8, step: 1 }
  ];

  const METRICS = [
    { id: 'gtr-preserved', label: 'Language preserved', note: 'differential test, both directions' },
    { id: 'gtr-rules', label: 'Productions', note: 'before and after the transformation' },
    { id: 'gtr-recursion', label: 'Left recursive', note: 'direct or through a cycle' },
    { id: 'gtr-shape', label: 'Tree shape changed', note: 'same string, different structure' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Grammar and transformation', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Before and after</div>' +
      '<div class="card-body"><div id="gtr-rules-view" class="mono" ' +
      'style="font-size:.82rem"></div>' +
      '<p class="note" id="gtr-view-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The full pipeline, step by step</div>' +
      '<div class="card-body"><table class="ref-table" id="gtr-pipeline"><thead><tr>' +
      '<th>Step</th><th>Productions</th><th>Nonterminals</th><th>Language preserved</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="gtr-pipeline-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The tree the transformation left behind</div>' +
      '<div class="card-body"><div id="gtr-trees"></div>' +
      '<p class="note" id="gtr-trees-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What each transformation costs</div>' +
      '<div class="card-body"><table class="ref-table" id="gtr-costs"><thead><tr>' +
      '<th>Transformation</th><th>Needed by</th><th>Blow-up</th><th>Tree effect</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="gtr-costs-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
