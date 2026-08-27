'use strict';

/**
 * Every figure the 30.1–30.4 content quotes, recomputed from the modules —
 * and then asserted to still appear in the prose. The numbers come from
 * `node tools/section-dump.js <id>` at the shipped defaults, so a change to a
 * default control setting fails here rather than leaving the prose describing
 * a run nobody sees.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const support = require('../support/worked-example-prose.js');

const CONTENT = path.join(__dirname, '..', '..', 'src', 'js', 'content');
['concepts-back-end', 'examples-back-end']
  .forEach(function (file) { require(path.join(CONTENT, file + '.js')); });

const BERUGO = path.join(__dirname, '..', '..', 'src', 'js', 'machines', 'berugo');
const MACHINES = path.join(__dirname, '..', '..', 'src', 'js', 'machines');
const SECTIONS = path.join(__dirname, '..', '..', 'src', 'js', 'sections');

const Spec = require(path.join(BERUGO, 'spec.js'));
const Ir = require(path.join(BERUGO, 'ir.js'));
const IrLower = require(path.join(BERUGO, 'ir-lower.js'));
const IrInterp = require(path.join(BERUGO, 'ir-interp.js'));
const Ssa = require(path.join(BERUGO, 'ssa.js'));
const Bytecode = require(path.join(BERUGO, 'bytecode.js'));
const Vm = require(path.join(BERUGO, 'vm.js'));
const Isel = require(path.join(BERUGO, 'isel.js'));
const Regalloc = require(path.join(BERUGO, 'regalloc.js'));
const PassLab = require(path.join(MACHINES, 'pass-lab.js'));

const BytecodeTemplate = require(path.join(SECTIONS, 'bytecode-design-template.js'));
const VmTemplate = require(path.join(SECTIONS, 'building-the-interpreter-template.js'));
const IselTemplate = require(path.join(SECTIONS, 'instruction-selection-template.js'));
const RegallocTemplate = require(path.join(SECTIONS, 'register-allocation-template.js'));

function programOf(source) { return IrLower.compile(source).program; }

function totals(mode, options) {
  return Spec.CONFORMANCE.reduce(function (into, entry) {
    const built = Bytecode.compile(programOf(entry.source),
      Object.assign({ mode: mode }, options || {}));
    const out = Vm.run(built, { budget: 400000 });

    return { instructions: into.instructions + Object.keys(built.chunks)
      .reduce(function (sum, name) { return sum + built.chunks[name].code.length; }, 0),
    dispatches: into.dispatches + out.dispatches };
  }, { instructions: 0, dispatches: 0 });
}

/* ---------------------------------------------------------- 30.1 bytecode */

test('figures: the loop sample is 74 stack instructions against 43 register ones', function () {
  const program = programOf(BytecodeTemplate.SAMPLES.expression);
  const sizes = {};

  ['stack', 'register'].forEach(function (mode) {
    const built = Bytecode.compile(program, { mode: mode });

    sizes[mode] = { instructions: built.chunks.main.code.length,
      constants: built.chunks.main.constants.length,
      slots: built.chunks.main.slots.length,
      bytes: Bytecode.encode(built.chunks.main, { width: 'variable' }).total,
      dispatches: Vm.run(built, { budget: 400000 }).dispatches };
  });
  assert.strictEqual(sizes.stack.instructions, 74);
  assert.strictEqual(sizes.register.instructions, 43);
  assert.strictEqual(sizes.stack.dispatches, 244);
  assert.strictEqual(sizes.register.dispatches, 125);
  assert.strictEqual(support.fixed(sizes.stack.dispatches / sizes.register.dispatches, 2),
    '1.95');
  assert.strictEqual(sizes.stack.bytes, 204);
  assert.strictEqual(sizes.register.bytes, 196);
  assert.strictEqual(sizes.stack.constants, 9);
  assert.strictEqual(sizes.stack.slots, 5);

  support.quotes('bytecode-design',
    ['74 stack against 43 register', '244 against 125 — the register set executes 1.95× fewer',
      '204 bytes against 196']);
});

