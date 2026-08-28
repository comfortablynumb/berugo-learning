'use strict';

/**
 * Every figure the 31.7-31.9 content quotes, recomputed from the modules —
 * and then asserted to still appear in the prose.
 *
 * Two of these are the milestone's most quotable results and both are about
 * something other than the collector: a process that dies of file descriptors
 * with 6.6 per cent of its heap in use, and three programs that compute 820
 * at 84, 3 and 1 allocations. The third is the verdict the leak lab is graded
 * on, which is a slope over a window rather than a comparison of two points.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const support = require('../support/worked-example-prose.js');

const CONTENT = path.join(__dirname, '..', '..', 'src', 'js', 'content');
['concepts-memory-practice', 'examples-memory-practice']
  .forEach(function (file) { require(path.join(CONTENT, file + '.js')); });

const ALG = path.join(__dirname, '..', '..', 'src', 'js', 'algorithms');
const MACHINES = path.join(__dirname, '..', '..', 'src', 'js', 'machines');
const SECTIONS = path.join(__dirname, '..', '..', 'src', 'js', 'sections');
const BERUGO = path.join(MACHINES, 'berugo');

const HeapSim = require(path.join(MACHINES, 'heap-sim.js'));
const GcLab = require(path.join(MACHINES, 'gc-lab.js'));
const GcWeak = require(path.join(ALG, 'gc-weak.js'));
const HeapAnalysis = require(path.join(ALG, 'heap-analysis.js'));
const IrLower = require(path.join(BERUGO, 'ir-lower.js'));
const IrInterp = require(path.join(BERUGO, 'ir-interp.js'));
const Interproc = require(path.join(BERUGO, 'interproc.js'));
const AvoidTemplate = require(path.join(SECTIONS, 'avoiding-the-collector-template.js'));

function makeHeap() { return HeapSim.makeHeap({}); }

/** The leak trace 31.9 replays, at its default control setting. */
function leakTrace(leak) {
  return HeapSim.synthetic({ count: 2400, seed: 5, survival: 0.12, retained: 48,
    leak: leak / 100 });
}

