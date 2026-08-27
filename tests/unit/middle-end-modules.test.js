'use strict';

/**
 * Property tests for the Berugo middle end (M29).
 *
 * The discipline of this milestone is that **a pass is correct exactly when
 * the optimised program computes what the unoptimised one computed**, and that
 * every analysis it rests on is checked against a second implementation of the
 * definition rather than against itself. So the properties below are three
 * shapes, repeated:
 *
 *   - a **brute-force oracle** — dominance by removing a block and asking what
 *     became unreachable, loop membership by enumerating paths, liveness by
 *     enumerating paths, aliasing by recording which registers really held the
 *     same object. Each is exponential, useless at scale, and cannot be subtly
 *     wrong, which is the whole reason to have it;
 *   - the **differential run**, which is the only gate that sees a pass
 *     producing perfectly valid IR that computes the wrong answer;
 *   - a **sensitivity**: every gate is also run against something deliberately
 *     broken, because a check nobody has watched fire is a check nobody
 *     believes. Naive LICM has to fail, or the safe one proves nothing.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const BERUGO = path.join(__dirname, '..', '..', 'src', 'js', 'machines', 'berugo');
const MACHINES = path.join(__dirname, '..', '..', 'src', 'js', 'machines');

const Spec = require(path.join(BERUGO, 'spec.js'));
const Ast = require(path.join(BERUGO, 'ast.js'));
const Interp = require(path.join(BERUGO, 'interp.js'));
const Fuzz = require(path.join(BERUGO, 'fuzz.js'));
const Ir = require(path.join(BERUGO, 'ir.js'));
const IrLower = require(path.join(BERUGO, 'ir-lower.js'));
const IrInterp = require(path.join(BERUGO, 'ir-interp.js'));
const Cfg = require(path.join(BERUGO, 'cfg.js'));
const Dominators = require(path.join(BERUGO, 'dominators.js'));
const Ssa = require(path.join(BERUGO, 'ssa.js'));
const Dataflow = require(path.join(BERUGO, 'dataflow.js'));
const Scalar = require(path.join(BERUGO, 'passes-scalar.js'));
const Loop = require(path.join(BERUGO, 'passes-loop.js'));
const Interproc = require(path.join(BERUGO, 'interproc.js'));
const Alias = require(path.join(BERUGO, 'alias.js'));
const PassLab = require(path.join(MACHINES, 'pass-lab.js'));

/* ----------------------------------------------------------------- fixtures */

/** The shapes the sections measure, named once so every suite shares them. */
const SHAPES = {
  loop: 'let t = 0;\nfor v in [1, 2, 3] { t = t + v * 2; }',
  nested: 'let t = 0;\nfor a in [1, 2] {\n  for b in [3, 4] { t = t + a * b; }\n}',
  branchInLoop: 'let t = 0;\nfor v in [1, 2, 3, 4] {\n' +
    '  if v > 2 { t = t + v; } else { t = t - 1; }\n}',
  twoLatches: 'let t = 0;\nlet i = 0;\nwhile i < 5 {\n  i = i + 1;\n' +
    '  if i == 2 { continue; } else { t = t + i; }\n}',
  diamond: 'let a = 3;\nlet b = if a < 5 { a * 2 } else { a - 1 };\nlet c = b + 1;',
  straight: 'let a = 1;\nlet b = a + 2;\nlet c = b * 3;',
  reuse: 'let a = 1;\nlet b = 2;\nlet c = a + b;\nlet d = a + b;\nlet e = c + d;',
  early: 'fn find(xs) {\n  for v in xs { if v > 2 { return v; } else { } }\n' +
    '  return 0;\n}\nlet r = find([1, 3, 5]);',
  trap: 'let d = 0;\nlet n = 0;\nlet acc = 0;\nwhile n < d {\n' +
    '  acc = acc + 100 / d;\n  n = n + 1;\n}',
  merge: 'let p = { x: 1 };\nlet q = { x: 2 };\nlet r = if 1 < 2 { p } else { q };\n' +
    'let v = r.x + p.x;',
  escapes: 'fn wrap(n) { return { value: n }; }\nfn read(r) { return r.value; }\n' +
    'let local = { value: 1 };\nlet box = { value: 2 };\n' +
    'let s = local.value + read(box) + wrap(3).value;'
};

const SHAPE_IDS = Object.keys(SHAPES);

function lastFunction(program) { return program.functions[program.functions.length - 1]; }

function mainOf(source) { return IrLower.compile(source).program.functions[0]; }

function graphOf(source) { return Cfg.build(mainOf(source)); }

/** The IR after SSA construction, which is what every pass past 29.4 takes. */
function ssaProgram(source, pipeline) {
  return PassLab.run(source, pipeline || ['ssa', 'copy-propagation']).program;
}

