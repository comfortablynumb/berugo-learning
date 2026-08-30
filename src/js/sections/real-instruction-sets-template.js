/** Markup for "Real instruction sets compared". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.IsaCompareTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ris-set', kind: 'select', label: 'instruction set', value: 'riscv',
      options: [
        { value: 'riscv', label: 'RISC-V — one addressing mode, no flags' },
        { value: 'arm64', label: 'ARM64 — fixed width, flags, rich addressing' },
        { value: 'x86', label: 'x86-64 — variable width, flags, memory operands' }] },
    { id: 'ris-view', kind: 'select', label: 'what to show', value: 'listing',
      options: [
        { value: 'listing', label: 'the listing, instruction by instruction' },
        { value: 'loop', label: 'the loop body only — the part that runs n times' },
        { value: 'evidence', label: 'how you would identify it from the listing alone' }] }
  ];

  const METRICS = [
    { id: 'ris-instructions', label: 'Instructions', note: 'for the whole function' },
    { id: 'ris-bytes', label: 'Bytes', note: 'the same function, encoded' },
    { id: 'ris-loop', label: 'Loop body', note: 'instructions that run n times' },
    { id: 'ris-loop-bytes', label: 'Loop body bytes', note: 'what the fetcher pays per iteration' },
    { id: 'ris-widths', label: 'Instruction lengths seen', note: 'in these ten instructions' },
    { id: 'ris-density', label: 'Density against the largest', note: 'bytes, relative' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'One function, three machines',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The listing for this instruction set</div>' +
      '<div class="card-body"><table class="ref-table" id="ris-listing"><thead><tr>' +
      '<th>#</th><th>Instruction</th><th>Bytes</th><th>In the loop?</th><th>Why it looks like that</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ris-listing-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('ris-totals', 'The same function on all three, counted',
        ['Instruction set', 'Instructions', 'Bytes', 'Loop instructions', 'Loop bytes',
          'Density']) +
      chartCard() +
      card('ris-properties', 'Four decisions, three different answers',
        ['Property', 'RISC-V', 'ARM64', 'x86-64', 'Why it matters']) +
      card('ris-flags', 'What condition codes cost, measured on this loop',
        ['Machine', 'Compare and branch', 'Instructions in the loop', 'What the flags buy',
          'What they cost']) +
      card('ris-decode', 'What each front end has to do before it can decode',
        ['Question', 'Fixed width', 'Variable width', 'How real machines answer it']);
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Instructions and bytes for the same function</div>' +
      '<div class="card-body"><div id="ris-chart" class="chart-host"></div>' +
      '<p class="note" id="ris-chart-note"></p></div></div>';
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