test('figures: the suite is 383 against 262 instructions and 503 against 319 dispatches',
  function () {
    const stack = totals('stack');
    const register = totals('register');

    assert.strictEqual(stack.instructions, 383);
    assert.strictEqual(register.instructions, 262);
    assert.strictEqual(stack.dispatches, 503);
    assert.strictEqual(register.dispatches, 319);
    assert.strictEqual(support.fixed(stack.instructions / register.instructions, 2), '1.46');
    assert.strictEqual(support.fixed(stack.dispatches / register.dispatches, 2), '1.58');

    support.quotes('bytecode-design',
      ['383 against 262 instructions and 503 against 319 dispatches',
        '1.46× fewer instructions and 1.58× fewer dispatches',
        '383 stack instructions']);
  });

test('figures: the peephole is worth 134 instructions across the suite', function () {
  const kept = totals('stack');
  const naive = totals('stack', { keepOnStack: false });
  const register = totals('register');

  assert.strictEqual(naive.instructions, 517);
  assert.strictEqual(naive.instructions - kept.instructions, 134);
  assert.strictEqual(support.fixed(100 * (naive.instructions - kept.instructions)
    / kept.instructions, 0), '35');
  assert.strictEqual(support.fixed(naive.instructions / register.instructions, 2), '1.97');

  support.quotes('bytecode-design',
    ['517 — 35% more, from one missing rewrite',
      '262 register instructions, so the ratio is 1.46× or 1.97×']);
});

test('figures: twenty adjacent pairs, and the top two are worth eighteen dispatches',
  function () {
    const chunk = Bytecode.compile(programOf(BytecodeTemplate.SAMPLES.expression),
      { mode: 'stack' }).chunks.main;
    const pairs = Bytecode.pairFrequencies(chunk);

    assert.strictEqual(pairs.length, 20);
    assert.strictEqual(pairs[0].pair, 'LOAD_TEMP+LOAD_TEMP');
    assert.strictEqual(pairs[0].count, 10);
    assert.strictEqual(Bytecode.fuse(chunk, 2).saved, 18);
    assert.strictEqual(chunk.code.length, 74);

    support.quotes('bytecode-design',
      ['the top adjacent pair on the loop sample is LOAD_TEMP+LOAD_TEMP, 10 times',
        '20 distinct', 'the two commonest account for 18 of its']);
  });

test('figures: 17 of 17 programs agree under both instruction sets', function () {
  const agreeing = { stack: 0, register: 0 };

  ['stack', 'register'].forEach(function (mode) {
    Spec.CONFORMANCE.forEach(function (entry) {
      const program = programOf(entry.source);
      const out = Vm.run(Bytecode.compile(program, { mode: mode }), { budget: 400000 });

      if (IrInterp.compare(IrInterp.run(program), out).agree) agreeing[mode] += 1;
    });
  });
  assert.strictEqual(agreeing.stack, 17);
  assert.strictEqual(agreeing.register, 17);

  support.quotes('bytecode-design', ['17 of 17 programs give the same answer under both sets']);
});

/* --------------------------------------------------------- 30.2 the VM */

test('figures: the closure fixture stops at main:6 after six dispatches', function () {
  const built = Bytecode.compile(programOf(VmTemplate.SAMPLES.closure), { mode: 'stack' });
  const session = Vm.session(built, { budget: 400000 });

  for (let at = 0; at < 6; at += 1) session.step();
  const snapshot = session.snapshot();

  assert.strictEqual(snapshot.fn, 'main');
  assert.strictEqual(snapshot.at, 6);
  assert.strictEqual(snapshot.dispatches, 6);
  assert.strictEqual(session.where().length, 1);

  support.quotes('building-the-interpreter', ['main:6, 1 frame live, 6 dispatches so far']);
});

