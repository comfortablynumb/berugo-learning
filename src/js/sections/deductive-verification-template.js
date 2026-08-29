/** Markup for "Deductive verification". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.VerifyTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function build(Vc) {
    const v = Vc.variable;
    const n = Vc.number;
    const c = Vc.condition;
    const bounds = [c(v('lo'), 'ge', n(0)), c(v('hi'), 'ge', v('lo')),
      c(v('hi'), 'le', n(1000))];

    return {
      midpoint: {
        about: 'the midpoint of a binary search, written the way everybody wrote it for '
          + 'twenty years',
        source: 'requires lo >= 0, hi >= lo, hi <= 1000\n  sum = lo + hi\n'
          + '  assert sum <= 1000   // and then mid = sum / 2',
        requires: bounds,
        body: [
          { op: 'assign', name: 'sum', expr: Vc.plus(v('lo'), v('hi')) },
          { op: 'assert', label: 'the sum stays inside the range',
            cond: c(v('sum'), 'le', n(1000)) }
        ]
      },
      midpointFixed: {
        about: 'the same midpoint with the addition rearranged so it cannot leave the range',
        source: 'requires lo >= 0, hi >= lo, hi <= 1000\n  sum = lo + (hi - lo)\n'
          + '  assert sum <= 1000   // and then mid = lo + (hi - lo) / 2',
        requires: bounds,
        body: [
          { op: 'assign', name: 'sum', expr: Vc.plus(v('lo'), Vc.minus(v('hi'), v('lo'))) },
          { op: 'assert', label: 'the sum stays inside the range',
            cond: c(v('sum'), 'le', n(1000)) }
        ]
      },
      counting: countingProgram(Vc, [c(v('i'), 'ge', n(0)), c(v('i'), 'le', v('n'))]),
      countingWeak: countingProgram(Vc, []),
      max: {
        about: 'a branch, and a postcondition that has to hold on both sides of it',
        source: 'if (a >= b) { m = a } else { m = b }\n'
          + '  assert m >= a\n  assert m >= b',
        requires: [],
        body: [
          { op: 'if', cond: c(v('a'), 'ge', v('b')),
            then: branchBody(Vc, 'a'), other: branchBody(Vc, 'b') }
        ]
      }
    };
  }

  function branchBody(Vc, name) {
    const v = Vc.variable;
    const c = Vc.condition;

    return [
      { op: 'assign', name: 'm', expr: v(name) },
      { op: 'assert', label: 'the result is at least a', cond: c(v('m'), 'ge', v('a')) },
      { op: 'assert', label: 'the result is at least b', cond: c(v('m'), 'ge', v('b')) }
    ];
  }

  function countingProgram(Vc, invariant) {
    const v = Vc.variable;
    const n = Vc.number;
    const c = Vc.condition;

    return {
      about: invariant.length
        ? 'a counting loop with the invariant written down'
        : 'the same loop with the invariant left out, which does not weaken the proof — it '
          + 'removes it',
      source: 'requires n >= 0\n  i = 0\n  while (i < n)' +
        (invariant.length ? '\n    invariant i >= 0, i <= n' : '\n    // no invariant') +
        '\n  { i = i + 1 }\n  assert i >= 0\n  assert i >= n',
      requires: [c(v('n'), 'ge', n(0))],
      body: [
        { op: 'assign', name: 'i', expr: n(0) },
        { op: 'while', cond: c(v('i'), 'lt', v('n')), invariant: invariant,
          body: [{ op: 'assign', name: 'i', expr: Vc.plus(v('i'), n(1)) }] },
        { op: 'assert', label: 'the counter never went negative',
          cond: c(v('i'), 'ge', n(0)) },
        { op: 'assert', label: 'the loop ran to the bound', cond: c(v('i'), 'ge', v('n')) }
      ]
    };
  }

  const CONTROLS = [
    { id: 'dvf-program', kind: 'select', label: 'annotated programme', value: 'midpoint',
      options: [
        { value: 'midpoint', label: 'the binary-search midpoint, as everyone wrote it' },
        { value: 'midpointFixed', label: 'the midpoint, rearranged' },
        { value: 'counting', label: 'a counting loop with its invariant' },
        { value: 'countingWeak', label: 'the same loop with the invariant left out' },
        { value: 'max', label: 'a branch with a postcondition on both sides' }
      ] }
  ];

  const METRICS = [
    { id: 'dvf-vcs', label: 'Verification conditions', note: 'one logical claim each' },
    { id: 'dvf-discharged', label: 'Discharged', note: 'the solver refuted the negation' },
    { id: 'dvf-failed', label: 'Not discharged', note: 'and every one has a counter-example' },
    { id: 'dvf-integer', label: 'With an integer counter-example',
      note: 'a state the program can really be in' },
    { id: 'dvf-rational', label: 'Refuted only over the rationals',
      note: 'the theory is weaker than the program' },
    { id: 'dvf-paths', label: 'Paths through the programme',
      note: 'a loop is cut at its invariant, so this is finite' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Annotations in, verification conditions out',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The annotated programme</div>' +
      '<div class="card-body"><pre class="code-block" id="dvf-source"></pre>' +
      '<p class="note" id="dvf-source-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('dvf-vc-table', 'Every verification condition, and what the solver did with it',
        ['Where it comes from', 'The claim', 'Verdict', 'What the solver found']) +
      card('dvf-detail', 'One condition in full: what may be assumed, and what must follow',
        ['Role', 'Statement', 'Holds in the counter-example?']) +
      chartCard() +
      card('dvf-pipeline', 'The three stages, and what each one can be wrong about',
        ['Stage', 'What goes in', 'What comes out', 'How it fails']);
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Conditions generated and discharged, per programme</div>' +
      '<div class="card-body"><div id="dvf-chart" class="chart-host"></div>' +
      '<p class="note" id="dvf-chart-note"></p></div></div>';
  }

  function card(id, title, columns) {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">' + title + '</div>' +
      '<div class="card-body"><table class="ref-table" id="' + id + '"><thead><tr>' +
      columns.map(function (name) { return '<th>' + name + '</th>'; }).join('') +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="' + id + '-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, build: build };
}));
