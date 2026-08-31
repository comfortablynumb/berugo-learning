/** Markup for "Hash tables in the wild". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HashInPracticeTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'hp-size', kind: 'range', label: 'entries', value: 20000, min: 2000, max: 100000, step: 2000 },
    { id: 'hp-delete', kind: 'range', label: 'deletion rate', value: 20, min: 0, max: 60, step: 5, suffix: '%' },
    { id: 'hp-keys', kind: 'select', label: 'key type', value: 'words',
      options: [{ value: 'words', label: 'word-like strings' }, { value: 'sequential', label: 'sequential ids' },
        { value: 'clustered', label: 'clustered strings' }, { value: 'random', label: 'random strings' }] },
    { id: 'hp-runs', kind: 'range', label: 'timing runs', value: 5, min: 3, max: 15, step: 2,
      note: 'Timings are the median of this many runs; probe counts are exact and need no repetition.' }
  ];

  const METRICS = [
    { id: 'hp-best', label: 'Fewest probes', note: 'on this workload' },
    { id: 'hp-fastest', label: 'Fastest measured', note: 'median over the runs' },
    { id: 'hp-map', label: 'Native Map', note: 'the baseline you already have' },
    { id: 'hp-object', label: 'Plain object', note: 'after the first delete' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Workload', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Every scheme in this milestone, ranked</div>' +
      '<div class="card-body"><div id="hp-table"></div>' +
      '<p class="note">Probes are a property of the scheme; times are a property of this machine and ' +
      'this engine. Both are shown, and they disagree — which is the lesson.</p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="grid-even" style="margin-top:.875rem">' +
      '<div class="card"><div class="card-header">Insertion-ordered map with O(1) delete</div>' +
      '<div class="card-body"><div id="hp-ordered" class="mono" style="font-size:.8125rem"></div>' +
      '<p class="note">Delete punches a hole rather than splicing. Without compaction the backing ' +
      'array grows with the number of deletes while the map size stays flat.</p></div></div>' +
      '<div class="card"><div class="card-header">Key coercion and identity</div>' +
      '<div class="card-body"><div id="hp-coercion" class="mono" style="font-size:.8125rem"></div>' +
      '<p class="note">Object keys are strings; Map keys are values compared by SameValueZero. The ' +
      'difference is not academic — it changes what counts as the same key.</p></div></div>' +
      '</div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
