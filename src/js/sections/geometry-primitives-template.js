/** Markup for "Primitives and robustness". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GeometryPrimitivesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'gp-family', kind: 'select', label: 'triple', value: 'near-collinear',
      options: [
        { value: 'near-collinear', label: 'near-collinear — one unit in the last place off the line' },
        { value: 'exactly-collinear', label: 'exactly collinear — the answer is 0' },
        { value: 'clear-left', label: 'clearly a left turn — no filter needed' },
        { value: 'kettner', label: 'the classroom example — Kettner et al.' }
      ] },
    { id: 'gp-offset', kind: 'range', label: 'how far off the line, in units of the last place',
      value: 1, min: 0, max: 24, step: 1 },
    { id: 'gp-trials', kind: 'range', label: 'triples in the sweep', value: 4000,
      min: 500, max: 12000, step: 500 },
    { id: 'gp-tolerance', kind: 'select', label: 'epsilon for the tolerance test', value: '1e-12',
      options: [
        { value: '1e-15', label: '1e-15 — tighter than the error it is meant to absorb' },
        { value: '1e-12', label: '1e-12 — the number people reach for' },
        { value: '1e-9', label: '1e-9 — comfortably larger' },
        { value: '1e-6', label: '1e-6 — obviously too big' }
      ] }
  ];

  const METRICS = [
    { id: 'gp-contradictions', label: 'Naive contradicts itself', note: 'of the triples swept' },
    { id: 'gp-epsilon-wrong', label: 'Epsilon answers wrongly', note: 'consistent, and not correct' },
    { id: 'gp-adaptive', label: 'Adaptive failures', note: 'contradictions plus wrong answers' },
    { id: 'gp-escalation', label: 'Escalations to exact', note: 'what robustness actually costs' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'One triple, and a sweep over many', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The three points, magnified until the gap is visible</div>' +
      '<div class="card-body"><div id="gp-scene"></div>' +
      '<p class="note" id="gp-scene-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">All six orderings of the same three points</div>' +
      '<div class="card-body"><table class="ref-table" id="gp-perms"><thead><tr>' +
      '<th>Ordering</th><th>Naive</th><th>Epsilon</th><th>Adaptive</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="gp-perms-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Consistency and correctness are different properties</div>' +
      '<div class="card-body"><table class="ref-table" id="gp-sweep"><thead><tr>' +
      '<th>Predicate</th><th>Contradicts itself</th><th>Wrong answer</th>' +
      '<th>Calls a real turn collinear</th><th>Verdict</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="gp-sweep-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What the filter costs on data that is not adversarial</div>' +
      '<div class="card-body"><table class="ref-table" id="gp-cost"><thead><tr>' +
      '<th>Input</th><th>Predicate calls</th><th>Escalated to exact</th><th>Rate</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="gp-cost-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
