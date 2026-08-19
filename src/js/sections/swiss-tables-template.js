/** Markup for "SIMD-style metadata probing". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SwissTablesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'swt-load', kind: 'range', label: 'load factor', value: 80, min: 20, max: 87, step: 1, suffix: '%',
      note: 'Abseil grows at 7/8. A group probe stays cheap where a plain linear probe is already suffering.' },
    { id: 'swt-capacity', kind: 'range', label: 'slots', value: 2048, min: 256, max: 8192, step: 256 },
    { id: 'swt-deletes', kind: 'range', label: 'deleted fraction', value: 0, min: 0, max: 50, step: 5, suffix: '%' }
  ];

  const METRICS = [
    { id: 'swt-groups', label: 'Groups per lookup', note: '1.0 means one cache line answered it' },
    { id: 'swt-keycmp', label: 'Key comparisons', note: 'only tags that matched are checked' },
    { id: 'swt-plain', label: 'Plain open addressing', note: 'slot probes for the same keys' },
    { id: 'swt-false', label: 'False tag matches', note: '1 in 128 by construction' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Table', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">One group of 16 control bytes</div>' +
      '<div class="card-body"><div id="swt-group" class="mono" style="font-size:.8125rem"></div>' +
      '<p class="note">The lookup compares its 7-bit tag against all 16 bytes and gets a bitmask. ' +
      'In C++ that is one SSE2 instruction; here it is a byte loop, and the group structure is what ' +
      'matters either way.</p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="grid-2" style="margin-top:.875rem">' +
      '<div class="card"><div class="card-header">Probes as the table fills</div>' +
      '<div class="card-body"><div id="swt-chart"></div><div id="swt-legend"></div>' +
      '<p class="note">Group probes against slot probes for the same keys at the same load.</p>' +
      '</div></div>' +
      '<div class="card"><div class="card-header">Splitting the hash</div>' +
      '<div class="card-body"><div id="swt-split" class="mono" style="font-size:.8125rem"></div>' +
      '<p class="note">H1 chooses the group, H2 is the 7 bits stored in the control byte. The two ' +
      'come from disjoint parts of the same hash, so a good mixer is a prerequisite (3.1).</p>' +
      '</div></div>' +
      '</div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
