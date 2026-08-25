/** Markup for "The parser". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ParserTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const SAMPLES = {
    precedence: 'let r = 1 + 2 * 3 < 10 && !flag || done;',
    match: 'let d = match shape {\n  some(v) => v + 1,\n  none => 0,\n};',
    broken: 'let a = (1 + 2;\nlet b = 3 * ;\nlet c = 4 + 5;',
    nested: 'fn outer(n) {\n  let inner = fn(x) => x * n;\n  return inner(n + 1);\n}',
    chained: 'let v = data.rows[2].name;'
  };

  const CONTROLS = [
    { id: 'pr-sample', kind: 'select', label: 'source', value: 'broken',
      options: [
        { value: 'broken', label: 'two malformed statements and one good one' },
        { value: 'precedence', label: 'six operators, one expression' },
        { value: 'match', label: 'a match with two arms' },
        { value: 'nested', label: 'a function returning a closure' },
        { value: 'chained', label: 'field, index and field again' }
      ] },
    { id: 'pr-node', kind: 'range', label: 'select node', value: 0, min: 0, max: 40, step: 1,
      note: 'the tree row highlights the source range it came from' }
  ];

  const METRICS = [
    { id: 'pr-nodes', label: 'Nodes in the tree', note: 'a tree comes back whatever the input' },
    { id: 'pr-errors', label: 'Error nodes and problems',
      note: 'the parser is total — it never throws' },
    { id: 'pr-depth', label: 'Tree depth', note: 'how far the recursive descent went' },
    { id: 'pr-selected', label: 'Selected node', note: 'and the characters it covers' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A program, and one node of it',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The source, with the selected node marked</div>' +
      '<div class="card-body"><div id="pr-source"></div>' +
      '<p class="note" id="pr-source-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The tree, indented by depth and in source order</div>' +
      '<div class="card-body"><div id="pr-tree"></div>' +
      '<p class="note" id="pr-tree-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Where the parser could not read what it needed</div>' +
      '<div class="card-body"><table class="ref-table" id="pr-problems"><thead><tr>' +
      '<th>Code</th><th>Where</th><th>Message</th><th>Recovered as</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="pr-problems-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The precedence table, which the parser and the printer share' +
      '</div>' +
      '<div class="card-body"><table class="ref-table" id="pr-precedence"><thead><tr>' +
      '<th>Operator</th><th>Left power</th><th>Right power</th><th>Binds</th>' +
      '<th>What that means</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="pr-precedence-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Grouping, checked by printing the tree back</div>' +
      '<div class="card-body"><table class="ref-table" id="pr-grouping"><thead><tr>' +
      '<th>Written</th><th>Parsed as</th><th>Nodes</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="pr-grouping-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, SAMPLES: SAMPLES };
}));
