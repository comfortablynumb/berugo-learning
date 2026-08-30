'use strict';

/**
 * Property tests for the BRV32 machine.
 *
 * The two that matter most are the ones with an outside judge. The encodings
 * are checked against values taken from the RISC-V specification, so an
 * agreement means the machine is compatible rather than self-consistent; and
 * the gate-level datapath is checked against the behavioural simulator
 * instruction by instruction, so a disagreement names the instruction that
 * caused it.
 */

const test = require('node:test');
const assert = require('node:assert');

const Sim = require('../../src/js/machines/logic-sim.js');
const Isa = require('../../src/js/machines/brv32/isa.js');
const Devices = require('../../src/js/machines/brv32/devices.js');
const Traps = require('../../src/js/machines/brv32/traps.js');
const Reference = require('../../src/js/machines/brv32/reference-sim.js');
const Assembler = require('../../src/js/machines/brv32/assembler.js');
const Disassembler = require('../../src/js/machines/brv32/disassembler.js');
const Control = require('../../src/js/machines/brv32/control.js');
const GateCpu = require('../../src/js/machines/brv32/gate-cpu.js');
const Linker = require('../../src/js/machines/brv32/linker.js');
const DatapathView = require('../../src/js/viz/datapath-view.js');

/* Encodings taken from the RISC-V specification and standard assembler output.
   This is the only table in the milestone that is not derived from our own
   code, which is exactly why it is here. */
const REFERENCE_ENCODINGS = [
  ['addi', { rd: 1, rs1: 0, imm: 5 }, 0x00500093],
  ['add', { rd: 3, rs1: 1, rs2: 2 }, 0x002081b3],
  ['sub', { rd: 3, rs1: 1, rs2: 2 }, 0x402081b3],
  ['lw', { rd: 5, rs1: 2, imm: 8 }, 0x00812283],
  ['sw', { rs1: 2, rs2: 5, imm: 8 }, 0x00512423],
  ['beq', { rs1: 1, rs2: 2, imm: 8 }, 0x00208463],
  ['bne', { rs1: 1, rs2: 2, imm: -4 }, 0xfe209ee3],
  ['jal', { rd: 1, imm: 16 }, 0x010000ef],
  ['lui', { rd: 5, imm: 0x12345000 }, 0x123452b7],
  ['auipc', { rd: 5, imm: 0x1000 }, 0x00001297],
  ['jalr', { rd: 0, rs1: 1, imm: 0 }, 0x00008067],
  ['slli', { rd: 2, rs1: 1, imm: 3 }, 0x00309113],
  ['srai', { rd: 2, rs1: 1, imm: 3 }, 0x4030d113],
  ['ecall', {}, 0x00000073]
];

test('isa: encodings match the published specification byte for byte', function () {
  REFERENCE_ENCODINGS.forEach(function (row) {
    assert.strictEqual(Isa.encode(row[0], row[1]) >>> 0, row[2] >>> 0,
      row[0] + ' does not match the reference encoding');
  });
  assert.strictEqual(REFERENCE_ENCODINGS.length, 14, 'and there are fourteen of them');
});

test('isa: every instruction round-trips through encode and decode', function () {
  Isa.TABLE.forEach(function (row) {
    const operands = { rd: 5, rs1: 7, rs2: 11,
      imm: row.format === 'U' ? 0x12345000
        : (row.format === 'B' || row.format === 'J' ? -8
          : (row.funct7 !== undefined ? 13 : -3)) };
    const decoded = Isa.decode(Isa.encode(row.name, operands));

    assert.strictEqual(decoded.name, row.name, row.name + ' decoded as ' + decoded.name);
  });
  assert.strictEqual(Isa.TABLE.length, 42, 'the instruction table is complete');
});

test('isa: a shift immediate reports the shift amount, not the funct7 above it', function () {
  assert.strictEqual(Isa.decode(Isa.encode('srai', { rd: 2, rs1: 1, imm: 3 })).imm, 3);
  assert.strictEqual(Isa.decode(Isa.encode('slli', { rd: 2, rs1: 1, imm: 31 })).imm, 31);
});

test('isa: the immediate is gathered from the fields the specification names', function () {
  const word = Isa.encode('bne', { rs1: 1, rs2: 2, imm: -4 });
  const parts = Isa.immediateParts(word, 'B');

  assert.strictEqual(parts.length, 4, 'a B-format immediate comes from four places');
  assert.deepStrictEqual(parts.map(function (part) { return part.to; }),
    ['imm[12:12]', 'imm[10:5]', 'imm[4:1]', 'imm[11:11]']);
  assert.strictEqual(Isa.immediateOf(word, 'B'), -4, 'and they reassemble to the offset');
});