test('figures: the suite runs to 17 of 17 with nine native calls', function () {
  const rows = Spec.CONFORMANCE.map(function (entry) {
    const program = programOf(entry.source);
    const built = Bytecode.compile(program, { mode: 'stack' });
    const out = Vm.run(built, { budget: 400000 });

    return { id: entry.id, natives: out.natives, chunks: Object.keys(built.chunks).length,
      agrees: IrInterp.compare(IrInterp.run(program), out).agree };
  });
  const byId = {};

  rows.forEach(function (row) { byId[row.id] = row; });
  assert.strictEqual(rows.filter(function (row) { return row.agrees; }).length, 17);
  assert.strictEqual(rows.reduce(function (sum, row) { return sum + row.natives; }, 0), 9);
  assert.strictEqual(byId.for.natives, 4);
  assert.strictEqual(byId.match.natives, 3);
  assert.strictEqual(byId.modules.natives, 2);
  assert.strictEqual(byId.closure.chunks, 3);

  support.quotes('building-the-interpreter',
    ['17 of 17 agree on value, output, outcome and every binding',
      '4 on the for program, 3 on match, 2 on modules, 0 everywhere else',
      '3 frames on the closure fixture', 'those 9 calls']);
});

/* ------------------------------------------------ 30.3 instruction selection */

test('figures: seven trees, seventeen tiles and twenty-four cycles', function () {
  const fn = programOf(IselTemplate.SAMPLES.multiplyAdd).functions[0];
  const out = Isel.selectFunction(fn);
  const optimal = Isel.checkOptimal(fn);
  const widest = out.rows.reduce(function (best, row) {
    return row.size > best.size ? row : best;
  }, out.rows[0]);

  assert.strictEqual(out.trees, 7);
  assert.strictEqual(out.instructions, 17);
  assert.strictEqual(out.cost, 24);
  assert.strictEqual(optimal.checked, 7);
  assert.strictEqual(optimal.disagreements, 0);
  assert.strictEqual(widest.size, 7);
  assert.strictEqual(widest.instructions, 6);

  support.quotes('instruction-selection',
    ['7 trees, 17 tiles, 24 cycles, with multiply-add chosen 1 time',
      '7 of 7 trees agree, with 0 disagreements']);
});

test('figures: the fused tile is chosen at four and abandoned at five', function () {
  const fn = programOf(IselTemplate.SAMPLES.multiplyAdd).functions[0];
  const sweep = Isel.costSweep(fn, 'MADDR', [2, 4, 5]);
  const byCost = {};

  sweep.forEach(function (row) { byCost[row.cost] = row; });
  assert.deepStrictEqual([byCost[2].total, byCost[2].instructions, byCost[2].uses], [22, 17, 1]);
  assert.deepStrictEqual([byCost[4].total, byCost[4].instructions, byCost[4].uses], [24, 17, 1]);
  assert.deepStrictEqual([byCost[5].total, byCost[5].instructions, byCost[5].uses], [24, 18, 0]);

  const mul = Isel.costSweep(fn, 'MUL', [1]);

  assert.deepStrictEqual([mul[0].total, mul[0].instructions, mul[0].uses], [20, 18, 2]);

  support.quotes('instruction-selection',
    ['22 cycles, still 17 tiles and 1 use — cheaper, not more often',
      '24 cycles, 18 tiles, and 0 uses — the tile stops being selected',
      '20 cycles, 18 tiles, and multiply chosen 2 times instead of 1']);
});

