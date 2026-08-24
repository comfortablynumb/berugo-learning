/** Markup for "Nondeterminism and the subset construction". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SubsetTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'sub-pattern', kind: 'select', label: 'the pattern', value: '(a|b)*abb',
      options: [
        { value: '(a|b)*abb', label: '(a|b)*abb — ends in abb' },
        { value: '(a|b)*a(a|b)', label: '(a|b)*a(a|b) — an a, two from the end' },
        { value: '(a|b)*a(a|b)(a|b)', label: '(a|b)*a(a|b)(a|b) — three from the end' },
        { value: 'a*b*', label: 'a*b* — a run of a then a run of b' }
      ] },
    { id: 'sub-input', kind: 'select', label: 'the input to trace', value: 'aabb',
      options: [
        { value: 'aabb', label: 'aabb' },
        { value: 'abab', label: 'abab' },
        { value: 'babb', label: 'babb' },
        { value: 'bbbb', label: 'bbbb' }
      ] }
  ];

  const METRICS = [
    { id: 'sub-nfa', label: 'NFA states', note: 'after removing ε-transitions' },
    { id: 'sub-dfa', label: 'DFA states', note: 'built by the subset construction' },
    { id: 'sub-min', label: 'After minimisation', note: 'the smallest machine for this language' },
    { id: 'sub-equiv', label: 'Languages agree', note: 'NFA against DFA, exhaustively' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Pattern and input', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The set of active states, symbol by symbol</div>' +
      '<div class="card-body"><div id="sub-trace"></div>' +
      '<p class="note" id="sub-trace-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The subset construction, one state at a time</div>' +
      '<div class="card-body"><table class="ref-table" id="sub-steps"><thead><tr>' +
      '<th>From</th><th>Symbol</th><th>To</th><th>New state</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="sub-steps-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Each DFA state is a set of NFA states</div>' +
      '<div class="card-body"><table class="ref-table" id="sub-subsets"><thead><tr>' +
      '<th>DFA state</th><th>NFA states it stands for</th><th>Accepting</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="sub-subsets-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The exponential family, measured against 2^(n+1)</div>' +
      '<div class="card-body"><table class="ref-table" id="sub-blowup"><thead><tr>' +
      '<th>n</th><th>NFA states</th><th>Positions</th><th>Subset construction</th>' +
      '<th>Minimal DFA</th><th>2^(n+1)</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="sub-blowup-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What real engines do instead</div>' +
      '<div class="card-body"><table class="ref-table" id="sub-engines"><thead><tr>' +
      '<th>Strategy</th><th>Cost per character</th><th>Memory</th><th>Where it is used</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="sub-engines-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
