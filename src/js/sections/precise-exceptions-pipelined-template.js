/** Markup for "Precise exceptions in a pipeline". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PreciseTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'pex-fault', kind: 'select', label: 'what goes wrong', value: 'misalignedLoad',
      options: [
        { value: 'ecall', label: 'ecall — detected in execute' },
        { value: 'illegal', label: 'an illegal instruction — detected in decode' },
        { value: 'misalignedLoad', label: 'a misaligned load — detected in memory' },
        { value: 'misalignedStore', label: 'a misaligned store — detected in memory' },
        { value: 'unmapped', label: 'a load from unmapped memory — detected in memory' }] },
    { id: 'pex-cycles', kind: 'range', label: 'cycles shown in the diagram', value: 20,
      min: 8, max: 40, step: 1 }
  ];

  const METRICS = [
    { id: 'pex-cause', label: 'mcause', note: 'why control left the program' },
    { id: 'pex-epc', label: 'mepc', note: 'the instruction that faulted' },
    { id: 'pex-tval', label: 'mtval', note: 'the offending value' },
    { id: 'pex-squashed', label: 'Instructions squashed', note: 'younger than the fault' },
    { id: 'pex-precise', label: 'State against the reference', note: 'at the same retire count' },
    { id: 'pex-drain', label: 'Cycles from detection to commit', note: 'older instructions finishing' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Raise a fault mid-pipeline',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">What happened, cycle by cycle</div>' +
      '<div class="card-body"><table class="ref-table" id="pex-trace"><thead><tr>' +
      '<th>Cycle</th><th>Stage</th><th>Event</th><th>What it means</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="pex-trace-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      diagramCard() +
      card('pex-classes', 'Every fault class, and the stage that detects it',
        ['Class', 'Detected in', 'Cause', 'mepc', 'mtval', 'State precise?']) +
      card('pex-rules', 'What precise means, as four requirements',
        ['Requirement', 'How this machine keeps it', 'What breaks without it']) +
      card('pex-single', 'The same fault on the single-cycle machine of M34',
        ['Question', 'Single cycle', 'Pipelined', 'What the difference costs']) +
      card('pex-ooo', 'What M36 has to add to keep the same promise',
        ['Problem', 'Here', 'Out of order']);
  }

  function diagramCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The stage diagram, with the squash visible</div>' +
      '<div class="card-body"><div id="pex-diagram"></div>' +
      '<p class="note" id="pex-diagram-note"></p></div></div>';
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
