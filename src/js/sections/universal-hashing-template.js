/** Markup for "Universal, tabulation and keyed hashing". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.UniversalHashingTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'uh-defence', kind: 'select', label: 'server-side defence', value: 'none',
      options: [{ value: 'none', label: 'none — fixed, published hash' },
        { value: 'seed', label: 'per-process random seed' },
        { value: 'treeify', label: 'treeify long buckets (keep the weak hash)' },
        { value: 'both', label: 'random seed and treeify' }] },
    { id: 'uh-payload', kind: 'range', label: 'attacker keys', value: 2000, min: 250, max: 6000, step: 250,
      note: 'Every one of these is crafted to land in the same bucket of the undefended table.' },
    { id: 'uh-buckets', kind: 'range', label: 'table buckets', value: 1024, min: 256, max: 4096, step: 256 }
  ];

  const METRICS = [
    { id: 'uh-chain', label: 'Longest bucket', note: 'entries in one bucket' },
    { id: 'uh-probes', label: 'Probes per lookup', note: 'key comparisons, measured' },
    { id: 'uh-work', label: 'Total work', note: 'comparisons for the whole request' },
    { id: 'uh-cost', label: 'Attack cost', note: 'candidate keys the attacker had to hash' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The request and the defence', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Work per request as the payload grows</div>' +
      '<div class="card-body"><div id="uh-chart"></div><div id="uh-legend"></div>' +
      '<p class="note">Undefended, the cost is quadratic in the number of keys posted: every ' +
      'insertion walks the chain the previous ones built.</p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="grid-even" style="margin-top:.875rem">' +
      '<div class="card"><div class="card-header">Bucket occupancy under attack</div>' +
      '<div class="card-body"><div id="uh-buckets-view"></div></div></div>' +
      '<div class="card"><div class="card-header">Multiply-shift and tabulation</div>' +
      '<div class="card-body"><div id="uh-universal" class="mono" style="font-size:.8125rem"></div>' +
      '<p class="note">Both are drawn from a family at start-up. The attacker can still collide ' +
      'the function they are facing — they just cannot know which one that is before the process ' +
      'starts.</p></div></div>' +
      '</div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
