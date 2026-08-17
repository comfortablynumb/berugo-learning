/** Markup for "Suffix automata and factor oracles". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SuffixAutomataTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'sm-text', kind: 'text', label: 'text', value: 'abbbaab', maxLength: 40,
      note: 'The automaton is rebuilt from scratch on every keystroke — it is an online construction.' },
    { id: 'sm-pattern', kind: 'text', label: 'test a string', value: 'aba', maxLength: 20,
      note: 'The automaton and a brute-force check both answer; they must agree.' },
    { id: 'sm-corpus', kind: 'select', label: 'measure on', value: 'dna',
      options: [{ value: 'dna', label: 'DNA, 2 000 characters' },
        { value: 'binary', label: 'a two-letter alphabet, 2 000 characters' },
        { value: 'english', label: 'English, 2 000 characters' },
        { value: 'repeat', label: '2 000 copies of one letter — no clones at all' },
        { value: 'fibonacci', label: 'the Fibonacci word' }] }
  ];

  const METRICS = [
    { id: 'sm-states', label: 'States', note: 'the bound is 2n − 1' },
    { id: 'sm-clones', label: 'Clones', note: 'the case every from-memory implementation gets wrong' },
    { id: 'sm-distinct', label: 'Distinct substrings', note: 'Σ (len − len(link)), cross-checked' },
    { id: 'sm-accepts', label: 'Accepts the test string', note: 'against brute force' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Text and a string to test', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Growth: states and transitions as characters arrive</div>' +
      '<div class="card-body"><div id="sm-chart"></div><div id="sm-legend"></div></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Construction, character by character</div>' +
      '<div class="card-body"><div id="sm-trace"></div>' +
      '<p class="note" id="sm-trace-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The factor oracle: the same shape with the clone step removed</div>' +
      '<div class="card-body"><pre class="step-work" id="sm-oracle"></pre>' +
      '<p class="note" id="sm-oracle-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Size against the other substring indexes</div>' +
      '<div class="card-body"><table class="ref-table" id="sm-size"><thead><tr>' +
      '<th>Structure</th><th>Units</th><th>Per character</th><th>Bytes per character</th><th>Agrees</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="sm-size-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
