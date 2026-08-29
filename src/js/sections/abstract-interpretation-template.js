/** Markup for "Abstract interpretation". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AbstractInterpTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const SAMPLES = {
    small: { source: 'let x = 0;\nlet n = 10;\nwhile (x < n) { x = x + 2; }\nlet r = x;',
      about: 'the loop everything in this section is measured on: ten, in twos' },
    large: { source: 'let x = 0;\nlet n = 1000;\nwhile (x < n) { x = x + 2; }\nlet r = x;',
      about: 'the same loop with a bound a hundred times further away' },
    unknown: { source: 'fn count(n) {\n  let x = 0;\n  while (x < n) { x = x + 2; }\n'
      + '  return x;\n}\nlet r = count(10);',
      about: 'the bound is a parameter, so no run can tell you what it is',
      params: { n: 10 }, names: ['n'] },
    nested: { source: 'let i = 0;\nlet t = 0;\nwhile (i < 5) { let j = 0; '
      + 'while (j < 3) { t = t + 1; j = j + 1; } i = i + 1; }\nlet r = t;',
      about: 'two loops, and only the inner one comes back from the widening' },
    branch: { source: 'let a = 4;\nlet b = 0;\nif (a > 2) { b = a - 1; } else { b = 0 - a; }\n'
      + 'let r = b;',
      about: 'no loop at all: a join, and the refinement each branch carries' }
  };

  const CONTROLS = [
    { id: 'abs-sample', kind: 'select', label: 'programme', value: 'small',
      options: [
        { value: 'small', label: 'a loop counting to ten in twos' },
        { value: 'large', label: 'the same loop counting to a thousand' },
        { value: 'unknown', label: 'a loop whose bound is a parameter' },
        { value: 'nested', label: 'two nested loops' },
        { value: 'branch', label: 'a branch with no loop' }
      ] },
    { id: 'abs-domain', kind: 'select', label: 'abstract domain', value: 'interval',
      options: [
        { value: 'interval', label: 'intervals — a lower and an upper bound' },
        { value: 'sign', label: 'signs — negative, zero, positive' },
        { value: 'parity', label: 'parity — even or odd' }
      ] },
    { id: 'abs-widen', kind: 'checkbox', label: 'widen at loop headers', value: true },
    { id: 'abs-narrow', kind: 'checkbox', label: 'narrow afterwards', value: true }
  ];

  const METRICS = [
    { id: 'abs-rounds', label: 'Rounds of the ascending pass',
      note: 'one sweep of every block is one round' },
    { id: 'abs-fixpoint', label: 'Reached a fixpoint', note: 'a round that changed nothing' },
    { id: 'abs-widenings', label: 'Widening steps', note: 'applied at loop headers only' },
    { id: 'abs-narrowings', label: 'Narrowing steps', note: 'the descending pass' },
    { id: 'abs-top', label: 'Claims that say nothing',
      note: 'the top of the lattice rules nothing out' },
    { id: 'abs-unsound', label: 'Values the run produced outside the claim',
      note: 'anything but zero is a broken analysis' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'One loop, one lattice, four operators',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The programme</div>' +
      '<div class="card-body"><pre class="code-block" id="abs-source"></pre>' +
      '<p class="note" id="abs-source-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('abs-chain', 'The ascending chain, one row per round',
        ['Pass', 'Round', 'Loop header', 'What the header knows', 'What changed']) +
      chartCard() +
      card('abs-points', 'Every program point, against what the run actually did',
        ['Block', 'Role', 'Variable', 'The analysis claims', 'The run produced', 'Verdict']) +
      card('abs-domains', 'The same programme in three domains',
        ['Domain', 'What one value can express', 'Height of the chain', 'Claims at the top',
          'Rounds', 'Why it terminates']) +
      card('abs-operators', 'The four operators, and which question each answers',
        ['Operator', 'Where it applies', 'What it does', 'What it costs you']);
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Rounds to a fixpoint, against how far the loop counts</div>' +
      '<div class="card-body"><div id="abs-chart" class="chart-host"></div>' +
      '<div id="abs-legend" class="legend-host"></div>' +
      '<p class="note" id="abs-chart-note"></p></div></div>';
  }

  function card(id, title, columns) {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">' + title + '</div>' +
      '<div class="card-body"><table class="ref-table" id="' + id + '"><thead><tr>' +
      columns.map(function (name) { return '<th>' + name + '</th>'; }).join('') +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="' + id + '-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, SAMPLES: SAMPLES };
}));
