/** Markup for "Describing hardware, and proving it right". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HdlTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const MODULES = {
    xor2: { label: 'xor2 — exclusive or from four NANDs', leaf: true },
    halfAdder: { label: 'halfAdder — one xor2 and one AND', leaf: false },
    fullAdder: { label: 'fullAdder — two half adders and an OR', leaf: false },
    adder4: { label: 'adder4 — four full adders in a row', leaf: false }
  };

  const CONTROLS = [
    { id: 'hdl-module', kind: 'select', label: 'top-level module', value: 'fullAdder',
      options: Object.keys(MODULES).map(function (id) {
        return { value: id, label: MODULES[id].label };
      }) },
    { id: 'hdl-tests', kind: 'select', label: 'test vectors', value: 'exhaustive',
      options: [
        { value: 'exhaustive', label: 'every input vector — possible, at these sizes' },
        { value: 'corner', label: 'the corner cases somebody would write by hand' },
        { value: 'single', label: 'one vector, to show what coverage catches' }] },
    { id: 'hdl-bug', kind: 'checkbox',
      label: 'inject a typo: the full adder ORs where it should XOR', value: false }
  ];

  const METRICS = [
    { id: 'hdl-instances', label: 'Module instances', note: 'before elaboration flattens them' },
    { id: 'hdl-gates', label: 'Gates after elaboration', note: 'the flat netlist that is run' },
    { id: 'hdl-depth', label: 'Critical path', note: 'measured on the flat netlist' },
    { id: 'hdl-checked', label: 'Vectors driven', note: 'by the selected test list' },
    { id: 'hdl-verdict', label: 'Equivalence', note: 'against a behavioural model' },
    { id: 'hdl-toggle', label: 'Toggle coverage', note: 'wires seen at both values' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Elaborate a hierarchy, then try to break it',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The elaborated netlist</div>' +
      '<div class="card-body"><div id="hdl-graph" class="mermaid-host"></div>' +
      '<p class="note" id="hdl-graph-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('hdl-bench', 'The testbench, vector by vector',
        ['Inputs', 'Outputs', 'The model says', 'Agree?', 'Settling time']) +
      card('hdl-library', 'The library, and what each module costs when elaborated',
        ['Module', 'Ports', 'Instances inside', 'Gates', 'Depth', 'Exhaustive check']) +
      chartCard() +
      card('hdl-coverage', 'Three test lists, and what each one actually covered',
        ['Test list', 'Vectors', 'Share of the input space', 'Toggle coverage',
          'Caught the injected bug?']) +
      card('hdl-flow', 'The flow, and what each step can and cannot catch',
        ['Step', 'What it checks', 'What it cannot see', 'The software equivalent']);
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Coverage against effort, for the three test lists</div>' +
      '<div class="card-body"><div id="hdl-chart" class="chart-host"></div>' +
      '<p class="note" id="hdl-chart-note"></p></div></div>';
  }

  function card(id, title, columns) {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">' + title + '</div>' +
      '<div class="card-body"><table class="ref-table" id="' + id + '"><thead><tr>' +
      columns.map(function (name) { return '<th>' + name + '</th>'; }).join('') +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="' + id + '-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS, MODULES: MODULES };
}));
