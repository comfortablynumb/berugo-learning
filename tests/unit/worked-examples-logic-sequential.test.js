'use strict';

/**
 * Every figure the M33.6-M33.8 content quotes, recomputed from the latch, the
 * state machine and the register file, and then checked against the prose.
 *
 * The stateful readings are replays: each step is a simulation carrying the
 * previous step's state forward, exactly as the sections do it, because a
 * storage cell has no value independent of its history.
 */

const test = require('node:test');
const assert = require('node:assert');

const Sim = require('../../src/js/machines/logic-sim.js');
const Memory = require('../../src/js/machines/blocks/memory.js');
const Fsm = require('../../src/js/machines/fsm-synth.js');
const Timing = require('../../src/js/machines/timing.js');

require('../../src/js/content/concepts-logic-sequential.js');
require('../../src/js/content/examples-logic-sequential.js');
const prose = require('../support/worked-example-prose.js');

function portsFor(kind, data, control) {
  if (kind === 'sr') return { s: data ? 1 : 0, r: control ? 1 : 0 };
  if (kind === 'd') return { d: data ? 1 : 0, en: control ? 1 : 0 };
  return { d: data ? 1 : 0, clk: control ? 1 : 0 };
}

function replay(kind, steps) {
  const net = Memory.latchCircuit(kind);
  const rows = [];
  let state = null;

  steps.forEach(function (step) {
    const run = Sim.simulate(net, portsFor(kind, step.d, step.c),
      { state: state, record: false });

    state = run.state;
    rows.push({ q: run.outputs.q ? 1 : 0, settleTime: run.settleTime });
  });
  return { net: net, rows: rows };
}

test('latches: the SR sequence proves state, and costs two gates', function () {
  const run = replay('sr', [{ d: false, c: true }, { d: false, c: false },
    { d: true, c: false }, { d: false, c: false }]);
  const values = run.rows.map(function (row) { return row.q; });

  assert.deepStrictEqual(values, [0, 0, 1, 1], 'steps 2 and 4 apply the same inputs');
  assert.strictEqual(run.rows[0].settleTime, 1, 'the reset settles in one gate delay');
  assert.strictEqual(run.rows[2].settleTime, 3, 'and the set in three');
  assert.strictEqual(Sim.gateCount(run.net), 2, 'the cell is two gates');
  assert.strictEqual(Sim.transistorCount(run.net), 8, 'and eight transistors');

  prose.quotes('sequential-logic-and-state',
    ['q = 0, settling time 1 gate delay', 'q = 1, settling time 3 gate delays',
      'q = 1, where the same inputs gave 0 at step 2', '2 gates, 8 transistors']);
});

test('latches: transparency is what separates the latch from the flip-flop', function () {
  const steps = [{ d: true, c: false }, { d: true, c: true }, { d: false, c: true },
    { d: false, c: false }, { d: true, c: false }];
  const latch = replay('d', steps);
  const flop = replay('dff', steps);

  assert.deepStrictEqual(latch.rows.map(function (row) { return row.q; }), [0, 1, 0, 0, 0],
    'the latch follows the data down while the enable is high');
  assert.deepStrictEqual(flop.rows.map(function (row) { return row.q; }), [0, 1, 1, 1, 1],
    'the flip-flop does not');
  assert.strictEqual(Sim.gateCount(latch.net), 5, 'the latch is five gates');
  assert.strictEqual(Sim.transistorCount(latch.net), 22, 'and 22 transistors');
  assert.strictEqual(Sim.gateCount(flop.net), 11, 'the flip-flop is eleven gates');
  assert.strictEqual(Sim.transistorCount(flop.net), 46, 'and 46 transistors');

  prose.quotes('sequential-logic-and-state',
    ['the latch follows to q = 0; the flip-flop holds q = 1',
      'latch 5 gates and 22 transistors; flip-flop 11 gates and 46',
      '11 gates against 5']);
});

