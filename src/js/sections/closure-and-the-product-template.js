/** Markup for "Closure properties and the product construction". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ClosureTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'clo-first', kind: 'select', label: 'the first language', value: '(a|b)*abb',
      options: [
        { value: '(a|b)*abb', label: '(a|b)*abb — ends in abb' },
        { value: 'a*b*', label: 'a*b* — a run of a then a run of b' },
        { value: '(b|ab*a)*', label: '(b|ab*a)* — an even number of a' },
        { value: '(a|b)(a|b)(a|b)', label: '(a|b)(a|b)(a|b) — exactly three symbols' }
      ] },
    { id: 'clo-second', kind: 'select', label: 'the second language', value: '(a|b)*b',
      options: [
        { value: '(a|b)*b', label: '(a|b)*b — ends in b' },
        { value: '((a|b)(a|b))*', label: '((a|b)(a|b))* — even length' },
        { value: 'a(a|b)*', label: 'a(a|b)* — starts with a' },
        { value: '(a|b)*', label: '(a|b)* — everything' }
      ] },
    { id: 'clo-operation', kind: 'select', label: 'the operation', value: 'intersection',
      options: [
        { value: 'intersection', label: 'intersection — both accept' },
        { value: 'union', label: 'union — either accepts' },
        { value: 'difference', label: 'difference — the first and not the second' },
        { value: 'symmetric', label: 'symmetric difference — exactly one accepts' }
      ] }
  ];

  const METRICS = [
    { id: 'clo-states', label: 'Product states', note: 'reachable pairs, out of the whole grid' },
    { id: 'clo-shortest', label: 'Shortest word in the result', note: 'or empty, if there is none' },
    { id: 'clo-contains', label: 'First is contained in second', note: 'with a counter-example when not' },
    { id: 'clo-equivalent', label: 'Languages equivalent', note: 'checked in both directions' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Two languages and an operation', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The answer, with its witness</div>' +
      '<div class="card-body"><div id="clo-answer"></div>' +
      '<p class="note" id="clo-answer-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The product states, and how each one decides</div>' +
      '<div class="card-body"><table class="ref-table" id="clo-pairs"><thead><tr>' +
      '<th>Pair</th><th>First accepts</th><th>Second accepts</th><th>Result accepts</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="clo-pairs-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">One construction, four accepting rules</div>' +
      '<div class="card-body"><table class="ref-table" id="clo-rules"><thead><tr>' +
      '<th>Operation</th><th>Accepting when</th><th>States</th><th>Shortest word</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="clo-rules-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The closure properties, and what each construction costs</div>' +
      '<div class="card-body"><table class="ref-table" id="clo-properties"><thead><tr>' +
      '<th>Operation</th><th>Construction</th><th>State cost</th><th>The catch</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="clo-properties-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
