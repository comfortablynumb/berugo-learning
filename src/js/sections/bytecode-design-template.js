/** Markup for "Bytecode design". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BytecodeTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const SAMPLES = {
    expression: 'let k = 3;\nlet t = 0;\nfor v in [1, 2, 3, 4] { t = t + v * k * 2; }',
    loop: 'let t = 0;\nlet i = 0;\nwhile i < 20 { t = t + i * 2; i = i + 1; }',
    call: 'fn step(a, b) { return a + b * 2; }\nlet t = 0;\nlet i = 0;\n'
      + 'while i < 10 { t = step(t, i); i = i + 1; }',
    record: 'let p = { x: 1, y: 2 };\nlet q = { x: 3, y: 4 };\nlet s = p.x + q.y;',
    straight: 'let a = 1;\nlet b = a + 2;\nlet c = b * 3;'
  };

  const CONTROLS = [
    { id: 'bd-sample', kind: 'select', label: 'program', value: 'expression',
      options: [
        { value: 'expression', label: 'a nested arithmetic expression in a loop' },
        { value: 'loop', label: 'a counted loop' },
        { value: 'call', label: 'a function called in a loop' },
        { value: 'record', label: 'two records and a field read' },
        { value: 'straight', label: 'straight-line code' }
      ] },
    { id: 'bd-mode', kind: 'select', label: 'instruction set', value: 'stack',
      options: [
        { value: 'stack', label: 'stack — operands are implicit' },
        { value: 'register', label: 'register — operands are named' }
      ] },
    { id: 'bd-width', kind: 'select', label: 'encoding', value: 'variable',
      options: [
        { value: 'variable', label: 'variable width — one byte for a small operand' },
        { value: 'fixed', label: 'fixed width — every instruction the same size' }
      ] },
    { id: 'bd-peephole', kind: 'checkbox', label: 'keep values on the stack', value: true,
      note: 'the one rewrite that decides how big the stack/register gap really is' },
    { id: 'bd-supers', kind: 'range', label: 'superinstructions', value: 2,
      min: 0, max: 8, step: 1, note: 'fuse the commonest adjacent pairs' }
  ];

  const METRICS = [
    { id: 'bd-instructions', label: 'Instructions', note: 'stack against register' },
    { id: 'bd-dispatches', label: 'Dispatches executed', note: 'what the loop actually pays' },
    { id: 'bd-bytes', label: 'Encoded size', note: 'code plus the constant pool' },
    { id: 'bd-agrees', label: 'Same answer', note: 'compared against the IR interpreter' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'One program, two instruction sets',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The disassembly</div>' +
      '<div class="card-body"><div id="bd-listing"></div>' +
      '<p class="note" id="bd-listing-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The two sets on this program, side by side</div>' +
      '<div class="card-body"><div id="bd-chart" class="chart-host"></div>' +
      '<p class="note" id="bd-chart-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every conformance program, both sets</div>' +
      '<div class="card-body"><table class="ref-table" id="bd-suite"><thead><tr>' +
      '<th>Program</th><th>Stack instructions</th><th>Register instructions</th>' +
      '<th>Stack dispatches</th><th>Register dispatches</th><th>Both agree</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bd-suite-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The commonest adjacent pairs, and what fusing them saves</div>' +
      '<div class="card-body"><table class="ref-table" id="bd-pairs"><thead><tr>' +
      '<th>Pair</th><th>Occurrences</th><th>Dispatches saved if fused</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bd-pairs-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">How four real bytecodes answered the same question</div>' +
      '<div class="card-body"><table class="ref-table" id="bd-designs"><thead><tr>' +
      '<th>Runtime</th><th>Shape</th><th>Encoding</th><th>What it bought</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bd-designs-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, SAMPLES: SAMPLES };
}));
