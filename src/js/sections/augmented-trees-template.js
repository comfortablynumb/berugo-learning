/** Markup for "Augmented trees". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AugmentedTreesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'aug-mode', kind: 'select', label: 'augmentation', value: 'size',
      options: [{ value: 'size', label: 'subtree size — rank and select' },
        { value: 'maxEnd', label: 'max endpoint — interval stabbing' },
        { value: 'sum', label: 'subtree sum — range sums' }] },
    { id: 'aug-count', kind: 'range', label: 'keys', value: 20000, min: 100, max: 100000, step: 100 },
    { id: 'aug-query', kind: 'number', label: 'query (rank k, stab point, or range start)', value: 5000, min: 1, step: 1 },
    { id: 'aug-seed', kind: 'range', label: 'seed', value: 4, min: 1, max: 40, step: 1,
      note: 'Every answer below is checked against a brute-force scan of the same data.' }
  ];

  const METRICS = [
    { id: 'aug-answer', label: 'Answer', note: 'from the augmented tree' },
    { id: 'aug-check', label: 'Brute force agrees', note: 'the same question, answered by scanning' },
    { id: 'aug-visits', label: 'Nodes visited', note: 'against the size of the structure' },
    { id: 'aug-pruned', label: 'Subtrees skipped', note: 'what the augmentation bought' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Augmentation and query', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The tree, annotated with the field being maintained</div>' +
      '<div class="card-body"><div id="aug-tree"></div>' +
      '<p class="note" id="aug-tree-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The three augmentations, on the same tree</div>' +
      '<div class="card-body"><table class="ref-table" id="aug-table"><thead><tr>' +
      '<th>Field</th><th>Maintained as</th><th>Query it unlocks</th><th>Nodes visited</th><th>A scan would visit</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="aug-table-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What can and cannot be augmented</div>' +
      '<div class="card-body"><table class="ref-table" id="aug-rule"><thead><tr>' +
      '<th>Field</th><th>Computable from node + children?</th><th>Verdict</th>' +
      '</tr></thead><tbody></tbody></table></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
