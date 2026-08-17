/** Markup for "Robin Hood, hopscotch and cuckoo hashing". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RobinHoodTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'rh-load', kind: 'range', label: 'load factor', value: 85, min: 30, max: 95, step: 5, suffix: '%',
      note: 'Cuckoo hashing fails to insert above about 50% with two tables; the demo rebuilds when it does.' },
    { id: 'rh-capacity', kind: 'range', label: 'slots', value: 2048, min: 512, max: 8192, step: 512 },
    { id: 'rh-neighbourhood', kind: 'range', label: 'hopscotch neighbourhood H', value: 8, min: 4, max: 32, step: 4 }
  ];

  const METRICS = [
    { id: 'rh-mean', label: 'Mean probe distance', note: 'the number the load factor fixes' },
    { id: 'rh-variance', label: 'Variance', note: 'what Robin Hood actually reduces' },
    { id: 'rh-p99', label: 'p99 distance', note: 'the tail a request waits on' },
    { id: 'rh-max', label: 'Worst distance', note: 'the slowest lookup in the table' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Table and load', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Probe-distance distribution</div>' +
      '<div class="card-body"><div id="rh-chart"></div><div id="rh-legend"></div>' +
      '<p class="note">Same keys, same load factor, same mean. The shapes differ: linear probing ' +
      'has a long right tail, Robin Hood does not.</p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem"><div class="card-header">Side by side</div>' +
      '<div class="card-body"><div id="rh-table"></div></div></div>' +
      '<div class="card" style="margin-top:.875rem"><div class="card-header">A cuckoo eviction chain</div>' +
      '<div class="card-body"><div id="rh-cuckoo" class="mono" style="font-size:.8125rem"></div>' +
      '<p class="note">Inserting one key can evict a key, which evicts another, and so on. If the ' +
      'walk closes into a cycle the only repair is a rebuild with new hash seeds.</p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
