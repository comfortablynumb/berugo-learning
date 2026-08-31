/** Markup for "Optimising software for the cache". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BlockingTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'cfs-n', kind: 'select', label: 'matrix size', value: '64',
      options: [32, 48, 64, 80, 96].map(function (value) {
        return { value: String(value),
          label: value + ' x ' + value + (value === 64 ? ' — a power of two' : '') };
      }) },
    { id: 'cfs-tile', kind: 'range', label: 'tile size', value: 16, min: 4, max: 48, step: 4 },
    { id: 'cfs-pad', kind: 'range', label: 'padding, in elements per row', value: 0,
      min: 0, max: 8, step: 1 }
  ];

  const METRICS = [
    { id: 'cfs-naive', label: 'Naive, trips to memory', note: 'the i, j, k loop nest' },
    { id: 'cfs-best', label: 'Best version', note: 'and what it took to get there' },
    { id: 'cfs-gain', label: 'Improvement', note: 'in DRAM accesses' },
    { id: 'cfs-tile-analytic', label: 'Tile the arithmetic picks', note: 'three tiles must fit' },
    { id: 'cfs-tile-best', label: 'Tile the sweep picks', note: 'measured, on this grid' },
    { id: 'cfs-cycles', label: 'Cycles per access', note: 'at the current settings' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'One multiplication, four versions',
        controls: CONTROLS }) +
      scope.DataTable.markup({ id: 'cfs-versions', first: true,
        title: 'Each transformation, and what it removed',
        columns: ['Version', 'Trips to memory', 'Against naive', 'Cycles per access',
          'What changed'] }) +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      chartCard() +
      scope.DataTable.markup({ id: 'cfs-three',
        title: 'The three Cs at each step: each fix removes the category it was aimed at',
        columns: ['Version', 'Compulsory', 'Capacity', 'Conflict', 'Dominant', 'What to do next'] }) +
      scope.DataTable.markup({ id: 'cfs-tiles',
        title: 'Tile-size sweep, against the size the arithmetic predicts',
        columns: ['Tile', 'Three tiles need', 'Trips to memory', 'Against the best',
          'Divides the matrix?'] }) +
      scope.DataTable.markup({ id: 'cfs-pads',
        title: 'Padding a power-of-two row stride',
        columns: ['Padding', 'Row stride', 'Trips to memory', 'Against no padding',
          'Conflict misses'] }) +
      scope.DataTable.markup({ id: 'cfs-catalogue',
        title: 'The transformations, and when each one is the right reach',
        columns: ['Transformation', 'What it fixes', 'What it costs', 'Where it appears here'] });
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Trips to memory, version by version</div>' +
      '<div class="card-body"><div id="cfs-chart" class="chart-host"></div>' +
      '<p class="note" id="cfs-chart-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