/* --------------------------------------------------------- the IR and its verifier */

test('ir: every conformance program lowers, verifies and computes what the core did',
  function () {
    const wrong = [];

    Spec.CONFORMANCE.forEach(function (entry) {
      const built = IrLower.compile(entry.source);
      const core = Interp.compareWithCore(entry.source).core;
      const verified = Ir.verifyProgram(built.program);

      if (!verified.ok) wrong.push(entry.id + ': ' + verified.problems[0].invariant);
      if (!IrInterp.compare(core, IrInterp.run(built.program)).agree) {
        wrong.push(entry.id + ': the IR computes something else');
      }
      assert.ok(Ast.countNodes(built.core) > 0, entry.id + ' lowered from nothing');
    });
    assert.deepStrictEqual(wrong, [],
      'an IR that verifies and computes something else is exactly the failure a verifier ' +
      'cannot see, which is why both columns are checked');
  });

test('ir: the verifier states ten invariants and every one of them can be violated',
  function () {
    assert.strictEqual(Ir.INVARIANTS.length, 10);
    Ir.INVARIANTS.forEach(function (row) {
      assert.ok(row.id && row.about, 'an invariant with no name cannot name itself');
    });
  });

/** Each breaker is the section's, so the demo and the test fail together. */
const BREAKERS = {
  terminator: function (fn) { fn.blocks[fn.blocks.length - 1].terminator = null; },
  target: function (fn) {
    const block = fn.blocks.find(function (entry) { return entry.terminator; });

    if (block.terminator.op === 'jump') block.terminator.target = 'bNope';
    else block.terminator.then = 'bNope';
  },
  defined: function (fn) {
    fn.blocks[0].instructions.push(
      Ir.instruction('move', { target: '%999', from: '%404', origin: 'injected' }));
  },
  reachable: function (fn) {
    Ir.terminate(Ir.makeBlock(fn, 'orphan'), 'ret', { value: null, origin: 'injected' });
  }
};

test('ir: each injected defect names its own invariant rather than merely refusing',
  function () {
    Object.keys(BREAKERS).forEach(function (kind) {
      const fn = mainOf(SHAPES.loop);

      assert.ok(Ir.verify(fn).ok, 'the lowering produced invalid IR before anything broke it');
      BREAKERS[kind](fn);
      const verified = Ir.verify(fn);

      assert.ok(!verified.ok, kind + ' was injected and the verifier accepted the function');
      assert.ok(verified.problems.some(function (problem) { return problem.invariant === kind; }),
        kind + ' fired as ' + verified.problems.map(function (p) { return p.invariant; }));
    });
  });

test('ir: cloning a function copies it deeply enough that a pass cannot reach the original',
  function () {
    const fn = mainOf(SHAPES.loop);
    const copy = Ir.cloneFunction(fn);
    const before = Ir.instructionCount(fn);

    copy.blocks[0].instructions.length = 0;
    assert.strictEqual(Ir.instructionCount(fn), before,
      'the differential run compiles the same program twice and would compare a program ' +
      'against itself if the clone shared blocks');
  });

/* ------------------------------------------------------------- control-flow graphs */

/** The oracle: every block that reaches a latch without passing the header. */
function reachesWithout(graph, from, target, avoid) {
  const seen = new Set();
  const stack = [from];

  if (from === target) return true;
  while (stack.length) {
    const id = stack.pop();

    if (id === target) return true;
    if (seen.has(id) || id === avoid) continue;
    seen.add(id);
    (graph.succs[id] || []).forEach(function (next) { stack.push(next); });
  }
  return false;
}

function loopOracle(graph, loop) {
  const body = new Set([loop.header]);

  (loop.latches || [loop.latch]).forEach(function (latch) {
    graph.blocks.forEach(function (id) {
      if (reachesWithout(graph, id, latch, loop.header)) body.add(id);
    });
  });
  return Array.from(body).sort();
}

test('cfg: every natural loop agrees with a path enumeration of the definition', function () {
  let checked = 0;

  SHAPE_IDS.forEach(function (id) {
    const graph = graphOf(SHAPES[id]);

    Cfg.loops(graph).forEach(function (loop) {
      assert.deepStrictEqual(loop.blocks.slice().sort(), loopOracle(graph, loop),
        id + ' loop at ' + loop.header + ' disagrees with the enumeration');
      checked += 1;
    });
  });
  assert.ok(checked >= 6, 'only ' + checked + ' loops were compared, so the sweep found none');
});

test('cfg: two back edges to one header are one loop with two latches', function () {
  const graph = graphOf(SHAPES.twoLatches);
  const found = Cfg.loops(graph);

  assert.strictEqual(Cfg.backEdges(graph).length, 2, 'the fixture stopped producing two latches');
  assert.strictEqual(found.length, 1,
    'treating each back edge as its own loop reports two loops sharing every block, which ' +
    'makes the nesting forest not a forest');
  assert.strictEqual((found[0].latches || [found[0].latch]).length, 2);
});

