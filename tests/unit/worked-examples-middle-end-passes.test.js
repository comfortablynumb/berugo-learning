'use strict';

/**
 * Every figure the 29.4–29.6 content quotes, recomputed from the modules —
 * and then asserted to still appear in the prose. Same discipline as the
 * 29.1–29.3 suite: the numbers come from `node tools/section-dump.js <id>` at
 * the shipped defaults, so moving a default control setting fails here rather
 * than leaving the prose describing a run nobody sees.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const support = require('../support/worked-example-prose.js');

const CONTENT = path.join(__dirname, '..', '..', 'src', 'js', 'content');
['concepts-middle-end-passes', 'examples-middle-end-passes']
  .forEach(function (file) { require(path.join(CONTENT, file + '.js')); });

const SECTIONS = path.join(__dirname, '..', '..', 'src', 'js', 'sections');
const BERUGO = path.join(__dirname, '..', '..', 'src', 'js', 'machines', 'berugo');
const MACHINES = path.join(__dirname, '..', '..', 'src', 'js', 'machines');

const Ir = require(path.join(BERUGO, 'ir.js'));
const IrLower = require(path.join(BERUGO, 'ir-lower.js'));
const IrInterp = require(path.join(BERUGO, 'ir-interp.js'));
const Cfg = require(path.join(BERUGO, 'cfg.js'));
const Ssa = require(path.join(BERUGO, 'ssa.js'));
const Dataflow = require(path.join(BERUGO, 'dataflow.js'));
const Scalar = require(path.join(BERUGO, 'passes-scalar.js'));
const PassLab = require(path.join(MACHINES, 'pass-lab.js'));

const SsaTemplate = require(path.join(SECTIONS, 'ssa-form-template.js'));
const DataflowTemplate = require(path.join(SECTIONS, 'dataflow-analysis-template.js'));
const ScalarTemplate = require(path.join(SECTIONS, 'scalar-optimisations-template.js'));

const PIPELINES = {
  full: ['ssa', 'sccp', 'copy-propagation', 'value-numbering', 'peephole', 'dead-code'],
  sccp: ['ssa', 'sccp', 'dead-code'],
  plain: ['ssa', 'copy-propagation', 'peephole', 'dead-code'],
  none: ['ssa']
};

function lastFunction(program) { return program.functions[program.functions.length - 1]; }

function afterSsa(source) { return lastFunction(PassLab.run(source, ['ssa']).program); }

/* ------------------------------------------------------------ 29.4 SSA form */

/** The section's prune table: every conformance program that needs a phi. */
function pruneRows() {
  const Spec = require(path.join(BERUGO, 'spec.js'));

  return Spec.CONFORMANCE.map(function (entry) {
    const program = IrLower.compile(entry.source).program;
    const built = program.functions.map(function (fn) {
      return Ssa.construct(fn, { prune: true });
    });
    const sum = function (field) {
      return built.reduce(function (total, row) { return total + row[field]; }, 0);
    };

    return { id: entry.id, placed: sum('placed'), pruned: sum('pruned'), kept: sum('phis') };
  }).filter(function (row) { return row.placed > 0; });
}

test('figures: nine phis placed across the suite, three pruned, six kept', function () {
  const rows = pruneRows();
  const total = function (field) {
    return rows.reduce(function (sum, row) { return sum + row[field]; }, 0);
  };

  assert.deepStrictEqual(rows.map(function (row) { return row.id; }),
    ['conditional', 'match', 'while', 'for']);
  assert.strictEqual(total('placed'), 9);
  assert.strictEqual(total('pruned'), 3);
  assert.strictEqual(total('kept'), 6);

  const match = rows.find(function (row) { return row.id === 'match'; });

  assert.deepStrictEqual([match.placed, match.pruned, match.kept], [4, 2, 2],
    'match has the largest gap, which is where the placement rule is most generous');

  support.quotes('ssa-form',
    ['9 placed, 3 pruned, 6 kept', 'match — 4 placed, 2 pruned, 2 kept',
      '3 removals across the 4 programs']);
});

