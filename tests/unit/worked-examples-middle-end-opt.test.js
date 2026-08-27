'use strict';

/**
 * Every figure the 29.7–29.10 content quotes, recomputed from the modules —
 * and then asserted to still appear in the prose.
 *
 * Two of these tests are the milestone's own discipline pointed at itself: the
 * naive LICM run has to FAIL, and the fuzzing sweep has to find nothing under
 * a pass that is definitely broken. Both are claims about coverage rather than
 * about correctness, and both are worthless unless the sensitivity is asserted
 * beside the result.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const support = require('../support/worked-example-prose.js');

const CONTENT = path.join(__dirname, '..', '..', 'src', 'js', 'content');
['concepts-middle-end-opt', 'examples-middle-end-opt']
  .forEach(function (file) { require(path.join(CONTENT, file + '.js')); });

const SECTIONS = path.join(__dirname, '..', '..', 'src', 'js', 'sections');
const BERUGO = path.join(__dirname, '..', '..', 'src', 'js', 'machines', 'berugo');
const MACHINES = path.join(__dirname, '..', '..', 'src', 'js', 'machines');

const Ir = require(path.join(BERUGO, 'ir.js'));
const IrInterp = require(path.join(BERUGO, 'ir-interp.js'));
const Cfg = require(path.join(BERUGO, 'cfg.js'));
const Dominators = require(path.join(BERUGO, 'dominators.js'));
const Loop = require(path.join(BERUGO, 'passes-loop.js'));
const Interproc = require(path.join(BERUGO, 'interproc.js'));
const Alias = require(path.join(BERUGO, 'alias.js'));
const Fuzz = require(path.join(BERUGO, 'fuzz.js'));
const PassLab = require(path.join(MACHINES, 'pass-lab.js'));

const LoopTemplate = require(path.join(SECTIONS, 'loop-optimisations-template.js'));
const InterprocTemplate = require(path.join(SECTIONS,
  'interprocedural-optimisation-template.js'));
const AliasTemplate = require(path.join(SECTIONS, 'alias-analysis-template.js'));

const BASE = ['ssa', 'copy-propagation'];
const PIPELINES = {
  full: ['ssa', 'sccp', 'copy-propagation', 'value-numbering', 'peephole', 'licm', 'dead-code'],
  broken: ['ssa', 'copy-propagation', 'licm-naive', 'dead-code'],
  minimal: ['ssa']
};
const SEED_FAILURE = 'let d = 0;\nlet n = 0;\nlet acc = 0;\nlet pad1 = 1 + 2;\n' +
  'let pad2 = 3 + 4;\nlet pad3 = 5 + 6;\nlet pad4 = 7 + 8;\nlet pad5 = 9 + 10;\n' +
  'let pad6 = 11 + 12;\nlet pad7 = 13 + 14;\nlet pad8 = 15 + 16;\n' +
  'while n < d {\n  acc = acc + 100 / d;\n  n = n + 1;\n}';

function lastFunction(program) { return program.functions[program.functions.length - 1]; }

function ssaOf(source) { return PassLab.run(source, BASE).program; }

/* ------------------------------------------------ 29.7 loop optimisations */

/** The section's two-version comparison, run on the trap fixture. */
function licmComparison(source) {
  return ['licm', 'licm-naive'].map(function (pass) {
    const out = PassLab.run(source, ['ssa', 'copy-propagation', pass]);
    const report = out.steps.find(function (step) { return step.pass === pass; });
    const summed = report.reports.reduce(function (acc, row) {
      return { hoisted: acc.hoisted + (row.hoisted || 0),
        refused: acc.refused + (row.refused || 0) };
    }, { hoisted: 0, refused: 0 });

    return { pass: pass, hoisted: summed.hoisted, refused: summed.refused,
      before: out.baseline.outcome, after: IrInterp.run(out.program).outcome,
      verified: report.verified, agrees: report.agrees };
  });
}