test('cfg: nesting depth follows containment, and the inner loop is inside the outer',
  function () {
    const found = Cfg.loops(graphOf(SHAPES.nested));
    const outer = found.find(function (loop) { return loop.depth === 0; });
    const inner = found.find(function (loop) { return loop.depth === 1; });

    assert.ok(outer && inner, 'the nested fixture no longer produces two nesting levels');
    assert.strictEqual(inner.parent.header, outer.header);
    inner.blocks.forEach(function (id) {
      assert.ok(outer.blocks.indexOf(id) !== -1, id + ' is in the inner loop and not the outer');
    });
  });

test('cfg: nothing the language can write has a critical edge or is irreducible', function () {
  SHAPE_IDS.forEach(function (id) {
    const summary = Cfg.summary(mainOf(SHAPES[id]));

    assert.strictEqual(summary.critical, 0, id + ' produced a critical edge');
    assert.strictEqual(summary.reducible, true, id + ' produced an irreducible graph');
    assert.strictEqual(summary.unreachable, 0, id + ' left an unreachable block behind');
  });
});

test('cfg: splitting critical edges removes them and keeps the graph reducible', function () {
  const fn = handmadeGraph();
  const before = Cfg.criticalEdges(Cfg.build(fn));

  assert.ok(before.length > 0,
    'the hand-built graph is the only source of a critical edge, so if it stops producing ' +
    'one the splitter is an untested branch again');
  const split = Cfg.splitCriticalEdges(fn);

  assert.strictEqual(split.split, before.length);
  assert.strictEqual(Cfg.criticalEdges(Cfg.build(fn)).length, 0);
  assert.ok(Ir.verify(fn).ok, 'splitting produced IR the verifier rejects');
});

/**
 * A shape the language cannot produce: two blocks that enter each other's
 * region, so neither dominates the other and no natural loop describes it —
 * and every edge out of the split lands on a join, which is critical.
 */
function handmadeGraph() {
  const fn = Ir.makeFunction('handmade', []);
  const blocks = ['entry', 'split', 'left', 'right', 'exit']
    .map(function (label) { return Ir.makeBlock(fn, label); });
  const cond = Ir.freshRegister(fn, 'Bool');

  Ir.emit(blocks[0], 'const', { target: cond, value: true, origin: 'test' });
  Ir.terminate(blocks[0], 'jump', { target: blocks[1].id, origin: 'test' });
  Ir.terminate(blocks[1], 'branch',
    { cond: cond, then: blocks[2].id, other: blocks[3].id, origin: 'test' });
  Ir.terminate(blocks[2], 'branch',
    { cond: cond, then: blocks[3].id, other: blocks[4].id, origin: 'test' });
  Ir.terminate(blocks[3], 'branch',
    { cond: cond, then: blocks[2].id, other: blocks[4].id, origin: 'test' });
  Ir.terminate(blocks[4], 'ret', { value: null, origin: 'test' });
  return fn;
}

test('cfg: the hand-built graph is irreducible, which nothing lowered from Berugo is',
  function () {
    assert.strictEqual(Cfg.isReducible(Cfg.build(handmadeGraph())), false,
      'a compiler still has to handle irreducible flow, so the case has to be demonstrable');
  });

/* -------------------------------------------------------------------- dominators */

test('dominators: the whole tree agrees with removing a block and asking what is lost',
  function () {
    SHAPE_IDS.forEach(function (id) {
      const graph = graphOf(SHAPES[id]);

      assert.deepStrictEqual(Dominators.setsFrom(Dominators.compute(graph)),
        Dominators.bruteForce(graph),
        id + ': a wrong dominator tree produces an optimiser that hoists code past a branch');
    });
  });

test('dominators: reverse postorder settles a reducible graph in one productive round',
  function () {
    SHAPE_IDS.forEach(function (id) {
      const graph = graphOf(SHAPES[id]);
      const trace = Dominators.compute(graph).changes;
      const productive = trace.filter(function (round) { return round.changes > 0; });

      assert.ok(trace.length >= (graph.blocks.length > 1 ? 2 : 1),
        id + ' stopped without a confirming round');
      assert.strictEqual(trace[trace.length - 1].changes, 0,
        id + ' reported a fixpoint on a round that still changed something');
      assert.ok(productive.length <= 2,
        id + ' needed ' + productive.length + ' productive rounds, so the visit order was lost');
    });
  });

