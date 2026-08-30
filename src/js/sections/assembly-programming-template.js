/** Markup for "Assembly programming". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AssemblyTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'asm-program', kind: 'select', label: 'program', value: 'factorial',
      options: [
        { value: 'sum', label: 'sum 1 to 10 — a counted loop' },
        { value: 'factorial', label: 'factorial by recursion — a real stack frame' },
        { value: 'arrayMax', label: 'largest element — an array walk' },
        { value: 'strlen', label: 'string length — byte loads and a sentinel' }] },
    { id: 'asm-step', kind: 'range', label: 'instructions executed', value: 24, min: 0,
      max: 130, step: 1 },
    { id: 'asm-all', kind: 'checkbox', label: 'show every register, not just the live ones',
      value: false }
  ];

  const METRICS = [
    { id: 'asm-pc', label: 'Program counter', note: 'and the instruction there' },
    { id: 'asm-retired', label: 'Instructions executed', note: 'of the whole run' },
    { id: 'asm-result', label: 'Result so far', note: 'the register the program leaves it in' },
    { id: 'asm-stack', label: 'Stack depth', note: 'bytes below the initial pointer' },
    { id: 'asm-calls', label: 'Calls in flight', note: 'frames the program has pushed' },
    { id: 'asm-final', label: 'Final answer', note: 'when the program reaches its ecall' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Step through real assembly', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Registers</div>' +
      '<div class="card-body"><table class="ref-table" id="asm-registers"><thead><tr>' +
      '<th>Register</th><th>Role</th><th>Hex</th><th>Signed</th><th>Changed?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="asm-registers-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('asm-listing', 'The program, assembled',
        ['', 'Address', 'Word', 'Source', 'From']) +
      card('asm-stack-table', 'The stack, from the pointer upwards',
        ['Address', 'Value', 'What it holds']) +
      chartCard() +
      card('asm-convention', 'The calling convention, which no gate enforces',
        ['Register', 'Name', 'Role', 'Who must preserve it']) +
      card('asm-idioms', 'Assembly idioms worth recognising in compiler output',
        ['Idiom', 'What it is', 'Why the compiler emits it']);
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Where the instructions go</div>' +
      '<div class="card-body"><div id="asm-chart" class="chart-host"></div>' +
      '<p class="note" id="asm-chart-note"></p></div></div>';
  }

  function card(id, title, columns) {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">' + title + '</div>' +
      '<div class="card-body"><table class="ref-table" id="' + id + '"><thead><tr>' +
      columns.map(function (name) { return '<th>' + name + '</th>'; }).join('') +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="' + id + '-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
