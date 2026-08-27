/** Markup for "Designing an intermediate representation". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DesignIrTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const SAMPLES = {
    loop: 'let t = 0;\nfor v in [1, 2, 3] { t = t + v * 2; }',
    branch: 'let a = 3;\nlet b = if a < 5 { a * 2 } else { a - 1 };',
    call: 'fn twice(n) { return n * 2; }\nlet r = twice(21);',
    record: 'let p = { x: 1, y: 2 };\nlet s = p.x + p.y;',
    nested: 'let t = 0;\nfor a in [1, 2] {\n  for b in [3, 4] { t = t + a * b; }\n}'
  };

  const CONTROLS = [
    { id: 'mi-sample', kind: 'select', label: 'program', value: 'loop',
      options: [
        { value: 'loop', label: 'a for loop — structured control flow becomes blocks' },
        { value: 'branch', label: 'an if in expression position' },
        { value: 'call', label: 'a function and a call' },
        { value: 'record', label: 'a record and two field loads' },
        { value: 'nested', label: 'two nested loops' }
      ] },
    { id: 'mi-break', kind: 'select', label: 'break an invariant deliberately', value: 'none',
      options: [
        { value: 'none', label: 'none — the IR as the lowering produced it' },
        { value: 'terminator', label: 'remove a terminator' },
        { value: 'target', label: 'point a jump at a block that does not exist' },
        { value: 'defined', label: 'read a register nothing defines' },
        { value: 'reachable', label: 'add a block nothing jumps to' }
      ],
      note: 'the verifier must name the invariant, not just refuse' }
  ];

  const METRICS = [
    { id: 'mi-blocks', label: 'Blocks', note: 'the tree had none of these' },
    { id: 'mi-instructions', label: 'Instructions',
      note: 'three-address, one operation each' },
    { id: 'mi-registers', label: 'Virtual registers',
      note: 'every value gets a name, which is what makes SSA possible' },
    { id: 'mi-verified', label: 'Verifier', note: 'run after every pass, always' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A program, and a deliberate defect',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The core language it came from</div>' +
      '<div class="card-body"><pre class="ast-source" id="mi-core"></pre>' +
      '<p class="note" id="mi-core-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The IR, block by block</div>' +
      '<div class="card-body"><div id="mi-listing"></div>' +
      '<p class="note" id="mi-listing-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every instruction, and the source construct it came from</div>' +
      '<div class="card-body"><table class="ref-table" id="mi-origin"><thead><tr>' +
      '<th>Block</th><th>Instruction</th><th>Came from</th><th>Source</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mi-origin-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The verifier: every invariant, and what it caught</div>' +
      '<div class="card-body"><table class="ref-table" id="mi-invariants"><thead><tr>' +
      '<th>Invariant</th><th>What it requires</th><th>Violated here</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mi-invariants-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The instruction set</div>' +
      '<div class="card-body"><table class="ref-table" id="mi-opcodes"><thead><tr>' +
      '<th>Opcode</th><th>Defines a value</th><th>Reads</th><th>What it is for</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mi-opcodes-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The whole conformance suite, lowered and run</div>' +
      '<div class="card-body"><table class="ref-table" id="mi-suite"><thead><tr>' +
      '<th>Program</th><th>Core nodes</th><th>Blocks</th><th>Instructions</th>' +
      '<th>Verifies</th><th>Agrees with the core</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mi-suite-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, SAMPLES: SAMPLES };
}));