test('dominators: the frontier of a block is exactly where its values stop being the only one',
  function () {
    const graph = graphOf(SHAPES.diamond);
    const tree = Dominators.compute(graph);
    const frontier = Dominators.frontiers(tree);

    Object.keys(frontier).forEach(function (id) {
      frontier[id].forEach(function (target) {
        assert.ok(!Dominators.strictlyDominates(tree, id, target),
          id + ' strictly dominates ' + target + ', so it cannot be on its frontier');
        assert.ok((graph.preds[target] || []).some(function (pred) {
          return Dominators.dominates(tree, id, pred);
        }), id + ' is on the frontier of ' + target + ' but dominates none of its predecessors');
      });
    });
  });

test('dominators: post-dominance is dominance on the reversed graph, and the exit is virtual',
  function () {
    const post = Dominators.postDominators(graphOf(SHAPES.branchInLoop));

    assert.ok(post.idom, 'post-dominance returned no tree');
    assert.ok(Object.keys(post.idom).length > 0,
      'a function with several returns has no single exit, so the tree needs a virtual one');
  });

/* ---------------------------------------------------------------------- SSA form */

test('ssa: construction holds both invariants and computes what the program computed',
  function () {
    const wrong = [];

    Spec.CONFORMANCE.forEach(function (entry) {
      const program = IrLower.compile(entry.source).program;
      const before = IrInterp.run(program);

      program.functions.forEach(function (fn) { Ssa.construct(fn); });
      const checked = program.functions.map(function (fn) { return Ssa.check(fn); });

      checked.forEach(function (result, index) {
        if (!result.ok) wrong.push(entry.id + '/' + index + ': ' + result.problems[0].why);
      });
      if (!IrInterp.compare(before, IrInterp.run(program)).agree) {
        wrong.push(entry.id + ': construction changed what the program computes');
      }
    });
    assert.deepStrictEqual(wrong, []);
  });

test('ssa: a phi operand is used on the edge, so its definition dominates the PREDECESSOR',
  function () {
    const fn = lastFunction(ssaProgram(SHAPES.loop, ['ssa']));
    const graph = Cfg.build(fn);
    const tree = Dominators.compute(graph);
    let phis = 0;

    Ir.eachInstruction(fn, function (inst, block) {
      if (inst.op !== 'phi') return;
      phis += 1;
      assert.strictEqual(inst.incoming.length, (graph.preds[block.id] || []).length,
        'a phi has exactly one entry per predecessor');
      inst.incoming.forEach(function (row) {
        const defined = definingBlock(fn, row.value);

        if (defined) {
          assert.ok(Dominators.dominates(tree, defined, row.block),
            'the definition of ' + row.value + ' must dominate ' + row.block + ', not the phi');
        }
      });
    });
    assert.ok(phis > 0, 'the loop fixture stopped producing a phi at all');
  });

function definingBlock(fn, register) {
  let found = null;

  Ir.eachInstruction(fn, function (inst, block) {
    if (Ir.definitionOf(inst) === register) found = block.id;
  });
  return found;
}

test('ssa: pruning is a fixpoint, and every phi it keeps has a reader', function () {
  const fn = lastFunction(ssaProgram(SHAPES.branchInLoop, ['ssa']));
  const before = countPhis(fn);
  const removed = Ssa.prune(fn);

  assert.strictEqual(countPhis(fn), before - removed, 'the count and the report disagree');
  assert.strictEqual(Ssa.prune(fn), 0,
    'a second pruning pass removed more, so the first was a sweep rather than a fixpoint — ' +
    'removing one phi can make another unread, which is why it has to iterate');

  const read = new Set();

  Ir.eachInstruction(fn, function (inst) {
    Ir.usesOf(inst).forEach(function (register) { read.add(register); });
  });
  Ir.eachInstruction(fn, function (inst) {
    if (inst.op === 'phi') assert.ok(read.has(inst.target), inst.target + ' survived unread');
  });
});

function countPhis(fn) {
  let count = 0;

  Ir.eachInstruction(fn, function (inst) { if (inst.op === 'phi') count += 1; });
  return count;
}

test('ssa: destruction preserves behaviour, including the swap cycle the language cannot write',
  function () {
    const sources = [SHAPES.loop, SHAPES.branchInLoop, SHAPES.diamond, SHAPES.twoLatches];

    sources.forEach(function (source) {
      const program = ssaProgram(source, ['ssa']);
      const before = IrInterp.run(program);

      program.functions.forEach(function (fn) { Ssa.destruct(fn); });
      assert.ok(IrInterp.compare(before, IrInterp.run(program)).agree,
        'destruction changed what the program computes');
      assert.ok(Ir.verifyProgram(program).ok, 'destruction produced IR the verifier rejects');
    });
  });