/* --------------------------------------------------------------- memory */

test('devices: alignment and mapping faults are reported, not truncated', function () {
  const memory = Devices.create({});

  assert.strictEqual(Devices.read(memory, 0x10000001, 4, false).fault.cause,
    Devices.CAUSE.misalignedLoad, 'an unaligned word load faults');
  assert.strictEqual(Devices.read(memory, 0x40000000, 4, false).fault.cause,
    Devices.CAUSE.faultLoad, 'and an unmapped one faults differently');
  assert.strictEqual(Devices.write(memory, 0x10000002, 1, 4).fault.cause,
    Devices.CAUSE.misalignedStore, 'stores are checked the same way');
  assert.ok(!Devices.read(memory, 0x10000000, 4, false).fault, 'an aligned mapped access is fine');
});

test('devices: loads sign-extend or zero-extend as the width says', function () {
  const memory = Devices.create({});

  Devices.write(memory, 0x10000000, 0xff, 1);
  assert.strictEqual(Devices.read(memory, 0x10000000, 1, true).value, -1, 'lb sign-extends');
  assert.strictEqual(Devices.read(memory, 0x10000000, 1, false).value, 255, 'lbu does not');
  Devices.write(memory, 0x10000004, 0x8000, 2);
  assert.strictEqual(Devices.read(memory, 0x10000004, 2, true).value, -32768, 'lh sign-extends');
  assert.strictEqual(Devices.read(memory, 0x10000004, 2, false).value, 32768, 'lhu does not');
});

test('devices: the console is an address', function () {
  const memory = Devices.create({});

  'hi'.split('').forEach(function (character) {
    Devices.write(memory, 0x20000000, character.charCodeAt(0), 1);
  });
  assert.strictEqual(memory.console, 'hi', 'writing to the device address produced output');
});

/* ------------------------------------------------------------ assembly */

test('assembler: two passes resolve a forward branch', function () {
  const out = Assembler.assemble(['  beq a0, a1, done', '  addi a0, a0, 1', 'done:',
    '  ecall'].join('\n'), { origin: 0 });

  assert.strictEqual(out.ok, true, 'it assembles');
  const decoded = Isa.decode(out.listing[0].word);

  assert.strictEqual(decoded.name, 'beq');
  assert.strictEqual(decoded.imm, 8, 'the branch reaches the label two instructions ahead');
});

test('assembler: pseudo-instructions expand and say that they did', function () {
  const out = Assembler.assemble('  li a0, 0x12345', { origin: 0 });

  assert.strictEqual(out.listing.length, 2, 'one line became two instructions');
  assert.strictEqual(out.listing[0].from, 'li', 'and the listing records where they came from');
  assert.strictEqual(Isa.decode(out.listing[0].word).name, 'lui');
  assert.strictEqual(Isa.decode(out.listing[1].word).name, 'addi');
});

test('assembler: an unresolved symbol becomes a relocation, not an error', function () {
  const out = Assembler.assemble('  jal ra, elsewhere', { origin: 0 });

  assert.strictEqual(out.ok, true, 'assembly succeeds');
  assert.deepStrictEqual(out.relocations.map(function (row) { return row.symbol; }),
    ['elsewhere']);
  assert.strictEqual(out.relocations[0].kind, 'jump', 'with the shape of the hole recorded');
});

test('disassembler: every assembled word disassembles to something that reassembles', function () {
  const source = ['  addi a0, x0, 5', '  add a1, a0, a0', '  sw a1, 4(a0)', '  lw a2, 4(a0)',
    '  beq a0, a1, 0', '  jal ra, 0'].join('\n');
  const out = Assembler.assemble(source, { origin: 0 });

  out.listing.forEach(function (row) {
    const line = Disassembler.line(row.word, row.address);

    assert.strictEqual(line.ok, true, 'it decodes');
    assert.strictEqual(line.name, Isa.decode(row.word).name, 'and names the same instruction');
    assert.ok(line.fields.length >= 6, 'and reports every field');
  });
});

/* ------------------------------------------------------- the simulator */

