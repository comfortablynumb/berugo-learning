'use strict';

/**
 * Every figure the 31.1-31.3 content quotes, recomputed from the modules —
 * and then asserted to still appear in the prose.
 *
 * The parameters here mirror each section controller exactly: the same seed,
 * the same object count, the same retained-set size and the same heap. A
 * figure test that measures a slightly different workload agrees with nothing
 * and fails for the wrong reasons.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const support = require('../support/worked-example-prose.js');

const CONTENT = path.join(__dirname, '..', '..', 'src', 'js', 'content');
['concepts-memory', 'examples-memory']
  .forEach(function (file) { require(path.join(CONTENT, file + '.js')); });

const ALG = path.join(__dirname, '..', '..', 'src', 'js', 'algorithms');
const MACHINES = path.join(__dirname, '..', '..', 'src', 'js', 'machines');
const VIZ = path.join(__dirname, '..', '..', 'src', 'js', 'viz');

const HeapSim = require(path.join(MACHINES, 'heap-sim.js'));
const GcLab = require(path.join(MACHINES, 'gc-lab.js'));
const GcManual = require(path.join(ALG, 'gc-manual.js'));
const GcRefcount = require(path.join(ALG, 'gc-refcount.js'));
const GcMarkSweep = require(path.join(ALG, 'gc-mark-sweep.js'));
const HeapMapView = require(path.join(VIZ, 'heap-map-view.js'));

/** The trace 31.1 and 31.2 both replay, at their default control settings. */
function mainTrace() {
  return HeapSim.synthetic({ count: 1500, seed: 5, retained: 64, cycles: 0.06,
    survival: 0.15 });
}

/** The heap 31.3 collects, built with no collector running. */
function markHeap() {
  return HeapSim.build(HeapSim.synthetic({ count: 900, seed: 5, survival: 0.2, retained: 64 }),
    undefined, { capacity: 32768 });
}

/* ------------------------------------------------------------- 31.1 */

test('figures: the trace is 1 599 objects and 44 608 bytes', function () {
  const trace = mainTrace();

  assert.strictEqual(trace.allocations, 1599);
  assert.strictEqual(trace.bytes, 44608);
  support.quotes('memory-management-landscape', ['1 599 objects', '44 608 bytes']);
});

test('figures: the quarantine sweep catches 0, 2, 4 and 5 of 5 at depths 0, 1, 4 and 6',
  function () {
    const sweep = GcManual.quarantineSweep(GcManual.seededScript(), [0, 1, 2, 4, 6, 8]);
    const byDepth = {};

    sweep.forEach(function (row) { byDepth[row.quarantine] = row; });
    assert.strictEqual(byDepth[0].caught, 0);
    assert.strictEqual(byDepth[0].missed, 5);
    assert.strictEqual(byDepth[1].caught, 2);
    assert.strictEqual(byDepth[2].caught, 2);
    assert.strictEqual(byDepth[4].caught, 4);
    assert.strictEqual(byDepth[4].missed, 1);
    assert.strictEqual(byDepth[6].caught, 5);
    assert.deepStrictEqual([0, 1, 2, 4, 6].map(function (d) { return byDepth[d].held; }),
      [0, 8, 16, 32, 36]);
    support.quotes('memory-management-landscape',
      ['0 of 5', '2 of 5', '4 of 5', '5 of 5', '32 bytes', '36 bytes']);
  });

test('figures: the seeded fixture is five faults and one unfreed block', function () {
  const run = GcManual.replay(GcManual.seededScript(), {});

  assert.strictEqual(run.seeded, 5);
  assert.strictEqual(run.caught, 4);
  assert.strictEqual(run.missed, 1);
  assert.strictEqual(run.leaks.length, 1);
  support.quotes('memory-management-landscape', ['five faults', 'one block that is never freed']);
});