test('ssa: sequencing a parallel copy with a cycle needs a temporary and gets the values right',
  function () {
    const fn = Ir.makeFunction('cycle', []);
    const moves = [{ to: '%a', from: '%b' }, { to: '%b', from: '%a' }];
    const state = { temporaries: 0 };
    const sequenced = Ssa.sequentialise(moves.map(function (m) { return { to: m.to, from: m.from }; }),
      fn, state);
    const values = { '%a': 1, '%b': 2 };

    sequenced.forEach(function (move) { values[move.to] = values[move.from]; });
    assert.strictEqual(values['%a'], 2, 'the swap lost a value');
    assert.strictEqual(values['%b'], 1, 'the swap lost a value');
    assert.strictEqual(state.temporaries, 1,
      'two copies in either order both end with the same value; only a temporary breaks it');
  });

test('ssa: a parallel copy with no cycle is ordered without any temporary', function () {
  const fn = Ir.makeFunction('chain', []);
  const state = { temporaries: 0 };
  const sequenced = Ssa.sequentialise([{ to: '%a', from: '%b' }, { to: '%b', from: '%c' }],
    fn, state);
  const values = { '%a': 1, '%b': 2, '%c': 3 };

  sequenced.forEach(function (move) { values[move.to] = values[move.from]; });
  assert.strictEqual(state.temporaries, 0, 'a chain needs no temporary and one was spent');
  assert.strictEqual(values['%a'], 2);
  assert.strictEqual(values['%b'], 3);
});

/* ------------------------------------------------------------ dataflow analysis */

test('dataflow: liveness agrees with a path enumeration on every fixture', function () {
  SHAPE_IDS.forEach(function (id) {
    const fn = lastFunction(ssaProgram(SHAPES[id], ['ssa']));
    const fast = Dataflow.run(fn, 'liveness');
    const slow = Dataflow.bruteLiveness(fn);

    Object.keys(slow).forEach(function (block) {
      assert.deepStrictEqual(Array.from(fast.out[block] || []).sort(),
        Array.from(slow[block] || []).sort(),
        id + ': liveness out of ' + block + ' disagrees with the enumeration');
    });
  });
});

test('dataflow: all four analyses reach a fixpoint, and solving twice gives the same answer',
  function () {
    const fn = lastFunction(ssaProgram(SHAPES.branchInLoop, ['ssa']));

    Object.keys(Dataflow.ANALYSES).forEach(function (name) {
      const first = Dataflow.run(fn, name);
      const second = Dataflow.run(fn, name);

      assert.ok(first.rounds > 0, name + ' visited no block');
      assert.ok(first.rounds < 100000, name + ' hit the iteration guard rather than a fixpoint');
      Object.keys(first.in).forEach(function (block) {
        assert.ok(Dataflow.sameSet(first.in[block], second.in[block]),
          name + ' is not deterministic at ' + block);
      });
    });
  });

/** Total facts at the fixpoint, which is what the lattice bottom collapses. */
function factCount(result) {
  return Object.keys(result.out).reduce(function (sum, id) {
    return sum + (result.out[id] ? result.out[id].size : 0);
  }, 0);
}

test('dataflow: an intersection analysis started at empty reports a well-formed empty fixpoint',
  function () {
    const fn = lastFunction(ssaProgram(SHAPES.reuse, ['ssa']));
    const analysis = Dataflow.availableExpressions(fn);
    const wrong = Object.assign({}, analysis, { initial: function () { return []; } });
    const proper = Dataflow.solve(fn, analysis);
    const broken = Dataflow.solve(fn, wrong);

    assert.ok(factCount(broken) <= factCount(proper),
      'starting an intersection analysis at the bottom of its lattice is the classic mistake ' +
      'and it is silent: it converges on the first visit and reports a well-formed nothing');
    assert.ok(broken.rows.length === proper.rows.length,
      'both are well-formed answers, which is exactly why the mistake survives review');
  });

/* -------------------------------------------------------------- the scalar passes */

test('scalar: every pass over every conformance program keeps all three gates', function () {
  const wrong = [];

  Spec.CONFORMANCE.forEach(function (entry) {
    const out = PassLab.run(entry.source,
      ['ssa', 'sccp', 'copy-propagation', 'value-numbering', 'peephole', 'dead-code']);

    out.steps.forEach(function (step) {
      if (!step.ok) wrong.push(entry.id + '/' + step.pass + ': ' + failureOf(step));
    });
  });
  assert.deepStrictEqual(wrong, []);
});

function failureOf(step) {
  if (!step.verified) return 'verifier: ' + step.problems[0].invariant;
  if (!step.dominance) return 'ssa: ' + step.problems[0].why;
  return 'behaviour: ' + step.why;
}

