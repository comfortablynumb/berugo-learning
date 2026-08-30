'use strict';

/**
 * Every figure the M34.4-M34.6 content quotes, recomputed from the gate-level
 * datapath, the control decoder and the multi-cycle comparison.
 *
 * Building the datapath is expensive - it is 5 945 gates - so it is built once
 * here and shared. Nothing in this file steps the gate machine; the
 * instruction-by-instruction differential lives in brv32-modules.test.js,
 * where it has a budget.
 */

const test = require('node:test');
const assert = require('node:assert');

const Sim = require('../../src/js/machines/logic-sim.js');
const Timing = require('../../src/js/machines/timing.js');
const Isa = require('../../src/js/machines/brv32/isa.js');
const Control = require('../../src/js/machines/brv32/control.js');
const GateCpu = require('../../src/js/machines/brv32/gate-cpu.js');
const Multicycle = require('../../src/js/machines/brv32/multicycle.js');
const Assembler = require('../../src/js/machines/brv32/assembler.js');
const Programs = require('../../src/js/machines/brv32/programs.js');
const SignalMachine = require('../../src/js/machines/brv32/signal-machine.js');

require('../../src/js/content/concepts-brv32-datapath.js');
require('../../src/js/content/examples-brv32-datapath.js');
const prose = require('../support/worked-example-prose.js');

const machine = GateCpu.create({ image: [], entry: 0 });
const report = Timing.frequency(machine.net, {});
const stages = Multicycle.stageDelays();

/* ------------------------------------------------ 34.4 the datapath */

test('datapath: the whole machine, in gates and in gate delays', function () {
  assert.strictEqual(Sim.gateCount(machine.net), 5945, 'gates');
  assert.strictEqual(Sim.transistorCount(machine.net), 75698, 'transistors');
  assert.strictEqual(report.period, 178, 'the clock period');
  assert.strictEqual(report.logic, 175, 'of which this is logic');
  assert.strictEqual(report.overhead, 3, 'and this is flip-flop overhead');

  prose.quotes('single-cycle-datapath',
    ['5 945 gates, 75 698 transistors, clock period 178 gate delays',
      '175 of logic plus 3 of flip-flop overhead']);
});

test('datapath: area and delay rank the blocks differently', function () {
  const decoder = Control.decoder();
  const aluDecoder = Control.aluDecoder();
  const byName = {};

  stages.forEach(function (row) { byName[row.name] = row; });

  assert.strictEqual(byName.decode.gates, 4271, 'the register file');
  assert.strictEqual(byName.decode.delay, 16, 'is shallow');
  assert.strictEqual(byName.execute.gates, 869, 'the ALU');
  assert.strictEqual(byName.execute.delay, 148, 'is deep');
  assert.strictEqual(byName.address.gates, 160, 'the PC adder');
  assert.strictEqual(byName.address.delay, 130, 'is nearly as deep');
  assert.strictEqual(Sim.gateCount(decoder), 103, 'the control decoder');
  assert.strictEqual(Sim.criticalPath(decoder).delay, 24, 'at depth 24');
  assert.strictEqual(Sim.gateCount(aluDecoder), 48, 'the ALU function decoder');
  assert.strictEqual(Sim.criticalPath(aluDecoder).delay, 13, 'at depth 13');

  const total = Sim.gateCount(machine.net);

  assert.strictEqual(Math.round(100 * byName.decode.gates / total), 72,
    'the register file is 72% of the area');
  assert.strictEqual(Math.round(100 * byName.execute.gates / total), 15,
    'and the ALU is 15%');
  assert.strictEqual(Math.round(100 * byName.execute.delay / report.logic), 85,
    'while the ALU is 85% of the logic delay');

  prose.quotes('single-cycle-datapath',
    ['register file 4 271 (72%), ALU 869 (15%), PC adder 160 (3%), control decoder ',
      'ALU 148, PC adder 130, control decoder 24, register file 16, function decoder 13']);
});

/* --------------------------------------------------- 34.5 the control unit */

