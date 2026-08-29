/** Markup for "Fuzzing". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.FuzzTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const TARGETS = {
    frontEnd: { label: 'the Berugo front end — lex, parse, resolve, typecheck, desugar',
      seeds: ['let x = 1;', 'fn f(a) { return a; }'],
      about: 'a real compiler front end whose contract is to REPORT errors rather than raise '
        + 'them, so any input that makes it throw is a bug' },
    brackets: { label: 'a bracket matcher with two planted defects',
      seeds: ['()', '[]'],
      about: 'depth counting instead of a stack: it accepts `[)` without crashing, and it '
        + 'throws at a nesting depth of seven' }
  };

  const CONTROLS = [
    { id: 'cgf-target', kind: 'select', label: 'target', value: 'brackets',
      options: Object.keys(TARGETS).map(function (id) {
        return { value: id, label: TARGETS[id].label };
      }) },
    { id: 'cgf-oracles', kind: 'select', label: 'oracles in use', value: 'all',
      options: [
        { value: 'crash', label: 'crashes only — what a fuzzer without an oracle finds' },
        { value: 'all', label: 'crashes, invariants and a differential reference' }
      ] },
    { id: 'cgf-iterations', kind: 'range', label: 'mutations', value: 1200, min: 200,
      max: 3000, step: 200 },
    { id: 'cgf-seed', kind: 'range', label: 'random seed', value: 7, min: 1, max: 12,
      step: 1 }
  ];

  const METRICS = [
    { id: 'cgf-executions', label: 'Executions', note: 'inputs run against the target' },
    { id: 'cgf-edges', label: 'Coverage reached', note: 'distinct behaviours the corpus covers' },
    { id: 'cgf-corpus', label: 'Corpus', note: 'inputs kept because they covered something new' },
    { id: 'cgf-findings', label: 'Findings', note: 'distinct failures, deduplicated' },
    { id: 'cgf-minimised', label: 'Corpus after minimisation',
      note: 'the same coverage from fewer inputs' },
    { id: 'cgf-bytes', label: 'Bytes saved by minimising', note: 'and no coverage lost' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Mutate, run, keep what covers something new',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The target</div>' +
      '<div class="card-body"><pre class="code-block" id="cgf-target-text"></pre>' +
      '<p class="note" id="cgf-target-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      chartCard() +
      card('cgf-findings-table', 'What it found, and how small the input shrank',
        ['Oracle', 'Input found', 'After shrinking', 'Times hit', 'What is wrong']) +
      card('cgf-oracle-table', 'The three oracles, and what each one can see',
        ['Oracle', 'What it checks', 'Findings here', 'What it cannot see']) +
      card('cgf-corpus-table', 'The corpus: inputs kept for the coverage they added',
        ['Input', 'Bytes', 'Edges covered', 'Kept after minimisation']) +
      card('cgf-mutators', 'The mutation operators, and why the corpus is the state',
        ['Operator', 'What it does', 'What it is for']);
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Coverage against executions — the curve every fuzzing report '
      + 'shows</div><div class="card-body"><div id="cgf-chart" class="chart-host"></div>' +
      '<div id="cgf-legend" class="legend-host"></div>' +
      '<p class="note" id="cgf-chart-note"></p></div></div>';
  }

  function card(id, title, columns) {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">' + title + '</div>' +
      '<div class="card-body"><table class="ref-table" id="' + id + '"><thead><tr>' +
      columns.map(function (name) { return '<th>' + name + '</th>'; }).join('') +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="' + id + '-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, TARGETS: TARGETS };
}));
