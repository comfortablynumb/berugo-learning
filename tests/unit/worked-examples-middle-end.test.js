'use strict';

/**
 * Every figure the 29.1–29.3 content quotes, recomputed from the modules —
 * and then asserted to still appear in the prose.
 *
 * The second half is what makes this a test rather than a demonstration:
 * moving a number without moving the sentence that quotes it fails the build.
 * Every figure below comes from `node tools/section-dump.js <id>` at the
 * section's shipped defaults, so a change to a default control setting shows
 * up here too rather than silently making the prose describe a different run.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const support = require('../support/worked-example-prose.js');

const CONTENT = path.join(__dirname, '..', '..', 'src', 'js', 'content');
['concepts-middle-end', 'examples-middle-end']
  .forEach(function (file) { require(path.join(CONTENT, file + '.js')); });

const SECTIONS = path.join(__dirname, '..', '..', 'src', 'js', 'sections');
const BERUGO = path.join(__dirname, '..', '..', 'src', 'js', 'machines', 'berugo');

const Spec = require(path.join(BERUGO, 'spec.js'));
const Ast = require(path.join(BERUGO, 'ast.js'));
const Interp = require(path.join(BERUGO, 'interp.js'));
const Ir = require(path.join(BERUGO, 'ir.js'));
const IrLower = require(path.join(BERUGO, 'ir-lower.js'));
const IrInterp = require(path.join(BERUGO, 'ir-interp.js'));
const Cfg = require(path.join(BERUGO, 'cfg.js'));
const Dominators = require(path.join(BERUGO, 'dominators.js'));

const IrTemplate = require(path.join(SECTIONS, 'designing-an-ir-template.js'));
const CfgTemplate = require(path.join(SECTIONS, 'control-flow-graphs-template.js'));
const DomTemplate = require(path.join(SECTIONS, 'dominators-template.js'));

function mainOf(source) { return IrLower.compile(source).program.functions[0]; }

function graphOf(source) { return Cfg.build(mainOf(source)); }

/* ------------------------------------------------- 29.1 designing an IR */

test('figures: the loop sample lowers to four blocks and thirty-two instructions',
  function () {
    const built = IrLower.compile(IrTemplate.SAMPLES.loop);
    const fn = built.program.functions[0];

    assert.strictEqual(fn.blocks.length, 4);
    assert.strictEqual(Ir.instructionCount(fn), 32);
    assert.strictEqual(fn.nextRegister, 22, '22 virtual registers');
    assert.strictEqual(fn.slots.length, 4, '4 named locals are still slots');
    assert.ok(Ir.verify(fn).ok);

    support.quotes('designing-an-ir',
      ['4 blocks and 32 instructions', '22 registers and 4 slots']);
  });

test('figures: the first three instructions name the core nodes they came from', function () {
  const fn = mainOf(IrTemplate.SAMPLES.loop);
  const first = fn.blocks[0].instructions.slice(0, 3);

  assert.deepStrictEqual(first.map(function (inst) { return Ir.showInstruction(inst); }),
    ['%0 = const 0', 'store @0, %0', '%1 = const 1']);
  assert.deepStrictEqual(first.map(function (inst) { return inst.origin; }),
    ['num', 'letDecl', 'num']);

  support.quotes('designing-an-ir',
    ['const 0, store @0, const 1 — from num, letDecl and num']);
});

test('figures: the cyclic edge is the jump at the end of the loop body', function () {
  const fn = mainOf(IrTemplate.SAMPLES.loop);
  const graph = Cfg.build(fn);
  const back = Cfg.backEdges(graph);

  assert.strictEqual(back.length, 1, 'one back edge, and a tree has none');
  assert.strictEqual(back[0].to, 'b1', 'it points at the loop header');

  support.quotes('designing-an-ir', ['the jump at the end of the loop body back to b1']);
});

test('figures: ten invariants, all of them holding on the sample', function () {
  const fn = mainOf(IrTemplate.SAMPLES.loop);
  const verified = Ir.verify(fn);

  assert.strictEqual(Ir.INVARIANTS.length, 10);
  assert.strictEqual(verified.checked, 10);
  assert.deepStrictEqual(verified.problems, []);

  const ssaOnly = Ir.INVARIANTS.filter(function (row) {
    return row.about.indexOf('SSA:') === 0;
  });

  assert.deepStrictEqual(ssaOnly.map(function (row) { return row.id; }),
    ['single-def', 'dominance'], 'the two that need a dominator tree');

  support.quotes('designing-an-ir', ['all 10 invariants hold', '10 of 10',
    'invariant 1 of 10 — terminator', 'invariant 2 of 10 — target',
    'single-def and dominance']);
});

