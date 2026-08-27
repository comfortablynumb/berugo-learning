/** Markup for "Building the interpreter". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.VmTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const SAMPLES = {
    closure: 'fn adder(n) { return fn(x) => x + n; }\nlet inc = adder(1);\nlet r = inc(41);',
    calls: 'fn step(a, b) { return a + b * 2; }\nlet t = 0;\nlet i = 0;\n'
      + 'while i < 4 { t = step(t, i); i = i + 1; }',
    fault: 'let xs = [1, 2];\nlet z = xs[5];',
    loop: 'let t = 0;\nlet i = 0;\nwhile i < 5 { t = t + i * 2; i = i + 1; }',
    nested: 'fn outer(n) { return inner(n) + 1; }\nfn inner(n) { return n * 2; }\n'
      + 'let r = outer(20);'
  };

  const CONTROLS = [
    { id: 'bi-sample', kind: 'select', label: 'program', value: 'closure',
      options: [
        { value: 'closure', label: 'a closure over a parameter' },
        { value: 'calls', label: 'a function called in a loop' },
        { value: 'nested', label: 'a call inside a call' },
        { value: 'loop', label: 'a counted loop' },
        { value: 'fault', label: 'an index outside its array' }
      ] },
    { id: 'bi-mode', kind: 'select', label: 'instruction set', value: 'stack',
      options: [
        { value: 'stack', label: 'stack — the operand stack is visible' },
        { value: 'register', label: 'register — the register file is visible' }
      ] },
    { id: 'bi-step', kind: 'range', label: 'step to instruction', value: 6,
      min: 0, max: 120, step: 1, note: 'the machine stopped between two instructions' },
    { id: 'bi-capture', kind: 'checkbox', label: 'capture upvalues by reference', value: false,
      note: 'the switch that decides what a loop-captured variable means' }
  ];

  const METRICS = [
    { id: 'bi-at', label: 'Stopped at', note: 'function and program counter' },
    { id: 'bi-depth', label: 'Frames live', note: 'the call stack right now' },
    { id: 'bi-dispatched', label: 'Dispatches so far', note: 'instructions executed to get here' },
    { id: 'bi-outcome', label: 'Outcome', note: 'once it runs to the end' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A program, stopped mid-flight', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The frame right now</div>' +
      '<div class="card-body"><div id="bi-frame"></div>' +
      '<p class="note" id="bi-frame-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The code, with the program counter marked</div>' +
      '<div class="card-body"><div id="bi-listing"></div>' +
      '<p class="note" id="bi-listing-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The call stack, innermost first</div>' +
      '<div class="card-body"><table class="ref-table" id="bi-stack"><thead><tr>' +
      '<th>Depth</th><th>Function</th><th>At</th><th>Instruction</th><th>Locals held</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bi-stack-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Capture by value against capture by reference</div>' +
      '<div class="card-body"><table class="ref-table" id="bi-capture-table"><thead><tr>' +
      '<th>Strategy</th><th>What the closure holds</th><th>Closed when</th>' +
      '<th>What a loop-captured variable means</th><th>Languages</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bi-capture-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every conformance program, run to the end</div>' +
      '<div class="card-body"><table class="ref-table" id="bi-suite"><thead><tr>' +
      '<th>Program</th><th>Dispatches</th><th>Deepest frame stack</th><th>Native calls</th>' +
      '<th>Same answer</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bi-suite-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, SAMPLES: SAMPLES };
}));
