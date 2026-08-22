/** Markup for "Regular expression engines". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RegexEnginesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'rgx-pattern', kind: 'text', label: 'pattern', value: '(a+)+b' },
    { id: 'rgx-input', kind: 'select', label: 'input family', value: 'aaa',
      options: [{ value: 'aaa', label: 'a repeated — the pathological family' },
        { value: 'aaab', label: 'a repeated then b — the matching family' },
        { value: 'mixed', label: 'a and b mixed' }] },
    { id: 'rgx-length', kind: 'range', label: 'input length shown in the metrics', value: 18, min: 4, max: 26, step: 1 },
    { id: 'rgx-budget', kind: 'range', label: 'backtracking step budget (thousands)', value: 2000, min: 100, max: 5000, step: 100 }
  ];

  const METRICS = [
    { id: 'rgx-back', label: 'Backtracking steps', note: 'for one match attempt' },
    { id: 'rgx-nfa', label: 'Thompson steps', note: 'the same pattern, the same input' },
    { id: 'rgx-ratio', label: 'Ratio', note: 'and what it does when the input grows by one' },
    { id: 'rgx-agree', label: 'Same verdict?', note: 'the two engines must agree wherever both finish' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The pattern and the input', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The Thompson NFA the pattern compiles to</div>' +
      '<div class="card-body"><div id="rgx-states"></div>' +
      '<p class="note" id="rgx-states-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">One curve is exponential and one is linear, on the same screen</div>' +
      '<div class="card-body"><div id="rgx-chart"></div><div id="rgx-legend"></div>' +
      '<table class="ref-table" id="rgx-growth"><thead><tr>' +
      '<th>Input length</th><th>Backtracking steps</th><th>Thompson steps</th><th>Ratio</th>' +
      '<th>State-set peak</th><th>Agree?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rgx-growth-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Which patterns are dangerous, and which are not</div>' +
      '<div class="card-body"><table class="ref-table" id="rgx-patterns"><thead><tr>' +
      '<th>Pattern</th><th>Steps at n = 12</th><th>Steps at n = 20</th><th>Growth per 8 characters</th>' +
      '<th>Thompson at n = 20</th><th>Verdict</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rgx-patterns-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Both engines on a fixture set</div>' +
      '<div class="card-body"><div id="rgx-fixtures"></div>' +
      '<p class="note" id="rgx-fixtures-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
