/** Markup for "Compressed tries: radix and PATRICIA". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CompressedTriesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ct-keys', kind: 'select', label: 'key set', value: 'words',
      options: [{ value: 'words', label: 'English words — short keys, shallow branching' },
        { value: 'hashes', label: '32-character hex keys — long and distinct' },
        { value: 'paths', label: 'filesystem-style paths' }] },
    { id: 'ct-count', kind: 'range', label: 'keys', value: 400, min: 20, max: 883, step: 10 },
    { id: 'ct-adaptive', kind: 'checkbox', label: 'adaptive node sizes (ART)', value: false,
      note: 'node4 / node16 / node48 / node256 by fan-out, instead of one map per node.' },
    { id: 'ct-address', kind: 'text', label: 'route this address', value: '10.1.2.7', maxLength: 15,
      note: 'Longest-prefix match over the routing table below.' }
  ];

  const METRICS = [
    { id: 'ct-nodes', label: 'Nodes', note: 'against the plain trie over the same keys' },
    { id: 'ct-bytes', label: 'Bytes per key', note: 'under the stated node model' },
    { id: 'ct-splits', label: 'Edge splits', note: 'insertions that had to divide an edge' },
    { id: 'ct-route', label: 'Route', note: 'longest matching prefix' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Keys, node sizes and a route to look up', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The same keys, with every non-branching chain collapsed</div>' +
      '<div class="card-body"><div id="ct-chart"></div>' +
      '<p class="note" id="ct-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Plain trie against radix trie, on the same key set</div>' +
      '<div class="card-body"><table class="ref-table" id="ct-table"><thead><tr>' +
      '<th>Structure</th><th>Nodes</th><th>Nodes per key</th><th>Bytes</th><th>Bytes per key</th>' +
      '<th>Character steps per lookup</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ct-table-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Longest-prefix match: the routing table</div>' +
      '<div class="card-body"><table class="ref-table" id="ct-route-table"><thead><tr>' +
      '<th>Prefix</th><th>Bits</th><th>Length</th><th>Next hop</th><th>Matches this address</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ct-route-table-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Where the adaptive node sizes go</div>' +
      '<div class="card-body"><pre class="step-work" id="ct-classes"></pre>' +
      '<p class="note" id="ct-classes-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