test('figures: the loop sample promotes four slots and finds a definition for every read',
  function () {
    const program = IrLower.compile(SsaTemplate.SAMPLES.loop).program;
    const built = Ssa.construct(program.functions[0]);

    assert.strictEqual(built.slots, 4);
    assert.strictEqual(built.missing || 0, 0, 'a read with no reaching definition is a bug');
    Ssa.prune(program.functions[0]);

    const phis = [];

    Ir.eachInstruction(program.functions[0], function (inst, block) {
      if (inst.op === 'phi') phis.push({ target: inst.target, block: block.id });
    });
    assert.deepStrictEqual(phis.map(function (row) { return row.target; }), ['%21', '%20']);
    assert.ok(phis.every(function (row) { return row.block === 'b1'; }),
      'both survivors sit at the loop header');

    support.quotes('ssa-form',
      ['4 slots promoted, 0 reads found no definition on any path',
        '%21 for the loop index and %20 for the accumulator']);
  });

/** Destruction over the same five cases the section tabulates. */
function destructRows() {
  const Spec = require(path.join(BERUGO, 'spec.js'));

  return Spec.CONFORMANCE.map(function (entry) {
    const program = IrLower.compile(entry.source).program;

    program.functions.forEach(function (fn) { Ssa.construct(fn); Ssa.prune(fn); });
    const before = IrInterp.run(program);
    const state = program.functions.map(function (fn) { return Ssa.destruct(fn); });

    return { id: entry.id,
      moves: state.reduce(function (sum, row) { return sum + row.moves; }, 0),
      temporaries: state.reduce(function (sum, row) { return sum + row.temporaries; }, 0),
      agrees: IrInterp.compare(before, IrInterp.run(program)).agree };
  }).filter(function (row) { return row.moves > 0; });
}

test('figures: four real programs need 2, 4, 2 and 4 copies and no temporary at all',
  function () {
    const rows = destructRows();

    assert.deepStrictEqual(rows.map(function (row) { return row.id; }),
      ['conditional', 'match', 'while', 'for']);
    assert.deepStrictEqual(rows.map(function (row) { return row.moves; }), [2, 4, 2, 4]);
    assert.strictEqual(rows.reduce(function (sum, row) { return sum + row.temporaries; }, 0), 0);
    assert.ok(rows.every(function (row) { return row.agrees; }));

    support.quotes('ssa-form', ['2, 4, 2 and 4 copies, and 0 temporaries anywhere']);
  });

test('figures: the hand-built swap needs three phis, seven copies and one temporary',
  function () {
    const fn = swapFunction();
    const program = { functions: [fn], main: fn.name, globals: [] };
    const before = IrInterp.run(program);
    let phis = 0;

    Ir.eachInstruction(fn, function (inst) { if (inst.op === 'phi') phis += 1; });
    const out = Ssa.destruct(fn);
    const after = IrInterp.run(program);

    assert.strictEqual(phis, 3);
    assert.strictEqual(out.moves, 7);
    assert.strictEqual(out.temporaries, 1);
    assert.ok(IrInterp.compare(before, after).agree,
      'the copies must be sequenced so the exchange survives; saving the SOURCE instead of ' +
      'the destination leaves both registers holding the same value');
    assert.strictEqual(before.value, '1', 'a - b after the swap, and 0 if the cycle collapsed');

    support.quotes('ssa-form', ['3 phis, 7 copies, 1 temporary', '5 of 5 preserved']);
  });

