/** Markup for "Separate chaining". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SeparateChainingTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'sc-load', kind: 'range', label: 'load factor (keys ÷ buckets)', value: 100, min: 10, max: 800, step: 10,
      suffix: '%', note: 'Chaining keeps working past 100%; the chains simply get longer.' },
    { id: 'sc-buckets', kind: 'range', label: 'buckets', value: 512, min: 64, max: 2048, step: 64 },
    { id: 'sc-treeify', kind: 'range', label: 'treeify threshold', value: 8, min: 0, max: 32, step: 1,
      note: '0 disables it. Real maps use 8, and only when the table is also large enough.' },
    { id: 'sc-keys', kind: 'select', label: 'key distribution', value: 'random',
      options: [{ value: 'random', label: 'random' }, { value: 'words', label: 'word-like' },
        { value: 'sequential', label: 'sequential' }, { value: 'adversarial', label: 'adversarial (all collide)' }] }
  ];

  const METRICS = [
    { id: 'sc-expected', label: 'Expected chain', note: 'α = keys ÷ buckets' },
    { id: 'sc-longest', label: 'Longest chain', note: 'the one that decides your tail' },
    { id: 'sc-probes', label: 'Probes per lookup', note: 'measured over every key' },
    { id: 'sc-empty', label: 'Empty buckets', note: 'expected e^-α of them' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Table and key stream', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Chain length per bucket</div>' +
      '<div class="card-body"><div id="sc-buckets-view"></div>' +
      '<p class="note">Purple bars are treeified buckets. The dashed line is the expected chain ' +
      'length; the interesting number is how far the tallest bar sits above it.</p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="grid-even" style="margin-top:.875rem">' +
      '<div class="card"><div class="card-header">Observed against Poisson</div>' +
      '<div class="card-body"><div id="sc-chart"></div><div id="sc-legend"></div>' +
      '<p class="note">Bucket occupancy under a good hash is Poisson with mean α: the fraction of ' +
      'buckets holding exactly k keys is e^-α·α^k / k!.</p></div></div>' +
      '<div class="card"><div class="card-header">Memory per entry</div>' +
      '<div class="card-body"><div id="sc-memory" class="mono" style="font-size:.8125rem"></div>' +
      '<p class="note">Chaining stores a node per entry. Open addressing stores the entry in the ' +
      'slot array and nothing else, which is most of its advantage.</p></div></div>' +
      '</div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
