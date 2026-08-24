/** Markup for "Randomised and interactive classes". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.InteractiveTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ipx-claim', kind: 'select', label: 'the prover claims', value: 'same',
      options: [
        { value: 'different', label: 'two graphs that really are different — an honest claim' },
        { value: 'same', label: 'two graphs that are the same — a lie the verifier must catch' }
      ] },
    { id: 'ipx-prover', kind: 'select', label: 'the prover strategy', value: 'guessing',
      options: [
        { value: 'honest', label: 'honest — it can solve isomorphism' },
        { value: 'guessing', label: 'guessing — it cannot tell, so it flips a coin' },
        { value: 'stubborn', label: 'always answers left — a deterministic lie' }
      ] },
    { id: 'ipx-rounds', kind: 'range', label: 'rounds', value: 4, min: 1, max: 10, step: 1 },
    { id: 'ipx-trials', kind: 'range', label: 'trials to measure the error over', value: 2000,
      min: 200, max: 5000, step: 200 }
  ];

  const METRICS = [
    { id: 'ipx-accepted', label: 'The verifier accepted', note: 'this run of the protocol' },
    { id: 'ipx-measured', label: 'Measured acceptance rate', note: 'over many independent runs' },
    { id: 'ipx-predicted', label: 'Predicted soundness error', note: 'two to the minus k' },
    { id: 'ipx-within', label: 'Within three sigma', note: 'the bound confirmed, not quoted' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Claim, prover and rounds', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The two graphs, and whether they differ</div>' +
      '<div class="card-body"><div id="ipx-graphs" class="mono" style="font-size:.82rem"></div>' +
      '<p class="note" id="ipx-graphs-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The rounds, one challenge at a time</div>' +
      '<div class="card-body"><table class="ref-table" id="ipx-rounds-table"><thead><tr>' +
      '<th>Round</th><th>Verifier picked</th><th>Prover answered</th><th>Correct</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ipx-rounds-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The soundness error, measured against the bound</div>' +
      '<div class="card-body"><table class="ref-table" id="ipx-soundness"><thead><tr>' +
      '<th>Rounds</th><th>Measured</th><th>Predicted</th><th>Difference</th><th>Within 3σ</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ipx-soundness-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The randomised classes, and what their error means</div>' +
      '<div class="card-body"><table class="ref-table" id="ipx-classes"><thead><tr>' +
      '<th>Class</th><th>Error</th><th>Amplification</th><th>Example</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ipx-classes-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Where this pattern actually ships</div>' +
      '<div class="card-body"><table class="ref-table" id="ipx-practice"><thead><tr>' +
      '<th>System</th><th>The weak verifier</th><th>The strong prover</th><th>What it buys</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ipx-practice-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
