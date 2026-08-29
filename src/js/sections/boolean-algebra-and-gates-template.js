/** Markup for "Boolean algebra and gates". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GatesTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  /** Every circuit here computes a function of at most three inputs, so the
   *  truth table is short enough to print and the demo can derive the
   *  canonical forms from it rather than being told them. */
  function build(Sim, kind) {
    const net = Sim.create(kind);
    const a = Sim.addInput(net, 'a');
    const b = Sim.addInput(net, 'b');

    if (kind === 'xor') { Sim.addOutput(net, 'y', Sim.addGate(net, 'xor', [a, b])); return net; }
    if (kind === 'xorFromNand') return xorFromNand(Sim, net, a, b);
    if (kind === 'notFromNand') {
      Sim.addOutput(net, 'y', Sim.addGate(net, 'nand', [a, a]));
      return net;
    }
    if (kind === 'andFromNand') return andFromNand(Sim, net, a, b);
    if (kind === 'orFromNand') return orFromNand(Sim, net, a, b);
    return threeInput(Sim, net, a, b, kind);
  }

  function xorFromNand(Sim, net, a, b) {
    const n1 = Sim.addGate(net, 'nand', [a, b]);
    const n2 = Sim.addGate(net, 'nand', [a, n1]);
    const n3 = Sim.addGate(net, 'nand', [b, n1]);

    Sim.addOutput(net, 'y', Sim.addGate(net, 'nand', [n2, n3]));
    return net;
  }

  function andFromNand(Sim, net, a, b) {
    const n1 = Sim.addGate(net, 'nand', [a, b]);

    Sim.addOutput(net, 'y', Sim.addGate(net, 'nand', [n1, n1]));
    return net;
  }

  function orFromNand(Sim, net, a, b) {
    const na = Sim.addGate(net, 'nand', [a, a]);
    const nb = Sim.addGate(net, 'nand', [b, b]);

    Sim.addOutput(net, 'y', Sim.addGate(net, 'nand', [na, nb]));
    return net;
  }

  function threeInput(Sim, net, a, b, kind) {
    const c = Sim.addInput(net, 'c');

    if (kind === 'mux') {
      Sim.addOutput(net, 'y', Sim.addGate(net, 'mux', [a, b, c]));
      return net;
    }
    if (kind === 'hazard') {
      const notB = Sim.addGate(net, 'not', [b]);
      const left = Sim.addGate(net, 'and', [a, b]);
      const right = Sim.addGate(net, 'and', [notB, c]);

      Sim.addOutput(net, 'y', Sim.addGate(net, 'or', [left, right]));
      return net;
    }
    const ab = Sim.addGate(net, 'and', [a, b]);
    const ac = Sim.addGate(net, 'and', [a, c]);
    const bc = Sim.addGate(net, 'and', [b, c]);

    Sim.addOutput(net, 'y', Sim.addGate(net, 'or', [Sim.addGate(net, 'or', [ab, ac]), bc]));
    return net;
  }

  const CIRCUITS = {
    xor: { label: 'exclusive or, as one gate',
      about: 'the gate a standard cell library gives you, and twelve transistors inside' },
    notFromNand: { label: 'not, from one NAND',
      about: 'a NAND with both inputs tied together, which is the whole proof that one gate '
        + 'type is enough' },
    xorFromNand: { label: 'exclusive or, from four NANDs',
      about: 'the same function with one gate type, which is what functional completeness means' },
    andFromNand: { label: 'and, from two NANDs',
      about: 'a NAND with its inputs tied together is an inverter, and NAND then NOT is AND' },
    orFromNand: { label: 'or, from three NANDs',
      about: 'De Morgan, built: invert both inputs, then NAND them' },
    majority: { label: 'majority of three', about: 'the carry output of a full adder' },
    mux: { label: 'a 2:1 multiplexer',
      about: 'the universal element a lookup table is made of' },
    hazard: { label: 'a and b, or not-b and c',
      about: 'correct on every row of its truth table, and it glitches' }
  };

  const CONTROLS = [
    { id: 'bag-circuit', kind: 'select', label: 'circuit', value: 'xorFromNand',
      options: Object.keys(CIRCUITS).map(function (id) {
        return { value: id, label: CIRCUITS[id].label };
      }) },
    { id: 'bag-a', kind: 'checkbox', label: 'input a', value: true },
    { id: 'bag-b', kind: 'checkbox', label: 'input b', value: false },
    { id: 'bag-c', kind: 'checkbox', label: 'input c (three-input circuits)', value: true }
  ];

  const METRICS = [
    { id: 'bag-output', label: 'Output now', note: 'for the inputs set above' },
    { id: 'bag-gates', label: 'Gates', note: 'and what they cost in transistors' },
    { id: 'bag-depth', label: 'Critical path', note: 'gate delays from input to output' },
    { id: 'bag-settle', label: 'Settling time', note: 'simulated, with per-gate delays' },
    { id: 'bag-minterms', label: 'Rows where the output is 1',
      note: 'the minterms, read off the truth table' },
    { id: 'bag-agree', label: 'Simulated rows matching the table',
      note: 'two evaluators that must agree' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Toggle the inputs and watch the gates settle',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The circuit, with its current values</div>' +
      '<div class="card-body"><div id="bag-circuit-graph" class="mermaid-host"></div>' +
      '<p class="note" id="bag-circuit-note"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('bag-truth', 'The truth table, derived by running the circuit',
        ['Row', 'Inputs', 'Output', 'Simulated', 'Settling time']) +
      card('bag-canonical', 'The canonical forms, generated from that table',
        ['Form', 'What it is', 'This function']) +
      chartCard() +
      card('bag-universal', 'One gate type is enough, and here is the price',
        ['Function', 'As one gate', 'From NANDs only', 'Transistors', 'Delay']) +
      card('bag-cost', 'What a gate costs, and why the cheap ones invert',
        ['Gate', 'Transistors', 'Delay', 'Why']);
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">Every circuit here, by area and by depth</div>' +
      '<div class="card-body"><div id="bag-chart" class="chart-host"></div>' +
      '<p class="note" id="bag-chart-note"></p></div></div>';
  }

  function card(id, title, columns) {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">' + title + '</div>' +
      '<div class="card-body"><table class="ref-table" id="' + id + '"><thead><tr>' +
      columns.map(function (name) { return '<th>' + name + '</th>'; }).join('') +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="' + id + '-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS,
    CIRCUITS: CIRCUITS, build: build };
}));
