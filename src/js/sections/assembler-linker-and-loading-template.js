/** Markup for "Assembler, linker and loading". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LinkerTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'lnk-scenario', kind: 'select', label: 'what to link', value: 'both',
      options: [
        { value: 'both', label: 'main.o and target.o — everything resolves' },
        { value: 'missing', label: 'main.o alone — the symbol is nowhere' },
        { value: 'far', label: 'with 5 000 bytes in between — out of branch range' },
        { value: 'veneer', label: 'the same, with a veneer — how real linkers fix it' }] },
    { id: 'lnk-stage', kind: 'select', label: 'pipeline stage', value: 'relocated',
      options: [
        { value: 'object', label: 'objects: bytes, symbols and holes' },
        { value: 'placed', label: 'placed: every object given an address' },
        { value: 'relocated', label: 'relocated: the holes filled, or reported' },
        { value: 'running', label: 'loaded and run' }] }
  ];

  const METRICS = [
    { id: 'lnk-objects', label: 'Objects', note: 'translation units on the command line' },
    { id: 'lnk-image', label: 'Image size', note: 'bytes, after placement' },
    { id: 'lnk-symbols', label: 'Symbols defined', note: 'across every object' },
    { id: 'lnk-relocations', label: 'Relocations', note: 'holes the assembler could not fill' },
    { id: 'lnk-result', label: 'Link result', note: 'and the first failure, if any' },
    { id: 'lnk-run', label: 'What it computes', note: 'once loaded and executed' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Assemble, place, relocate, load',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">This stage, in detail</div>' +
      '<div class="card-body"><table class="ref-table" id="lnk-stage-table"><thead><tr>' +
      '<th>Item</th><th>Where</th><th>What</th><th>Note</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="lnk-stage-table-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('lnk-objects-table', 'The objects: bytes, what each defines, what each still needs',
        ['Object', 'Bytes', 'Defines', 'Needs', 'Placed at']) +
      card('lnk-relocs', 'Every hole, and whether it could be filled',
        ['At', 'Symbol', 'Shape', 'Reach', 'Offset needed', 'Verdict']) +
      card('lnk-map', 'The symbol map, sorted by address',
        ['Symbol', 'Address', 'Defined by']) +
      chartCard() +
      card('lnk-kinds', 'What each relocation shape can express',
        ['Shape', 'Format', 'Range', 'What happens past it']) +
      card('lnk-passes', 'Why the assembler needs two passes',
        ['Pass', 'What it can do', 'What it cannot yet', 'What would break without it']);
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">How far each relocation shape reaches, in bytes</div>' +
      '<div class="card-body"><div id="lnk-chart" class="chart-host"></div>' +
      '<p class="note" id="lnk-chart-note"></p></div></div>';
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
