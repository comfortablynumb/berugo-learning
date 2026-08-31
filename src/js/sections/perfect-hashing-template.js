/** Markup for "Perfect and minimal perfect hashing". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PerfectHashingTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ph-keys', kind: 'range', label: 'keys in the static set', value: 500, min: 50, max: 4000, step: 50 },
    { id: 'ph-lambda', kind: 'range', label: 'CHD keys per bucket (λ)', value: 4, min: 1, max: 8, step: 1,
      note: 'Larger λ means fewer displacements to store and a longer search to find them.' },
    { id: 'ph-set', kind: 'select', label: 'key set', value: 'words',
      options: [{ value: 'words', label: 'word-like (a keyword table)' },
        { value: 'sequential', label: 'sequential identifiers' },
        { value: 'random', label: 'random tokens' }] }
  ];

  const METRICS = [
    { id: 'ph-fks', label: 'FKS space', note: 'slots per key, including both levels' },
    { id: 'ph-chd', label: 'CHD bits per key', note: 'the displacement array is the whole structure' },
    { id: 'ph-probes', label: 'Lookup cost', note: 'probes to find a key that is present' },
    { id: 'ph-build', label: 'Build cost', note: 'seed and displacement trials' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Static key set', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Where the keys land</div>' +
      '<div class="card-body"><div id="ph-slots"></div>' +
      '<p class="note">A minimal perfect hash fills every slot exactly once: no empty slots, no ' +
      'collisions, and no comparison chain to walk.</p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="grid-even" style="margin-top:.875rem">' +
      '<div class="card"><div class="card-header">Space against a hash table</div>' +
      '<div class="card-body"><div id="ph-chart"></div><div id="ph-legend"></div>' +
      '<p class="note">A hash table has to keep the keys to answer "is this key present". A perfect ' +
      'hash need not, if you already know every lookup is for a key in the set.</p></div></div>' +
      '<div class="card"><div class="card-header">Construction trace</div>' +
      '<div class="card-body"><div id="ph-trace" class="mono" style="font-size:.8125rem"></div>' +
      '<p class="note">FKS retries a seed per bucket; CHD searches a displacement per bucket, ' +
      'largest bucket first, which is what makes the search converge.</p></div></div>' +
      '</div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
