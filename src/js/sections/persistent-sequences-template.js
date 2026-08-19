/** Markup for "Persistent queues: amortisation, laziness and real time". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PersistentSequencesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'psq-kind', kind: 'select', label: 'queue', value: 'banker',
      options: [{ value: 'strict', label: 'strict two-list queue' },
        { value: 'banker', label: 'banker’s queue (lazy, memoised)' },
        { value: 'realtime', label: 'real-time queue (incremental rotation)' }] },
    { id: 'psq-size', kind: 'range', label: 'queue length before the reuse', value: 512, min: 128, max: 2048, step: 128 },
    { id: 'psq-reuses', kind: 'range', label: 'times the same version is reused', value: 1000, min: 100, max: 2000, step: 100 }
  ];

  const METRICS = [
    { id: 'psq-steps', label: 'Steps per reuse', note: 'the same old version, called again and again' },
    { id: 'psq-worst', label: 'Worst single operation', note: 'during the reuse loop' },
    { id: 'psq-build', label: 'Worst operation while building', note: 'the spike the amortised bound hides' },
    { id: 'psq-ratio', label: 'Against the real-time queue', note: 'steps per reuse, as a ratio' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The queue, the length and the abuse', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Cost per operation over one ordinary run</div>' +
      '<div class="card-body"><div id="psq-chart"></div>' +
      '<div id="psq-chart-legend"></div>' +
      '<p class="note" id="psq-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Three queues, one adversary: reuse the version whose next tail rotates</div>' +
      '<div class="card-body"><table class="ref-table" id="psq-compare"><thead><tr>' +
      '<th>Queue</th><th>Steps / reuse</th><th>Worst reuse</th><th>Worst build</th>' +
      '<th>Suspensions forced</th><th>vs real-time</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="psq-compare-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Total steps for the whole reuse loop</div>' +
      '<div class="card-body"><div id="psq-bars"></div>' +
      '<p class="note" id="psq-bars-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
