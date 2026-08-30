'use strict';

/**
 * Every figure the M34.1-M34.3 content quotes, recomputed from the modules and
 * then checked against the prose.
 *
 * The encoding half is the important one. An assembler and a disassembler
 * written by the same person round-trip perfectly and can both be wrong, so
 * the published-encoding table is checked here byte for byte as well as in the
 * section - it is the only oracle in the milestone that did not come out of
 * this repository.
 */

const test = require('node:test');
const assert = require('node:assert');

const Isa = require('../../src/js/machines/brv32/isa.js');
const Models = require('../../src/js/machines/brv32/models.js');
const Assembler = require('../../src/js/machines/brv32/assembler.js');
const Reference = require('../../src/js/machines/brv32/reference-sim.js');
const Programs = require('../../src/js/machines/brv32/programs.js');

require('../../src/js/content/concepts-brv32.js');
require('../../src/js/content/examples-brv32.js');
require('../../src/js/content/concepts-brv32-assembly.js');
require('../../src/js/content/examples-brv32-assembly.js');
const prose = require('../support/worked-example-prose.js');

/* ------------------------------------------------- 34.1 instruction sets */

test('models: three machines, one answer, and the sizes the section compares', function () {
  const rows = Models.compare([7, 5, 4]);

  assert.ok(rows.agree, 'all three models must compute the same value');
  assert.strictEqual(rows.answer, 20, '(7 + 5) x 2 - 4');

  const byName = {};

  rows.rows.forEach(function (row) { byName[row.name] = row; });
  assert.strictEqual(byName.stack.instructions, 7, 'the stack program');
  assert.strictEqual(byName.stack.bytes, 7, 'at one byte each');
  assert.strictEqual(byName.accumulator.instructions, 4, 'the accumulator program');
  assert.strictEqual(byName.accumulator.bytes, 8, 'at two bytes each');
  assert.strictEqual(byName.register.instructions, 3, 'the register program');
  assert.strictEqual(byName.register.bytes, 12, 'at four bytes each');

  prose.quotes('instruction-set-design',
    ['7 instructions, 7 bytes', '4 instructions at 2 bytes each = 8 bytes',
      '3 instructions at 4 bytes = 12 bytes']);
});

test('models: the field-packing arithmetic, including the case that does not fit', function () {
  function pack(registers, operands) {
    return Models.packing({ width: 16, opcodes: 32, registers: registers, operands: operands });
  }

  assert.strictEqual(pack(8, 2).immediateBits, 5, '16 - 5 - 6');
  assert.strictEqual(pack(8, 2).range.low, -16, 'a signed 5-bit field');
  assert.strictEqual(pack(8, 2).range.high, 15, 'reaches -16 to 15');
  assert.strictEqual(pack(16, 2).immediateBits, 3, '16 registers costs two more bits');
  assert.strictEqual(pack(32, 2).immediateBits, 1, 'and 32 costs two more again');
  assert.strictEqual(pack(8, 3).immediateBits, 2, 'a third operand costs three');
  assert.strictEqual(pack(32, 3).immediateBits, -4, 'which is not a small immediate');
  assert.strictEqual(pack(32, 3).encodable, false, 'the instruction does not fit at all');

  prose.quotes('instruction-set-design',
    ['3 bits per register x 2 = 6, plus 5 of opcode = 11, leaving 5 immediate bits: -16 to 15',
      '16 registers leave 3 bits (-4 to 3); 32 registers leave 1 bit (-1 to 0)',
      '-4 bits left, so it does not fit']);
});

/* --------------------------------------------------- 34.2 the encoding */

/* Taken from the RISC-V specification and from standard assembler output.
   This is the only table in the milestone whose right-hand side is not
   produced by our own code, which is exactly why it is worth having. */
const PUBLISHED = [
  ['addi a0, zero, 5', 0x00500513],
  ['add a2, a0, a1', 0x00b50633],
  ['sub a2, a0, a1', 0x40b50633],
  ['lw a1, 8(a0)', 0x00852583],
  ['sw a1, 8(a0)', 0x00b52423],
  ['beq a0, a1, 8', 0x00b50463],
  ['bne a0, a1, -4', 0xfeb51ee3],
  ['jal ra, 16', 0x010000ef],
  ['lui a0, 0x12345', 0x12345537],
  ['auipc a0, 1', 0x00001517],
  ['jalr zero, ra, 0', 0x00008067],
  ['slli a1, a0, 3', 0x00351593],
  ['srai a1, a0, 3', 0x40355593],
  ['ecall', 0x00000073]
];

