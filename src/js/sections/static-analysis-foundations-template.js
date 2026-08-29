/** Markup for "Foundations of static analysis". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.FoundationsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const SAMPLES = {
    counting: 'let x = 0;\nlet n = 10;\nwhile (x < n) { x = x + 2; }\nlet r = x;',
    branching: 'let a = 4;\nlet b = 0;\nif (a > 2) { b = a - 1; } else { b = 0 - a; }\nlet r = b;',
    nested: 'let i = 0;\nlet t = 0;\nwhile (i < 5) { let j = 0; '
      + 'while (j < 3) { t = t + 1; j = j + 1; } i = i + 1; }\nlet r = t;',
    straight: 'let a = 3;\nlet b = 4;\nlet c = a * b;\nlet r = c - 2;'
  };

  const CONTROLS = [
    { id: 'saf-sample', kind: 'select', label: 'programme', value: 'counting',
      options: [
        { value: 'counting', label: 'a loop counting to ten in twos' },
        { value: 'branching', label: 'a branch on the sign of a value' },
        { value: 'nested', label: 'two nested loops' },
        { value: 'straight', label: 'straight-line arithmetic' }
      ] },
    { id: 'saf-precision', kind: 'select', label: 'precision level', value: 'narrow',
      options: [
        { value: 'sign', label: 'sign — negative, zero or positive' },
        { value: 'parity', label: 'parity — even or odd' },
        { value: 'widen', label: 'intervals, widening only' },
        { value: 'narrow', label: 'intervals, widening then narrowing' }
      ] }
  ];

  const METRICS = [
    { id: 'saf-sound', label: 'Values observed outside the claim',
      note: 'unsoundness, which is a bug' },
    { id: 'saf-exact', label: 'Claims exactly matching what happened',
      note: 'of the claims this run reached' },
    { id: 'saf-unbounded', label: 'Claims that say nothing',
      note: 'the analysis reached the top of its lattice' },
    { id: 'saf-observations', label: 'Observations the check is based on',
      note: 'no observations proves nothing' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'One programme, one property, four precisions',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The programme</div>' +
      '<div class="card-body"><pre class="code-block" id="saf-source"></pre>' +
      '<p class="note" id="saf-source-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('saf-levels', 'The same property at four precision levels',
        ['Precision', 'What it can say', 'Claims', 'Exact', 'Saying nothing',
          'Values outside the claim']) +
      card('saf-claims', 'Every claim this run reached, against what happened',
        ['Block', 'Variable', 'The analysis says', 'The run did', 'Distinct values',
          'Verdict']) +
      card('saf-quadrant', 'Sound, complete, both or neither',
        ['Behaviour', 'Reports every real problem', 'Reports only real problems',
          'Classification', 'What its silence means']) +
      card('saf-axes', 'The precision axes, and what each one costs',
        ['Axis', 'What it distinguishes', 'What it costs', 'Where it is usually dropped']);
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
