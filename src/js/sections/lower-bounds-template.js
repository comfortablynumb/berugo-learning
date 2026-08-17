/** Markup for "Lower bounds and adversary arguments". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LowerBoundsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function indexOptions(n) {
    const out = [];
    for (let i = 0; i < n; i += 1) out.push({ value: String(i), label: 'a[' + i + ']' });
    return out;
  }

  const CONTROLS = function () {
    return [
      { id: 'lb-n', kind: 'select', label: 'elements', value: '4',
        options: [{ value: '3', label: '3 (6 permutations)' }, { value: '4', label: '4 (24 permutations)' },
          { value: '5', label: '5 (120 permutations)' }] },
      { id: 'lb-i', kind: 'select', label: 'compare', value: '0', options: indexOptions(5) },
      { id: 'lb-j', kind: 'select', label: 'against', value: '1', options: indexOptions(5) },
      { id: 'lb-ask', kind: 'button', label: 'Ask (adversary answers)', primary: true },
      { id: 'lb-reset', kind: 'button', label: 'Reset' },
      { id: 'lb-adversary', kind: 'button', label: 'Run max-finding against the adversary' }
    ];
  };

  const METRICS = [
    { id: 'lb-remaining', label: 'Orders still possible', note: 'consistent with every answer so far' },
    { id: 'lb-asked', label: 'Comparisons used', note: 'against the information-theoretic floor' },
    { id: 'lb-bound', label: 'Floor ⌈log₂ n!⌉', note: 'no comparison sort can beat this' },
    { id: 'lb-max', label: 'Max-finding verdict', note: 'n − 1 comparisons, or the claim is unsound' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Ask a comparison', controls: CONTROLS() }) +
      '<div class="card"><div class="card-header">Remaining consistent orders</div>' +
      '<div class="card-body"><div id="lb-live" class="mono" style="font-size:.75rem"></div>' +
      '<div id="lb-history" style="margin-top:.5rem"></div></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS);
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
