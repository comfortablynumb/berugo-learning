/** Markup for "Names, scopes and resolution". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.NamesScopesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const SAMPLES = {
    shadowing: 'let a = 1;\nfn f(a) {\n  let b = a + 1;\n  return fn(n) => n * b;\n}\nlet b = f(a);\nlet c = a + b(2);',
    closures: 'fn counter(start) {\n  let step = 2;\n  return fn(n) => n * step + start;\n}\nlet up = counter(10);\nlet v = up(3);',
    nested: 'let x = 1;\nfn outer(x) {\n  fn middle(x) {\n    return fn(y) => x + y;\n  }\n  return middle(x + 1);\n}',
    imports: 'import math;\nimport text;\nlet a = math.square(4);\nlet b = text.upper("hi");\nlet c = math.max(a, 2);',
    typo: 'let value = 1;\nlet total = 0;\nlet z = valu + totl;\nlet w = accumulator;'
  };

  const CONTROLS = [
    { id: 'ns-sample', kind: 'select', label: 'fixture', value: 'shadowing',
      options: [
        { value: 'shadowing', label: 'shadowing — two a and two b, four different bindings' },
        { value: 'closures', label: 'a closure capturing two names from two scopes' },
        { value: 'nested', label: 'three nested x, each shadowing the last' },
        { value: 'imports', label: 'two modules and five qualified names' },
        { value: 'typo', label: 'three misspelled names, and one that is not close to anything' }
      ] },
    { id: 'ns-cursor', kind: 'range', label: 'cursor: the nth identifier in the file',
      value: 0, min: 0, max: 30, step: 1,
      note: 'its binding site and every other reference to the same binding light up' },
    { id: 'ns-rename', kind: 'text', label: 'rename the name under the cursor to',
      value: 'renamed', maxLength: 20,
      note: 'the rename applies its edits, re-resolves, and refuses if anything changed meaning' }
  ];

  const METRICS = [
    { id: 'ns-scopes', label: 'Scopes', note: 'one per block, function, arm and loop' },
    { id: 'ns-bindings', label: 'Bindings', note: 'not counting the four builtins' },
    { id: 'ns-captured', label: 'Captured bindings',
      note: 'used inside a function that does not own them' },
    { id: 'ns-under-cursor', label: 'Under the cursor',
      note: 'which binding this occurrence resolves to' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A fixture, a cursor and a rename',
        controls: CONTROLS }) +
      '<div class="card">' +
      '<div class="card-header">Every reference to the binding under the cursor</div>' +
      '<div class="card-body"><div id="ns-source"></div>' +
      '<p class="note" id="ns-source-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The scope tree, and what each scope binds</div>' +
      '<div class="card-body"><table class="ref-table" id="ns-scope-table"><thead><tr>' +
      '<th>Scope</th><th>Kind</th><th>Binds</th><th>Uses</th><th>Captured</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ns-scope-table-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Same spelling, different binding</div>' +
      '<div class="card-body"><table class="ref-table" id="ns-shadow-table"><thead><tr>' +
      '<th>Name</th><th>Occurrences</th><th>Distinct bindings</th><th>Where each is bound</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ns-shadow-table-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Captures: what each function has to carry</div>' +
      '<div class="card-body"><table class="ref-table" id="ns-capture-table"><thead><tr>' +
      '<th>Function</th><th>Captures</th><th>Owned by</th><th>Why it is a capture</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ns-capture-table-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Unresolved names, and the nearest thing in scope</div>' +
      '<div class="card-body"><table class="ref-table" id="ns-error-table"><thead><tr>' +
      '<th>Written</th><th>Where</th><th>Suggestion</th><th>Edit distance</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ns-error-table-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The rename, and whether it was allowed</div>' +
      '<div class="card-body"><table class="ref-table" id="ns-rename-table"><thead><tr>' +
      '<th>Measure</th><th>Result</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ns-rename-table-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, SAMPLES: SAMPLES };
}));