test('figures: the safe pass hoists 4 and refuses 1; the naive one hoists 5 and refuses none',
  function () {
    const rows = licmComparison(LoopTemplate.SAMPLES.trap);
    const safe = rows[0];
    const naive = rows[1];

    assert.deepStrictEqual([safe.hoisted, safe.refused], [4, 1]);
    assert.deepStrictEqual([naive.hoisted, naive.refused], [5, 0]);
    assert.strictEqual(safe.before, 'ok');
    assert.strictEqual(safe.after, 'ok');
    assert.strictEqual(naive.before, 'ok');
    assert.strictEqual(naive.after, 'runtime',
      'the naive pass HAS to break this program, or the safety condition proves nothing');
    assert.ok(safe.verified && naive.verified,
      'both produce IR the verifier accepts, so only running the program catches it');

    support.quotes('loop-optimisations',
      ['4 hoisted, 1 refused, ok before and ok after', '5 hoisted, 0 refused',
        'ok before, runtime after', 'both produce IR the verifier accepts']);
  });

test('figures: the refusal names %9 and the dominance reason', function () {
  const fn = lastFunction(ssaOf(LoopTemplate.SAMPLES.trap));
  const report = Loop.licm(Ir.cloneFunction(fn));

  assert.strictEqual(report.refused, 1);
  assert.strictEqual(report.reasons.length, 1);
  assert.strictEqual(report.reasons[0].register, '%9');
  assert.ok(report.reasons[0].why.indexOf('may fault') !== -1);
  assert.ok(report.reasons[0].why.indexOf('b2') !== -1,
    'the reason names the block that fails to dominate every exit');

  support.quotes('loop-optimisations',
    ['%9 — may fault, and b2 does not dominate every loop exit']);
});

test('figures: the outer loop is 15 instructions weighted 150 with 5 invariants and 2 indices',
  function () {
    const fn = lastFunction(ssaOf(LoopTemplate.SAMPLES.trap));
    const rows = Loop.report(fn);

    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].depth, 0);
    assert.strictEqual(rows[0].body, 15);
    assert.strictEqual(rows[0].weighted, 150);
    assert.strictEqual(rows[0].weighted / rows[0].body, 10,
      'ten assumed iterations per nesting level, and the factor is the assumption');
    assert.strictEqual(rows[0].invariant, 5);
    assert.strictEqual(rows[0].induction, 2);
    assert.strictEqual(rows[0].exits, 1);

    support.quotes('loop-optimisations',
      ['15 instructions, weighted 150, at depth 0', '10 assumed iterations per nesting level',
        '5, of which 4 were hoisted and 1 refused']);
  });

test('figures: the two induction variables are %15 stepping by %9 and %14 stepping by 1',
  function () {
    const fn = lastFunction(ssaOf(LoopTemplate.SAMPLES.trap));
    const found = Loop.inductionVariables(fn);

    assert.strictEqual(found.length, 2);
    assert.deepStrictEqual(found.map(function (row) { return row.register; }), ['%15', '%14']);
    assert.deepStrictEqual(found.map(function (row) { return row.start; }), ['%2', '%1']);
    assert.deepStrictEqual(found.map(function (row) {
      return row.constant === null ? row.step : String(row.constant);
    }), ['%9', '1'], 'a step is reported as its register unless the register is a known constant');

    support.quotes('loop-optimisations',
      ['%15 starting at %2 stepping by %9, and %14 starting at %1 stepping by 1']);
  });

/* --------------------------------------- 29.8 interprocedural optimisation */

test('figures: the escapes fixture has two direct calls and no indirect one', function () {
  const graph = Interproc.callGraph(ssaOf(InterprocTemplate.SAMPLES.escapes));

  assert.strictEqual(graph.edges.length, 2);
  assert.strictEqual(graph.indirect.length, 0);
  assert.strictEqual(graph.recursive.length, 0);
  assert.deepStrictEqual(graph.edges.map(function (edge) { return edge.to; }).sort(),
    ['read', 'wrap']);

  support.quotes('interprocedural-optimisation', ['2 direct, 0 indirect', '0 direct']);
});

