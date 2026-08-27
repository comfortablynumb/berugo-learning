/** Markup for "Interprocedural optimisation". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.InterprocTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const SAMPLES = {
    /* Three records and three different answers: one returned, one passed to a
       call that only reads it, and one never leaving the frame. The middle one
       is the imprecise case, and the fixture exists to make it visible. */
    escapes: 'fn wrap(n) { return { value: n }; }\nfn read(r) { return r.value; }\n'
      + 'let local = { value: 1 };\nlet box = { value: 2 };\n'
      + 'let s = local.value + read(box) + wrap(3).value;',
    higherOrder: 'fn twice(f, x) { return f(f(x)); }\nfn inc(n) { return n + 1; }\n'
      + 'let r = twice(inc, 5);',
    recursive: 'fn down(n) { return if n < 1 { 0 } else { down(n - 1) }; }\nlet r = down(3);',
    tail: 'fn last(xs) { return len(xs); }\nfn go(xs) { return last(xs); }\nlet r = go([1, 2]);',
    closure: 'fn adder(n) { return fn(x) => x + n; }\nlet inc = adder(1);\nlet r = inc(41);'
  };

  const CONTROLS = [
    { id: 'ip-sample', kind: 'select', label: 'program', value: 'escapes',
      options: [
        { value: 'escapes', label: 'one record that escapes and one that does not' },
        { value: 'higherOrder', label: 'a function passed as a value — an indirect call' },
        { value: 'recursive', label: 'a recursive call, which inlining must refuse' },
        { value: 'tail', label: 'a call whose result is returned immediately' },
        { value: 'closure', label: 'a closure returned from a function' }
      ] },
    { id: 'ip-budget', kind: 'range', label: 'inlining budget', value: 40,
      min: 0, max: 120, step: 5,
      note: 'spent on the best cost-benefit ratio first' }
  ];

  const METRICS = [
    { id: 'ip-calls', label: 'Direct and indirect calls',
      note: 'an indirect edge is one the optimiser cannot follow' },
    { id: 'ip-inlined', label: 'Call sites chosen', note: 'and what they cost from the budget' },
    { id: 'ip-stack', label: 'Allocations that can live on the stack',
      note: 'nothing lets them outlive the frame' },
    { id: 'ip-tail', label: 'Tail calls', note: 'a call whose result is returned unchanged' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A program and a budget', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The call graph</div>' +
      '<div class="card-body"><table class="ref-table" id="ip-graph"><thead><tr>' +
      '<th>From</th><th>To</th><th>In block</th><th>Kind</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ip-graph-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Each candidate, its cost and its benefit</div>' +
      '<div class="card-body"><table class="ref-table" id="ip-candidates"><thead><tr>' +
      '<th>Call site</th><th>Callee size</th><th>Estimated benefit</th><th>Ratio</th>' +
      '<th>Chosen</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ip-candidates-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every allocation, and why it escapes or does not</div>' +
      '<div class="card-body"><table class="ref-table" id="ip-escape"><thead><tr>' +
      '<th>Function</th><th>Allocation</th><th>Register</th><th>Escapes</th><th>Why</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ip-escape-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What the budget buys, as it is raised</div>' +
      '<div class="card-body"><table class="ref-table" id="ip-budget-table"><thead><tr>' +
      '<th>Budget</th><th>Sites chosen</th><th>Spent</th><th>Left on the table</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ip-budget-table-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The conformance suite: calls, allocations and what escapes</div>' +
      '<div class="card-body"><table class="ref-table" id="ip-suite"><thead><tr>' +
      '<th>Program</th><th>Functions</th><th>Direct</th><th>Indirect</th>' +
      '<th>Allocations</th><th>On the stack</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ip-suite-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, SAMPLES: SAMPLES };
}));