test('figures: twenty-five tiles, seven chosen, and the two multiply-add rows', function () {
  const fn = programOf(IselTemplate.SAMPLES.multiplyAdd).functions[0];
  const out = Isel.selectFunction(fn);
  const used = {};

  out.rows.forEach(function (row) {
    row.tiles.forEach(function (tile) { used[tile.tile] = (used[tile.tile] || 0) + 1; });
  });
  assert.strictEqual(Isel.TILES.length, 25);
  assert.strictEqual(Object.keys(used).length, 7);
  assert.strictEqual(used.MADD || 0, 0);
  assert.strictEqual(used.MADDR, 1);
  assert.strictEqual(used.LDXI || 0, 0);

  support.quotes('instruction-selection',
    ['2 — one with the multiply on the left and one on the right',
      'the left form fires 0 times and the right form fires 1',
      '25 tiles, of which 7 are chosen on this program']);
});

/* ------------------------------------------------- 30.4 register allocation */

function prepared(source) {
  const out = PassLab.run(source, ['ssa', 'sccp', 'copy-propagation', 'dead-code']);

  out.program.functions.forEach(function (fn) { if (fn.ssa) Ssa.destruct(fn); });
  return out.program.functions.reduce(function (best, fn) {
    return Ir.instructionCount(fn) > Ir.instructionCount(best) ? fn : best;
  }, out.program.functions[0]);
}

test('figures: colouring spends 13 points in memory and linear scan spends 9', function () {
  const fn = prepared(RegallocTemplate.SAMPLES.pressure);
  const split = Regalloc.compare(fn, { registers: 4 });
  const plain = Regalloc.compare(fn, { registers: 4, split: false });

  assert.strictEqual(split.rows[0].spilledPoints, 13);
  assert.strictEqual(split.rows[1].spilledPoints, 9);
  assert.strictEqual(split.rows[0].spills, 2);
  assert.strictEqual(split.rows[1].spills, 0);
  assert.strictEqual(split.rows[1].splits, 6);
  assert.strictEqual(plain.rows[1].spilledPoints, 15);
  assert.strictEqual(plain.rows[1].spills, 3);
  assert.strictEqual(split.graph.values, 11);
  assert.strictEqual(split.graph.maxDegree, 9);
  assert.strictEqual(split.graph.edges, 25);

  support.quotes('register-allocation',
    ['13 points in memory for colouring against 9 for linear scan',
      'colouring spills 2 intervals and linear scan spills 0, after 6 splits',
      '15 points instead of 9, and 3 spilled intervals instead of 0',
      '11 live ranges and 25 interference edges']);
});

test('figures: the sweep crosses over between one register and four', function () {
  const fn = prepared(RegallocTemplate.SAMPLES.pressure);
  const sweep = Regalloc.pressureSweep(fn, [1, 2, 3, 4, 6, 8]);
  const byRegisters = {};

  sweep.forEach(function (row) { byRegisters[row.registers] = row; });
  assert.deepStrictEqual([byRegisters[1].colouringPoints, byRegisters[1].scanPoints], [25, 30]);
  assert.deepStrictEqual([byRegisters[4].colouringPoints, byRegisters[4].scanPoints], [13, 9]);
  assert.strictEqual(byRegisters[8].colouringPoints, 0);
  assert.ok(byRegisters[3].scanPoints < byRegisters[3].colouringPoints,
    'linear scan is ahead at three registers, which the textbook claim does not predict');

  support.quotes('register-allocation',
    ['25 points for colouring against 30 for linear scan',
      'BEATS graph colouring at three and four']);
});

test('figures: every conformance program allocates soundly at four registers', function () {
  const rows = Spec.CONFORMANCE.map(function (entry) {
    const compared = Regalloc.compare(prepared(entry.source), { registers: 4 });

    return { id: entry.id, sound: compared.graph.verify.ok && compared.scan.verify.ok,
      colouring: compared.graph.spills, scan: compared.scan.spills };
  });

  assert.strictEqual(rows.filter(function (row) { return row.sound; }).length, 17);
  assert.strictEqual(rows.reduce(function (sum, row) { return sum + row.colouring; }, 0), 1);

  support.quotes('register-allocation',
    ['17 of 17 conformance programs verify at every program point']);
});