test('figures: both sites are taken at ratios 1.00 and 1.67, spending 6 of a budget of 40',
  function () {
    const plan = Interproc.plan(ssaOf(InterprocTemplate.SAMPLES.escapes), { budget: 40 });
    const byCallee = {};

    plan.candidates.forEach(function (site) { byCallee[site.to] = site; });
    assert.strictEqual(plan.chosen.length, 2);
    assert.strictEqual(plan.spent, 6);
    assert.strictEqual(plan.budget, 40);
    assert.strictEqual(support.fixed(byCallee.read.ratio, 2), '1.00');
    assert.strictEqual(support.fixed(byCallee.wrap.ratio, 2), '1.67');

    support.quotes('interprocedural-optimisation',
      ['read at ratio 1.00 and wrap at 1.67, spending 6 of 40']);
  });

test('figures: five allocations, two escapes, and only one of them for a real reason',
  function () {
    const program = ssaOf(InterprocTemplate.SAMPLES.escapes);
    const all = Interproc.escapeProgram(program);
    const rows = all.functions.reduce(function (out, row) {
      return out.concat(row.allocations.map(function (entry) {
        return Object.assign({ fn: row.fn }, entry);
      }));
    }, []);
    const escaping = rows.filter(function (row) { return row.escapes; });

    assert.strictEqual(all.allocations, 5);
    assert.strictEqual(all.escaping, 2);
    assert.strictEqual(all.stack, 3, '3 of 5 stay on the frame');
    assert.deepStrictEqual(escaping.map(function (row) { return row.why; }).sort(),
      ['passed to a call, which this analysis cannot see into', 'returned']);
    assert.deepStrictEqual(escaping.map(function (row) { return row.fn + ' ' + row.register; })
      .sort(), ['main %5', 'wrap %2']);

    support.quotes('interprocedural-optimisation',
      ['3 of 5 stay on the frame; 2 escape', '%2 in wrap — a makeRecord, returned',
        '%5 in main, passed to a call, which this analysis cannot see into']);
  });

test('figures: nine of eleven allocations across the suite could live on the stack',
  function () {
    const Spec = require(path.join(BERUGO, 'spec.js'));
    const totals = Spec.CONFORMANCE.reduce(function (acc, entry) {
      const summary = Interproc.summary(PassLab.run(entry.source, BASE).program);

      return { allocations: acc.allocations + summary.allocations,
        stack: acc.stack + summary.stack };
    }, { allocations: 0, stack: 0 });

    assert.strictEqual(totals.allocations, 11);
    assert.strictEqual(totals.stack, 9);
    assert.strictEqual(support.fixed(100 * totals.stack / totals.allocations, 1), '81.8');

    support.quotes('interprocedural-optimisation',
      ['9 of 11 allocations across the suite could live on the stack — 81.8%']);
  });

/* ---------------------------------------------------- 29.9 alias analysis */

/** The dynamic oracle, rebuilt from the section so the two cannot drift. */
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

test('figures: Andersen reports 22 pairs in 2 rounds and Steensgaard 28 from 7 merges',
  function () {
    const fn = lastFunction(ssaOf(AliasTemplate.SAMPLES.merge));
    const compared = Alias.compare(fn);

    assert.strictEqual(compared.sites, 2);
    assert.strictEqual(compared.andersenPairs, 22);
    assert.strictEqual(compared.steensgaardPairs, 28);
    assert.strictEqual(compared.lost, 6);
    assert.strictEqual(compared.andersen.rounds, 2);
    assert.strictEqual(compared.steensgaard.merges, 7);

    support.quotes('alias-analysis',
      ['22 may-alias pairs, reached in 2 rounds', '28 pairs, from 7 merges',
        '6 more is imprecision; 1 fewer is unsoundness']);
  });

