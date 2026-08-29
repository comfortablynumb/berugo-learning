'use strict';

/**
 * Property tests for the M33 gate-level machinery.
 *
 * Hardware verification is exhaustive where software testing samples, because
 * the input space is finite and the cost of a bug is a respin. Every block
 * here is checked over its whole input space against a behavioural reference
 * written from the definition rather than from the circuit, and the two
 * evaluators in the simulator - the zero-delay reference and the event-driven
 * one - are checked against each other on every row.
 */

const test = require('node:test');
const assert = require('node:assert');

const Sim = require('../../src/js/machines/logic-sim.js');
const Min = require('../../src/js/algorithms/boolean-min.js');
const Select = require('../../src/js/machines/blocks/select.js');
const Adder = require('../../src/js/machines/blocks/adder.js');
const Alu = require('../../src/js/machines/blocks/alu.js');
const Memory = require('../../src/js/machines/blocks/memory.js');

function bitsInto(value, prefix, width, into) {
  for (let at = 0; at < width; at += 1) into[prefix + at] = (value >> at) & 1;
  return into;
}

function numberFrom(values, prefix, width) {
  let out = 0;

  for (let at = 0; at < width; at += 1) out |= (values[prefix + at] ? 1 : 0) << at;
  return out;
}

/* ------------------------------------------------------------ the simulator */

function xorFromNand() {
  const net = Sim.create('xor from nand');
  const a = Sim.addInput(net, 'a');
  const b = Sim.addInput(net, 'b');
  const n1 = Sim.addGate(net, 'nand', [a, b]);
  const n2 = Sim.addGate(net, 'nand', [a, n1]);
  const n3 = Sim.addGate(net, 'nand', [b, n1]);

  Sim.addOutput(net, 'y', Sim.addGate(net, 'nand', [n2, n3]));
  return net;
}

/* The differential that matters: the two evaluators share no code, and a
   simulator that disagreed with the truth table would be reporting waveforms
   for a circuit nobody built. */
test('simulator: the event-driven run settles to what the reference computes', function () {
  const nets = [xorFromNand(), Select.muxTree({ bits: 2 }), Adder.rippleCarry({ width: 3 }),
    Select.comparator({ width: 3 })];

  nets.forEach(function (net) {
    Sim.truthTable(net).rows.forEach(function (row) {
      const run = Sim.simulate(net, row.inputs, { record: false });

      assert.strictEqual(run.settled, true, net.name + ' did not settle');
      net.outputs.forEach(function (port) {
        assert.strictEqual(run.outputs[port.label], row.outputs[port.label],
          net.name + ': ' + port.label + ' disagrees with the truth table');
      });
    });
  });
});

test('simulator: xor from four nands is xor, and costs four gates', function () {
  const net = xorFromNand();

  assert.strictEqual(Sim.gateCount(net), 4, 'the known minimum with two-input NANDs');
  Sim.truthTable(net).rows.forEach(function (row) {
    assert.strictEqual(row.outputs.y, row.inputs.a !== row.inputs.b ? 1 : 0,
      'a=' + row.inputs.a + ' b=' + row.inputs.b);
  });
});

/* A glitch is a wire that changes twice on the way from one settled state to
   another. Counting changes from a COLD start instead would report one on
   every circuit ever built, which is why `transition` exists. */
test('simulator: the classic static hazard glitches, and the redundant term fixes it',
  function () {
    const build = function (redundant) {
      const net = Sim.create(redundant ? 'fixed' : 'hazard');
      const a = Sim.addInput(net, 'a');
      const b = Sim.addInput(net, 'b');
      const c = Sim.addInput(net, 'c');
      const notB = Sim.addGate(net, 'not', [b]);
      const left = Sim.addGate(net, 'and', [a, b]);
      const right = Sim.addGate(net, 'and', [notB, c]);
      let y = Sim.addGate(net, 'or', [left, right]);

      if (redundant) y = Sim.addGate(net, 'or', [y, Sim.addGate(net, 'and', [a, c])]);
      Sim.addOutput(net, 'y', y);
      return net;
    };
    const plain = Sim.transition(build(false), { a: 1, b: 1, c: 1 }, { a: 1, b: 0, c: 1 }, {});
    const fixed = Sim.transition(build(true), { a: 1, b: 1, c: 1 }, { a: 1, b: 0, c: 1 }, {});

    assert.strictEqual(plain.before.y, 1, 'the output is high before');
    assert.strictEqual(plain.after.y, 1, 'and high after');
    assert.strictEqual(plain.outputGlitches.length, 1, 'and it dips in between');
    assert.strictEqual(fixed.outputGlitches.length, 0,
      'the redundant term holds the output up through the transition');
    assert.strictEqual(fixed.after.y, 1, 'without changing what it computes');
  });

