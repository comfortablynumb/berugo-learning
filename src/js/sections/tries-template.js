/** Markup for "Tries". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TriesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'tr-query', kind: 'text', label: 'search box', value: 'con', maxLength: 20,
      placeholder: 'type a prefix',
      note: 'The tree below highlights the path this prefix walks, and the completions are the subtree under it.' },
    { id: 'tr-layout', kind: 'select', label: 'child storage', value: 'map',
      options: [{ value: 'map', label: 'map per node — one entry per real child' },
        { value: 'array', label: '26-slot array per node — one index, all the waste' },
        { value: 'sorted', label: 'sorted child array — binary search, no waste' }] },
    { id: 'tr-keys', kind: 'range', label: 'words from the list', value: 883, min: 20, max: 883, step: 1 },
    { id: 'tr-draw', kind: 'range', label: 'nodes drawn', value: 90, min: 20, max: 200, step: 10,
      note: 'The whole trie is built; only this many nodes are drawn.' }
  ];

  const METRICS = [
    { id: 'tr-nodes', label: 'Nodes', note: 'one per distinct prefix' },
    { id: 'tr-bytes', label: 'Bytes per key', note: 'under the stated node model' },
    { id: 'tr-completions', label: 'Completions', note: 'keys under the prefix in the box' },
    { id: 'tr-lookup', label: 'Character steps per lookup', note: 'hits and near-miss lookups together' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The word list, and how a node stores its children', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Shared prefixes, and the path the search box walks</div>' +
      '<div class="card-body"><div id="tr-chart"></div>' +
      '<p class="note" id="tr-chart-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">What the search box answers</div>' +
      '<div class="card-body"><pre class="step-work" id="tr-answers"></pre>' +
      '<p class="note" id="tr-answers-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The three node layouts, over the identical trie</div>' +
      '<div class="card-body"><table class="ref-table" id="tr-layout-table"><thead><tr>' +
      '<th>Layout</th><th>Nodes</th><th>Bytes</th><th>Bytes per key</th><th>Against a hash table</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="tr-layout-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