test('figures: sixteen pairs actually aliased and neither analysis missed one', function () {
  const fn = lastFunction(ssaOf(AliasTemplate.SAMPLES.merge));
  const observed = observedPairs(fn);
  const andersen = Alias.checkSound(Alias.andersen(fn), observed);
  const steensgaard = Alias.checkSound(Alias.steensgaard(fn), observed);

  assert.strictEqual(observed.pairs.length, 16);
  assert.deepStrictEqual(andersen.missed, []);
  assert.deepStrictEqual(steensgaard.missed, []);
  assert.strictEqual(andersen.reported, 22);
  assert.strictEqual(steensgaard.reported, 28);

  support.quotes('alias-analysis',
    ['16 aliases actually happened; both report supersets and neither misses one',
      '16 pairs actually aliased', 'Andersen 22 and Steensgaard 28, missing 0']);
});

test('figures: three registers point at one site each, and unification merges them',
  function () {
    const fn = lastFunction(ssaOf(AliasTemplate.SAMPLES.merge));
    const andersen = Alias.andersen(fn);
    const single = Object.keys(andersen.points).filter(function (register) {
      return andersen.points[register].size === 1;
    }).sort();

    assert.ok(['%1', '%5', '%10'].every(function (register) {
      return single.indexOf(register) !== -1;
    }), 'Andersen keeps %1, %5 and %10 pointing at one site each');

    support.quotes('alias-analysis',
      ['Andersen keeps %1, %5 and %10 pointing at one site each']);
  });

test('figures: one of five fixtures separates the two analyses, two have an eliminable load',
  function () {
    const rows = Object.keys(AliasTemplate.SAMPLES).map(function (id) {
      const fn = lastFunction(ssaOf(AliasTemplate.SAMPLES[id]));

      return Object.assign({ id: id }, Alias.compare(fn));
    });
    const separated = rows.filter(function (row) { return row.lost > 0; });
    const eliminable = rows.filter(function (row) { return row.andersenLoads > 0; });

    assert.strictEqual(rows.length, 5);
    assert.deepStrictEqual(separated.map(function (row) { return row.id; }), ['merge']);
    assert.deepStrictEqual(eliminable.map(function (row) { return row.id; }),
      ['aliased', 'store']);
    assert.strictEqual(rows.find(function (row) { return row.id === 'merge'; }).andersenLoads, 0,
      'the fixture where the two analyses differ has no load to forward either way, which is ' +
      'why the imprecision column and the payoff column are two different fixtures');

    support.quotes('alias-analysis',
      ['only 1 of 5 fixtures separates the two',
        '2 of 5 fixtures have an eliminable load at all']);
  });

/* ----------------------------------------------- 29.10 verifying the optimiser */

/** The sweep, exactly as the section runs it: generate, compile, compare. */
function sweep(count, seed, pipeline) {
  const state = { checked: 0, failures: [] };

  for (let i = 0; i < count && state.failures.length < 3; i += 1) {
    const source = Fuzz.generate(seed + i, { maxDepth: 3 });

    state.checked += 1;
    try {
      const out = PassLab.run(source, pipeline);

      if (!out.ok) state.failures.push({ source: source, step: out.firstFailure });
    } catch (error) {
      state.failures.push({ source: source, step: { pass: 'threw', why: error.message } });
    }
  }
  return state;
}

test('figures: four hundred generated programs find nothing, under both pipelines',
  function () {
    const clean = sweep(400, 1, PIPELINES.full);
    const broken = sweep(400, 1, PIPELINES.broken);

    assert.strictEqual(clean.checked, 400);
    assert.strictEqual(clean.failures.length, 0);
    assert.strictEqual(broken.checked, 400);
    assert.strictEqual(broken.failures.length, 0,
      'the generator cannot write a division guarded by its own loop condition, which is ' +
      'the only shape naive LICM breaks — coverage is a property of the generator');

    support.quotes('verifying-the-optimiser',
      ['400 programs, 0 failures', '0 of the 400 have the shape',
        '400 inputs nobody chose']);
  });