test('figures: seventeen conformance programs lower, verify and agree with the core',
  function () {
    const rows = Spec.CONFORMANCE.map(function (entry) {
      const built = IrLower.compile(entry.source);
      const core = Interp.compareWithCore(entry.source).core;

      return { id: entry.id, core: Ast.countNodes(built.core),
        blocks: built.program.functions[0].blocks.length,
        instructions: Ir.instructionCount(built.program.functions[0]),
        verified: Ir.verifyProgram(built.program).ok,
        agrees: IrInterp.compare(core, IrInterp.run(built.program)).agree };
    });

    assert.strictEqual(rows.length, 17);
    assert.strictEqual(rows.filter(function (row) { return row.verified; }).length, 17);
    assert.strictEqual(rows.filter(function (row) { return row.agrees; }).length, 17);

    const match = rows.find(function (row) { return row.id === 'match'; });

    assert.strictEqual(match.blocks, 7);
    assert.strictEqual(match.instructions, 32);

    support.quotes('designing-an-ir', ['17 of 17']);
  });

test('figures: the opcode table is eighteen rows and every one names its operand fields',
  function () {
    const names = Object.keys(Ir.OPCODES);

    assert.strictEqual(names.length, 18);
    names.forEach(function (name) {
      const spec = Ir.OPCODES[name];

      assert.ok(spec.about, name + ' has no description');
      assert.ok(Array.isArray(spec.uses) || spec.uses === undefined,
        name + ' does not name the fields holding its operand registers');
    });
  });

/* ------------------------------------------------ 29.2 control-flow graphs */

test('figures: the nested fixture is seven blocks, eight edges and two loops', function () {
  const summary = Cfg.summary(mainOf(CfgTemplate.SAMPLES.nested));

  assert.strictEqual(summary.blocks, 7);
  assert.strictEqual(summary.edges, 8);
  assert.strictEqual(summary.loops, 2);
  assert.strictEqual(summary.backEdges, 2);
  assert.strictEqual(summary.maxDepth, 2);

  support.quotes('control-flow-graphs',
    ['7 blocks, 8 edges, 2 natural loops, deepest nesting 2', '2 back edges and 2 loops']);
});

/** The suite table: every fixture, plus the graph Berugo cannot produce. */
function cfgSuite() {
  return Object.keys(CfgTemplate.SAMPLES).map(function (id) {
    return Object.assign({ id: id }, Cfg.summary(mainOf(CfgTemplate.SAMPLES[id])));
  });
}

test('figures: no lowered fixture has a critical edge or is irreducible', function () {
  const rows = cfgSuite();

  assert.strictEqual(rows.length, 5);
  assert.strictEqual(rows.filter(function (row) { return row.critical > 0; }).length, 0);
  assert.strictEqual(rows.filter(function (row) { return !row.reducible; }).length, 0);
  assert.strictEqual(rows.filter(function (row) { return row.unreachable > 0; }).length, 0);

  support.quotes('control-flow-graphs',
    ['0 for every one of them', '5 of 6 fixtures have neither']);
});

test('figures: the hand-built graph is six critical edges of seven, and irreducible',
  function () {
    const fn = handmade();
    const graph = Cfg.build(fn);

    assert.strictEqual(graph.edges.length, 7);
    assert.strictEqual(Cfg.criticalEdges(graph).length, 6);
    assert.strictEqual(Cfg.isReducible(graph), false);
    assert.strictEqual(Cfg.summary(fn).blocks, 5);

    Cfg.splitCriticalEdges(fn);
    assert.strictEqual(fn.blocks.length, 11, 'splitting turns 5 blocks into 11');
    assert.strictEqual(Cfg.criticalEdges(Cfg.build(fn)).length, 0);

    support.quotes('control-flow-graphs',
      ['6 critical edges out of 7', '1 of 6 fixtures is irreducible',
        '5 blocks and 6 critical edges into 11 blocks and none']);
  });