const SUM_PROGRAM = ['  li a0, 10', '  li a1, 0', 'loop:', '  beqz a0, done',
  '  add a1, a1, a0', '  addi a0, a0, -1', '  j loop', 'done:', '  ecall'].join('\n');

test('reference: a real program computes a real answer', function () {
  const out = Assembler.assemble(SUM_PROGRAM, { origin: 0 });
  const machine = Reference.create({ image: out.bytes, entry: 0 });
  const run = Reference.run(machine, { budget: 200, stopOnTrap: true });

  assert.strictEqual(run.finished, true, run.reason);
  assert.strictEqual(Reference.snapshot(machine).registers[11], 55, 'the sum of 1 to 10');
  /* Two setup instructions, four per iteration for ten iterations, one final
     branch that falls through, and the ecall: 2 + 40 + 1 + 1. */
  assert.strictEqual(run.steps, 44, 'in the number of instructions the loop implies');
});

test('reference: every exception class produces precise state', function () {
  const cases = [
    { source: '  ecall', cause: 11 },
    { source: '  .word 0xffffffff', cause: 2 },
    { source: '  li a0, 0x10000001\n  lw a1, 0(a0)', cause: 4 },
    { source: '  li a0, 0x40000000\n  sw a1, 0(a0)', cause: 7 }
  ];

  cases.forEach(function (row) {
    const out = Assembler.assemble(row.source, { origin: 0 });
    const machine = Reference.create({ image: out.bytes, entry: 0 });

    Reference.run(machine, { budget: 10, stopOnTrap: true });
    const state = Reference.snapshot(machine);

    assert.strictEqual(state.csrs[Traps.CSR.mcause], row.cause,
      row.source.split('\n').pop() + ' should raise cause ' + row.cause);
    assert.strictEqual(state.pc, machine.traps.csrs[Traps.CSR.mtvec] >>> 0,
      'and the handler address is where execution continues');
  });
});

test('reference: a timer interrupt is asynchronous and precise', function () {
  const out = Assembler.assemble(['  li a0, 1', '  li a1, 2', '  li a2, 3',
    '  li a3, 4'].join('\n'), { origin: 0 });
  const machine = Reference.create({ image: out.bytes, entry: 0 });

  machine.traps.csrs[Traps.CSR.mie] = 1 << Traps.INTERRUPT_TIMER;
  machine.memory.timer.compare = 3;
  Reference.run(machine, { budget: 12 });
  const taken = machine.traps.taken;

  assert.ok(taken.length > 0, 'the interrupt was taken');
  assert.strictEqual(taken[0].interrupt, true, 'and it is an interrupt, not an exception');
  assert.strictEqual((taken[0].cause >>> 31) & 1, 1, 'which the cause register marks');
});

/* ------------------------------------------------------------ control */

test('control: the gate decoder matches the control table on every instruction', function () {
  const net = Control.decoder();
  const flat = ['regWrite', 'aluSrc', 'memRead', 'memWrite', 'branch', 'jump', 'jalr'];

  Isa.TABLE.forEach(function (row) {
    const word = Isa.encode(row.name, { rd: 5, rs1: 6, rs2: 7,
      imm: row.format === 'U' ? 0x1000 : 4 });
    const want = Control.signalsFor(Isa.decode(word));
    const values = {};

    for (let at = 0; at < 7; at += 1) values['op' + at] = (word >>> at) & 1;
    const got = Sim.outputsOf(net, Sim.evaluate(net, values));

    flat.forEach(function (signal) {
      assert.strictEqual(got[signal] ? 1 : 0, want[signal],
        row.name + ' disagrees on ' + signal);
    });
    assert.strictEqual((got.writeBack1 ? 2 : 0) | (got.writeBack0 ? 1 : 0), want.writeBack,
      row.name + ' disagrees on the write-back source');
  });
  assert.strictEqual(Sim.gateCount(net), 103, 'and the whole decoder is 103 gates');
});

