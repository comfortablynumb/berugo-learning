/** Markup for "Instruction selection". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.IselTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const SAMPLES = {
    multiplyAdd: 'let k = 3;\nlet t = 0;\nfor v in [1, 2, 3, 4] { t = t + v * k * 2; }',
    indexed: 'let xs = [10, 20, 30];\nlet a = xs[0] + xs[1];\nlet b = a + xs[2];',
    fields: 'let p = { x: 1, y: 2 };\nlet s = p.x * 4 + p.y;',
    compare: 'let a = 3;\nlet ok = a * 2 + 1 < 10;\nlet n = if ok { a + 1 } else { a - 1 };',
    flat: 'let a = 1;\nlet b = a + 2;\nlet c = b + 3;\nlet d = c + 4;'
  };

  const CONTROLS = [
    { id: 'is-sample', kind: 'select', label: 'program', value: 'multiplyAdd',
      options: [
        { value: 'multiplyAdd', label: 'an expression with a multiply inside an add' },
        { value: 'indexed', label: 'indexed loads with constant offsets' },
        { value: 'fields', label: 'field loads feeding arithmetic' },
        { value: 'compare', label: 'arithmetic feeding a comparison' },
        { value: 'flat', label: 'a chain of adds — no tile can cover two' }
      ] },
    { id: 'is-tile', kind: 'select', label: 'retune this tile', value: 'MADDR',
      options: [
        { value: 'MADDR', label: 'MADDR — multiply-add, mul on the right' },
        { value: 'MADD', label: 'MADD — multiply-add, mul on the left' },
        { value: 'MUL', label: 'MUL — a plain multiply' },
        { value: 'LDXI', label: 'LDXI — indexed load with a constant offset' },
        { value: 'ADDI', label: 'ADDI — add an immediate' }
      ] },
    { id: 'is-cost', kind: 'range', label: 'its cost, in cycles', value: 4,
      min: 1, max: 10, step: 1, note: 'the model is data, so one number moves the selection' }
  ];

  const METRICS = [
    { id: 'is-trees', label: 'Expression trees', note: 'maximal regions the tiler covers' },
    { id: 'is-cost-total', label: 'Selected cost', note: 'cycles on the modelled target' },
    { id: 'is-instructions', label: 'Instructions emitted', note: 'one per tile in the cover' },
    { id: 'is-optimal', label: 'Against exhaustive search', note: 'every tree, every cover' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'A tree, a cost model, a cover', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">Cost against the retuned tile</div>' +
      '<div class="card-body"><div id="is-chart" class="chart-host"></div>' +
      '<p class="note" id="is-chart-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every tree in the function, and the cover chosen for it</div>' +
      '<div class="card-body"><table class="ref-table" id="is-trees-table"><thead><tr>' +
      '<th>Block</th><th>Value</th><th>Root</th><th>Nodes</th><th>Cost</th>' +
      '<th>Tiles, innermost first</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="is-trees-table-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The dynamic-programming answer against exhaustive search</div>' +
      '<div class="card-body"><table class="ref-table" id="is-oracle"><thead><tr>' +
      '<th>Block</th><th>Root</th><th>Nodes</th><th>Tiler says</th><th>Every cover says</th>' +
      '<th>Agree</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="is-oracle-caption"></p></div></div>' +
      '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">The tile table — the whole of what a retarget changes</div>' +
      '<div class="card-body"><table class="ref-table" id="is-tiles"><thead><tr>' +
      '<th>Tile</th><th>Pattern</th><th>Cost</th><th>Times chosen here</th><th>What it is</th>' +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="is-tiles-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, SAMPLES: SAMPLES };
}));