/** The section's hand-built swap, rebuilt so the two cannot drift apart. */
function swapFunction() {
  const fn = Ir.makeFunction('swap-cycle', []);
  const blocks = ['entry', 'header', 'exit']
    .map(function (label) { return Ir.makeBlock(fn, label); });
  const reg = {};

  ['a0', 'b0', 'i0', 'a1', 'b1', 'i1', 'i2', 'one', 'limit', 'diff']
    .forEach(function (name) { reg[name] = Ir.freshRegister(fn, 'Number'); });
  reg.cond = Ir.freshRegister(fn, 'Bool');
  Ir.emit(blocks[0], 'const', { target: reg.a0, value: 1, origin: 'handmade' });
  Ir.emit(blocks[0], 'const', { target: reg.b0, value: 2, origin: 'handmade' });
  Ir.emit(blocks[0], 'const', { target: reg.i0, value: 0, origin: 'handmade' });
  Ir.terminate(blocks[0], 'jump', { target: blocks[1].id, origin: 'handmade' });
  swapHeader(fn, blocks, reg);
  Ir.emit(blocks[2], 'binary', { target: reg.diff, operator: 'sub', left: reg.a1,
    right: reg.b1, origin: 'handmade' });
  Ir.terminate(blocks[2], 'ret', { value: reg.diff, origin: 'handmade' });
  return fn;
}

function swapHeader(fn, blocks, reg) {
  const header = blocks[1];
  const phi = function (target, fromEntry, fromLatch) {
    header.instructions.push(Ir.instruction('phi', { target: target,
      incoming: [{ block: blocks[0].id, value: fromEntry },
        { block: header.id, value: fromLatch }], origin: 'handmade' }));
  };

  phi(reg.a1, reg.a0, reg.b1);
  phi(reg.b1, reg.b0, reg.a1);
  phi(reg.i1, reg.i0, reg.i2);
  Ir.emit(header, 'const', { target: reg.one, value: 1, origin: 'handmade' });
  Ir.emit(header, 'const', { target: reg.limit, value: 3, origin: 'handmade' });
  Ir.emit(header, 'binary', { target: reg.i2, operator: 'add', left: reg.i1,
    right: reg.one, origin: 'handmade' });
  Ir.emit(header, 'binary', { target: reg.cond, operator: 'lt', left: reg.i1,
    right: reg.limit, origin: 'handmade' });
  Ir.terminate(header, 'branch', { cond: reg.cond, then: header.id,
    other: blocks[2].id, origin: 'handmade' });
}

/* --------------------------------------------------- 29.5 dataflow analysis */

test('figures: the four analyses differ only in direction, meet and initial value',
  function () {
    const fn = afterSsa(DataflowTemplate.SAMPLES.loop);
    const rows = ['liveness', 'reaching', 'available', 'busy'].map(function (name) {
      return Dataflow.run(fn, name);
    });

    assert.deepStrictEqual(rows.map(function (row) { return row.direction; }),
      ['backward', 'forward', 'forward', 'backward']);
    assert.deepStrictEqual(rows.map(function (row) { return row.meet; }),
      ['union', 'union', 'intersect', 'intersect']);

    support.quotes('dataflow-analysis',
      ['row 1 of 4 — backward, union', 'row 3 of 4 — forward, intersect',
        '2 unions start at empty; 2 intersections start at everything']);
  });

test('figures: the same four-block function costs 1.50, 1.75, 1.00 and 2.00 visits a block',
  function () {
    const fn = afterSsa(DataflowTemplate.SAMPLES.loop);
    const rows = ['liveness', 'reaching', 'available', 'busy'].map(function (name) {
      const result = Dataflow.run(fn, name);

      return support.fixed(result.rounds / result.blocks, 2);
    });

    assert.deepStrictEqual(rows, ['1.50', '1.75', '1.00', '2.00']);

    support.quotes('dataflow-analysis',
      ['liveness 1.50 visits per block, reaching 1.75, available 1.00, busy 2.00']);
  });

