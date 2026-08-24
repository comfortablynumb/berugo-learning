/** Markup for "Regular expressions and their constructions". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RegexTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'rex-pattern', kind: 'select', label: 'the pattern', value: '(a|b)*abb',
      options: [
        { value: '(a|b)*abb', label: '(a|b)*abb' },
        { value: 'a*b*', label: 'a*b*' },
        { value: '(ab)+', label: '(ab)+' },
        { value: 'a?b?c', label: 'a?b?c' },
        { value: '((a|b)(a|b))*', label: '((a|b)(a|b))*' },
        { value: '(a|b)*a(a|b)(a|b)', label: '(a|b)*a(a|b)(a|b)' }
      ] },
    { id: 'rex-order', kind: 'select', label: 'state-elimination order', value: 'forward',
      options: [
        { value: 'forward', label: 'first state first' },
        { value: 'reverse', label: 'last state first' }
      ] }
  ];

  const METRICS = [
    { id: 'rex-thompson', label: 'Thompson states', note: 'two per operator, nothing shared' },
    { id: 'rex-glushkov', label: 'Glushkov states', note: 'one per literal position, no ε' },
    { id: 'rex-deriv', label: 'Derivative states', note: 'a DFA, with no graph built at all' },
    { id: 'rex-round', label: 'Round trip', note: 'regex → automaton → regex, checked' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Pattern and elimination order', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The regex read back off the machine</div>' +
      '<div class="card-body"><div id="rex-back"></div>' +
      '<p class="note" id="rex-back-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Three constructions, one language</div>' +
      '<div class="card-body"><table class="ref-table" id="rex-compare"><thead><tr>' +
      '<th>Construction</th><th>States</th><th>ε-edges</th><th>Deterministic</th>' +
      '<th>Agrees with the others</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rex-compare-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The derivatives, which ARE the DFA states</div>' +
      '<div class="card-body"><table class="ref-table" id="rex-derivatives"><thead><tr>' +
      '<th>Derivative</th><th>Matches ε</th><th>On a</th><th>On b</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rex-derivatives-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">State elimination, one removal at a time</div>' +
      '<div class="card-body"><table class="ref-table" id="rex-eliminate"><thead><tr>' +
      '<th>Removed</th><th>Edges left</th><th>Expression length</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rex-eliminate-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The extensions that stop being regular</div>' +
      '<div class="card-body"><table class="ref-table" id="rex-extensions"><thead><tr>' +
      '<th>Feature</th><th>Still regular</th><th>What it costs</th><th>What to do instead</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="rex-extensions-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