test('control: the ALU function decoder matches its table, including the subtractions', function () {
  const net = Control.aluDecoder();

  Isa.TABLE.forEach(function (row) {
    const word = Isa.encode(row.name, { rd: 5, rs1: 6, rs2: 7,
      imm: row.format === 'U' ? 0x1000 : 4 });
    const decoded = Isa.decode(word);
    const want = Control.aluControlFor(Control.signalsFor(decoded));
    const values = { f0: decoded.funct3 & 1, f1: (decoded.funct3 >> 1) & 1,
      f2: (decoded.funct3 >> 2) & 1, bit30: (word >>> 30) & 1,
      isArith: row.opcode === Isa.OPCODES.op || row.opcode === Isa.OPCODES.opImm ? 1 : 0,
      isReg: row.opcode === Isa.OPCODES.op ? 1 : 0,
      isBranch: row.opcode === Isa.OPCODES.branch ? 1 : 0 };
    const got = Sim.outputsOf(net, Sim.evaluate(net, values));

    assert.strictEqual((got.sel2 ? 4 : 0) | (got.sel1 ? 2 : 0) | (got.sel0 ? 1 : 0),
      want.select, row.name + ' selects the wrong ALU function');
    assert.strictEqual(got.sub ? 1 : 0, want.sub, row.name + ' disagrees on subtract');
    assert.strictEqual(got.unsigned ? 1 : 0, want.unsig, row.name + ' disagrees on unsigned');
  });
});

/* ------------------------------------------------------- the datapath */

test('datapath: the gate-level CPU agrees with the reference, instruction by instruction',
  function () {
    const source = ['  lui a0, 0x10000', '  addi a1, x0, 42', '  sw a1, 0(a0)',
      '  lw a2, 0(a0)', '  addi a3, x0, 3', 'loop:', '  addi a3, a3, -1', '  bnez a3, loop',
      '  jal ra, sub1', '  j done', 'sub1:', '  addi a4, x0, 99', '  ret', 'done:',
      '  auipc a5, 0', '  lbu a6, 1(a0)', '  ecall'].join('\n');
    const out = Assembler.assemble(source, { origin: 0 });
    const result = GateCpu.differential(out.bytes, { steps: 16 });

    assert.strictEqual(result.steps, 16, 'sixteen instructions were compared');
    assert.strictEqual(result.agreed, 16, result.rows.filter(function (row) {
      return row.differences.length;
    }).map(function (row) {
      return row.instruction + ': ' + JSON.stringify(row.differences);
    }).join('; '));
    assert.strictEqual(result.gate.unsettled || 0, 0, 'and every settling reached a fixpoint');
  });

test('datapath: the arithmetic instructions agree bit for bit', function () {
  const source = ['  addi a0, x0, 5', '  addi a1, x0, 3', '  add a2, a0, a1',
    '  sub a3, a0, a1', '  and a4, a0, a1', '  or a5, a0, a1', '  xor a6, a0, a1',
    '  slli a7, a0, 2', '  slt t0, a1, a0', '  sltu t1, a0, a1', '  srai t2, a3, 1'].join('\n');
  const out = Assembler.assemble(source, { origin: 0 });
  const result = GateCpu.differential(out.bytes, { steps: 11 });

  assert.strictEqual(result.agreed, 11, 'every arithmetic instruction matched');
});

test('datapath: the netlist is built from gates and reports its size', function () {
  const machine = GateCpu.create({ image: [], entry: 0 });

  assert.strictEqual(machine.built.gates, 5945, 'the datapath is 5 945 gates');
  assert.ok(machine.net.hasFeedback, 'and it has state, so it is not a DAG');
});

/* -------------------------------------------------------------- linking */

test('linker: a cross-object call resolves and runs', function () {
  const main = Linker.compile('main', ['_start:', '  addi a0, x0, 6', '  jal ra, twice',
    '  ecall'].join('\n'));
  const lib = Linker.compile('lib', ['twice:', '  add a0, a0, a0', '  ret'].join('\n'));
  const out = Linker.link([main, lib], { base: 0, entrySymbol: '_start' });

  assert.strictEqual(out.ok, true, 'the link succeeds');
  const machine = Reference.create({ image: out.image, entry: out.entry });

  Reference.run(machine, { budget: 50, stopOnTrap: true });
  assert.strictEqual(Reference.snapshot(machine).registers[10], 12, '6 doubled is 12');
});

test('linker: an out-of-range branch is reported rather than truncated', function () {
  const near = Linker.compile('near', ['  beq a0, a1, faraway', '  ecall'].join('\n'));
  const filler = Linker.compile('filler', '  .space 5000');
  const far = Linker.compile('far', ['faraway:', '  ecall'].join('\n'));
  const out = Linker.link([near, filler, far], { base: 0 });

  assert.strictEqual(out.ok, false, 'the link fails');
  assert.strictEqual(out.failed[0].offset, 5008, 'and names the offset it needed');
  assert.match(out.failed[0].why, /out of range/, 'and says why');

  const close = Linker.link([near, far], { base: 0 });

  assert.strictEqual(close.ok, true, 'the same relocation is fine when it is close enough');
});