/** The liveness check table: every fixture against the path enumeration. */
function livenessRows() {
  return Object.keys(DataflowTemplate.SAMPLES).map(function (id) {
    const fn = afterSsa(DataflowTemplate.SAMPLES[id]);
    const fast = Dataflow.run(fn, 'liveness');
    const slow = Dataflow.bruteLiveness(fn);

    /* Live registers is the SUM of the out-sets, not the size of their union:
       the column is how much the allocator has to keep alive across the whole
       function, and a register live out of three blocks costs three times. */
    return { id: id, blocks: fast.blocks, visits: fast.rounds,
      live: Object.keys(fast.out).reduce(function (sum, block) {
        return sum + fast.out[block].size;
      }, 0),
      agrees: Object.keys(slow).every(function (block) {
        return Dataflow.sameSet(fast.out[block], slow[block]);
      }) };
  });
}

test('figures: five fixtures, five exact agreements with the enumeration', function () {
  const rows = livenessRows();
  const loop = rows.find(function (row) { return row.id === 'loop'; });
  const straight = rows.find(function (row) { return row.id === 'straight'; });

  assert.strictEqual(rows.length, 5);
  assert.strictEqual(rows.filter(function (row) { return row.agrees; }).length, 5);
  assert.deepStrictEqual([loop.blocks, loop.visits, loop.live], [4, 6, 5]);
  assert.deepStrictEqual([straight.blocks, straight.visits, straight.live], [1, 1, 0]);

  support.quotes('dataflow-analysis',
    ['5 of 5 agree exactly', '4 blocks, 6 visits, 5 live registers',
      '1 block, 1 visit, 0 live registers']);
});

test('figures: the loop header has one register in and three out', function () {
  const fn = afterSsa(DataflowTemplate.SAMPLES.loop);
  const result = Dataflow.run(fn, 'liveness');

  assert.deepStrictEqual(Array.from(result.in.b1).sort(), ['%4']);
  assert.deepStrictEqual(Array.from(result.out.b1).sort(), ['%22', '%23', '%4']);

  support.quotes('dataflow-analysis', ['b1 has %4 in and %22, %23, %4 out']);
});

/* ------------------------------------------------ 29.6 scalar optimisations */

test('figures: SCCP reaches seven instructions where folding alone stops at twelve',
  function () {
    const source = ScalarTemplate.SAMPLES.guarded;
    const sizes = {};

    Object.keys(PIPELINES).forEach(function (name) {
      sizes[name] = PassLab.run(source, PIPELINES[name]).instructions;
    });
    assert.strictEqual(sizes.none, 15, 'SSA construction only');
    assert.strictEqual(sizes.plain, 12, 'folding without reachability');
    assert.strictEqual(sizes.sccp, 7);
    assert.strictEqual(sizes.full, 6);
    assert.strictEqual(sizes.plain - sizes.sccp, 5, 'the five instructions in between');

    support.quotes('scalar-optimisations',
      ['15 instructions', '12 instructions, 0 blocks removed', '7 instructions, 1 block removed',
        '5 instructions, one of them a division by zero']);
  });

test('figures: the guarded fixture goes 19 down to 6, and SCCP folds five values', function () {
  const out = PassLab.run(ScalarTemplate.SAMPLES.guarded, PIPELINES.full);
  const first = out.steps[0].before;
  const sccp = out.steps.find(function (step) { return step.pass === 'sccp'; });
  const report = sccp.reports[sccp.reports.length - 1];

  assert.strictEqual(first, 19);
  assert.strictEqual(out.instructions, 6);
  assert.strictEqual(support.fixed(100 * (first - out.instructions) / first, 1), '68.4');
  assert.strictEqual(report.folded, 5);
  assert.strictEqual(report.blocks, 1, 'one block proved unreachable');
  assert.strictEqual(report.branches, 1, 'one branch straightened');

  support.quotes('scalar-optimisations', ['6 instructions — 19 down to 6, 68.4% removed']);
});

/** Phase ordering over every fixture, in both directions. */
function orderingRows() {
  return Object.keys(ScalarTemplate.SAMPLES).map(function (id) {
    return Object.assign({ id: id },
      PassLab.ordering(ScalarTemplate.SAMPLES[id], 'sccp', 'value-numbering'));
  });
}

