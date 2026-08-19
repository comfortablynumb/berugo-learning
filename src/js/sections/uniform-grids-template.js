/** Markup for "Uniform grids and spatial hashing". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.UniformGridsTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'ug-kind', kind: 'select', label: 'point distribution', value: 'uniform',
      options: [{ value: 'uniform', label: 'uniform — the case a grid is for' },
        { value: 'clustered', label: 'clustered — the case it is not' },
        { value: 'grid', label: 'lattice — perfectly even' },
        { value: 'collinear', label: 'collinear — everything on a diagonal' }] },
    { id: 'ug-cell', kind: 'range', label: 'cell size', value: 25, min: 5, max: 200, step: 5 },
    { id: 'ug-radius', kind: 'range', label: 'query radius', value: 25, min: 10, max: 60, step: 5 },
    { id: 'ug-mode', kind: 'select', label: 'addressing', value: 'grid',
      options: [{ value: 'grid', label: 'direct — bounded, no collisions' },
        { value: 'hash', label: 'hashed — unbounded, collisions' }] },
    { id: 'ug-buckets', kind: 'select', label: 'hash table size', value: '1024',
      options: [{ value: '256', label: '256 buckets' }, { value: '1024', label: '1 024' },
        { value: '4096', label: '4 096' }, { value: '8192', label: '8 192' }] }
  ];

  const METRICS = [
    { id: 'ug-candidates', label: 'Candidates per query', note: 'points taken out of a bucket and measured' },
    { id: 'ug-selectivity', label: 'Candidates per result', note: '1.0 is perfect; anything large is wasted work' },
    { id: 'ug-predicted', label: 'Predicted from density', note: 'the formula against the measurement' },
    { id: 'ug-memory', label: 'Memory', note: 'buckets plus placements' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The cells, the radius and the table', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The grid over the points, and the cells one query reads</div>' +
      '<div class="card-body"><div id="ug-map"></div>' +
      '<p class="note" id="ug-map-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Cells scanned against candidates tested: the work has a minimum</div>' +
      '<div class="card-body"><div id="ug-sweep-chart"></div>' +
      '<div id="ug-sweep-legend"></div>' +
      '<p class="note" id="ug-sweep-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The sweep, with the prediction beside the measurement</div>' +
      '<div class="card-body"><table class="ref-table" id="ug-sweep-table"><thead><tr>' +
      '<th>Cell size</th><th>Cells / query</th><th>Candidates / query</th><th>Predicted</th>' +
      '<th>Results / query</th><th>Candidates per result</th><th>Total work</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ug-sweep-table-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The same points and the same queries, three indexes</div>' +
      '<div class="card-body"><table class="ref-table" id="ug-compare"><thead><tr>' +
      '<th>Index</th><th>Candidates / query</th><th>Per result</th><th>Memory</th><th>Wrong answers</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="ug-compare-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