test('encoding: all fourteen published words match byte for byte', function () {
  PUBLISHED.forEach(function (row) {
    const out = Assembler.assemble('  ' + row[0], { origin: 0 });

    assert.ok(out.ok, row[0] + ' should assemble: ' + JSON.stringify(out.errors));
    assert.strictEqual(out.listing[0].word >>> 0, row[1] >>> 0,
      row[0] + ' should encode to 0x' + (row[1] >>> 0).toString(16));
  });
  assert.strictEqual(PUBLISHED.length, 14, 'the section quotes fourteen of them');

  prose.quotes('brv32-instruction-set',
    ['14 encodings from the RISC-V specification, compared byte for byte',
      'All 14 published words match']);
});

test('encoding: sw a1, 8(a0) built field by field, as the example builds it', function () {
  const word = (0x23 | (10 << 15) | (11 << 20) | (2 << 12) | (8 << 7)) >>> 0;

  assert.strictEqual(10 << 15, 0x00050000, 'rs1 = a0 = 10');
  assert.strictEqual(11 << 20, 0x00b00000, 'rs2 = a1 = 11');
  assert.strictEqual(2 << 12, 0x00002000, 'funct3 selects the word width');
  assert.strictEqual(8 << 7, 0x00000400, 'imm[4:0] = 8');
  assert.strictEqual(word, 0x00b52423, 'and the pieces or together');

  const decoded = Isa.decode(word);

  assert.strictEqual(decoded.name, 'sw');
  assert.strictEqual(decoded.imm, 8, 'the immediate reassembles');
  assert.deepStrictEqual(decoded.parts.map(function (part) { return part.value; }), [0, 8],
    'from two fields: imm[11:5] = 0 and imm[4:0] = 8');

  prose.quotes('brv32-instruction-set',
    ['0x00050000', '0x00b00000', '0x00002000', '0x00b52423']);
});

test('encoding: the four fields of bne a0, a1, -4, and the missing bit zero', function () {
  const decoded = Isa.decode(0xfeb51ee3 >>> 0);

  assert.strictEqual(decoded.name, 'bne');
  assert.strictEqual(decoded.rs1, 10, 'a0');
  assert.strictEqual(decoded.rs2, 11, 'a1');
  assert.strictEqual(decoded.imm, -4, 'a branch to the previous instruction');

  const values = {};

  decoded.parts.forEach(function (part) { values[part.to] = part.value; });
  assert.strictEqual(values['imm[12:12]'], 1, 'the sign, from word[31]');
  assert.strictEqual(values['imm[10:5]'], 63, 'from word[30:25]');
  assert.strictEqual(values['imm[4:1]'], 14, 'from word[11:8]');
  assert.strictEqual(values['imm[11:11]'], 1, 'from word[7]');

  /* Reassembled as the example does it: 13 bits, then sign-extended. */
  const raw = (1 << 12) | (63 << 5) | (14 << 1) | (1 << 11);

  assert.strictEqual(raw, 0x1ffc, 'the 13-bit value');
  assert.strictEqual(Isa.signExtend(raw, 13), -4, 'which is -4');

  prose.quotes('brv32-instruction-set',
    ['imm[12] from word[31] = 1', 'imm[10:5] from word[30:25] = 63',
      'imm[4:1] from word[11:8] = 14', 'imm[11] from word[7] = 1', '0x1ffc']);
});

/* ------------------------------------------------ 34.3 assembly programs */

function runToCompletion(name) {
  const spec = Programs.CATALOGUE[name];
  const image = Assembler.assemble(spec.source, { origin: 0 });
  const machine = Reference.create({ image: image.bytes, entry: 0, stack: 0x10000f00 });
  const run = Reference.run(machine, { budget: 3000, stopOnTrap: true });

  return { image: image, machine: machine, run: run,
    state: Reference.snapshot(machine), spec: spec };
}

