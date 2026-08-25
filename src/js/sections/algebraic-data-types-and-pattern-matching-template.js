/** Markup for "Algebraic data types and pattern matching". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PatternTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'adt-match', kind: 'select', label: 'the match', value: '9',
      options: [
        { value: '0', label: 'Bool × Bool: true;true | true;false | false;_' },
        { value: '1', label: 'Bool × Bool: true;true | false;_ — incomplete' },
        { value: '2', label: 'Colour: red | green — one missing' },
        { value: '3', label: 'Colour: red | green | blue — complete' },
        { value: '4', label: 'Colour: red | _ | blue — a dead clause' },
        { value: '5', label: 'List: nil | cons(true, _) — incomplete' },
        { value: '6', label: 'List: nil | cons(_, _) — complete' },
        { value: '7', label: 'Option × Bool: none;_ | some(true);true | some(_);_' },
        { value: '8', label: 'Tree: leaf | node(leaf,_,leaf) | node(_,_,_) | leaf' },
        { value: '9', label: 'Bool³: _;false;true | false;true;_ | _;_;false | _;_;_' }
      ] },
    { id: 'adt-heuristic', kind: 'select', label: 'which column to test first', value: 'first',
      options: [
        { value: 'first', label: 'the leftmost column' },
        { value: 'smallDefault', label: 'the smallest default matrix' },
        { value: 'necessity', label: 'the column most rows test' },
        { value: 'fewestBranches', label: 'the fewest head constructors' }
      ] }
  ];

  const METRICS = [
    { id: 'adt-exhaustive', label: 'Exhaustive', note: 'is any value unmatched' },
    { id: 'adt-witness', label: 'A value nothing matches', note: 'constructed, not guessed' },
    { id: 'adt-dead', label: 'Unreachable clauses', note: 'no value can ever reach them' },
    { id: 'adt-size', label: 'Decision-tree nodes', note: 'for the chosen column order' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A match, and a column heuristic', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The clauses, and whether each can run</div>' +
      '<div class="card-body"><table class="ref-table" id="adt-clauses"><thead><tr>' +
      '<th>#</th><th>Pattern</th><th>Reachable</th><th>Why not</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="adt-clauses-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The compiled decision tree</div>' +
      '<div class="card-body"><div id="adt-tree"></div>' +
      '<p class="note" id="adt-tree-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What the column choice costs</div>' +
      '<div class="card-body"><table class="ref-table" id="adt-heuristics"><thead><tr>' +
      '<th>Heuristic</th><th>Nodes</th><th>Tests</th><th>Depth</th><th>Clauses reached</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="adt-heuristics-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every match, checked for both faults</div>' +
      '<div class="card-body"><table class="ref-table" id="adt-sweep"><thead><tr>' +
      '<th>Match</th><th>Exhaustive</th><th>Missing value</th><th>Dead clauses</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="adt-sweep-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The type signatures the checker works over</div>' +
      '<div class="card-body"><table class="ref-table" id="adt-types"><thead><tr>' +
      '<th>Type</th><th>Constructors</th><th>Arities</th><th>Values of size ≤ 2</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="adt-types-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
