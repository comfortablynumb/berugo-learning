/** Markup for "Push-relabel and modern flow". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PushRelabelTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'prl-shape', kind: 'select', label: 'network', value: 'layered',
      options: [{ value: 'layered', label: 'layered' },
        { value: 'grid', label: 'grid' },
        { value: 'random', label: 'random' },
        { value: 'bottleneck', label: 'bottleneck' },
        { value: 'unit', label: 'unit capacity' }] },
    { id: 'prl-width', kind: 'range', label: 'width of each rank', value: 5, min: 2, max: 9, step: 1 },
    { id: 'prl-layers', kind: 'range', label: 'ranks', value: 5, min: 2, max: 8, step: 1 },
    { id: 'prl-seed', kind: 'range', label: 'network seed', value: 1, min: 1, max: 40, step: 1 },
    { id: 'prl-rule', kind: 'select', label: 'selection rule', value: 'fifo',
      options: [{ value: 'fifo', label: 'FIFO — a queue of active vertices' },
        { value: 'highest', label: 'highest label — always the tallest' }] },
    { id: 'prl-gap', kind: 'checkbox', label: 'gap heuristic', value: true },
    { id: 'prl-global', kind: 'checkbox', label: 'global relabelling', value: true }
  ];

  const METRICS = [
    { id: 'prl-value', label: 'Maximum flow', note: 'and whether Dinic agrees' },
    { id: 'prl-relabels', label: 'Relabels', note: 'the operation the heuristics remove' },
    { id: 'prl-pushes', label: 'Pushes', note: 'split into saturating and not' },
    { id: 'prl-valid', label: 'Heights valid, nothing active?', note: 'the two termination conditions' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The network and the rules', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Where the excess ended up, and how tall each vertex got</div>' +
      '<div class="card-body"><div id="prl-heights"></div>' +
      '<p class="note" id="prl-heights-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What each heuristic is worth</div>' +
      '<div class="card-body"><table class="ref-table" id="prl-sweep"><thead><tr>' +
      '<th>Gap</th><th>Global relabel</th><th>Value</th><th>Relabels</th><th>Pushes</th>' +
      '<th>Arc visits</th><th>Against no heuristics</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="prl-sweep-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Push-relabel against the augmenting-path family</div>' +
      '<div class="card-body"><table class="ref-table" id="prl-compare"><thead><tr>' +
      '<th>Algorithm</th><th>Value</th><th>Arc visits</th><th>Cut capacity</th><th>Valid flow?</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="prl-compare-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Saturating and non-saturating pushes, which are bounded differently</div>' +
      '<div class="card-body"><div id="prl-split"></div>' +
      '<p class="note" id="prl-split-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">How the heuristics scale with the network</div>' +
      '<div class="card-body"><table class="ref-table" id="prl-scale"><thead><tr>' +
      '<th>Vertices</th><th>Relabels with both</th><th>Relabels with neither</th>' +
      '<th>Saving</th><th>Dinic arc visits</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="prl-scale-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