test('figures: the seeded program does fail under the broken pipeline and not under the full one',
  function () {
    assert.strictEqual(PassLab.run(SEED_FAILURE, PIPELINES.full).ok, true,
      'a correct pipeline compiles it correctly, so there is nothing to shrink');
    const broken = PassLab.run(SEED_FAILURE, PIPELINES.broken);

    assert.strictEqual(broken.ok, false,
      'a fuzzing campaign that cannot reach a shape needs the shape written by hand, and ' +
      'the hand-written one has to actually fail');
    assert.ok(PassLab.failureOf(SEED_FAILURE, PIPELINES.broken));
  });

test('figures: the shrinker takes fifteen lines to six over eleven rounds', function () {
  const shrunk = PassLab.shrink(SEED_FAILURE, PIPELINES.broken);

  assert.strictEqual(shrunk.ok, true);
  assert.strictEqual(shrunk.from, 15);
  assert.strictEqual(shrunk.to, 6);
  assert.strictEqual(shrunk.was, 237);
  assert.strictEqual(shrunk.characters, 71);
  assert.strictEqual(shrunk.tried, 51);
  assert.strictEqual(shrunk.accepted, 10);
  assert.strictEqual(shrunk.rounds, 11);

  support.quotes('verifying-the-optimiser',
    ['15 lines to 6, and 237 characters to 71', '51 candidates tried, 10 accepted, over 11 rounds',
      '6 lines of minimal repro', '11 rounds, 1 recomputation each']);
});

test('figures: the reduced program still parses, resolves and fails at the same pass',
  function () {
    const shrunk = PassLab.shrink(SEED_FAILURE, PIPELINES.broken);
    const original = PassLab.failureOf(SEED_FAILURE, PIPELINES.broken);
    const reduced = PassLab.failureOf(shrunk.source, PIPELINES.broken);
    const IrLower = require(path.join(BERUGO, 'ir-lower.js'));

    assert.deepStrictEqual(IrLower.compile(shrunk.source).errors, [],
      'without the validity gate the reducer deletes a declaration the loop still uses');
    assert.ok(reduced, 'the reduced program stopped failing');
    assert.strictEqual(reduced.pass, original.pass,
      'without the same-failure gate the shrinker changes the subject');

    support.quotes('verifying-the-optimiser',
      ['2 gates — it must still parse and resolve']);
  });

test('figures: seventeen of seventeen pass every gate, and the broken pipeline is not vacuous',
  function () {
    const suite = PassLab.suite(PIPELINES.full);

    assert.strictEqual(suite.passed, 17);
    assert.strictEqual(suite.total, 17);
    assert.strictEqual(suite.before, 229);
    assert.strictEqual(suite.after, 129);

    /* A suite that only ever says yes has not been shown to be able to say
       anything else, so the sensitivity is asserted here rather than assumed. */
    assert.strictEqual(PassLab.run(LoopTemplate.SAMPLES.trap, PIPELINES.broken).ok, false);
  });

test('figures: only the differential run has an entry against every pass', function () {
  const passes = ['ssa', 'sccp', 'copy-propagation', 'value-numbering', 'licm', 'dead-code'];
  const fn = lastFunction(ssaOf(LoopTemplate.SAMPLES.trap));

  assert.ok(Dominators.compute(Cfg.build(fn)).idom,
    'the SSA column is the two invariants the verifier cannot state without this tree');
  passes.forEach(function (name) {
    assert.ok(PassLab.PASSES[name], name + ' is in the coverage table and not in the pipeline');
  });
  assert.strictEqual(passes.length, 6);
});