test('figures: the triangle has three different winners', function () {
  const trace = mainTrace();
  const rows = GcLab.compare(trace, { capacity: 8192, nursery: 1536, candidates: 32 },
    ['refcount', 'mark-sweep', 'generational']);
  const byMode = {};

  rows.forEach(function (row) { byMode[row.mode] = row; });
  assert.strictEqual(byMode.refcount.max, 0);
  assert.strictEqual(byMode['mark-sweep'].max, 381);
  assert.strictEqual(byMode.generational.max, 90);
  assert.strictEqual(support.fixed(byMode.refcount.throughput, 3), '0.576');
  assert.strictEqual(support.fixed(byMode['mark-sweep'].throughput, 3), '0.666');
  assert.strictEqual(support.fixed(byMode.generational.throughput, 3), '0.619');
  assert.strictEqual(byMode.refcount.peak, 7240);
  assert.strictEqual(byMode['mark-sweep'].peak, 8192);
  assert.strictEqual(byMode.generational.peak, 7792);
  rows.forEach(function (row) { assert.ok(row.correct); });
  support.quotes('memory-management-landscape',
    ['0.576', '0.666', '0.619', '7 240', '8 192', '7 792', '381', '90']);
});

test('figures: the header is 12 792 of 44 608 bytes — 28.7 per cent', function () {
  const trace = mainTrace();
  const header = HeapSim.HEADER_BYTES * trace.allocations;

  assert.strictEqual(HeapSim.HEADER_BYTES, 8);
  assert.strictEqual(header, 12792);
  assert.strictEqual(support.fixed((header / trace.bytes) * 100, 1), '28.7');
  support.quotes('memory-management-landscape', ['12 792', '28.7 per cent']);
});

/* ------------------------------------------------------------- 31.2 */

test('figures: counting performs 3 757 adjustments over 5 101 steps', function () {
  const run = GcLab.replay(mainTrace(), { mode: 'refcount', capacity: 8192 });
  const traffic = run.mutatorWork - run.programWork;

  assert.strictEqual(run.programWork, 5101);
  assert.strictEqual(traffic, 3757);
  assert.strictEqual(support.fixed(traffic / run.programWork, 2), '0.74');
  support.quotes('reference-counting', ['3 757 adjustments', '5 101 program steps', '0.74']);
});

test('figures: counting reclaims 1 354 objects and leaks 154', function () {
  const run = GcLab.replay(mainTrace(), { mode: 'refcount', capacity: 8192 });

  assert.strictEqual(run.immediate, 1354);
  assert.strictEqual(run.uncollected, 154);
  assert.strictEqual(run.uncollectedBytes, 4304);
  assert.strictEqual(run.distribution.max, 0, 'and it never pauses');
  support.quotes('reference-counting', ['1 354 objects', '154 objects', '4 304 bytes']);
});

test('figures: cycle collection at 32 candidates takes the leak to 8', function () {
  const run = GcLab.replay(mainTrace(), { mode: 'refcount-cycles', capacity: 8192,
    candidates: 32 });

  assert.strictEqual(run.uncollected, 8);
  assert.strictEqual(run.collections, 11);
  assert.strictEqual(run.distribution.max, 304);
  support.quotes('reference-counting', ['8 objects', '11 pauses', '304']);
});

test('figures: the cascade frees the chain length at one store', function () {
  const make = function () { return HeapSim.makeHeap({}); };

  [1, 10, 100, 200].forEach(function (length) {
    const out = GcRefcount.cascade(make, length);

    assert.strictEqual(out.reclaimed, length);
    assert.strictEqual(out.decrements, length);
  });
  const run = GcLab.replay(mainTrace(), { mode: 'refcount', capacity: 8192 });

  assert.strictEqual(run.worstStep, 3, 'the generated graph is shallow, so the demo sees 3');
  support.quotes('reference-counting', ['200 objects freed', '200 decrements', '3 units']);
});

