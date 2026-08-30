'use strict';

/**
 * Every figure the M34.7-M34.10 content quotes, recomputed from the address
 * decoder, the trap machinery, the linker and the instruction-set comparison.
 *
 * The trap half runs both handlers over the same timer interrupt, because the
 * whole teaching point of that example is that one of them loses an
 * instruction per interrupt and reports nothing - which is only convincing if
 * both numbers come out of the machine rather than out of the prose.
 */

const test = require('node:test');
const assert = require('node:assert');

const Devices = require('../../src/js/machines/brv32/devices.js');
const Traps = require('../../src/js/machines/brv32/traps.js');
const Assembler = require('../../src/js/machines/brv32/assembler.js');
const Reference = require('../../src/js/machines/brv32/reference-sim.js');
const Programs = require('../../src/js/machines/brv32/programs.js');
const Linker = require('../../src/js/machines/brv32/linker.js');
const Compare = require('../../src/js/machines/brv32/isa-compare.js');

require('../../src/js/content/concepts-brv32-system.js');
require('../../src/js/content/examples-brv32-system.js');
require('../../src/js/content/concepts-brv32-toolchain.js');
require('../../src/js/content/examples-brv32-toolchain.js');
const prose = require('../support/worked-example-prose.js');

const BASE = 0x10000000;
const VECTOR = 0x100;

/* -------------------------------------------- 34.7 the memory interface */

function memoryWith(pattern) {
  const state = Devices.create({});

  Devices.writeWord(state, BASE, pattern >>> 0, 4);
  return state;
}

test('memory: the same four bytes read six ways', function () {
  const state = memoryWith(0xfeedbe80);

  assert.strictEqual(Devices.read(state, BASE, 1, true).value, -128, 'lb');
  assert.strictEqual(Devices.read(state, BASE, 1, false).value, 128, 'lbu');
  assert.strictEqual(Devices.read(state, BASE, 2, true).value, -16768, 'lh');
  assert.strictEqual(Devices.read(state, BASE, 2, false).value, 48768, 'lhu');
  assert.strictEqual(Devices.read(state, BASE, 4, true).value, -17973632, 'lw');
  assert.strictEqual(Devices.read(state, BASE, 4, false).value, -17973632,
    'and at the register width there is nothing left to choose');
  assert.strictEqual(Devices.read(state, BASE + 3, 1, true).value, -2, 'the highest byte');
  assert.strictEqual(Devices.read(state, BASE + 3, 1, false).value, 254, 'unsigned');

  prose.quotes('memory-interface-and-io',
    ['0x80 has its top bit set, so the answer is -128', 'signed -16 768, unsigned 48 768',
      '-17 973 632 either way', '0xfe, which is -2 signed and 254 unsigned']);
});

test('memory: every width against every alignment, counted', function () {
  const state = memoryWith(0xfeedbe80);
  const addresses = [BASE, BASE + 1, BASE + 2, BASE + 3, 0x20000000, 0x30000000];
  let faults = 0;
  let ramFaults = 0;

  addresses.forEach(function (address) {
    [1, 2, 4].forEach(function (width) {
      const out = Devices.read(state, address, width, true);

      if (!out.fault) return;
      faults += 1;
      if (address >= BASE && address < BASE + 4) ramFaults += 1;
    });
  });

  assert.strictEqual(addresses.length * 3, 18, 'the whole matrix');
  assert.strictEqual(faults, 8, 'of which eight fault');
  assert.strictEqual(ramFaults, 5, 'five of them for alignment');
  assert.strictEqual(Devices.read(state, BASE + 1, 2, true).fault.cause, 4, 'misaligned load');
  assert.strictEqual(Devices.read(state, BASE + 1, 2, true).fault.value, BASE + 1,
    'and the address is carried with it');
  assert.strictEqual(Devices.read(state, 0x30000000, 4, true).fault.cause, 5, 'access fault');
  assert.strictEqual(Devices.read(state, 0x30000000, 1, true).fault.cause, 5,
    'at every width — the region is decided before the alignment');

  prose.quotes('memory-interface-and-io',
    ['5 of 12 accesses fault: cause 4, load address misaligned',
      '8 of 18 fault, and the other 10 return a value',
      'cause 4 with mtval 0x10000001; cause 5 with mtval 0x30000000']);
});

/* ---------------------------------------------------- 34.8 traps */

function runTrap(name, handlerKind, budget) {
  const body = name === 'timer'
    ? '  li a0, 1\n  li a1, 2\n  li a2, 3\n  li a3, 4\n'
    : Programs.FAULTS[name] + '\n  li a3, 4\n';
  const image = Assembler.assemble(body + 'spin:\n  j spin\n', { origin: 0 });
  const handler = Assembler.assemble(
    handlerKind === 'skip' ? Programs.HANDLER : Programs.INTERRUPT_HANDLER, { origin: VECTOR });
  const machine = Reference.create({ image: image.bytes, entry: 0 });

  assert.ok(handler.ok, 'the handler must assemble: ' + JSON.stringify(handler.errors));
  Devices.loadImage(machine.memory, VECTOR, handler.bytes);
  if (name === 'timer') {
    machine.traps.csrs[Traps.CSR.mie] = 1 << Traps.INTERRUPT_TIMER;
    machine.memory.timer.compare = 3;
  }
  Reference.run(machine, { budget: budget || 30 });
  return machine;
}

