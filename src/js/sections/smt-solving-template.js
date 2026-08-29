/** Markup for "SMT solving". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SmtTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function euf(left, right, equal) {
    return { left: left, right: right, equal: equal !== false };
  }

  function diff(left, right, bound) {
    return { left: left, right: right, bound: bound, equal: true };
  }

  /** The padded family: one real conflict plus k independent free choices,
   *  which multiply the boolean models without touching the theory conflict. */
  function padded(k) {
    const atoms = [euf('a', 'b'), euf('f(a)', 'f(b)')];
    const clauses = [[1], [-2]];

    for (let at = 1; at <= k; at += 1) {
      atoms.push(euf('u' + at, 'v' + at));
      atoms.push(euf('u' + at, 'w' + at));
      clauses.push([atoms.length - 1, atoms.length]);
    }
    return { theory: 'euf', atoms: atoms, clauses: clauses };
  }

  const PROBLEMS = {
    congruence: { theory: 'euf', atoms: [euf('a', 'b'), euf('f(a)', 'f(b)')],
      clauses: [[1], [-2]],
      about: 'equal arguments must give equal results, which is the congruence rule and the '
        + 'only thing an uninterpreted function is assumed to obey' },
    transitive: { theory: 'euf',
      atoms: [euf('a', 'b'), euf('b', 'c'), euf('f(a)', 'f(c)')],
      clauses: [[1], [2], [-3]],
      about: 'transitivity through the union-find, then congruence on top of it' },
    choice: { theory: 'euf',
      atoms: [euf('a', 'b'), euf('b', 'c'), euf('a', 'c'), euf('f(a)', 'f(c)')],
      clauses: [[1, 3], [2, 3], [-4]],
      about: 'two ways to reach the same contradiction, so the core has to be refuted twice' },
    cycle: { theory: 'difference',
      atoms: [diff('x', 'y', 3), diff('y', 'z', -2), diff('z', 'x', -2)],
      clauses: [[1], [2], [3]],
      about: 'three difference constraints round a cycle whose weights sum below zero' },
    feasible: { theory: 'difference',
      atoms: [diff('x', 'y', 3), diff('y', 'z', -2), diff('z', 'x', 4)],
      clauses: [[1], [2], [3]],
      about: 'the same shape with one weight changed, so the cycle is no longer negative' }
  };

  const CONTROLS = [
    { id: 'smt-problem', kind: 'select', label: 'problem', value: 'choice',
      options: [
        { value: 'congruence', label: 'a = b, and f(a) is not f(b)' },
        { value: 'transitive', label: 'a = b, b = c, and f(a) is not f(c)' },
        { value: 'choice', label: 'two routes to the same contradiction' },
        { value: 'cycle', label: 'difference logic: a negative cycle' },
        { value: 'feasible', label: 'difference logic: a feasible system' },
        { value: 'padded', label: 'one conflict plus k free choices' }
      ] },
    { id: 'smt-explain', kind: 'select', label: 'what the theory returns', value: 'minimal',
      options: [
        { value: 'minimal', label: 'a minimised core — the literals that really clash' },
        { value: 'full', label: 'the whole assignment — the degenerate lazy solver' }
      ] },
    { id: 'smt-pad', kind: 'range', label: 'free choices in the padded problem', value: 3,
      min: 0, max: 5, step: 1 }
  ];

  const METRICS = [
    { id: 'smt-verdict', label: 'Verdict', note: 'and whether brute force agrees' },
    { id: 'smt-rounds', label: 'Rounds of the loop',
      note: 'each one is a model the theory refuted' },
    { id: 'smt-size', label: 'Atoms and clauses', note: 'the boolean skeleton the core sees' },
    { id: 'smt-explanation', label: 'Average explanation',
      note: 'literals the theory blamed per refutation' },
    { id: 'smt-brute', label: 'Assignments brute force tried',
      note: 'the oracle: every boolean model, theory-checked' },
    { id: 'smt-checked', label: 'Answer re-checked',
      note: 'skeleton and theory model, by code outside the solver' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A SAT core that knows nothing, and a theory that '
        + 'knows one thing', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The problem</div>' +
      '<div class="card-body"><pre class="code-block" id="smt-problem-text"></pre>' +
      '<p class="note" id="smt-problem-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('smt-loop', 'The DPLL(T) loop, round by round',
        ['Round', 'Stage', 'Outcome', 'Literals asserted', 'Explanation', 'Clause sent back']) +
      card('smt-atoms', 'The atoms, and what the final model says about them',
        ['#', 'Atom', 'In the last model', 'Role']) +
      chartCard() +
      card('smt-theories', 'What each theory decides, and how it explains itself',
        ['Theory', 'The atoms it takes', 'How it decides', 'What its explanation is',
          'Where it stops']);
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Rounds against free choices: what a good explanation is worth' +
      '</div><div class="card-body"><div id="smt-chart" class="chart-host"></div>' +
      '<div id="smt-legend" class="legend-host"></div>' +
      '<p class="note" id="smt-chart-note"></p></div></div>';
  }

  function card(id, title, columns) {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">' + title + '</div>' +
      '<div class="card-body"><table class="ref-table" id="' + id + '"><thead><tr>' +
      columns.map(function (name) { return '<th>' + name + '</th>'; }).join('') +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="' + id + '-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS,
    PROBLEMS: PROBLEMS, padded: padded };
}));
