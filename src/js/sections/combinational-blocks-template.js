/** Markup for "The combinational building blocks". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BlocksTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const BLOCKS = {
    muxTree: { label: 'multiplexer, as a tree of 2:1 stages',
      about: 'depth grows with the logarithm of the width, which is why wide selects are cheap' },
    muxFlat: { label: 'multiplexer, as one level of decoded terms',
      about: 'constant depth, and a gate count that doubles with every select bit' },
    decoder: { label: 'decoder — one output per address',
      about: 'the block inside every memory, register file and jump table' },
    priorityEncoder: { label: 'priority encoder — the index of the highest set input',
      about: 'an interrupt controller, and the reason its latency is a chain' },
    comparator: { label: 'comparator — equal, and less than',
      about: 'equality is a tree; magnitude is a chain, which is why they cost differently' },
    barrelShifter: { label: 'barrel shifter — any distance in one pass',
      about: 'why a variable shift is one cycle and a variable multiply is not' }
  };

  const CONTROLS = [
    { id: 'blk-block', kind: 'select', label: 'block', value: 'muxTree',
      options: Object.keys(BLOCKS).map(function (id) {
        return { value: id, label: BLOCKS[id].label };
      }) },
    { id: 'blk-size', kind: 'range', label: 'select or address bits (width is two to this)',
      value: 2, min: 1, max: 4, step: 1 },
    { id: 'blk-rotate', kind: 'checkbox', label: 'shifter rotates instead of filling with zeros',
      value: false }
  ];

  const METRICS = [
    { id: 'blk-shape', label: 'Ports', note: 'inputs and outputs of this block' },
    { id: 'blk-gates', label: 'Gates', note: 'and the transistors they cost' },
    { id: 'blk-depth', label: 'Critical path', note: 'gate delays, input to output' },
    { id: 'blk-settle', label: 'Settling time', note: 'simulated with per-gate delays' },
    { id: 'blk-checked', label: 'Vectors checked', note: 'against a behavioural model' },
    { id: 'blk-verdict', label: 'Equivalence', note: 'the model is the independent judge' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Pick a block and a width', controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The netlist, as built</div>' +
      '<div class="card-body"><div id="blk-graph" class="mermaid-host"></div>' +
      '<p class="note" id="blk-graph-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('blk-behaviour', 'What it does, driven vector by vector',
        ['Inputs', 'Outputs', 'The model says', 'Agree?', 'Settling time']) +
      card('blk-compare', 'Every block at this width, measured the same way',
        ['Block', 'Ports', 'Gates', 'Transistors', 'Depth', 'Exhaustively checked?']) +
      chartCard() +
      card('blk-scaling', 'Tree against flat, as the width doubles',
        ['Width', 'Tree gates', 'Tree depth', 'Flat gates', 'Flat depth', 'Gate ratio']) +
      card('blk-uses', 'Where each of these sits in a processor',
        ['Block', 'In the datapath', 'What its cost buys', 'The failure it causes']);
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Area and depth as the multiplexer widens</div>' +
      '<div class="card-body"><div id="blk-chart" class="chart-host"></div>' +
      '<p class="note" id="blk-chart-note"></p></div></div>';
  }

  function card(id, title, columns) {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">' + title + '</div>' +
      '<div class="card-body"><table class="ref-table" id="' + id + '"><thead><tr>' +
      columns.map(function (name) { return '<th>' + name + '</th>'; }).join('') +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="' + id + '-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, BLOCKS: BLOCKS };
}));