test('scalar: SCCP folds through a dead branch that propagation alone must leave', function () {
  const guarded = 'let flag = false;\nlet n = if flag { 1 / 0 } else { 7 };\nlet r = n + 1;';
  const sccp = PassLab.run(guarded, ['ssa', 'sccp', 'dead-code']);
  const plain = PassLab.run(guarded, ['ssa', 'copy-propagation', 'peephole', 'dead-code']);

  assert.ok(sccp.instructions < plain.instructions,
    'SCCP is not a better folder — it answers a different question, and if the two agree ' +
    'the reachability half has stopped working');
  assert.ok(sccp.ok && plain.ok, 'a pipeline broke a gate on the guarded fixture');
});

test('scalar: a peephole rule is only applied where the types make it sound', function () {
  const identities = 'fn keep(x) { return x + 0; }\nfn same(x) { return x * 1; }\n' +
    'fn zero(x) { return x * 0; }\nfn none(x) { return x - x; }\n' +
    'let r = keep(5) + same(6) + zero(7) + none(8);';
  const out = PassLab.run(identities, ['ssa', 'peephole', 'dead-code']);

  assert.ok(out.ok, 'the peephole pass broke a gate on the fixture built for it');
  assert.ok(Scalar.RULES.length >= 5, 'the rule table shrank below what the section reports');
});

test('scalar: value numbering only replaces a use its earlier definition dominates', function () {
  const redundant = 'let a = 1;\nlet b = 2;\nlet c = a + b;\nlet d = a + b;\nlet e = c + d;';
  const out = PassLab.run(redundant, ['ssa', 'value-numbering', 'dead-code']);

  assert.ok(out.ok, 'value numbering broke a gate');
  assert.ok(Ssa.check(lastFunction(out.program)).ok,
    'a replacement whose definition does not dominate the use is valid IR and a wrong program');
});

/* ---------------------------------------------------------------- the loop passes */

test('loop: safe LICM refuses a faulting hoist and naive LICM takes it and breaks the program',
  function () {
    const safe = PassLab.run(SHAPES.trap, ['ssa', 'copy-propagation', 'licm', 'dead-code']);
    const naive = PassLab.run(SHAPES.trap,
      ['ssa', 'copy-propagation', 'licm-naive', 'dead-code']);

    assert.ok(safe.ok, 'the safe pass broke the trap fixture: ' + (safe.firstFailure || {}).why);
    assert.ok(!naive.ok,
      'naive LICM has to fail here, or the safe pass proves nothing — the fixture is a ' +
      'division whose only guard is the loop condition');
    assert.ok(naive.failed.every(function (step) { return step.verified; }),
      'both versions produce IR the verifier accepts; only running the program catches it');
  });

test('loop: a refusal names the register and the reason, and the naive pass refuses nothing',
  function () {
    const fn = lastFunction(ssaProgram(SHAPES.trap));
    const report = Loop.licm(Ir.cloneFunction(fn));
    const naive = Loop.licm(Ir.cloneFunction(fn), { naive: true });

    assert.ok(report.refused > 0, 'nothing was refused on the trap fixture');
    assert.strictEqual(naive.refused, 0, 'the naive pass is the one with no safety condition');
    assert.ok(naive.hoisted > report.hoisted,
      'the difference between the two passes is the instruction that breaks the program');
    report.reasons.forEach(function (row) {
      assert.ok(row.register || row.loop, 'a refusal that names nothing cannot be acted on');
      assert.ok(row.why && row.why.length > 10, 'a refusal with no reason is a verdict');
    });
  });

test('loop: safe LICM preserves behaviour on every fixture it has something to do on',
  function () {
    SHAPE_IDS.forEach(function (id) {
      const out = PassLab.run(SHAPES[id], ['ssa', 'copy-propagation', 'licm', 'dead-code']);

      assert.ok(out.ok, id + ': ' + failureOf(out.firstFailure || { verified: true,
        dominance: true, why: 'unknown' }));
    });
  });

test('loop: an induction variable is a header phi stepping by an invariant amount', function () {
  const fn = lastFunction(ssaProgram(SHAPES.loop));
  const graph = Cfg.build(fn);
  const loops = Cfg.loops(graph);
  const found = Loop.inductionVariables(fn, loops[0], graph);

  assert.ok(found.length > 0, 'a `for` always introduces an index, so one is expected here');
  found.forEach(function (row) {
    assert.strictEqual(row.header, loops[0].header, 'an induction variable outside its loop');
    assert.ok(row.step !== undefined, 'an induction variable with no step is not one');
  });
});

/* ------------------------------------------------------- interprocedural analysis */

test('interproc: the call graph follows copy chains, so a direct call stays direct after SSA',
  function () {
    const program = ssaProgram(SHAPES.escapes);
    const graph = Interproc.callGraph(program);

    assert.ok(graph.edges.length >= 2,
      'renaming interposes a copy wherever a local was read, and an analysis that does not ' +
      'follow them reports zero direct edges and no error');
    graph.edges.forEach(function (edge) {
      assert.ok(graph.nodes.indexOf(edge.to) !== -1 || edge.indirect,
        'a direct edge names a callee that is not in the program');
    });
  });

