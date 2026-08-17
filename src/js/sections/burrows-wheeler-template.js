/** Markup for "Burrows–Wheeler transform and the FM-index". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BurrowsWheelerTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'bw-text', kind: 'text', label: 'text', value: 'mississippi', maxLength: 30,
      note: 'Short enough to draw the whole rotation matrix, which is what the transform is defined as.' },
    { id: 'bw-pattern', kind: 'text', label: 'pattern', value: 'issi', maxLength: 20,
      note: 'Counted by backward search — right to left, two rank queries per character.' },
    { id: 'bw-block', kind: 'range', label: 'rank checkpoint every', value: 32, min: 4, max: 256, step: 4,
      suffix: 'positions' },
    { id: 'bw-corpus', kind: 'select', label: 'measure on', value: 'dna',
      options: [{ value: 'dna', label: 'DNA, 4 000 characters' },
        { value: 'logs', label: 'log lines — heavily repetitive' },
        { value: 'english', label: 'English, 4 000 characters' },
        { value: 'random', label: 'random 26-letter text — the incompressible case' }] }
  ];

  const METRICS = [
    { id: 'bw-runs', label: 'Runs in the last column', note: 'fewer runs is a more compressible transform' },
    { id: 'bw-count', label: 'Occurrences', note: 'without ever reconstructing the text' },
    { id: 'bw-steps', label: 'Rank steps per count', note: 'set by the checkpoint spacing' },
    { id: 'bw-bytes', label: 'Bytes per character', note: 'last column, checkpoints and samples' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Text, pattern and the rank checkpoint spacing', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The sorted rotations: first column and last column</div>' +
      '<div class="card-body"><div id="bw-matrix"></div>' +
      '<p class="note" id="bw-matrix-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Backward search, one character at a time</div>' +
      '<div class="card-body"><div id="bw-search"></div>' +
      '<p class="note" id="bw-search-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Inverting with LF, without the matrix</div>' +
      '<div class="card-body"><pre class="step-work" id="bw-inverse"></pre>' +
      '<p class="note" id="bw-inverse-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What the checkpoint spacing trades</div>' +
      '<div class="card-body"><table class="ref-table" id="bw-block-table"><thead><tr>' +
      '<th>Checkpoint every</th><th>Checkpoint bytes</th><th>Bytes per character</th>' +
      '<th>Rank steps per count</th><th>Same answer</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bw-block-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