const FLAT = ['regWrite', 'aluSrc', 'memRead', 'memWrite', 'branch', 'jump', 'jalr'];
const OPCODE_SAMPLES = { op: 'add a0, a1, a2', opImm: 'addi a0, a1, 8', load: 'lw a0, 8(a1)',
  store: 'sw a0, 8(a1)', branch: 'beq a0, a1, 8', jal: 'jal ra, 8',
  jalr: 'jalr ra, a0, 0', lui: 'lui a0, 0x10000', auipc: 'auipc a0, 1' };

function signalsFor(text) {
  const out = Assembler.assemble('  ' + text, { origin: 0 });

  return Control.signalsFor(Isa.decode(out.listing[0].word >>> 0));
}

test('control: the column fan-ins are the OR gates the decoder builds', function () {
  const counts = {};

  FLAT.forEach(function (name) { counts[name] = 0; });
  Object.keys(OPCODE_SAMPLES).forEach(function (opcode) {
    const vector = signalsFor(OPCODE_SAMPLES[opcode]);

    FLAT.forEach(function (name) { if (vector[name]) counts[name] += 1; });
  });

  assert.strictEqual(counts.memWrite, 1, 'only the store row');
  assert.strictEqual(counts.memRead, 1, 'only the load row');
  assert.strictEqual(counts.branch, 1, 'only the branch row');
  assert.strictEqual(counts.jump, 2, 'jal and jalr');
  assert.strictEqual(counts.aluSrc, 5, 'opImm, load, store, jalr and auipc');
  assert.strictEqual(counts.regWrite, 7, 'everything except store and branch');

  const widest = Object.keys(OPCODE_SAMPLES).reduce(function (best, opcode) {
    const vector = signalsFor(OPCODE_SAMPLES[opcode]);
    const count = FLAT.filter(function (name) { return vector[name]; }).length;

    return count > best ? count : best;
  }, 0);

  assert.strictEqual(widest, 4, 'jalr asserts four; nothing asserts more');

  prose.quotes('the-control-unit',
    ['1 — only the store row, so memWrite is a wire from a single AND term',
      '7 of 9 rows: op, opImm, load, jal, jalr, lui and auipc']);
});

test('control: the gates match the table on every instruction, and refuse the rest', function () {
  const net = Control.decoder();
  let agreed = 0;

  Isa.TABLE.forEach(function (row) {
    const word = Isa.encode(row.name, { rd: 5, rs1: 6, rs2: 7,
      imm: row.format === 'U' ? 0x1000 : 4 });
    const want = Control.signalsFor(Isa.decode(word));
    const values = {};

    for (let at = 0; at < 7; at += 1) values['op' + at] = (word >>> at) & 1;
    const out = Sim.outputsOf(net, Sim.evaluate(net, values));
    const same = FLAT.every(function (name) {
      return (out[name] ? 1 : 0) === want[name];
    });

    if (same) agreed += 1;
  });

  assert.strictEqual(Isa.TABLE.length, 42, 'the instruction set');
  assert.strictEqual(agreed, 42, 'and the gates agree on all of it');

  let undefinedOpcodes = 0;

  for (let opcode = 0; opcode < 128; opcode += 1) {
    const decoded = Isa.decode((opcode | (5 << 7)) >>> 0);

    if (decoded.ok) continue;
    undefinedOpcodes += 1;
    const signals = Control.signalsFor(decoded);

    assert.strictEqual(signals.regWrite, 0, 'opcode ' + opcode + ' must write no register');
    assert.strictEqual(signals.memWrite, 0, 'opcode ' + opcode + ' must write no memory');
  }
  assert.strictEqual(undefinedOpcodes, 118, '128 opcode values, 10 of which have a row');

  prose.quotes('the-control-unit',
    ['42 of 42 agree on every signal',
      'all 118 opcodes with no row leave regWrite and memWrite low']);
});

test('control: one signal forced, three programs, three different failures', function () {
  const expected = {
    none: ['55', '37', '5'],
    'regWrite=0': ['0', '0', '0'],
    'aluSrc=1': ['0', '59049235', 'never finished'],
    'branch=0': ['never finished', 'never finished', 'never finished'],
    'memWrite=1': ['faulted after 1', 'faulted after 1', 'faulted after 1'],
    'writeBack=1': ['0', '1303', 'never finished']
  };

  Object.keys(expected).forEach(function (key) {
    const override = key === 'none' ? null : overrideOf(key);

    ['sum', 'arrayMax', 'strlen'].forEach(function (name, index) {
      assert.strictEqual(describe(name, override), expected[key][index],
        key + ' on ' + name);
    });
  });

  prose.quotes('the-control-unit',
    ['0, 0 and 0: every value stays zero',
      'aluSrc: 0, 59 049 235, never finishes. writeBack: 0, 1 303, never finishes']);
});