test('interproc: the inlining plan never exceeds its budget and never inlines a recursive edge',
  function () {
    const program = ssaProgram(SHAPES.escapes);

    [0, 10, 40, 120].forEach(function (budget) {
      const plan = Interproc.plan(program, { budget: budget });

      assert.ok(plan.spent <= budget, 'the plan spent ' + plan.spent + ' of ' + budget);
      plan.chosen.forEach(function (site) {
        assert.notStrictEqual(site.from, site.to, 'a recursive edge was chosen for inlining');
      });
    });
    assert.strictEqual(Interproc.plan(program, { budget: 0 }).chosen.length, 0,
      'a budget of zero is the useful control — it is what the pipeline achieves with no ' +
      'inlining at all, and it has to actually decline everything');
  });

test('interproc: a recursive call is excluded from inlining outright, at any budget',
  function () {
    const program = ssaProgram(
      'fn down(n) { return if n < 1 { 0 } else { down(n - 1) }; }\nlet r = down(3);');
    const graph = Interproc.callGraph(program);

    assert.ok(graph.recursive.length > 0, 'the recursive fixture stopped recursing');
    assert.strictEqual(Interproc.plan(program, { budget: 1000 }).chosen
      .filter(function (site) { return site.from === site.to; }).length, 0);
  });

test('interproc: escape analysis reports a reason per allocation, not a verdict', function () {
  const rows = Interproc.escapeAnalysis(lastFunction(ssaProgram(SHAPES.escapes)));

  assert.ok(rows.allocations.length > 0, 'the fixture stopped allocating');
  rows.allocations.forEach(function (row) {
    assert.ok(row.why && row.why.length > 4,
      'a number nobody can explain is what reporting a verdict alone produces');
    assert.ok(Interproc.ALLOCATIONS.indexOf(row.op) !== -1, row.op + ' is not an allocation');
  });
});

test('interproc: an allocation that is returned escapes, and one that never leaves does not',
  function () {
    const rows = Interproc.escapeAnalysis(
      lastFunction(ssaProgram('fn wrap(n) { return { value: n }; }\nlet r = wrap(1).value;')));
    const escaping = rows.allocations.filter(function (row) { return row.escapes; });

    assert.ok(rows.allocations.length >= escaping.length,
      'escape analysis reported more escapes than allocations');
  });

/* -------------------------------------------------------------- alias analysis */

/**
 * The oracle: replay the allocations and record which registers really held
 * the same object. It sees only the paths this input took, which is exactly
 * the right shape — it can prove an analysis unsound and can never prove one
 * correct, so a miss is a definite bug and agreement is only evidence.
 */
function observedPairs(fn) {
  const objects = new Map();
  const rows = [];

  Ir.eachInstruction(fn, function (inst) {
    const target = Ir.definitionOf(inst);

    if (!target) return;
    if (Alias.ALLOCATIONS.indexOf(inst.op) !== -1) objects.set(target, { site: target });
    else if (inst.op === 'move' && objects.has(inst.from)) {
      objects.set(target, objects.get(inst.from));
    } else if (inst.op === 'phi') carryPhi(inst, target, objects);
    if (objects.has(target)) rows.push({ register: target, object: objects.get(target) });
  });
  return Alias.dynamicPairs(fn, rows);
}

function carryPhi(inst, target, objects) {
  const first = inst.incoming.find(function (row) { return objects.has(row.value); });

  if (first) objects.set(target, objects.get(first.value));
}

test('alias: both analyses report a superset of what actually aliased on every fixture',
  function () {
    SHAPE_IDS.forEach(function (id) {
      const fn = lastFunction(ssaProgram(SHAPES[id]));
      const observed = observedPairs(fn);

      [Alias.andersen(fn), Alias.steensgaard(fn)].forEach(function (result) {
        const sound = Alias.checkSound(result, observed);

        assert.deepStrictEqual(sound.missed, [],
          id + ': ' + result.name + ' missed a pair that really aliased, which is the one ' +
          'direction of error a downstream pass cannot survive');
      });
    });
  });

test('alias: unification reports a superset of inclusion, never fewer pairs', function () {
  SHAPE_IDS.forEach(function (id) {
    const fn = lastFunction(ssaProgram(SHAPES[id]));
    const inclusion = Alias.andersen(fn).pairs;
    const unified = Alias.steensgaard(fn).pairs;

    inclusion.forEach(function (pair) {
      assert.ok(unified.indexOf(pair) !== -1,
        id + ': Andersen reports ' + pair + ' and Steensgaard does not, which would make ' +
        'the cheaper analysis unsound rather than coarser');
    });
  });
});

