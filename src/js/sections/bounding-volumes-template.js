/** Markup for "Bounding volume hierarchies and the SAH". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BoundingVolumesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CONTROLS = [
    { id: 'bvh-strategy', kind: 'select', label: 'build', value: 'sah',
      options: [{ value: 'sah', label: 'surface-area heuristic' },
        { value: 'median', label: 'median centroid on the widest axis' }] },
    { id: 'bvh-count', kind: 'range', label: 'triangles', value: 20000, min: 2000, max: 40000, step: 2000 },
    { id: 'bvh-clumps', kind: 'range', label: 'clumps in the scene', value: 6, min: 1, max: 20, step: 1 },
    { id: 'bvh-leaf', kind: 'range', label: 'leaf size', value: 4, min: 1, max: 16, step: 1 },
    { id: 'bvh-motion', kind: 'select', label: 'animation', value: 'coherent',
      options: [{ value: 'coherent', label: 'coherent — neighbours move together' },
        { value: 'scattered', label: 'scattered — every triangle independently' }] }
  ];

  const METRICS = [
    { id: 'bvh-cost', label: 'SAH cost of the tree', note: 'the quantity the build was minimising' },
    { id: 'bvh-nodes', label: 'Nodes visited per ray', note: 'and primitives actually intersected' },
    { id: 'bvh-shape', label: 'Tree', note: 'nodes, leaves and depth' },
    { id: 'bvh-hits', label: 'Rays that hit', note: 'against a brute-force intersection of every triangle' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'The scene, the build and the motion', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The hierarchy, projected onto x and y</div>' +
      '<div class="card-body"><div id="bvh-map"></div>' +
      '<p class="note" id="bvh-map-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Two builds of the same triangles, and what a ray pays</div>' +
      '<div class="card-body"><table class="ref-table" id="bvh-compare"><thead><tr>' +
      '<th>Build</th><th>Nodes</th><th>Leaves</th><th>Depth</th><th>SAH cost</th><th>Sibling overlap</th>' +
      '<th>Nodes / ray</th><th>Primitives / ray</th><th>Disagreements</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="bvh-compare-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The leaf-size sweep: where splitting stops paying</div>' +
      '<div class="card-body"><div id="bvh-chart"></div>' +
      '<div id="bvh-chart-legend"></div>' +
      '<p class="note" id="bvh-chart-note"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Refit against rebuild, after the scene moves</div>' +
      '<div class="card-body"><pre class="step-work" id="bvh-refit"></pre>' +
      '<p class="note" id="bvh-refit-note"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS };
}));