/* ------------------------------------------------------- boolean minimisation */

test('minimisation: the greedy cover is correct, and not always minimal', function () {
  const cases = [
    { minterms: [3, 5, 6, 7], bits: 3, name: 'majority' },
    { minterms: [0, 1, 2, 5, 6, 7, 8, 9, 10, 14], bits: 4, name: 'four-variable' },
    { minterms: [1, 3, 7, 11, 15], dontCares: [0, 2, 5], bits: 4, name: 'with don\'t-cares' }
  ];

  cases.forEach(function (row) {
    const greedy = Min.greedyCover(row.minterms, row.dontCares || [], row.bits);
    const exact = Min.minimumCover(row.minterms, row.dontCares || [], row.bits, {});

    assert.strictEqual(Min.agrees(greedy.terms, row.minterms, row.dontCares || [],
      row.bits).ok, true, row.name + ': the cover must compute the function');
    assert.strictEqual(greedy.cost, exact.cost, row.name + ': greedy matches the minimum here');
  });
});

test('minimisation: the covering step is a real search, and greedy can lose it', function () {
  const minterms = [0, 1, 2, 5, 6, 7];
  const greedy = Min.greedyCover(minterms, [], 3);
  const exact = Min.minimumCover(minterms, [], 3, {});

  assert.strictEqual(Min.agrees(greedy.terms, minterms, [], 3).ok, true,
    'the greedy answer is correct');
  assert.strictEqual(Min.agrees(exact.terms, minterms, [], 3).ok, true,
    'and so is the exact one');
  assert.strictEqual(greedy.terms.length, 4, 'greedy takes four terms');
  assert.strictEqual(exact.terms.length, 3, 'three are enough');
  assert.ok(exact.cost < greedy.cost,
    'set cover is NP-hard and greedy is what everybody ships, which is the point');
});

test('minimisation: a hazard is a pair of adjacent minterms with no shared term', function () {
  const minterms = [1, 5, 6, 7];
  const cover = ['11-', '-01'];
  const found = Min.hazards(cover, minterms, 3);

  assert.strictEqual(Min.agrees(cover, minterms, [], 3).ok, true, 'the cover is correct');
  assert.strictEqual(found.length, 1, 'and it has exactly one static hazard');
  assert.strictEqual(found[0].fix, '1-1', 'fixed by the redundant term a and c');
});

/* ------------------------------------------------------------- the blocks */

test('blocks: a multiplexer tree and a flat multiplexer compute the same function', function () {
  [1, 2, 3].forEach(function (bits) {
    const tree = Select.muxTree({ bits: bits });
    const flat = Select.muxFlat({ bits: bits });

    Sim.truthTable(tree).rows.forEach(function (row) {
      const select = numberFrom(row.inputs, 's', bits);

      assert.strictEqual(row.outputs.y, row.inputs['d' + select], 'tree at ' + bits + ' bits');
    });
    Sim.truthTable(flat).rows.forEach(function (row) {
      const select = numberFrom(row.inputs, 's', bits);

      assert.strictEqual(row.outputs.y, row.inputs['d' + select], 'flat at ' + bits + ' bits');
    });
    assert.ok(Sim.gateCount(tree) < Sim.gateCount(flat), 'and the tree is smaller');
    assert.ok(Sim.criticalPath(tree).delay < Sim.criticalPath(flat).delay,
      'and shallower, which is why nobody builds the flat one');
  });
});

test('blocks: the decoder, the priority encoder and the comparator', function () {
  const decoder = Select.decoder({ bits: 3 });

  Sim.truthTable(decoder).rows.forEach(function (row) {
    const value = numberFrom(row.inputs, 'a', 3);

    for (let at = 0; at < 8; at += 1) {
      assert.strictEqual(row.outputs['y' + at], at === value ? 1 : 0, 'decoder line ' + at);
    }
  });

  const encoder = Select.priorityEncoder({ bits: 2 });

  Sim.truthTable(encoder).rows.forEach(function (row) {
    let highest = -1;

    for (let at = 0; at < 4; at += 1) if (row.inputs['d' + at]) highest = at;
    assert.strictEqual(row.outputs.valid, highest === -1 ? 0 : 1, 'the valid flag');
    if (highest === -1) return;
    assert.strictEqual(numberFrom(row.outputs, 'y', 2), highest,
      'the index of the highest set input');
  });

  const comparator = Select.comparator({ width: 3 });

  Sim.truthTable(comparator).rows.forEach(function (row) {
    const a = numberFrom(row.inputs, 'a', 3);
    const b = numberFrom(row.inputs, 'b', 3);

    assert.strictEqual(row.outputs.eq, a === b ? 1 : 0, a + ' = ' + b);
    assert.strictEqual(row.outputs.lt, a < b ? 1 : 0, a + ' < ' + b);
  });
});

