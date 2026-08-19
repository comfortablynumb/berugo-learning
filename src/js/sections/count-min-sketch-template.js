/** Markup for "Count-min and count-sketch". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CountMinSketchTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'cms-width', kind: 'range', label: 'width w (counters per row)', value: 512, min: 64, max: 4096, step: 64,
      note: 'ε = e/w, so the additive error bound is (e/w)·N whatever the key set looks like.' },
    { id: 'cms-depth', kind: 'range', label: 'depth d (rows)', value: 5, min: 1, max: 9, step: 2,
      note: 'δ = e^−d: the probability the bound is exceeded for any one key.' },
    { id: 'cms-skew', kind: 'range', label: 'Zipf skew', value: 110, min: 0, max: 200, step: 10,
      suffix: '/100' },
    { id: 'cms-length', kind: 'range', label: 'stream length', value: 200000, min: 20000, max: 400000, step: 20000 },
    { id: 'cms-column', kind: 'select', label: 'estimator drawn in the scatter', value: 'plain',
      options: [{ value: 'plain', label: 'count-min — take the minimum' },
        { value: 'conservative', label: 'count-min with conservative update' },
        { value: 'signed', label: 'count-sketch — signed hashes, take the median' }] }
  ];

  const METRICS = [
    { id: 'cms-bound', label: 'Error bound ε·N', note: 'what the guarantee promises' },
    { id: 'cms-worst', label: 'Worst error measured', note: 'over every key in the stream' },
    { id: 'cms-under', label: 'Keys under-counted', note: 'count-min: must be zero' },
    { id: 'cms-bytes', label: 'Sketch memory', note: 'against an exact hash map' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Size the matrix, shape the stream', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Per-key truth against per-key estimate</div>' +
      '<div class="card-body"><div id="cms-scatter-chart"></div>' +
      '<div id="cms-scatter-legend"></div>' +
      '<p class="note" id="cms-scatter-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Three estimators over the identical matrix and the identical stream</div>' +
      '<div class="card-body"><table class="ref-table" id="cms-estimators"><thead><tr>' +
      '<th>Estimator</th><th>Mean absolute error</th><th>Worst error</th><th>Keys under-counted</th>' +
      '<th>Safe for</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="cms-estimators-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Heavy hitters, and what the sketch cannot do alone</div>' +
      '<div class="card-body"><pre class="step-work" id="cms-heavy"></pre>' +
      '<p class="note" id="cms-heavy-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The guarantee, checked against every key</div>' +
      '<div class="card-body"><pre class="step-work" id="cms-guarantee"></pre>' +
      '<p class="note" id="cms-guarantee-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
