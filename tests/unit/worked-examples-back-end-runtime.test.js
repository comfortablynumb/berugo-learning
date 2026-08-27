'use strict';

/**
 * Every figure the 30.8–30.10 content quotes, recomputed from the modules —
 * and then asserted to still appear in the prose.
 *
 * The measurement section is the awkward one to test, because wall-clock
 * numbers are not reproducible. So its figures here are the deterministic
 * ones — dispatch counts, cost per iteration, the agreement table — and the
 * protocol itself is checked as a property rather than as a timing.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const support = require('../support/worked-example-prose.js');

const CONTENT = path.join(__dirname, '..', '..', 'src', 'js', 'content');
['concepts-back-end-runtime', 'examples-back-end-runtime']
  .forEach(function (file) { require(path.join(CONTENT, file + '.js')); });

const BERUGO = path.join(__dirname, '..', '..', 'src', 'js', 'machines', 'berugo');
const MACHINES = path.join(__dirname, '..', '..', 'src', 'js', 'machines');
const SECTIONS = path.join(__dirname, '..', '..', 'src', 'js', 'sections');

const Spec = require(path.join(BERUGO, 'spec.js'));
const Ir = require(path.join(BERUGO, 'ir.js'));
const IrLower = require(path.join(BERUGO, 'ir-lower.js'));
const Bytecode = require(path.join(BERUGO, 'bytecode.js'));
const Shapes = require(path.join(BERUGO, 'shapes.js'));
const Runtime = require(path.join(BERUGO, 'runtime.js'));
const ExecLab = require(path.join(MACHINES, 'exec-lab.js'));

const ShapesTemplate = require(path.join(SECTIONS, 'inline-caches-template.js'));
const RuntimeTemplate = require(path.join(SECTIONS, 'runtime-support-template.js'));

function programOf(source) { return IrLower.compile(source).program; }

function compiledFor(source) {
  return Bytecode.compile(programOf(source), { mode: 'register' });
}

/* ------------------------------------------------------------ 30.8 shapes */

test('figures: one order costs 1.00 per access, two cost 1.50 and every order costs 5.99',
  function () {
    const study = Shapes.orderStudy({ names: ['x', 'y', 'z'], count: 1000 });
    const byId = {};

    study.forEach(function (row) { byId[row.id] = row; });
    assert.strictEqual(support.fixed(byId['one order'].perAccess, 2), '1.00');
    assert.strictEqual(support.fixed(byId['two orders'].perAccess, 2), '1.50');
    assert.strictEqual(support.fixed(byId['every order'].perAccess, 2), '5.99');
    assert.deepStrictEqual(study.map(function (row) { return row.shapes; }), [4, 7, 16]);
    assert.deepStrictEqual(study.map(function (row) { return row.state; }),
      ['monomorphic', 'polymorphic', 'megamorphic']);
    assert.strictEqual(byId['one order'].hits, 999);
    assert.strictEqual(byId['one order'].misses, 1);
    assert.strictEqual(byId['every order'].hits, 0);
    assert.strictEqual(byId['every order'].misses, 1000);

    support.quotes('inline-caches',
      ['1.00 per access, with 999 hits and 1 miss',
        '1.50 per access — the site is polymorphic now',
        '5.99 per access, with 0 hits and 1 000 misses',
        '4 shapes, then 7, then 16 — from 3 field names']);
  });

test('figures: the cliff is between four shapes and five', function () {
  const sweep = Shapes.stateSweep([1, 2, 3, 4, 5, 8], { accesses: 1000 });
  const byShapes = {};

  sweep.forEach(function (row) { byShapes[row.shapes] = row; });
  assert.deepStrictEqual([1, 2, 3, 4].map(function (n) {
    return support.fixed(byShapes[n].perAccess, 2);
  }), ['1.00', '1.50', '2.00', '2.50']);
  assert.strictEqual(support.fixed(byShapes[5].perAccess, 2), '7.98');
  assert.strictEqual(support.fixed(byShapes[8].perAccess, 2), '10.98');
  assert.strictEqual(byShapes[4].hits, 996);
  assert.strictEqual(byShapes[5].hits, 0);
  assert.strictEqual(Shapes.POLYMORPHIC_LIMIT, 4);

  support.quotes('inline-caches',
    ['1.00, 1.50, 2.00, 2.50 — half a unit per extra shape',
      '7.98 — more than three times the cost of four',
      '996 hits at four shapes and 0 at five',
      '10.98, growing with the field count rather than the shape count']);
});

test('figures: a real program with two orders builds five shapes over three records',
  function () {
    const out = Shapes.fromProgram(programOf(ShapesTemplate.SAMPLES.twoOrders), Ir);

    assert.strictEqual(out.sites.length, 3);
    assert.strictEqual(out.shapes, 5);
    assert.strictEqual(out.transitions, 4);
    assert.strictEqual(new Set(out.sites.map(function (row) { return row.shape; })).size, 2,
      'three records over two distinct shapes');

    support.quotes('inline-caches',
      ['3 records over 5 shapes, two of them carrying the same 2 fields']);
  });

/* ---------------------------------------------------- 30.9 runtime metadata */