test('programs: the instruction counts and results the chart plots', function () {
  const expected = { sum: [44, 55], factorial: [125, 120], arrayMax: [43, 37],
    strlen: [32, 5] };

  Object.keys(expected).forEach(function (name) {
    const out = runToCompletion(name);

    assert.strictEqual(out.run.steps, expected[name][0], name + ' instruction count');
    assert.strictEqual(out.state.registers[out.spec.result], expected[name][1],
      name + ' result');
  });

  const console = runToCompletion('console');

  assert.strictEqual(console.run.steps, 47, 'the console program');
  assert.strictEqual(console.machine.memory.console, 'hi there', 'writes eight characters');

  prose.quotes('assembly-programming',
    ['44, 125, 43, 32 and 47 instructions',
      'sum = 55, factorial = 120, array max = 37, strlen = 5']);
});

test('programs: the factorial spends 58 of its 125 instructions inside multiply', function () {
  const image = Assembler.assemble(Programs.CATALOGUE.factorial.source, { origin: 0 });
  const machine = Reference.create({ image: image.bytes, entry: 0, stack: 0x10000f00 });
  const multiply = image.symbols.multiply;
  const mdone = image.symbols.mdone;

  assert.ok(multiply !== undefined && mdone !== undefined, 'the labels exist');

  let inside = 0;
  let calls = 0;
  let deepest = 0;
  let steps = 0;

  for (let at = 0; at < 3000; at += 1) {
    const pc = machine.pc >>> 0;

    if (pc === multiply) calls += 1;
    if (pc >= multiply && pc <= mdone) inside += 1;
    const out = Reference.step(machine);

    steps += 1;
    deepest = Math.max(deepest, 0x10000f00 - (machine.registers[2] | 0));
    if (out.trapped) break;
  }

  assert.strictEqual(steps, 125, 'the whole run');
  assert.strictEqual(inside, 58, 'instructions executed at or past the multiply entry');
  assert.strictEqual(calls, 4, 'multiply is called once per level above the base case');
  assert.strictEqual(deepest, 40, 'five frames of eight bytes');
  assert.strictEqual(Math.round(100 * inside / steps), 46, 'which is 46% of the run');

  prose.quotes('assembly-programming',
    ['58 of the 125 — 46% — are executed inside the multiply subroutine',
      'the stack reaches 40 bytes — 5 frames',
      '4 calls at 4 instructions of setup and return, plus 3 per iteration over 14 iterations: 16 + 42 = 58']);
});

test('programs: the frames hold what the call was about to destroy', function () {
  const image = Assembler.assemble(Programs.CATALOGUE.factorial.source, { origin: 0 });
  const machine = Reference.create({ image: image.bytes, entry: 0, stack: 0x10000f00 });

  for (let at = 0; at < 24; at += 1) Reference.step(machine);

  const sp = machine.registers[2] >>> 0;

  assert.strictEqual(sp, 0x10000ee8, 'three frames down after 24 instructions');
  assert.strictEqual(0x10000f00 - sp, 24, 'which is 24 bytes');

  const Devices = require('../../src/js/machines/brv32/devices.js');
  const words = [];

  for (let at = 0; at < 6; at += 1) {
    words.push(Devices.readWord(machine.memory, sp + 4 * at, 4) | 0);
  }
  assert.deepStrictEqual(words, [3, 48, 4, 48, 5, 16],
    'argument and return address per frame, innermost first');

  prose.quotes('assembly-programming',
    ['sp = 0x10000ee8, which is 24 bytes below 0x10000f00 — 3 frames in flight',
      '5 with return address 16, then 4 with 48, then 3 with 48']);
});

test('programs: thirteen of the factorial listing\'s twenty-seven words are expansions', function () {
  const image = Assembler.assemble(Programs.CATALOGUE.factorial.source, { origin: 0 });
  const expanded = image.listing.filter(function (row) { return row.from; });

  assert.strictEqual(image.listing.length, 27, 'the assembled listing');
  assert.strictEqual(expanded.length, 13, 'of which the assembler wrote these');

  prose.quotes('assembly-programming',
    ['27 words, of which 13 were written by the assembler']);
});
