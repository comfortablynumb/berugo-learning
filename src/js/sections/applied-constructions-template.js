/** Markup for "Applied constructions". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AppliedTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'apc-threshold', kind: 'range', label: 'shares needed to reconstruct (k)', value: 3,
      min: 2, max: 5, step: 1 },
    { id: 'apc-held', kind: 'range', label: 'shares the attacker holds', value: 2, min: 1,
      max: 5, step: 1 },
    { id: 'apc-leaf', kind: 'select', label: 'the entry to prove', value: '2',
      options: [
        { value: '0', label: 'alice:100' },
        { value: '2', label: 'carol:75' },
        { value: '4', label: 'erin:12' },
        { value: '6', label: 'grace:38 — the odd leaf' }
      ] }
  ];

  const METRICS = [
    { id: 'apc-reconstructed', label: 'Reconstructed secret', note: 'from the shares the attacker holds' },
    { id: 'apc-candidates', label: 'Secrets still possible', note: 'consistent with those shares' },
    { id: 'apc-proof', label: 'Inclusion proof', note: 'hashes needed to prove one entry' },
    { id: 'apc-tampered', label: 'Tampered leaf detected', note: 'the same proof against an edited value' }
  ];

  function render() {
    return '<div class="callout callout-warning" id="apc-disclaimer"></div>' +
      '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Threshold and proof', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">What the attacker’s shares determine</div>' +
      '<div class="card-body"><div id="apc-verdict"></div>' +
      '<p class="note" id="apc-verdict-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every k-subset reconstructs the same secret</div>' +
      '<div class="card-body"><table class="ref-table" id="apc-subsets"><thead><tr>' +
      '<th>Shares used</th><th>Reconstructed</th><th>Correct</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="apc-subsets-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">With one share too few, every secret is still on the table</div>' +
      '<div class="card-body"><table class="ref-table" id="apc-fits"><thead><tr>' +
      '<th>Candidate secret</th><th>Fits the held shares</th><th>Implies the unseen share is</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="apc-fits-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The inclusion proof, hash by hash</div>' +
      '<div class="card-body"><table class="ref-table" id="apc-path"><thead><tr>' +
      '<th>Level</th><th>Sibling hash</th><th>Side</th><th>Running value</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="apc-path-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What a Merkle proof costs against sending the list</div>' +
      '<div class="card-body"><table class="ref-table" id="apc-cost"><thead><tr>' +
      '<th>Entries</th><th>Proof hashes</th><th>Proof bytes</th><th>The whole list</th>' +
      '<th>Saving</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="apc-cost-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Where else this idea turns up</div>' +
      '<div class="card-body"><table class="ref-table" id="apc-uses"><thead><tr>' +
      '<th>System</th><th>What is committed to</th><th>What the proof replaces</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="apc-uses-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
