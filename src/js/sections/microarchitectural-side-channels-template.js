/** Markup for "Microarchitectural side channels". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ChannelTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'chan-mitigation', kind: 'select', label: 'mitigation', value: 'none',
      options: [
        { value: 'none', label: 'none — the gadget as written' },
        { value: 'fence', label: 'a speculation barrier before the dependent load' },
        { value: 'mask', label: 'index masking — the address can never leave the array' }] },
    { id: 'chan-noise', kind: 'range', label: 'noise (other activity in the cache)',
      value: 0.3, min: 0, max: 0.9, step: 0.1 },
    { id: 'chan-rounds', kind: 'range', label: 'rounds per character', value: 31, min: 1,
      max: 127, step: 2 },
    { id: 'chan-train', kind: 'range', label: 'training calls before each attempt', value: 6,
      min: 0, max: 12, step: 1 }
  ];

  const METRICS = [
    { id: 'chan-recovered', label: 'Recovered', note: 'the secret is CAFEBABE' },
    { id: 'chan-accuracy', label: 'Accuracy', note: 'characters correct, this run' },
    { id: 'chan-mean', label: 'Mean over 8 seeds', note: 'the number worth quoting' },
    { id: 'chan-chance', label: 'Chance', note: 'one in sixteen — what a blocked channel gives' },
    { id: 'chan-speculative', label: 'Speculative accesses', note: 'reads that never architecturally happened' },
    { id: 'chan-blocked', label: 'Blocked by the mitigation', note: 'speculative reads prevented' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Run the channel, then break it',
        controls: CONTROLS }) +
      scope.DataTable.markup({ id: 'chan-timings', first: true,
        title: 'One reload pass: how long each probe line took',
        columns: ['Value', 'Address', 'Set', 'Cycles', 'Reading'] }) +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      chartCard() +
      scope.DataTable.markup({ id: 'chan-attack',
        title: 'The secret, one character at a time',
        columns: ['Position', 'Expected', 'Recovered', 'Correct?', 'Votes for the winner'] }) +
      scope.DataTable.markup({ id: 'chan-rounds-table',
        title: 'Repetition against noise: mean accuracy over eight seeds',
        columns: ['Rounds', 'No mitigation', 'Speculation barrier', 'Index masking'] }) +
      scope.DataTable.markup({ id: 'chan-mitigations',
        title: 'Three mitigations, and how each one fails or does not',
        columns: ['Mitigation', 'What it stops', 'Leak', 'What it costs'] }) +
      scope.DataTable.markup({ id: 'chan-receivers',
        title: 'Flush+Reload against Prime+Probe: not the same attack',
        columns: ['Receiver', 'Needs', 'Recovers', 'On this cache', 'Ambiguity'] }) +
      scope.DataTable.markup({ id: 'chan-steps',
        title: 'Why rolling back the registers was never a mitigation',
        columns: ['Step', 'Architectural state', 'Cache state', 'Recoverable?'] });
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Recovery rate against rounds, for each mitigation</div>' +
      '<div class="card-body"><div id="chan-chart" class="chart-host"></div>' +
      '<p class="note" id="chan-chart-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
