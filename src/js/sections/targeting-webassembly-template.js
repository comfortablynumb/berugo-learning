/** Markup for "Targeting WebAssembly". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.WasmTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const SAMPLES = {
    loop: 'let t = 0;\nlet i = 0;\nwhile i < 20 { t = t + i * 2; i = i + 1; }',
    nested: 'let t = 0;\nlet a = 0;\nwhile a < 4 {\n  let b = 0;\n'
      + '  while b < 5 { t = t + a * b; b = b + 1; }\n  a = a + 1;\n}',
    branch: 'let a = 3;\nlet b = if a < 5 { a * 2 } else { a - 1 };\nlet c = b + 1;',
    call: 'fn add(a, b) { return a + b; }\nfn twice(n) { return add(n, n); }\n'
      + 'let s = twice(21);',
    divide: 'let d = 0;\nlet n = 0;\nlet acc = 0;\n'
      + 'while n < 3 {\n  acc = acc + 100 / d;\n  n = n + 1;\n}'
  };

  const CONTROLS = [
    { id: 'tw-sample', kind: 'select', label: 'program', value: 'loop',
      options: [
        { value: 'loop', label: 'a counted loop — one wasm loop' },
        { value: 'nested', label: 'two nested loops' },
        { value: 'branch', label: 'a branch and a join — one wasm block' },
        { value: 'call', label: 'two functions and a direct call' },
        { value: 'divide', label: 'a division by zero — wasm gives infinity, Berugo faults' }
      ] }
  ];

  const METRICS = [
    { id: 'tw-bytes', label: 'Module size', note: 'the whole binary, every section' },
    { id: 'tw-valid', label: 'Validates', note: 'in the host\'s own WebAssembly validator' },
    { id: 'tw-agrees', label: 'Agrees with the interpreter', note: 'outcome and every binding' },
    { id: 'tw-subset', label: 'Conformance suite in the subset', note: 'and the rest with a reason' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A program, compiled to bytes', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The module, section by section</div>' +
      '<div class="card-body"><table class="ref-table" id="tw-sections"><thead><tr>' +
      '<th>Section</th><th>Id</th><th>Bytes</th><th>What is in it</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tw-sections-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The graph, and the structure the stackifier recovered</div>' +
      '<div class="card-body"><div id="tw-graph" class="chart-host"></div>' +
      '<p class="note" id="tw-graph-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every block: what it becomes in structured control flow</div>' +
      '<div class="card-body"><table class="ref-table" id="tw-blocks"><thead><tr>' +
      '<th>Block</th><th>Predecessors</th><th>Loop header</th><th>Merge point</th>' +
      '<th>Becomes</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tw-blocks-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The result, against the interpreter</div>' +
      '<div class="card-body"><table class="ref-table" id="tw-result"><thead><tr>' +
      '<th>Observable</th><th>WebAssembly</th><th>IR interpreter</th><th>Agree</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tw-result-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The whole conformance suite, and what the subset excludes</div>' +
      '<div class="card-body"><table class="ref-table" id="tw-suite"><thead><tr>' +
      '<th>Program</th><th>In the subset</th><th>Bytes</th><th>Validates</th><th>Agrees</th>' +
      '<th>Why not, if not</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tw-suite-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, SAMPLES: SAMPLES };
}));