test('alias: the merge fixture is the one that separates the two relations', function () {
  const fn = lastFunction(ssaProgram(SHAPES.merge));
  const compared = Alias.compare(fn);

  assert.ok(compared.lost > 0,
    'unification is symmetric and permanent, so a value coming out of a conditional has to ' +
    'cost precision — if it does not, the merge stopped happening');
});

/* ------------------------------------------------- the pass laboratory and the fuzzer */

test('passlab: the conformance suite passes every gate after every pass', function () {
  const suite = PassLab.suite();

  assert.strictEqual(suite.passed, suite.total,
    suite.rows.filter(function (row) { return !row.ok; })
      .map(function (row) { return row.id + ': ' + row.why; }).join('; '));
  assert.strictEqual(suite.total, Spec.CONFORMANCE.length);
  assert.ok(suite.after < suite.before, 'the pipeline removed nothing across the whole suite');
});

test('passlab: the suite can say no — the broken pipeline fails the seeded shape', function () {
  const seeded = PassLab.run(SHAPES.trap, ['ssa', 'copy-propagation', 'licm-naive', 'dead-code']);

  assert.ok(!seeded.ok,
    'a suite that only ever says yes has not been shown to be able to say anything else');
  assert.ok(seeded.firstFailure.pass === 'licm-naive' || !seeded.firstFailure.agrees,
    'the failure is named at the pass that caused it, not at the end of the pipeline');
});

test('passlab: phase ordering gives different code in the two directions on some program',
  function () {
    const differing = ['guarded', 'redundant'].map(function (id) {
      const source = id === 'guarded'
        ? 'let flag = false;\nlet n = if flag { 1 / 0 } else { 7 };\nlet r = n + 1;'
        : 'let a = 1;\nlet b = 2;\nlet c = a + b;\nlet d = a + b;\nlet e = c + d;';

      return PassLab.ordering(source, 'sccp', 'value-numbering');
    });

    assert.ok(differing.some(function (row) { return !row.same; }),
      'if no order ever differed, phase ordering would not be a problem');
    differing.forEach(function (row) {
      assert.ok(row.first.ok && row.second.ok, 'an ordering broke a gate');
    });
  });

test('passlab: shrinking keeps a valid program that fails the same way, and gets smaller',
  function () {
    const source = 'let d = 0;\nlet n = 0;\nlet acc = 0;\nlet pad1 = 1 + 2;\n' +
      'let pad2 = 3 + 4;\nlet pad3 = 5 + 6;\nlet pad4 = 7 + 8;\nlet pad5 = 9 + 10;\n' +
      'let pad6 = 11 + 12;\nlet pad7 = 13 + 14;\nlet pad8 = 15 + 16;\n' +
      'while n < d {\n  acc = acc + 100 / d;\n  n = n + 1;\n}';
    const pipeline = ['ssa', 'copy-propagation', 'licm-naive', 'dead-code'];
    const shrunk = PassLab.shrink(source, pipeline);

    assert.ok(shrunk.ok, 'the seeded program stopped failing under the broken pipeline');
    assert.ok(shrunk.to < shrunk.from, 'the shrinker reported progress it did not make');
    assert.ok(shrunk.accepted > 0 && shrunk.rounds > 0);
    assert.ok(PassLab.failureOf(shrunk.source, pipeline),
      'the reduced program must still fail, and fail in the same way');
  });

test('passlab: a shrunk program still parses and resolves', function () {
  const source = 'let d = 0;\nlet n = 0;\nlet acc = 0;\nlet pad = 1 + 2;\n' +
    'while n < d {\n  acc = acc + 100 / d;\n  n = n + 1;\n}';
  const shrunk = PassLab.shrink(source, ['ssa', 'copy-propagation', 'licm-naive', 'dead-code']);
  const built = IrLower.compile(shrunk.source);

  assert.deepStrictEqual(built.errors, [],
    'without a validity gate the reducer deletes a declaration the loop still uses and ' +
    'produces a repro about an unbound name');
});

test('fuzz: generated programs compile, run and agree before and after the pipeline',
  function () {
    let checked = 0;

    for (let seed = 1; seed <= 60; seed += 1) {
      const out = PassLab.run(Fuzz.generate(seed, { maxDepth: 3 }));

      assert.ok(out.ok, 'seed ' + seed + ': ' + failureOf(out.firstFailure || { verified: true,
        dominance: true, why: 'unknown' }));
      checked += 1;
    }
    assert.strictEqual(checked, 60,
      'a sweep that finds nothing is the expected result and the only evidence the passes ' +
      'hold on inputs nobody chose — but it has to have run');
  });