test('figures: three of five fixtures differ by one instruction, all favouring the first order',
  function () {
    const rows = orderingRows();
    const differing = rows.filter(function (row) { return !row.same; });

    assert.strictEqual(rows.length, 5);
    assert.strictEqual(differing.length, 3);
    assert.deepStrictEqual(differing.map(function (row) { return row.id; }).sort(),
      ['folding', 'guarded', 'redundant']);
    assert.ok(differing.every(function (row) { return row.difference === -1; }),
      'every difference is one instruction in the same direction');

    const byId = {};

    rows.forEach(function (row) { byId[row.id] = row; });
    assert.deepStrictEqual([byId.guarded.first.instructions, byId.guarded.second.instructions],
      [6, 7]);
    assert.deepStrictEqual([byId.redundant.first.instructions,
      byId.redundant.second.instructions], [5, 6]);
    assert.strictEqual(byId.identities.first.instructions, 36);
    assert.strictEqual(byId.loop.first.instructions, 25);

    support.quotes('scalar-optimisations',
      ['3 of 5 differ', 'guarded 6 against 7, redundant 5 against 6, folding 6 against 7',
        'identities at 36 both ways and loop at 25 both ways']);
  });

test('figures: four of five peephole rules fire on the identities fixture, 45 down to 24',
  function () {
    const source = ScalarTemplate.SAMPLES.identities;
    const out = PassLab.run(source, PIPELINES.full);
    const first = out.steps[0].before;
    const fired = countRules(source);

    assert.strictEqual(first, 45);
    assert.strictEqual(out.instructions, 24);
    assert.strictEqual(support.fixed(100 * (first - out.instructions) / first, 1), '46.7');
    assert.strictEqual(Scalar.RULES.length, 5);
    assert.strictEqual(fired.filter(function (row) { return row.count > 0; }).length, 4,
      'eq-self is the one that never fires, because the fixture has no self-comparison');

    support.quotes('scalar-optimisations',
      ['4 of 5 rules fire, and the program goes 45 to 24 — 46.7% removed']);
  });

/**
 * How often each rewrite rule fires, summed over every function rather than
 * the first the lowering emitted — which is the section's own counter, and it
 * has to run the whole pipeline: the peephole pass sees whatever SCCP and copy
 * propagation left, not the raw construction.
 */
function countRules(source) {
  const out = PassLab.run(source, PIPELINES.full);
  const step = out.steps.find(function (entry) { return entry.pass === 'peephole'; });
  const counts = {};

  (step ? step.reports : []).forEach(function (report) {
    Object.keys(report.rules || {}).forEach(function (id) {
      counts[id] = (counts[id] || 0) + report.rules[id];
    });
  });
  return Scalar.RULES.map(function (rule) {
    return { id: rule.id, count: counts[rule.id] || 0 };
  });
}

test('figures: the pipeline removes 100 of 229 instructions across the whole suite',
  function () {
    const suite = PassLab.suite(PIPELINES.full);

    assert.strictEqual(suite.total, 17);
    assert.strictEqual(suite.passed, 17);
    assert.strictEqual(suite.before, 229);
    assert.strictEqual(suite.after, 129);
    assert.strictEqual(suite.before - suite.after, 100);
    assert.strictEqual(support.fixed(100 * (suite.before - suite.after) / suite.before, 1),
      '43.7');
  });

test('figures: the whole guarded pipeline holds every gate after every pass', function () {
  const out = PassLab.run(ScalarTemplate.SAMPLES.guarded, PIPELINES.full);

  assert.strictEqual(out.steps.length, 6);
  out.steps.forEach(function (step) {
    assert.ok(step.verified, step.pass + ' broke a structural invariant');
    assert.ok(step.dominance, step.pass + ' broke an SSA invariant');
    assert.ok(step.agrees, step.pass + ' changed what the program computes');
  });
  assert.ok(Cfg.summary(lastFunction(out.program)).unreachable === 0);
});