test('registers: six clocked cycles against a one-variable reference', function () {
  const width = 4;
  const net = Memory.register({ width: width });
  const plan = [{ d: 5, we: 1 }, { d: 9, we: 0 }, { d: 9, we: 1 }, { d: 0, we: 0 },
    { d: 12, we: 1 }, { d: 12, we: 0 }];
  let state = null;
  let held = 0;
  let agreed = 0;

  plan.forEach(function (step) {
    const values = { we: step.we };

    for (let at = 0; at < width; at += 1) values['d' + at] = (step.d >> at) & 1;
    const run = Sim.cycle(net, values, state, 'clk');
    let after = 0;

    for (let at = 0; at < width; at += 1) after += (run.after['q' + at] ? 1 : 0) << at;
    held = step.we ? step.d : held;
    state = run.state;
    if (after === held) agreed += 1;
  });

  assert.strictEqual(agreed, 6, 'every cycle matches the reference');
  assert.strictEqual(Sim.gateCount(net), 52, 'a 4-bit register is 52 gates');
  assert.strictEqual((52 / width).toFixed(1), '13.0', 'which is 13.0 per bit');

  prose.quotes('sequential-logic-and-state',
    ['52 gates — 13.0 per bit — matching the reference on 6 of 6 cycles',
      'A 4-bit register is 52 gates']);
});

/* ------------------------------------------------------- state machines */

test('state machines: three encodings, one behaviour', function () {
  const machine = Fsm.sequenceDetector('moore');
  const inputs = Fsm.allInputs(8);
  const rows = ['binary', 'onehot', 'gray'].map(function (scheme) {
    const result = Fsm.compare(machine, scheme, inputs);
    const timing = Timing.frequency(result.built.net, {});

    return { scheme: scheme, flops: result.flops, gates: result.gates,
      logic: timing.logic, period: timing.period, mismatches: result.mismatches.length };
  });
  const by = {};

  rows.forEach(function (row) { by[row.scheme] = row; });
  assert.deepStrictEqual([by.binary.flops, by.binary.gates, by.binary.logic, by.binary.period],
    [3, 26, 11, 14], 'binary encoding');
  assert.deepStrictEqual([by.onehot.flops, by.onehot.gates, by.onehot.logic, by.onehot.period],
    [5, 30, 7, 10], 'one-hot encoding');
  assert.deepStrictEqual([by.gray.flops, by.gray.gates, by.gray.logic, by.gray.period],
    [3, 20, 7, 10], 'gray encoding');
  rows.forEach(function (row) {
    assert.strictEqual(row.mismatches, 0, row.scheme + ' matches the transition table');
  });
  assert.strictEqual(inputs.length, 256, 'over every string of length 8');

  prose.quotes('hardware-state-machines',
    ['3 flip-flops, 26 gates, 11 gate delays of logic, clock period 14',
      '5 flip-flops, 30 gates, 7 gate delays of logic, clock period 10',
      '3 flip-flops, 20 gates, 7 gate delays of logic, clock period 10',
      '0 mismatches out of 256 strings',
      'cut the logic depth from 11 to 7']);
});

test('state machines: the netlist reproduces the table symbol by symbol', function () {
  const machine = Fsm.sequenceDetector('moore');
  const built = Fsm.synthesise(machine, 'binary');
  const abstract = Fsm.run(machine, '1101101101');
  const gates = Fsm.simulateMachine(built, '1101101101');

  assert.strictEqual(abstract.output, '0000100100', 'the abstract machine');
  assert.strictEqual(gates.output, '0000100100', 'and the gates agree');
  assert.strictEqual(abstract.trace[3].to, 'found', 'symbol 4 reaches the accepting state');
  assert.strictEqual(abstract.output[4], '1', 'and symbol 5 is where the output reads 1');

  prose.quotes('hardware-state-machines',
    ['output 0000100100 — the pattern is reported twice in ten symbols',
      'output 0000100100 — identical, symbol for symbol',
      'symbol 4 moves oneOneZero to found; symbol 5 is where the output reads 1']);
});

/* -------------------------------------------------------- memory arrays */

