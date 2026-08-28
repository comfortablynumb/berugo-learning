/** Markup for "Mark-sweep and mark-compact". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MarkSweepTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'msw-progress', kind: 'range', label: 'marking progress', value: 100,
      min: 0, max: 100, step: 5, note: 'per cent of the mark completed; the map follows' },
    { id: 'msw-stack', kind: 'range', label: 'mark stack limit', value: 64,
      min: 4, max: 256, step: 4, note: 'entries; a full stack drops the child and sets a flag' },
    { id: 'msw-after', kind: 'select', label: 'after the sweep', value: 'sweep',
      options: [
        { value: 'sweep', label: 'leave the survivors where they are' },
        { value: 'compact', label: 'slide them together and fix the pointers' }
      ] }
  ];

  const METRICS = [
    { id: 'msw-marked', label: 'Objects reached', note: 'black, at this point in the mark' },
    { id: 'msw-rescans', label: 'Rescan passes after an overflow',
      note: 'each one is a walk of the whole heap' },
    { id: 'msw-largest', label: 'Largest usable free run',
      note: 'what an allocation request actually meets' },
    { id: 'msw-verdict', label: 'Reclaimed against the oracle',
      note: 'the reclaimed set must equal the unreachable set' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'One heap, one collection, stepped',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The heap, coloured by mark state</div>' +
      '<div class="card-body"><div id="msw-map"></div>' +
      '<p class="note" id="msw-map-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Free space after the sweep, drawn to scale</div>' +
      '<div class="card-body"><div id="msw-strip-sweep"></div>' +
      '<p class="note">After a sweep: the survivors have not moved, so the free space is '
      + 'whatever was between them.</p>' +
      '<div id="msw-strip-compact" style="margin-top:.6rem"></div>' +
      '<p class="note" id="msw-strip-caption"></p></div></div>' +
      card('msw-colours', 'The three colours, and what each one is a promise about',
        ['Colour', 'Means', 'Objects now', 'What it would mean to sweep it']) +
      card('msw-stack-table', 'What a bounded mark stack costs',
        ['Limit', 'Reached in the main pass', 'Rescan passes', 'Total work',
          'Reclaimed', 'Freed a live object']) +
      card('msw-frag', 'The same free bytes, two shapes',
        ['After', 'Live bytes', 'Free bytes', 'Holes', 'Largest hole',
          'Largest as a share of free']) +
      card('msw-scan', 'Precise against conservative scanning',
        ['Scanner', 'Needs', 'Roots found', 'Retains', 'Can move objects']);
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