test('figures: the cycle fixture holds both counts at 1 with nothing reachable', function () {
  const out = GcRefcount.cycleScenario(function () { return HeapSim.makeHeap({}); });
  const last = out.rows[out.rows.length - 1];

  assert.deepStrictEqual(last.counts, [1, 1, 1]);
  assert.strictEqual(last.unreachable, 2);
  support.quotes('reference-counting', ['count of', '1']);
});

/* ------------------------------------------------------------- 31.3 */

test('figures: the demo heap is 922 objects of which 89 are reachable', function () {
  const heap = markHeap();

  assert.strictEqual(heap.cells.size, 922);
  assert.strictEqual(HeapSim.reachable(heap, heap.roots).size, 89);
  assert.strictEqual(HeapSim.unreachable(heap, heap.roots).length, 833);
  support.quotes('mark-sweep-and-compact', ['922 objects', '89 are reachable', '833']);
});

test('figures: the stack-limit sweep costs 2 775 against 1 011 and reclaims the same set',
  function () {
    const source = markHeap();
    const rows = [1, 8, 32, 64].map(function (limit) {
      const heap = HeapSim.clone(source);
      const want = new Set(HeapSim.unreachable(heap, heap.roots));
      const state = GcMarkSweep.create({ stackLimit: limit });
      const out = GcMarkSweep.collect(heap, state, 'test');

      return { limit: limit, visited: out.visited, rescans: state.rescans, work: out.work,
        reclaimed: out.reclaimed.length,
        wrong: out.reclaimed.filter(function (id) { return !want.has(id); }).length };
    });
    const byLimit = {};

    rows.forEach(function (row) { byLimit[row.limit] = row; });
    assert.strictEqual(byLimit[1].visited, 9);
    assert.strictEqual(byLimit[1].rescans, 2);
    assert.strictEqual(byLimit[1].work, 2775);
    assert.strictEqual(byLimit[8].visited, 18);
    assert.strictEqual(byLimit[8].work, 2784);
    assert.strictEqual(byLimit[32].visited, 50);
    assert.strictEqual(byLimit[32].rescans, 1);
    assert.strictEqual(byLimit[32].work, 1894);
    assert.strictEqual(byLimit[64].visited, 89);
    assert.strictEqual(byLimit[64].rescans, 0);
    assert.strictEqual(byLimit[64].work, 1011);
    assert.strictEqual(support.fixed(byLimit[1].work / byLimit[64].work, 2), '2.74');
    rows.forEach(function (row) {
      assert.strictEqual(row.reclaimed, 833);
      assert.strictEqual(row.wrong, 0);
    });
    support.quotes('mark-sweep-and-compact',
      ['2 775', '1 011', '2.74', '1 894', '2 784', '833 of 833']);
  });

test('figures: the same 23 080 free bytes are 57 holes or 1', function () {
  const source = markHeap();
  const span = source.next;
  const measure = function (compact) {
    const heap = HeapSim.clone(source);

    GcMarkSweep.collect(heap, GcMarkSweep.create({ compact: compact }), 'test');
    const runs = HeapMapView.runsOf(Array.from(heap.cells.values()), span);
    const free = HeapMapView.freeBytes(runs);

    return { live: heap.bytes, free: free, largest: HeapMapView.largestHole(runs),
      holes: runs.filter(function (row) { return row.free; }).length,
      share: (HeapMapView.largestHole(runs) / free) * 100 };
  };
  const swept = measure(false);
  const packed = measure(true);

  assert.strictEqual(span, 25736);
  assert.strictEqual(swept.live, 2656);
  assert.strictEqual(packed.live, 2656);
  assert.strictEqual(swept.free, 23080);
  assert.strictEqual(packed.free, 23080);
  assert.strictEqual(swept.holes, 57);
  assert.strictEqual(packed.holes, 1);
  assert.strictEqual(swept.largest, 5160);
  assert.strictEqual(packed.largest, 23080);
  assert.strictEqual(support.fixed(swept.share, 1), '22.4');
  support.quotes('mark-sweep-and-compact',
    ['23 080', '2 656', '57 pieces', '5 160', '22.4 per cent', '25 736']);
});