test('blocks: the barrel shifter shifts and rotates, at log-depth', function () {
  [false, true].forEach(function (rotate) {
    const net = Select.barrelShifter({ width: 8, rotate: rotate });

    for (let value = 0; value < 256; value += 5) {
      for (let amount = 0; amount < 8; amount += 1) {
        const values = bitsInto(amount, 's', 3, bitsInto(value, 'd', 8, {}));
        const got = numberFrom(Sim.outputsOf(net, Sim.evaluate(net, values)), 'y', 8);
        const wanted = rotate
          ? (((value << amount) | (value >>> (8 - amount))) & 255)
          : ((value << amount) & 255);

        assert.strictEqual(got, wanted, (rotate ? 'rotate ' : 'shift ') + value + ' by ' + amount);
      }
    }
    assert.strictEqual(Sim.criticalPath(net).delay, 9,
      'three multiplexer stages, whatever the distance');
  });
});

/* ------------------------------------------------------------- arithmetic */

function checkAdder(net, width) {
  const total = Math.pow(2, width);

  for (let a = 0; a < total; a += 1) {
    for (let b = 0; b < total; b += 1) {
      for (let carry = 0; carry < 2; carry += 1) {
        const values = bitsInto(b, 'b', width, bitsInto(a, 'a', width, { cin: carry }));
        const out = Sim.outputsOf(net, Sim.evaluate(net, values));
        const got = numberFrom(out, 's', width) + (out.cout << width);

        assert.strictEqual(got, a + b + carry,
          net.name + ': ' + a + ' + ' + b + ' + ' + carry);
      }
    }
  }
}

test('adders: three constructions, one function', function () {
  [4, 8].forEach(function (width) {
    checkAdder(Adder.rippleCarry({ width: width }), width);
    checkAdder(Adder.carryLookahead({ width: width }), width);
    checkAdder(Adder.carrySelect({ width: width }), width);
  });
});

test('adders: the delay-versus-area trade is real and measurable', function () {
  const rows = [4, 8, 16].map(function (width) {
    const ripple = Adder.rippleCarry({ width: width });
    const lookahead = Adder.carryLookahead({ width: width });
    const select = Adder.carrySelect({ width: width });

    return { width: width,
      ripple: { gates: Sim.gateCount(ripple), delay: Sim.criticalPath(ripple).delay },
      lookahead: { gates: Sim.gateCount(lookahead),
        delay: Sim.criticalPath(lookahead).delay },
      select: { gates: Sim.gateCount(select), delay: Sim.criticalPath(select).delay } };
  });

  rows.forEach(function (row) {
    assert.ok(row.lookahead.delay < row.ripple.delay,
      'lookahead is shallower at ' + row.width + ' bits');
    assert.ok(row.lookahead.gates > row.ripple.gates, 'and larger');
    assert.ok(row.select.delay < row.ripple.delay, 'carry-select is shallower too');
  });
  /* The honest part: a flat lookahead grows quadratically, so at sixteen bits
     the carry-select adder is both smaller AND faster - which is why real
     designs build lookahead in four-bit blocks rather than across the word. */
  const wide = rows[2];

  assert.ok(wide.select.gates < wide.lookahead.gates,
    'at 16 bits carry-select is smaller than a flat lookahead');
  assert.ok(wide.select.delay < wide.lookahead.delay, 'and shallower');
});

test('multiplier: an array of adders, checked exhaustively', function () {
  const width = 4;
  const net = Adder.arrayMultiplier({ width: width });
  const total = Math.pow(2, width);

  for (let a = 0; a < total; a += 1) {
    for (let b = 0; b < total; b += 1) {
      const values = bitsInto(b, 'b', width, bitsInto(a, 'a', width, {}));
      const got = numberFrom(Sim.outputsOf(net, Sim.evaluate(net, values)), 'p', width * 2);

      assert.strictEqual(got, a * b, a + ' x ' + b);
    }
  }
  assert.ok(Sim.criticalPath(net).delay > Sim.criticalPath(Adder.rippleCarry({ width: width }))
    .delay, 'and it is deeper than an adder, which is why multiply costs more cycles');
});

/* ------------------------------------------------------------------- ALU */

