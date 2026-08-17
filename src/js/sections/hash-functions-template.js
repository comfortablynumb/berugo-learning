/** Markup for "What a hash function has to do". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HashFunctionsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'hf-function', kind: 'select', label: 'hash function', value: 'murmur3',
      options: [{ value: 'murmur3', label: 'murmur3 (mix + finalise)' },
        { value: 'xx', label: 'xxhash32 finaliser' },
        { value: 'fnv-1a', label: 'FNV-1a (no finaliser)' },
        { value: 'djb2', label: 'djb2 (no finaliser)' },
        { value: 'weak', label: 'weak: one shift and an XOR' }] },
    { id: 'hf-keys', kind: 'select', label: 'key distribution', value: 'words',
      options: [{ value: 'words', label: 'word-like strings' },
        { value: 'sequential', label: 'sequential keys' },
        { value: 'clustered', label: 'clustered keys' },
        { value: 'random', label: 'random keys' }] },
    { id: 'hf-count', kind: 'range', label: 'keys', value: 4096, min: 512, max: 16384, step: 512 },
    { id: 'hf-buckets', kind: 'range', label: 'buckets', value: 512, min: 64, max: 2048, step: 64,
      note: 'Chi-squared is computed against a uniform expectation of keys / buckets.' },
    { id: 'hf-samples', kind: 'range', label: 'avalanche samples', value: 512, min: 64, max: 2048, step: 64,
      note: 'Below about 420 samples the 40-60% band is noise: the standard error of a cell is ' +
        'sqrt(0.25/n), and the worst of 1 024 cells strays outside the band by chance.' }
  ];

  const METRICS = [
    { id: 'hf-avalanche', label: 'Avalanche', note: 'tested against sampling error, not a fixed band' },
    { id: 'hf-range', label: 'Worst cell', note: 'deviation from 0.5, in standard errors' },
    { id: 'hf-chi', label: 'Chi-squared / dof', note: '1.0 is uniform' },
    { id: 'hf-collisions', label: 'Fullest bucket', note: 'against the expected mean' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Function and key set', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Avalanche matrix</div>' +
      '<div class="card-body"><div id="hf-avalanche-view"></div><div id="hf-legend"></div>' +
      '<p class="note">Row i, column j: how often flipping input bit i flips output bit j. ' +
      'A mixer that works is a flat field at 0.5; anything with visible structure has bits it ' +
      'never mixed.</p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="grid-2" style="margin-top:.875rem">' +
      '<div class="card"><div class="card-header">Bucket distribution</div>' +
      '<div class="card-body"><div id="hf-histogram"></div></div></div>' +
      '<div class="card"><div class="card-header">Composite keys: XOR against an ordered combine</div>' +
      '<div class="card-body"><div id="hf-combine" class="mono" style="font-size:.8125rem"></div>' +
      '<p class="note">Tuples of two 16-bit fields, every ordered pair. XOR maps (a, b) and (b, a) ' +
      'to the same value by construction.</p></div></div>' +
      '</div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