const CELL_GATES = Sim.gateCount(Memory.register({ width: 1 }));

function fileStudy(count, width) {
  const net = Memory.registerFile({ count: count, width: width });
  const gates = Sim.gateCount(net);
  const storage = count * width * CELL_GATES;

  return { cells: count * width, gates: gates,
    readDepth: Timing.frequency(net, {}).logic,
    accessShare: Math.round(100 * (gates - storage) / gates),
    perBit: gates / (count * width), net: net };
}

test('memory: storage against access logic, at four shapes', function () {
  assert.strictEqual(CELL_GATES, 13, 'a register bit is 13 gates including its enable mux');
  const rows = [fileStudy(2, 4), fileStudy(4, 4), fileStudy(8, 4), fileStudy(8, 8)];

  assert.deepStrictEqual(rows.map(function (row) { return row.cells; }), [8, 16, 32, 64],
    'flip-flops');
  assert.deepStrictEqual(rows.map(function (row) { return row.gates; }), [115, 244, 508, 980],
    'gates');
  assert.deepStrictEqual(rows.map(function (row) { return row.readDepth; }), [17, 22, 27, 27],
    'read depths');
  assert.deepStrictEqual(rows.map(function (row) { return row.accessShare; }), [10, 15, 18, 15],
    'the share that is access logic');
  assert.strictEqual(rows[1].perBit.toFixed(1), '15.3', 'gates per stored bit at 4 by 4');

  prose.quotes('memory-arrays',
    ['8 cells, 115 gates, read depth 17, access logic 10% of the gates',
      '16 cells, 244 gates, read depth 22, access logic 15%',
      '32 cells, 508 gates, read depth 27, access logic 18%',
      '64 cells, 980 gates, read depth 27, access logic 15%',
      '15.3 gates per stored bit',
      'from 10% of the gates to 18%']);
});

test('memory: read during write, measured on both sides of the edge', function () {
  const width = 4;
  const count = 4;
  const net = Memory.registerFile({ count: count, width: width });
  const plan = [
    { we: 1, write: 1, data: 5, readA: 1, readB: 2 },
    { we: 0, write: 1, data: 9, readA: 1, readB: 2 },
    { we: 1, write: 2, data: 9, readA: 1, readB: 2 },
    { we: 1, write: 1, data: 12, readA: 1, readB: 2 },
    { we: 0, write: 1, data: 0, readA: 1, readB: 2 },
    { we: 1, write: 2, data: 3, readA: 2, readB: 1 }
  ];
  let state = null;
  let contents = [0, 0, 0, 0];
  let differ = 0;
  let matched = 0;

  plan.forEach(function (step) {
    const values = { we: step.we, clk: 0 };
    const bits = Math.log2(count);

    for (let at = 0; at < width; at += 1) values['d' + at] = (step.data >> at) & 1;
    for (let at = 0; at < bits; at += 1) {
      values['wa' + at] = (step.write >> at) & 1;
      values['ra' + at] = (step.readA >> at) & 1;
      values['rb' + at] = (step.readB >> at) & 1;
    }
    const run = Sim.cycle(net, values, state, 'clk');
    const read = function (outputs) {
      let value = 0;

      for (let at = 0; at < width; at += 1) value += (outputs['x' + at] ? 1 : 0) << at;
      return value;
    };
    const model = Memory.fileReference(contents, { writeEnable: step.we,
      writeAddress: step.write, data: step.data, readA: step.readA, readB: step.readB });

    if (read(run.before) !== read(run.after)) differ += 1;
    if (read(run.before) === model.x) matched += 1;
    contents = model.state;
    state = run.state;
  });

  assert.strictEqual(matched, 6, 'the before-edge reading matches the model every cycle');
  assert.strictEqual(differ, 3, 'and three cycles read the register they write');

  prose.quotes('memory-arrays',
    ['3 of 6 cycles differ; 6 of 6 match the model on the before-edge reading',
      'before the edge 0, after the edge 5, model 0']);
});
