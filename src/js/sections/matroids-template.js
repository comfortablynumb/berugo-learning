/** Markup for "Matroids: when greedy is provably right". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MatroidsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'mtr-system', kind: 'select', label: 'independence system', value: 'graphic',
      options: [{ value: 'graphic', label: 'graphic — acyclic edge sets (Kruskal)' },
        { value: 'uniform', label: 'uniform — at most k elements' },
        { value: 'partition', label: 'partition — a quota per group' },
        { value: 'matching', label: 'matchings in a graph — NOT a matroid' },
        { value: 'handmade', label: 'a hand-written family — NOT a matroid' }] },
    { id: 'mtr-ground', kind: 'range', label: 'ground-set size', value: 8, min: 4, max: 14, step: 1 },
    { id: 'mtr-k', kind: 'range', label: 'k (uniform) / quota (partition)', value: 3, min: 1, max: 6, step: 1 },
    { id: 'mtr-seed', kind: 'range', label: 'instance seed', value: 5, min: 1, max: 30, step: 1 }
  ];

  const METRICS = [
    { id: 'mtr-verdict', label: 'Is it a matroid?', note: 'both properties, checked by enumeration' },
    { id: 'mtr-independent', label: 'Independent sets', note: 'of 2^n subsets asked about' },
    { id: 'mtr-greedy', label: 'Greedy weight', note: 'the generic algorithm over the oracle' },
    { id: 'mtr-best', label: 'Best possible weight', note: 'exhaustive over the independent sets' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The structure to test', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The two properties</div>' +
      '<div class="card-body"><table class="ref-table" id="mtr-properties"><thead><tr>' +
      '<th>Property</th><th>Holds?</th><th>Witness, when it does not</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mtr-properties-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Greedy against the truth, on every system</div>' +
      '<div class="card-body"><table class="ref-table" id="mtr-systems"><thead><tr>' +
      '<th>System</th><th>Matroid?</th><th>Greedy weight</th><th>Best weight</th><th>Greedy optimal?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mtr-systems-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The generic greedy algorithm, step by step</div>' +
      '<div class="card-body"><table class="ref-table" id="mtr-trace"><thead><tr>' +
      '<th>Step</th><th>Element</th><th>Weight</th><th>Kept?</th><th>Running weight</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mtr-trace-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Kruskal is this code with an acyclicity oracle</div>' +
      '<div class="card-body"><table class="ref-table" id="mtr-kruskal"><thead><tr>' +
      '<th>Run</th><th>Edges taken</th><th>Total weight</th><th>Oracle calls</th><th>Matches the reference?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="mtr-kruskal-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
