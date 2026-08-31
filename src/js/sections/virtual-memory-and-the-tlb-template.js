/** Markup for "Virtual memory and the TLB". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TlbTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'tlb-working', kind: 'select', label: 'working set', value: '1024',
      options: [64, 128, 256, 512, 1024, 2048, 4096].map(function (kb) {
        return { value: String(kb), label: kb + ' KiB' };
      }) },
    { id: 'tlb-entries', kind: 'range', label: 'TLB entries', value: 64, min: 8, max: 256,
      step: 8 },
    { id: 'tlb-huge', kind: 'checkbox', label: 'huge pages (2 MiB instead of 4 KiB)',
      value: false },
    { id: 'tlb-levels', kind: 'range', label: 'page-table levels', value: 4, min: 1, max: 5,
      step: 1 }
  ];

  const METRICS = [
    { id: 'tlb-reach', label: 'Reach', note: 'entries x page size' },
    { id: 'tlb-fits', label: 'Working set against reach', note: 'the only comparison that matters' },
    { id: 'tlb-hitrate', label: 'TLB hit rate', note: 'translations served without a walk' },
    { id: 'tlb-walks', label: 'Page-table walks', note: 'each one several dependent loads' },
    { id: 'tlb-cost', label: 'Cycles per access', note: 'translation only, before the data' },
    { id: 'tlb-verdict', label: 'Translation-bound?', note: 'is the TLB the limit here' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Walk a working set and translate every address',
        controls: CONTROLS }) +
      scope.DataTable.markup({ id: 'tlb-walk', first: true,
        title: 'One address, walked',
        columns: ['Step', 'What is read', 'Cost'] }) +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      chartCard() +
      scope.DataTable.markup({ id: 'tlb-reach-table',
        title: 'The reach cliff: the same walk at every working-set size',
        columns: ['Working set', 'Against reach', 'Hit rate', 'Walks', 'Cycles per access'] }) +
      scope.DataTable.markup({ id: 'tlb-huge-table',
        title: 'Huge pages: what they fix, and what they do not',
        columns: ['Page size', 'Reach', 'Hit rate', 'Cycles per access', 'What it costs'] }) +
      scope.DataTable.markup({ id: 'tlb-asid',
        title: 'Two address spaces, and the identifier that keeps them apart',
        columns: ['Address space', 'Virtual page', 'Physical frame', 'Visible to the other?'] }) +
      scope.DataTable.markup({ id: 'tlb-switch',
        title: 'A context switch, with identifiers and without',
        columns: ['Scheme', 'Entries surviving the switch', 'Walks after it', 'What it costs'] });
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Translation cost as the working set passes the reach</div>' +
      '<div class="card-body"><div id="tlb-chart" class="chart-host"></div>' +
      '<p class="note" id="tlb-chart-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