test('figures: the fault fixture has five safepoints of thirty-one instructions', function () {
  const source = RuntimeTemplate.SAMPLES.fault;
  const compiled = compiledFor(source);
  const summary = Runtime.summary(compiled, source);
  const trace = Runtime.traceAtFault(compiled, source, { budget: 200000 });

  assert.strictEqual(summary.safepoints, 5);
  assert.strictEqual(summary.instructions, 31);
  assert.strictEqual(summary.mapped, 8);
  assert.strictEqual(summary.withSpans, 27);
  assert.strictEqual(summary.lines, 3);
  assert.strictEqual(trace.rows.length, 3);
  assert.strictEqual(trace.rows[0].fn, 'pick');
  assert.strictEqual(trace.rows[0].origin, 'returnStmt');
  assert.strictEqual(trace.rows[0].line, 1);

  support.quotes('runtime-support',
    ['5 of its 31 instructions', '8 live registers across those 5 safepoints',
      '27 of 31, over 3 lines of source', '3 frames, each naming a construct and a line',
      'pick, a returnStmt on line 1, holding xs and at']);
});

test('figures: the suite has twenty-six safepoints and the map misses none of forty-four reads',
  function () {
    const totals = Spec.CONFORMANCE.reduce(function (into, entry) {
      const out = Runtime.checkSafepoints(compiledFor(entry.source), { budget: 200000 });

      return { safepoints: into.safepoints + out.safepoints,
        observed: into.observed + out.observed,
        missed: into.missed + out.missed.length,
        slack: into.slack + out.slack };
    }, { safepoints: 0, observed: 0, missed: 0, slack: 0 });

    assert.strictEqual(totals.safepoints, 26);
    assert.strictEqual(totals.observed, 44);
    assert.strictEqual(totals.missed, 0);
    assert.strictEqual(totals.slack, 0);

    support.quotes('runtime-support',
      ['44 register reads across 26 safepoints',
        '0 here — the map is exactly the dynamic live set on this suite']);
  });

test('figures: the source map covers sixteen instructions of the faulting function',
  function () {
    const source = RuntimeTemplate.SAMPLES.fault;
    const chunk = compiledFor(source).chunks.main;
    const rows = Runtime.sourceMap(chunk, source);

    assert.strictEqual(rows.length, 16);
    assert.ok(rows.filter(function (row) { return row.line > 0; }).length >= 15);
    assert.strictEqual(Runtime.CONVENTION.length, 5);

    support.quotes('runtime-support',
      ['16 instructions, each with its line and the source text at that span',
        'the 5 stack maps, which are the same walk asked about liveness']);
  });

/* ------------------------------------------------------ 30.10 measurement */

test('figures: the dispatch table reports 4 810 against 9 614 on the loop benchmark',
  function () {
    const table = ExecLab.dispatchTable({ budget: 4000000 });
    const byId = {};

    table.forEach(function (row) { byId[row.id] = row; });
    assert.strictEqual(byId.loop.rows[0].dispatches, 9614);
    assert.strictEqual(byId.loop.rows[1].dispatches, 4810);
    assert.strictEqual(support.fixed(byId.loop.ratio, 2), '2.00');
    assert.strictEqual(support.fixed(byId.calls.ratio, 2), '1.88');
    assert.strictEqual(support.fixed(byId.branchy.ratio, 2), '1.76');
    assert.strictEqual(support.fixed(byId.nested.ratio, 2), '1.98');

    support.quotes('measuring-a-runtime',
      ['4 810 dispatches for the register VM against 9 614 for the stack VM']);
  });

test('figures: the cost per iteration is flat from 25 to 400 iterations', function () {
  const rows = ExecLab.scaling([25, 50, 100, 200, 400], { budget: 8000000 });
  const bySize = {};

  rows.forEach(function (row) { bySize[row.size] = row; });
  assert.strictEqual(bySize[25].dispatches, 410);
  assert.strictEqual(bySize[400].dispatches, 6410);
  assert.strictEqual(support.fixed(bySize[25].perItem, 2), '16.40');
  assert.strictEqual(support.fixed(bySize[400].perItem, 2), '16.02');

  support.quotes('measuring-a-runtime',
    ['410 dispatches against 6 410', '16.40 against 16.02 — flat, so the loop really is the work']);
});

test('figures: fifty-nine comparisons across four back ends, with nine outside the subset',
  function () {
    const suite = ExecLab.suite({ budget: 400000 });

    assert.strictEqual(suite.programs, 17);
    assert.strictEqual(suite.checks, 59);
    assert.strictEqual(suite.disagreements, 0);
    assert.strictEqual(suite.unsupported, 9);

    support.quotes('measuring-a-runtime',
      ['59 comparisons, 0 disagreements, 9 programs outside the wasm subset']);
  });

test('figures: the protocol discards its warm-up and reports the spread', function () {
  const out = ExecLab.bench(ExecLab.BENCHMARKS[0].source, 'register',
    { warmup: 3, runs: 7, budget: 4000000 });

  assert.strictEqual(out.warmup, 3);
  assert.strictEqual(out.runs, 7);
  assert.ok(out.worst >= out.median && out.median >= out.best,
    'the median sits inside the range');
  assert.strictEqual(support.fixed(out.worst - out.best, 6),
    support.fixed(out.spread, 6), 'the spread is worst minus best');
  assert.ok(out.checksum > 0, 'and the result is consumed');

  const naive = ExecLab.naiveBench(ExecLab.BENCHMARKS[0].source, 'register',
    { budget: 4000000 });

  assert.strictEqual(naive.runs, 1);
  assert.strictEqual(naive.warmup, 0);
  assert.strictEqual(naive.spread, null,
    'a single run has no spread to report, which is the whole objection to it');
});

test('figures: the list of ways a benchmark lies is six long and every entry is silent',
  function () {
    support.quotes('measuring-a-runtime', ['6, every one of them silent']);
  });