/** The section's hand-built graph, rebuilt here so the two cannot drift. */
function handmade() {
  const fn = Ir.makeFunction('handmade', []);
  const blocks = ['entry', 'split', 'left', 'right', 'exit']
    .map(function (label) { return Ir.makeBlock(fn, label); });
  const cond = Ir.freshRegister(fn, 'Bool');

  Ir.emit(blocks[0], 'const', { target: cond, value: true, origin: 'handmade' });
  Ir.terminate(blocks[0], 'jump', { target: blocks[1].id, origin: 'handmade' });
  Ir.terminate(blocks[1], 'branch',
    { cond: cond, then: blocks[2].id, other: blocks[3].id, origin: 'handmade' });
  Ir.terminate(blocks[2], 'branch',
    { cond: cond, then: blocks[3].id, other: blocks[4].id, origin: 'handmade' });
  Ir.terminate(blocks[3], 'branch',
    { cond: cond, then: blocks[2].id, other: blocks[4].id, origin: 'handmade' });
  Ir.terminate(blocks[4], 'ret', { value: null, origin: 'handmade' });
  return fn;
}

test('figures: the loop finder agrees with the enumeration on both nested loops', function () {
  const graph = graphOf(CfgTemplate.SAMPLES.nested);
  const loops = Cfg.loops(graph);
  const outer = loops.find(function (loop) { return loop.depth === 0; });
  const inner = loops.find(function (loop) { return loop.depth === 1; });

  assert.deepStrictEqual(outer.blocks.slice().sort(), ['b1', 'b2', 'b4', 'b5', 'b6']);
  assert.deepStrictEqual(inner.blocks.slice().sort(), ['b4', 'b5']);
  assert.strictEqual(inner.parent.header, 'b1');

  support.quotes('control-flow-graphs',
    ['b1, b2, b4, b5, b6 from each, and they agree', 'b4, b5 from each, agreeing, at depth 1']);
});

test('figures: the two-latches fixture is one loop from two back edges', function () {
  const graph = graphOf(CfgTemplate.SAMPLES.twoLatches);
  const loops = Cfg.loops(graph);

  assert.strictEqual(Cfg.backEdges(graph).length, 2,
    'without the `continue` both arms join before the latch and there is only one');
  assert.strictEqual(loops.length, 1);
  assert.deepStrictEqual(loops[0].latches.slice().sort(), ['b4', 'b6']);

  support.quotes('control-flow-graphs', ['1 loop from 2 back edges']);
});

/* ------------------------------------------------------- 29.3 dominators */

test('figures: two rounds over seven blocks, six changes then none', function () {
  const tree = Dominators.compute(graphOf(DomTemplate.SAMPLES.branchInLoop));

  assert.strictEqual(tree.rounds, 2);
  assert.deepStrictEqual(tree.changes.map(function (row) { return row.changes; }), [6, 0]);
  assert.strictEqual(Object.keys(tree.idom).length, 7);

  support.quotes('dominators',
    ['round 1 changed 6 blocks, round 2 changed 0', '0 changes in round 2',
      '6 of the 7 blocks settle in round 1']);
});

test('figures: the join block b6 is dominated by the branch, and its frontier is the header',
  function () {
    const graph = graphOf(DomTemplate.SAMPLES.branchInLoop);
    const tree = Dominators.compute(graph);

    assert.strictEqual(Dominators.immediate(tree, 'b6'), 'b2');
    assert.deepStrictEqual(Dominators.frontiers(tree).b6, ['b1']);

    support.quotes('dominators',
      ['b2 — the branch above the arms, not either arm', 'b1 — the loop header']);
  });

test('figures: the tree agrees with the removal oracle on all seven blocks', function () {
  const graph = graphOf(DomTemplate.SAMPLES.branchInLoop);
  const fast = Dominators.setsFrom(Dominators.compute(graph));
  const slow = Dominators.bruteForce(graph);

  assert.strictEqual(Object.keys(slow).length, 7);
  assert.deepStrictEqual(fast, slow);
  assert.deepStrictEqual(slow.b4, ['b0', 'b1', 'b2', 'b4']);

  support.quotes('dominators', ['7 of 7 agree', 'b0, b1, b2, b4 from both', '7 removals']);
});

test('figures: post-dominance answers the sixth question the tree is consulted for',
  function () {
    const graph = graphOf(DomTemplate.SAMPLES.branchInLoop);
    const post = Dominators.postDominators(graph);

    assert.ok(Object.keys(post.idom).length > 0,
      'speculation and partial redundancy both ask a post-dominance question, so the tree ' +
      'has to exist for the six-question table to be a claim rather than a list');

    support.quotes('dominators', ['6 questions from six different passes']);
  });
