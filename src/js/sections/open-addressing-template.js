/** Markup for "Open addressing". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.OpenAddressingTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'oa-probe', kind: 'select', label: 'probe sequence', value: 'linear',
      options: [{ value: 'linear', label: 'linear: h + i' },
        { value: 'quadratic', label: 'quadratic: h + i(i+1)/2' },
        { value: 'double', label: 'double hashing: h1 + i·h2' }] },
    { id: 'oa-deletion', kind: 'select', label: 'deletion', value: 'tombstone',
      options: [{ value: 'tombstone', label: 'tombstones' },
        { value: 'backward-shift', label: 'backward shift (linear only)' }] },
    { id: 'oa-load', kind: 'range', label: 'load factor', value: 70, min: 10, max: 95, step: 5, suffix: '%' },
    { id: 'oa-churn', kind: 'range', label: 'churn operations after filling', value: 0, min: 0, max: 5000, step: 100,
      note: 'Each operation deletes one live key and inserts a new one, so the live size never changes.' },
    { id: 'oa-capacity', kind: 'range', label: 'slots', value: 1024, min: 256, max: 4096, step: 256 }
  ];

  const METRICS = [
    { id: 'oa-probes', label: 'Probes, key present', note: 'measured over every live key' },
    { id: 'oa-miss', label: 'Probes, key absent', note: 'the case tombstones destroy' },
    { id: 'oa-expected', label: 'Theory says', note: '½(1 + 1/(1−α)) for a hit' },
    { id: 'oa-tombs', label: 'Tombstones', note: 'slots that are neither live nor free' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Table, probing and churn', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Slot array</div>' +
      '<div class="card-body"><div id="oa-slots"></div><div id="oa-slot-legend"></div>' +
      '<p class="note">Every slot in the table. Runs of occupied slots are clusters, and a probe ' +
      'that lands in one has to walk it. Red slots are tombstones: they stop nothing and cost ' +
      'everything.</p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="grid-even" style="margin-top:.875rem">' +
      '<div class="card"><div class="card-header">Probes against load factor</div>' +
      '<div class="card-body"><div id="oa-chart"></div><div id="oa-legend"></div>' +
      '<p class="note">The 1/(1−α) wall is real and it is close: at α = 0.9 a linear-probing lookup ' +
      'averages 5.5 probes, at α = 0.95 it averages 10.5.</p></div></div>' +
      '<div class="card"><div class="card-header">One probe walk</div>' +
      '<div class="card-body"><div id="oa-walk" class="mono" style="font-size:.8125rem"></div>' +
      '<p class="note">The slots a single lookup visits, in order, with the state of each.</p>' +
      '</div></div>' +
      '</div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