test('traps: every synchronous class, with the state the hardware saved', function () {
  const expected = {
    ecall: [11, 0x4, 0],
    illegal: [2, 0x4, 0xffffffff],
    misalignedLoad: [4, 0x8, 0x10000001],
    misalignedStore: [6, 0x8, 0x10000002],
    unmapped: [5, 0x8, 0x40000000]
  };

  Object.keys(expected).forEach(function (name) {
    const machine = runTrap(name, 'aware');
    const first = machine.traps.taken[0];
    const want = expected[name];

    assert.ok(first, name + ' should trap');
    assert.strictEqual(first.cause, want[0], name + ' cause');
    assert.strictEqual(first.pc, want[1], name + ' mepc');
    assert.strictEqual(machine.traps.csrs[Traps.CSR.mtval] >>> 0, want[2] >>> 0,
      name + ' mtval');
    assert.strictEqual(first.interrupt, false, name + ' is synchronous');
    assert.strictEqual(machine.traps.taken.length, 1, name + ' traps once and continues');
    assert.strictEqual(Reference.snapshot(machine).registers[13], 4,
      name + ' resumes and reaches the instruction after the fault');
  });

  prose.quotes('exceptions-and-privilege',
    ['cause 11, mepc = 0x4, mtval = 0', 'cause 2, mepc = 0x4, mtval = 0xffffffff',
      'cause 4, mepc = 0x8, mtval = 0x10000001',
      'all five continue, set a3 = 4, and reach the spin loop — 1 trap each']);
});

test('traps: the cause-aware handler keeps the instruction the other one eats', function () {
  const aware = runTrap('timer', 'aware');
  const skip = runTrap('timer', 'skip');

  assert.strictEqual(aware.traps.taken.length, 1, 'one interrupt, acknowledged');
  assert.strictEqual(Reference.snapshot(aware).registers[13], 4, 'and a3 is set');
  assert.strictEqual(aware.traps.taken[0].interrupt, true, 'it is asynchronous');
  assert.strictEqual((aware.traps.taken[0].cause >>> 31) & 1, 1, 'and the sign bit says so');

  assert.strictEqual(skip.traps.taken.length, 5, 'five interrupts, none acknowledged');
  assert.strictEqual(Reference.snapshot(skip).registers[13], 0,
    'and the instruction that would have set a3 was skipped');

  prose.quotes('exceptions-and-privilege',
    ['1 trap taken, and the program ends with a0 = 1, a1 = 2, a2 = 3, a3 = 4',
      '5 traps taken, and a3 is still 0 at the end']);
});

/* ------------------------------------------ 34.9 assembler and linker */

const MAIN = ['_start:', '  li a0, 5', '  li a1, 5', '  beq a0, a1, target',
  '  li a0, 0', '  ecall'].join('\n');
const MAIN_VENEER = ['_start:', '  li a0, 5', '  li a1, 5', '  beq a0, a1, veneer',
  '  li a0, 0', '  ecall'].join('\n');
const VENEER = ['veneer:', '  j target'].join('\n');
const PAD = '  .space 5000';
const TARGET = ['target:', '  li a0, 42', '  ecall'].join('\n');

function linkAndRun(objects) {
  const linked = Linker.link(objects.map(function (pair) {
    return Linker.compile(pair[0], pair[1]);
  }), { base: 0, entrySymbol: '_start' });

  if (!linked.ok) return { linked: linked, value: null };
  const machine = Reference.create({ image: linked.image, entry: linked.entry || 0 });

  Reference.run(machine, { budget: 200, stopOnTrap: true });
  return { linked: linked, value: Reference.snapshot(machine).registers[10] };
}

test('linker: two objects, one hole, and a program that runs', function () {
  const main = Linker.compile('main.o', MAIN);
  const target = Linker.compile('target.o', TARGET);

  assert.strictEqual(main.size, 20, 'main.o is twenty bytes');
  assert.deepStrictEqual(Object.keys(main.symbols), ['_start'], 'and defines _start');
  assert.strictEqual(main.relocations.length, 1, 'with one hole');
  assert.strictEqual(main.relocations[0].address, 8, 'at address 8');
  assert.strictEqual(main.relocations[0].kind, 'branch', 'branch-shaped');
  assert.strictEqual(target.size, 8, 'target.o is eight bytes');

  const out = linkAndRun([['main.o', MAIN], ['target.o', TARGET]]);

  assert.strictEqual(out.linked.ok, true, 'it links');
  assert.strictEqual(out.linked.image.length, 28, 'to 28 bytes');
  assert.strictEqual(out.linked.symbols.target, 0x14, 'target lands at 0x14');
  assert.strictEqual(out.linked.applied[0].offset, 12, 'so the offset is 12');
  assert.strictEqual(out.value, 42, 'and the program computes 42');

  prose.quotes('assembler-linker-and-loading',
    ['20 bytes, defines _start, and one relocation: branch-shaped, at address 8, for target',
      'main.o at 0x0 and target.o at 0x14, giving an image of 28 bytes',
      'target is at 0x14, the branch is at 0x8, so the offset is 12']);
});