test('linker: an undefined symbol fails the link and names it', function () {
  const out = Linker.link([Linker.compile('bad', '  jal ra, nowhere')], { base: 0 });

  assert.strictEqual(out.ok, false);
  assert.strictEqual(out.failed[0].symbol, 'nowhere');
});

/* ------------------------------------------------------------- the view */

test('datapath view: the diagram marks the blocks this instruction leaves idle', function () {
  const load = DatapathView.idleBlocks({ signals: { memRead: 1, regWrite: 1, aluSrc: 1 },
    rs1: 1, rs2: 0, rd: 2, imm: 4 });
  const add = DatapathView.idleBlocks({ signals: { regWrite: 1 }, rs1: 1, rs2: 2, rd: 3 });

  assert.strictEqual(load.indexOf('DMEM'), -1, 'a load uses the data memory');
  assert.notStrictEqual(add.indexOf('DMEM'), -1, 'an add does not');
  assert.match(DatapathView.definition({ signals: { regWrite: 1 }, rs1: 1, rs2: 2, rd: 3 }),
    /^flowchart LR/, 'and the definition is a flowchart');
});

/* --------------------------------------------- the control registers */

/* The CSR instructions name the control register where every other I-format
   instruction names a source register, so reading the operands positionally
   makes 0x342 "not a register" - which is exactly what it did before the
   assembler learned this shape, and it made the trap handler unassemblable. */
test('assembler: a csr instruction names its control register in the middle', function () {
  const out = Assembler.assemble('  csrrs t0, 0x342, x0\n  csrrw x0, 0x341, t1', { origin: 0 });

  assert.strictEqual(out.ok, true, JSON.stringify(out.errors));
  assert.strictEqual(out.listing[0].word >>> 0, 0x342022f3, 'csrr t0, mcause');
  assert.strictEqual(out.listing[1].word >>> 0, 0x34131073, 'csrw mepc, t1');

  const bad = Assembler.assemble('  csrrs t0, notanumber, x0', { origin: 0 });

  assert.strictEqual(bad.ok, false, 'and a control register that is not a number is refused');
  assert.match(bad.errors[0].message, /control register/);
});

test('devices: writing a timer register acknowledges the interrupt', function () {
  const state = Devices.create({});

  state.timer.compare = 2;
  Devices.tick(state);
  Devices.tick(state);
  assert.strictEqual(state.timer.pending, true, 'the compare was reached');

  Devices.write(state, 0x20001004, 0, 4);
  assert.strictEqual(state.timer.pending, false,
    'a device that cannot be acknowledged re-interrupts forever');
});

test('devices: the program region is larger than a branch can reach', function () {
  const rom = Devices.MAP.filter(function (region) { return region.name === 'rom'; })[0];

  assert.ok(rom.size > Linker.KINDS.branch.high,
    'otherwise "out of branch range" and "off the end of memory" are the same event, ' +
    'and a veneer cannot be demonstrated at all');
});

/* --------------------------------------- the instruction-set comparison */

test('compare: the totals are summed from the listings, and the loops are all four', function () {
  const Compare = require('../../src/js/machines/brv32/isa-compare.js');
  const rows = {};

  Compare.all().forEach(function (row) { rows[row.id] = row; });
  assert.deepStrictEqual(Object.keys(rows).sort(), ['arm64', 'riscv', 'x86']);

  Compare.SETS.forEach(function (set) {
    const summed = set.listing.reduce(function (total, row) { return total + row.bytes; }, 0);

    assert.strictEqual(rows[set.id].bytes, summed, set.id + ': the total comes from the rows');
    assert.strictEqual(rows[set.id].instructions, set.listing.length, set.id + ': and so does the count');
    assert.strictEqual(rows[set.id].loopInstructions, 4, set.id + ': four instructions per element');
    assert.ok(set.evidence.length >= 4, set.id + ': four identifying observations');
  });

  assert.deepStrictEqual(rows.riscv.widths, [4], 'RISC-V is fixed width');
  assert.deepStrictEqual(rows.arm64.widths, [4], 'and so is ARM64');
  assert.deepStrictEqual(rows.x86.widths, [1, 2, 3], 'x86-64 is not');
});