function overrideOf(text) {
  const parts = text.split('=');
  const out = {};

  out[parts[0]] = Number(parts[1]);
  return out;
}

function describe(name, override) {
  const spec = Programs.CATALOGUE[name];
  const image = Assembler.assemble(spec.source, { origin: 0 });
  const run = SignalMachine.runWith(image.bytes, override, { budget: 400 });

  if (run.halted) return 'faulted after ' + run.steps;
  if (!run.finished) return 'never finished';
  return String(run.state.registers[spec.result]);
}

/* ------------------------------------------------- 34.6 multi-cycle */

function comparisonFor(name) {
  const image = Assembler.assemble(Programs.CATALOGUE[name].source, { origin: 0 });

  return Multicycle.compare(image.bytes,
    { stages: stages, singlePeriod: report.period, budget: 3000 });
}

test('multicycle: the performance equation on the sum program', function () {
  const row = comparisonFor('sum');

  assert.strictEqual(row.slowest, 148, 'the execute stage sets the multi-cycle period');
  assert.strictEqual(row.multi.period, 151, '148 plus 3 of overhead');
  assert.strictEqual(row.single.period, 178, 'against the whole datapath');
  assert.strictEqual(row.mix.retired, 44, 'the instruction count');
  assert.strictEqual(Number(row.cpi.toFixed(2)), 3.7, 'measured from the class mix');
  assert.strictEqual(row.multi.cycles, 163, 'so 163 cycles');
  assert.strictEqual(row.single.cycles * row.single.period, 7832, 'single-cycle total');
  assert.strictEqual(row.multi.cycles * row.multi.period, 24613, 'multi-cycle total');
  assert.strictEqual(Number((24613 / 7832).toFixed(1)), 3.1, 'a 3.1x loss');
  assert.strictEqual(Math.round(100 * (178 - 151) / 178), 15, 'from a 15% shorter clock');

  prose.quotes('multi-cycle-execution',
    ['single: 44 x 178 = 7 832. multi: 163 x 151 = 24 613',
      '24 613 / 7 832 = 3.1 times slower',
      'decode 16 gate delays, execute 148, address 130']);
});

test('multicycle: the break-even stage period, and the CPI that would also do it', function () {
  const row = comparisonFor('sum');

  assert.strictEqual(row.breakEven, 48, '7832 / 163, rounded down');
  assert.strictEqual(row.breakEven - row.overhead, 45, 'leaving 45 for the stage logic');
  assert.strictEqual(Number((148 / 45).toFixed(1)), 3.3, 'so 3.3x faster would be needed');
  assert.strictEqual(Number((178 / 151).toFixed(2)), 1.18, 'or a CPI below 1.18');

  prose.quotes('multi-cycle-execution',
    ['7 832 / 163 = 48 gate delays', '48 - 3 = 45 gate delays of logic in the slowest stage',
      'CPI would have to fall below 178 / 151 = 1.18']);
});

test('multicycle: all five programs, and the single-cycle machine wins each', function () {
  const expected = { sum: [44, 3.70, 7832, 24613], factorial: [125, 3.87, 22250, 73084],
    arrayMax: [43, 3.84, 7654, 24915], strlen: [32, 3.94, 5696, 19026],
    console: [47, 3.96, 8366, 28086] };

  Object.keys(expected).forEach(function (name) {
    const row = comparisonFor(name);
    const want = expected[name];

    assert.strictEqual(row.mix.retired, want[0], name + ' instructions');
    assert.strictEqual(Number(row.cpi.toFixed(2)), want[1], name + ' CPI');
    assert.strictEqual(row.single.cycles * row.single.period, want[2], name + ' single-cycle');
    assert.strictEqual(row.multi.cycles * row.multi.period, want[3], name + ' multi-cycle');
    assert.ok(want[3] > want[2], name + ': the single-cycle machine wins');
  });
});