test('linker: the two ways a hole cannot be filled, and the veneer that fixes one', function () {
  const far = linkAndRun([['main.o', MAIN], ['pad.o', PAD], ['target.o', TARGET]]);

  assert.strictEqual(far.linked.ok, false, 'the branch cannot reach');
  assert.strictEqual(far.linked.failed[0].offset, 5012, 'it needs 5 012 bytes');
  assert.match(far.linked.failed[0].why, /out of range/, 'and says so');
  assert.strictEqual(Linker.KINDS.branch.high, 4094, 'against a reach of 4 094');

  const missing = linkAndRun([['main.o', MAIN]]);

  assert.strictEqual(missing.linked.ok, false, 'a different failure');
  assert.strictEqual(missing.linked.failed[0].why, 'undefined symbol', 'with a different cause');
  assert.strictEqual(missing.linked.failed[0].offset, undefined, 'and no offset at all');

  const veneer = linkAndRun([['main.o', MAIN_VENEER], ['veneer.o', VENEER],
    ['pad.o', PAD], ['target.o', TARGET]]);

  assert.strictEqual(veneer.linked.ok, true, 'two hops link');
  assert.strictEqual(veneer.linked.image.length, 5032, 'the image is 5 032 bytes');
  assert.strictEqual(veneer.linked.applied[0].offset, 12, 'the branch reaches the veneer');
  assert.strictEqual(veneer.linked.applied[1].offset, 5004, 'and the veneer jumps 5 004');
  assert.strictEqual(veneer.value, 42, 'and it computes the same answer');

  prose.quotes('assembler-linker-and-loading',
    ['the offset needed is 5 012 and the field reaches 4 094',
      'the branch reaches the veneer at offset 12; the veneer jumps 5 004 to target',
      '5 032 bytes, and a0 = 42']);
});

/* ------------------------------------- 34.10 three instruction sets */

test('comparison: ten instructions each, and only the bytes differ', function () {
  const rows = {};

  Compare.all().forEach(function (row) { rows[row.id] = row; });

  ['riscv', 'arm64', 'x86'].forEach(function (id) {
    assert.strictEqual(rows[id].instructions, 10, id + ' instruction count');
    assert.strictEqual(rows[id].loopInstructions, 4, id + ' loop body');
  });
  assert.strictEqual(rows.riscv.bytes, 40, 'RISC-V');
  assert.strictEqual(rows.arm64.bytes, 40, 'ARM64');
  assert.strictEqual(rows.x86.bytes, 23, 'x86-64');
  assert.strictEqual(rows.riscv.loopBytes, 16, 'the RISC-V loop');
  assert.strictEqual(rows.x86.loopBytes, 11, 'against the x86 loop');
  assert.deepStrictEqual(rows.riscv.widths, [4], 'one length');
  assert.deepStrictEqual(rows.x86.widths, [1, 2, 3], 'three lengths');

  const density = {};

  Compare.density().forEach(function (row) { density[row.id] = row.ratio; });
  assert.strictEqual(Number(density.x86.toFixed(2)), 1.74, 'x86-64 is 1.74 times denser');
  assert.strictEqual(density.riscv, 1, 'and the two RISC machines tie');

  prose.quotes('real-instruction-sets',
    ['10 instructions, 40 bytes, loop body 4 instructions and 16 bytes',
      '10 instructions, 23 bytes, loop body 4 instructions and 11 bytes',
      '40 / 23 = 1.74 times denser']);
});

test('comparison: the byte counts are summed from the rows, not stated', function () {
  Compare.SETS.forEach(function (set) {
    const summed = set.listing.reduce(function (total, row) { return total + row.bytes; }, 0);

    assert.strictEqual(Compare.measure(set.id).bytes, summed,
      set.id + ': the total must come from the listing');
    set.listing.forEach(function (row) {
      assert.ok(row.bytes >= 1 && row.bytes <= 15, set.id + ': a plausible instruction length');
      assert.ok(row.about, set.id + ': every row says why it looks like that');
    });
  });

  /* The x86 rows carry their encodings so a reader can check one at a time -
     the only claim in this section that is not computed here. */
  Compare.BY_ID.x86.listing.forEach(function (row) {
    assert.ok(row.encoding, 'every x86 row carries its bytes: ' + row.text);
    assert.strictEqual(row.encoding.split(' ').length, row.bytes,
      row.text + ': the byte count matches the encoding given');
  });
});