function snapshots(leak) {
  const trace = leakTrace(leak);

  return [0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map(function (fraction) {
    return HeapSim.snapshot(trace, Math.floor(trace.events.length * fraction),
      { capacity: 65536 });
  });
}

function answerOf(run) {
  const row = (run.bindings || []).filter(function (text) {
    return text.indexOf('r = ') === 0;
  })[0];

  return row ? row.slice(4) : '';
}

/* ------------------------------------------------------------- 31.7 */

test('figures: the handle loop dies at iteration 17 with 0.27 KB of a 4 KB heap in use',
  function () {
    const leaking = GcWeak.handleScenario({ close: false, limit: 16, iterations: 64,
      objectBytes: 16, heapLimit: 4096 });
    const closed = GcWeak.handleScenario({ close: true, limit: 16, iterations: 64,
      objectBytes: 16, heapLimit: 4096 });

    assert.strictEqual(leaking.failedAt, 17);
    assert.strictEqual(leaking.collections, 0);
    assert.strictEqual(support.fixed(leaking.bytes / 1024, 2), '0.27');
    assert.strictEqual(support.fixed((leaking.bytes / 4096) * 100, 1), '6.6');
    assert.strictEqual(closed.exhausted, false);
    assert.strictEqual(closed.opened, 64);
    assert.strictEqual(closed.peakHandles, 1);
    support.quotes('weak-references',
      ['iteration 17', '0.27 KB', '6.6 per cent', '64 iterations', 'peak open of 1']);
  });

test('figures: the strong cache holds 600 bytes and the weak one 312', function () {
  const rows = GcWeak.STRENGTHS.map(function (strength) {
    return { id: strength.id,
      easy: GcWeak.cacheScenario(makeHeap, strength.id, { entries: 12, keep: 0.5 }),
      tight: GcWeak.cacheScenario(makeHeap, strength.id,
        { entries: 12, keep: 0.5, pressure: true }) };
  });
  const byId = {};

  rows.forEach(function (row) { byId[row.id] = row; });
  assert.strictEqual(byId.strong.easy.cleared, 0);
  assert.strictEqual(byId.strong.easy.reclaimed, 0);
  assert.strictEqual(byId.strong.easy.bytes, 600);
  assert.strictEqual(byId.soft.easy.cleared, 0, 'a policy that has not fired');
  assert.strictEqual(byId.soft.tight.cleared, 6, 'and the same references once it has');
  assert.strictEqual(byId.weak.easy.cleared, 6);
  assert.strictEqual(byId.weak.easy.reclaimed, 12);
  assert.strictEqual(byId.weak.easy.bytes, 312);
  assert.strictEqual(byId.strong.easy.before, 25);
  assert.strictEqual(byId.weak.easy.live, 13);
  support.quotes('weak-references',
    ['600 bytes', '312', '6 cleared', '12 reclaimed', '25 objects down to 13']);
});

test('figures: a finalisable object is queued in cycle one and freed in cycle two', function () {
  const clean = GcWeak.resurrectionScenario(makeHeap, { resurrect: false });
  const raised = GcWeak.resurrectionScenario(makeHeap, { resurrect: true });

  assert.deepStrictEqual(clean.rows.map(function (row) { return row.finalised; }), [0, 1, 0]);
  assert.deepStrictEqual(clean.rows.map(function (row) { return row.reclaimed; }), [0, 2, 0]);
  assert.strictEqual(clean.rows[0].queued, 1);
  assert.strictEqual(raised.live, 3);
  assert.strictEqual(raised.finalised, 1);
  assert.strictEqual(raised.twice, 0);
  support.quotes('weak-references',
    ['Cycle 1', 'cycle 2', 'frees 2 objects', '3 objects remain']);
});

/* ------------------------------------------------------------- 31.8 */

test('figures: three programmes compute 820 at 84, 3 and 1 allocations', function () {
  const sources = AvoidTemplate.sources(40);
  const rows = ['heavy', 'pooled', 'light'].map(function (kind) {
    const trace = HeapSim.record(sources[kind], {});
    const lowered = IrLower.compile(sources[kind]);
    const gc = GcLab.replay(trace, { mode: 'generational', capacity: 1024, nursery: 320,
      candidates: 8 });

    return { kind: kind, trace: trace, gc: gc,
      answer: answerOf(IrInterp.run(lowered.program, {})),
      escape: Interproc.escapeProgram(lowered.program) };
  });

  assert.deepStrictEqual(rows.map(function (row) { return row.answer; }), ['820', '820', '820']);
  assert.deepStrictEqual(rows.map(function (row) { return row.trace.allocations; }), [84, 3, 1]);
  assert.deepStrictEqual(rows.map(function (row) { return row.trace.bytes; }), [2288, 360, 328]);
  assert.deepStrictEqual(rows.map(function (row) { return row.gc.collections; }), [10, 2, 1]);
  assert.deepStrictEqual(rows.map(function (row) { return row.gc.gcWork; }), [70, 6, 0]);
  support.quotes('avoiding-the-collector',
    ['820', '84', '2 288', '360', '328', '10 collections', '70 units', '6 units']);
});

test('figures: only the heavy programme has a slope', function () {
  const counts = [40, 80].map(function (size) {
    const sources = AvoidTemplate.sources(size);

    return ['heavy', 'pooled', 'light'].map(function (kind) {
      return HeapSim.record(sources[kind], {}).allocations;
    });
  });

  assert.deepStrictEqual(counts[0], [84, 3, 1]);
  assert.deepStrictEqual(counts[1], [164, 3, 1]);
  support.quotes('avoiding-the-collector', ['164 objects']);
});

test('figures: escape analysis sees 5 sites, 3 of which never leave their frame', function () {
  const sources = AvoidTemplate.sources(40);
  const lowered = IrLower.compile(sources.heavy);
  const escape = Interproc.escapeProgram(lowered.program);
  const reasons = [];

  escape.functions.forEach(function (fn) {
    fn.allocations.forEach(function (row) { if (row.escapes) reasons.push(row.why); });
  });
  assert.strictEqual(escape.allocations, 5);
  assert.strictEqual(escape.stack, 3);
  assert.strictEqual(escape.escaping, 2);
  assert.deepStrictEqual(reasons, ['returned', 'returned']);

  const trace = HeapSim.record(sources.heavy, {});
  const top = trace.sites[0];

  assert.strictEqual(top.count, 41);
  assert.strictEqual(top.bytes, 984);
  assert.strictEqual(support.fixed((top.bytes / trace.bytes) * 100, 1), '43.0');
  assert.strictEqual(trace.sites[0].count + trace.sites[1].count, 81,
    'the two returned records account for 81 of the 84 objects');
  support.quotes('avoiding-the-collector',
    ['5 sites', '3 of 5', '2 of 5', 'returned', '41 objects', '984 bytes', '43.0 per cent',
      '81 of the 84']);
});

/* ------------------------------------------------------------- 31.9 */

test('figures: the retained set is flat without the leak and climbs 7 120 to 12 432 with it',
  function () {
    const clean = snapshots(0).map(function (heap) { return heap.bytes; });
    const dirty = snapshots(15).map(function (heap) { return heap.bytes; });
    const cleanVerdict = HeapAnalysis.stability(clean);
    const dirtyVerdict = HeapAnalysis.stability(dirty);

    assert.strictEqual(cleanVerdict.stable, true);
    assert.strictEqual(support.fixed(cleanVerdict.slope, 1), '0.0');
    assert.strictEqual(clean[0], 2128);
    assert.strictEqual(dirtyVerdict.stable, false);
    assert.strictEqual(support.fixed(dirtyVerdict.slope, 1), '1040.0');
    assert.strictEqual(dirty[0], 7120);
    assert.strictEqual(dirty[dirty.length - 1], 12432);
    support.quotes('diagnosing-gc',
      ['2 128', '2 168', '0.0', '7 120', '12 432', '1 040.0']);
  });

test('figures: the warm-up window says "growing" for a healthy start', function () {
  const trace = leakTrace(0);
  const early = [0.1, 0.2, 0.3, 0.4].map(function (fraction) {
    return HeapSim.snapshot(trace, Math.floor(trace.events.length * fraction),
      { capacity: 65536 }).bytes;
  });

  assert.strictEqual(HeapAnalysis.stability(early).stable, false,
    'the clean run reads as growing across its warm-up, which is the mistake');
  assert.strictEqual(early[0], 1272);
  assert.strictEqual(early[early.length - 1], 1992);
  assert.strictEqual(support.fixed(HeapAnalysis.stability(early).slope, 1), '244.8');
  support.quotes('diagnosing-gc', ['1 272', '1 992', '244.8']);
});

test('figures: one object retains 12 248 of a 12 432-byte dump through a 368-hop path',
  function () {
    const heap = snapshots(15)[5];
    const analysis = HeapAnalysis.analyse(heap);
    const top = analysis.rows.slice().sort(function (a, b) {
      return b.retained - a.retained;
    })[0];
    const longest = analysis.rows.reduce(function (most, row) {
      return Math.max(most, HeapAnalysis.retainingPath(heap, row.id).length - 1);
    }, 0);

    assert.strictEqual(heap.bytes, 12432);
    assert.strictEqual(top.id, 0);
    assert.strictEqual(top.shallow, 40);
    assert.strictEqual(top.retained, 12248);
    assert.strictEqual(support.fixed((top.retained / heap.bytes) * 100, 1), '98.5');
    assert.strictEqual(longest, 368);
    support.quotes('diagnosing-gc',
      ['12 248', '12 432', '40 bytes', '98.5 per cent', '368 hops']);
  });

test('figures: the snapshot difference names a site that gained 960 bytes', function () {
  const shots = snapshots(15);
  const rows = HeapAnalysis.growth(HeapAnalysis.analyse(shots[0]),
    HeapAnalysis.analyse(shots[5]));
  const top = rows[0];

  assert.strictEqual(top.wasCount, 32);
  assert.strictEqual(top.count, 61);
  assert.strictEqual(top.wasRetained, 920);
  assert.strictEqual(top.retained, 1880);
  assert.strictEqual(top.delta, 960);
  support.quotes('diagnosing-gc', ['32 objects', '61', '920 bytes', '1 880', '960']);
});

test('figures: promotion is 16 920 bytes of 67 872 allocated — 24.9 per cent', function () {
  const run = GcLab.replay(leakTrace(15), { mode: 'generational', capacity: 16384,
    nursery: 2048 });

  assert.strictEqual(run.allocatedBytes, 67872);
  assert.strictEqual(run.report.promoted, 16920);
  assert.strictEqual(support.fixed((run.report.promoted / run.allocatedBytes) * 100, 1), '24.9');
  support.quotes('diagnosing-gc', ['16 920', '67 872', '24.9 per cent']);
});

test('figures: the heap-sizing sweep changes everything except the leak', function () {
  const trace = leakTrace(15);
  const rows = [4096, 8192, 16384, 32768, 49152].map(function (capacity) {
    return GcLab.replay(trace, { mode: 'generational', capacity: capacity,
      nursery: Math.max(512, Math.round(capacity / 8)) });
  });

  assert.strictEqual(rows[0].collections, 1922);
  assert.strictEqual(support.fixed(rows[0].throughput, 3), '0.008');
  assert.strictEqual(rows[4].collections, 13);
  assert.strictEqual(support.fixed(rows[4].throughput, 3), '0.699');
  rows.forEach(function (row) {
    assert.ok(row.correct, 'no setting is allowed to free a reachable object');
  });
  /* The leak is unchanged by every one of them: the retained set at the end is
     the same live set whatever heap the collector was given. */
  const finals = rows.map(function (row) { return row.finalBytes; });

  assert.ok(Math.max.apply(null, finals) - Math.min.apply(null, finals) < 8000,
    'the live set is what it is: ' + finals.join(', '));
  support.quotes('diagnosing-gc', ['1 922', '0.008', '13', '0.699']);
});