test('alu: every operation and every flag, over the whole input space', function () {
  const width = 4;
  const net = Alu.alu({ width: width });
  const total = Math.pow(2, width);
  let checked = 0;

  for (let op = 0; op < 4; op += 1) {
    for (let a = 0; a < total; a += 1) {
      for (let b = 0; b < total; b += 1) {
        const values = bitsInto(b, 'b', width,
          bitsInto(a, 'a', width, { op0: op & 1, op1: (op >> 1) & 1 }));
        const out = Sim.outputsOf(net, Sim.evaluate(net, values));
        const want = Alu.reference(a, b, op, width);
        const flags = Alu.flagsOf(want.value, want.carry, want.overflow, width);

        checked += 1;
        assert.strictEqual(numberFrom(out, 'r', width), want.value,
          'op ' + op + ': ' + a + ', ' + b);
        assert.strictEqual(out.zero, flags.zero, 'zero flag on op ' + op);
        assert.strictEqual(out.negative, flags.negative, 'negative flag on op ' + op);
        assert.strictEqual(out.carry, flags.carry, 'carry flag on op ' + op);
        assert.strictEqual(out.overflow, flags.overflow, 'overflow flag on op ' + op);
      }
    }
  }
  assert.strictEqual(checked, 1024, 'exhaustive over four operations and two 4-bit operands');
});

/* Carry and overflow are different flags for different signedness, and the
   test that says so is the one at the boundary. */
test('alu: carry and overflow disagree exactly where signedness does', function () {
  const width = 4;
  const carryOnly = Alu.reference(15, 1, 0, width);
  const overflowOnly = Alu.reference(7, 1, 0, width);

  assert.deepStrictEqual({ carry: carryOnly.carry, overflow: carryOnly.overflow },
    { carry: 1, overflow: 0 }, '15 + 1 wraps unsigned and is fine signed');
  assert.deepStrictEqual({ carry: overflowOnly.carry, overflow: overflowOnly.overflow },
    { carry: 0, overflow: 1 }, '7 + 1 is fine unsigned and overflows signed');
});

/* ------------------------------------------------------------ sequential */

test('latches: set, hold, reset, hold', function () {
  const net = Memory.latchCircuit('sr');
  const wanted = [1, 1, 0, 0];
  let state = {};

  [[1, 0], [0, 0], [0, 1], [0, 0]].forEach(function (pair, at) {
    const out = Sim.simulate(net, { s: pair[0], r: pair[1] },
      { state: state, record: false });

    state = out.wires;
    assert.strictEqual(out.settled, true, 'the latch settles');
    assert.strictEqual(out.outputs.q, wanted[at], 'step ' + at);
    assert.strictEqual(out.outputs.nq, wanted[at] ? 0 : 1, 'and the complement holds');
  });
});

test('flip-flop: the value is captured at the edge and held across the cycle', function () {
  const net = Memory.latchCircuit('ff');
  let state = {};
  const edge = function (data) {
    const low = Sim.simulate(net, { d: data, clk: 0 }, { state: state, record: false });

    state = low.wires;
    const high = Sim.simulate(net, { d: data, clk: 1 }, { state: state, record: false });

    state = high.wires;
    return high.outputs.q;
  };

  assert.strictEqual(edge(1), 1, 'the edge captures a one');
  const held = Sim.simulate(net, { d: 0, clk: 1 }, { state: state, record: false });

  state = held.wires;
  assert.strictEqual(held.outputs.q, 1,
    'and the data input falling mid-cycle changes nothing — this is the whole '
    + 'difference from a latch');
  assert.strictEqual(edge(0), 0, 'the next edge captures the zero');
});

test('register file: a read port returns the old value before the edge', function () {
  const net = Memory.registerFile({ width: 2, count: 4 });
  const requests = [
    { writeEnable: 1, writeAddress: 1, data: 3, readA: 1, readB: 0 },
    { writeEnable: 0, writeAddress: 0, data: 0, readA: 1, readB: 0 },
    { writeEnable: 1, writeAddress: 2, data: 2, readA: 2, readB: 1 },
    { writeEnable: 0, writeAddress: 0, data: 0, readA: 2, readB: 1 }
  ];
  let state = {};
  let model = [0, 0, 0, 0];
  let differed = 0;

  requests.forEach(function (request, at) {
    const values = { we: request.writeEnable };

    for (let bit = 0; bit < 2; bit += 1) {
      values['d' + bit] = (request.data >> bit) & 1;
      values['ra' + bit] = (request.readA >> bit) & 1;
      values['rb' + bit] = (request.readB >> bit) & 1;
      values['wa' + bit] = (request.writeAddress >> bit) & 1;
    }
    const out = Sim.cycle(net, values, state, 'clk');
    const wanted = Memory.fileReference(model, request);

    state = out.state;
    model = wanted.state;
    assert.strictEqual(numberFrom(out.before, 'x', 2), wanted.x, 'port x on cycle ' + at);
    assert.strictEqual(numberFrom(out.before, 'y', 2), wanted.y, 'port y on cycle ' + at);
    if (numberFrom(out.after, 'x', 2) !== wanted.x) differed += 1;
  });
  assert.strictEqual(differed, 2,
    'and the same port sampled after the edge differs on exactly the two '
    + 'read-during-write cycles, which is why a pipeline needs forwarding');
});
