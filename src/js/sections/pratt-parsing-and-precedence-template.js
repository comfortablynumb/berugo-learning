/** Markup for "Pratt parsing and expression precedence". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PrattTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'prt-input', kind: 'text', label: 'the expression', value: 'a + b * c ^ d',
      maxLength: 40 },
    { id: 'prt-plus', kind: 'range', label: 'binding power of +', value: 50, min: 10, max: 90,
      step: 10 },
    { id: 'prt-times', kind: 'range', label: 'binding power of *', value: 60, min: 10, max: 90,
      step: 10 },
    { id: 'prt-caret', kind: 'select', label: 'associativity of ^', value: 'right',
      options: [
        { value: 'right', label: 'right — a ^ b ^ c is a ^ (b ^ c)' },
        { value: 'left', label: 'left — a ^ b ^ c is (a ^ b) ^ c' }
      ] }
  ];

  const METRICS = [
    { id: 'prt-tree', label: 'The parse, parenthesised', note: 'the tree shape, written out' },
    { id: 'prt-depth', label: 'Tree depth', note: 'how deeply the binding powers nested it' },
    { id: 'prt-calls', label: 'Recursive calls', note: 'one per expression, no backtracking' },
    { id: 'prt-changed', label: 'Differs from the default table', note: 'same input, edited powers' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Expression and operator table', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The tree, from the table you just edited</div>' +
      '<div class="card-body"><div id="prt-tree-view"></div>' +
      '<p class="note" id="prt-tree-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The operator table, sorted by binding power</div>' +
      '<div class="card-body"><table class="ref-table" id="prt-table"><thead><tr>' +
      '<th>Token</th><th>Position</th><th>Binding power</th><th>Associativity</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="prt-table-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Expressions the table has to get right</div>' +
      '<div class="card-body"><table class="ref-table" id="prt-cases"><thead><tr>' +
      '<th>Expression</th><th>Parses as</th><th>Expected</th><th>Match</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="prt-cases-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The same precedence as a grammar</div>' +
      '<div class="card-body"><table class="ref-table" id="prt-grammar"><thead><tr>' +
      '<th>Level</th><th>Grammar rule</th><th>Pratt entry</th><th>Adding an operator</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="prt-grammar-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Where the two denotations do their work</div>' +
      '<div class="card-body"><table class="ref-table" id="prt-denotations"><thead><tr>' +
      '<th>Token position</th><th>Called</th><th>Sees on its left</th><th>Example</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="prt-denotations-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
