/** Markup for "Undecidability and diagonalisation". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DiagonalTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'dia-oracle', kind: 'select', label: 'the proposed halting oracle', value: 'heuristic',
      options: [
        { value: 'heuristic', label: 'a heuristic — looks for obvious infinite loops' },
        { value: 'optimistic', label: 'always says halts — an unsound analyser' },
        { value: 'pessimistic', label: 'always says loops — a useless sound one' },
        { value: 'random', label: 'flips a coin' }
      ] },
    { id: 'dia-size', kind: 'range', label: 'machines in the table', value: 6, min: 3, max: 10,
      step: 1 },
    { id: 'dia-budget', kind: 'range', label: 'bounded-halting budget, in steps', value: 200,
      min: 10, max: 2000, step: 10 }
  ];

  const METRICS = [
    { id: 'dia-verdict', label: 'The oracle says', note: 'about the machine built to defeat it' },
    { id: 'dia-actual', label: 'It actually does', note: 'the opposite, by construction' },
    { id: 'dia-contradiction', label: 'Contradiction', note: 'for every oracle, every time' },
    { id: 'dia-bounded', label: 'Bounded halting decided', note: 'the same question, with a limit' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Oracle, table size and budget', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The program that defeats it</div>' +
      '<div class="card-body"><pre class="mono" id="dia-source" ' +
      'style="font-size:.78rem;margin:0;white-space:pre-wrap"></pre>' +
      '<p class="note" id="dia-source-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The diagonal table: machines against inputs</div>' +
      '<div class="card-body"><div id="dia-table" class="mono" ' +
      'style="font-size:.8rem;line-height:1.5"></div>' +
      '<p class="note" id="dia-table-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Where the constructed machine differs from every row</div>' +
      '<div class="card-body"><table class="ref-table" id="dia-differences"><thead><tr>' +
      '<th>Row</th><th>At column</th><th>The row does</th><th>The new machine does</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dia-differences-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Bounded halting, which IS decidable</div>' +
      '<div class="card-body"><table class="ref-table" id="dia-bounded-table"><thead><tr>' +
      '<th>Machine</th><th>Halts within the budget</th><th>Steps used</th><th>Outcome</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dia-bounded-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Decidable, recognisable, and neither</div>' +
      '<div class="card-body"><table class="ref-table" id="dia-tower"><thead><tr>' +
      '<th>Problem</th><th>Decidable</th><th>Recognisable</th><th>Co-recognisable</th>' +
      '<th>What that means in practice</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="dia-tower-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
