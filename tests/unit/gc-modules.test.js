'use strict';

/**
 * Property tests for the M31 collectors, and the oracle every one of them is
 * judged by.
 *
 * The oracle is the whole point and it appears in almost every test here:
 * `HeapSim.reachable` is a plain breadth-first walk that shares no code with
 * any collector, and the rule is that the set a collector reclaims must
 * contain no reachable object. That check found three real defects during
 * this milestone — a generational collector that never scanned its old roots,
 * an overflow recovery that left objects grey forever, and a mark loop that
 * dropped ROOTS when the stack was smaller than the root set — and every one
 * of them was reporting healthy statistics while it happened. The regression
 * tests for all three are below, named for what they lost.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const ALG = path.join(__dirname, '..', '..', 'src', 'js', 'algorithms');
const MACHINES = path.join(__dirname, '..', '..', 'src', 'js', 'machines');
const VIZ = path.join(__dirname, '..', '..', 'src', 'js', 'viz');

const HeapSim = require(path.join(MACHINES, 'heap-sim.js'));
const GcLab = require(path.join(MACHINES, 'gc-lab.js'));
const GcManual = require(path.join(ALG, 'gc-manual.js'));
const GcRefcount = require(path.join(ALG, 'gc-refcount.js'));
const GcMarkSweep = require(path.join(ALG, 'gc-mark-sweep.js'));
const GcCopying = require(path.join(ALG, 'gc-copying.js'));
const GcBarriers = require(path.join(ALG, 'gc-barriers.js'));
const GcIncremental = require(path.join(ALG, 'gc-incremental.js'));
const GcRegions = require(path.join(ALG, 'gc-regions.js'));
const GcWeak = require(path.join(ALG, 'gc-weak.js'));
const HeapAnalysis = require(path.join(ALG, 'heap-analysis.js'));
const HeapMapView = require(path.join(VIZ, 'heap-map-view.js'));

function makeHeap() { return HeapSim.makeHeap({}); }

function traceOf(options) {
  return HeapSim.synthetic(Object.assign({ count: 900, seed: 5, survival: 0.15,
    retained: 48 }, options || {}));
}

/* ------------------------------------------------------------ the generator */

test('the synthetic survival dial is real, and the measured rate follows it', function () {
  const rates = [0, 0.2, 0.5].map(function (survival) {
    const trace = HeapSim.synthetic({ count: 1200, seed: 5, survival: survival,
      retained: 200 });
    const curve = GcCopying.survivalCurve(trace, 8);

    return curve.reduce(function (sum, row) { return sum + row.rate; }, 0) / curve.length;
  });

  assert.ok(rates[0] < 0.1, 'at a dial of 0 almost nothing survives, got ' + rates[0]);
  assert.ok(rates[1] > rates[0] + 0.1, 'the dial moves the measurement');
  assert.ok(rates[2] > rates[1] + 0.1, 'and keeps moving it');
});

test('a new object is a root until it is stored somewhere', function () {
  const trace = traceOf({ count: 60 });
  const roots = new Map();

  trace.events.forEach(function (event) {
    if (event.kind === 'roots') roots.set(event.at, event.roots);
  });
  /* Every allocation is followed by a roots event that includes it: a program
     holds a new value in a register, and a register is a root. Without this
     the trace is not a possible program and a collector triggered between the
     allocation and the store is entitled to free the object. */
  trace.events.forEach(function (event, at) {
    if (event.kind !== 'alloc') return;
    const next = trace.events.slice(at + 1).find(function (row) {
      return row.kind === 'roots';
    });

    assert.ok(next && next.roots.indexOf(event.id) !== -1,
      'object ' + event.id + ' is not rooted after its allocation');
  });
});

test('the retained set reaches a steady state and the leak dial breaks it', function () {
  const flat = HeapSim.snapshot(traceOf({ count: 2400 }), undefined, { capacity: 65536 });
  const leaky = HeapSim.snapshot(traceOf({ count: 2400, leak: 0.15 }), undefined,
    { capacity: 65536 });

  assert.ok(leaky.bytes > flat.bytes * 2,
    'the leak dial should multiply the retained set: ' + flat.bytes + ' against ' + leaky.bytes);
});

/* ------------------------------------------------------------- the manual */

test('the manual fixture plants a fault the default quarantine misses', function () {
  const run = GcManual.replay(GcManual.seededScript(), {});

  assert.strictEqual(run.seeded, 5);
  assert.strictEqual(run.caught, 4);
  assert.strictEqual(run.missed, 1, 'a fixture a detector always passes tests nothing');
  assert.strictEqual(run.leaks.length, 1);
});

test('the quarantine sweep trades detection against memory monotonically', function () {
  const sweep = GcManual.quarantineSweep(GcManual.seededScript(), [0, 1, 2, 4, 6, 8]);

  sweep.forEach(function (row, at) {
    if (at === 0) return;
    assert.ok(row.caught >= sweep[at - 1].caught, 'catching never gets worse with depth');
    assert.ok(row.held >= sweep[at - 1].held, 'and it is always paid for in memory');
  });
  assert.strictEqual(sweep[0].caught, 0);
  assert.strictEqual(sweep[sweep.length - 1].missed, 0);
});

/* --------------------------------------------------------------- counting */

test('a cycle keeps its counts above zero and trial deletion reclaims it', function () {
  const out = GcRefcount.cycleScenario(makeHeap);
  const last = out.rows[out.rows.length - 1];

  assert.deepStrictEqual(last.counts, [1, 1, 1], 'neither member reaches zero');
  assert.deepStrictEqual(out.leaked.sort(), [0, 1], 'and the oracle says both are unreachable');

  const collected = GcRefcount.collectCycles(out.heap, out.state);

  assert.strictEqual(collected.reclaimed.length, 2);
  assert.ok(!out.heap.cells.has(0) && !out.heap.cells.has(1));
});

test('a cascade frees the whole chain at one store', function () {
  [1, 10, 100, 200, 1000].forEach(function (length) {
    const out = GcRefcount.cascade(makeHeap, length);

    assert.strictEqual(out.reclaimed, length, 'chain of ' + length);
    assert.strictEqual(out.decrements, length);
    assert.strictEqual(out.remaining, 0);
  });
});

test('trial deletion never reclaims a group anything outside points into', function () {
  const heap = makeHeap();

  [0, 1, 2].forEach(function (id) {
    heap.cells.set(id, { id: id, size: 16, refs: [], colour: 'white', age: 0, count: 0 });
  });
  heap.cells.get(0).refs = [1];
  heap.cells.get(1).refs = [0];
  heap.cells.get(2).refs = [0];
  heap.cells.get(0).count = 2;
  heap.cells.get(1).count = 1;
  heap.cells.get(2).count = 1;
  heap.roots = [2];

  const group = GcRefcount.subgraph(heap, 0);

  assert.ok(GcRefcount.externallyReferenced(heap, group),
    'object 2 holds object 0, so the cycle is live');
});

/* ---------------------------------------------------------------- tracing */

test('mark-sweep reclaims exactly the unreachable set at every stack limit', function () {
  const source = HeapSim.build(traceOf({ survival: 0.2 }), undefined, { capacity: 32768 });

  [1, 2, 4, 8, 16, 32, 64, 256].forEach(function (limit) {
    const heap = HeapSim.clone(source);
    const want = new Set(HeapSim.unreachable(heap, heap.roots));
    const state = GcMarkSweep.create({ stackLimit: limit });
    const out = GcMarkSweep.collect(heap, state, 'test');

    assert.strictEqual(out.reclaimed.length, want.size, 'limit ' + limit);
    out.reclaimed.forEach(function (id) {
      assert.ok(want.has(id), 'limit ' + limit + ' freed reachable object ' + id);
    });
  });
});

test('a stack smaller than the root set keeps every root', function () {
  /* The regression for the second overflow defect: the whole root set was
     pushed before anything was scanned, so a stack of two dropped roots — and
     a dropped root cannot be recovered, because the rescan looks for a black
     object with a white child and a root has no parent. Six live objects went. */
  const heap = makeHeap();

  for (let id = 0; id < 6; id += 1) {
    heap.cells.set(id, { id: id, size: 16, refs: [], colour: 'white', age: 0, count: 0 });
    heap.bytes += 16;
  }
  heap.roots = [0, 1, 2, 3, 4];
  const state = GcMarkSweep.create({ stackLimit: 1 });
  const out = GcMarkSweep.collect(heap, state, 'test');

  assert.deepStrictEqual(out.reclaimed, [5]);
  [0, 1, 2, 3, 4].forEach(function (id) {
    assert.ok(heap.cells.has(id), 'root ' + id + ' survived');
  });
});

test('overflow recovery leaves nothing grey', function () {
  /* The regression for the first defect: the recovery shaded the dropped
     children grey itself and then handed the grey ids to a marker that only
     accepts white ones, so they were never scanned and their own children
     were swept while live. */
  const heap = makeHeap();

  for (let id = 0; id < 31; id += 1) {
    const kids = [];

    if (2 * id + 1 < 31) kids.push(2 * id + 1);
    if (2 * id + 2 < 31) kids.push(2 * id + 2);
    heap.cells.set(id, { id: id, size: 16, refs: kids, colour: 'white', age: 0, count: 0 });
    heap.bytes += 16;
  }
  heap.roots = [0];
  const state = GcMarkSweep.create({ stackLimit: 2 });
  const out = GcMarkSweep.collect(heap, state, 'test');

  assert.strictEqual(out.reclaimed.length, 0, 'the whole tree is reachable');
  assert.ok(state.rescans > 0, 'and the recovery really ran');
  heap.cells.forEach(function (cell) {
    assert.notStrictEqual(cell.colour, 'grey', 'object ' + cell.id + ' was left grey');
  });
});

test('compaction preserves the live set and leaves one free run', function () {
  const source = HeapSim.build(traceOf({ survival: 0.2 }), undefined, { capacity: 32768 });
  const span = source.next;
  const swept = HeapSim.clone(source);
  const packed = HeapSim.clone(source);

  GcMarkSweep.collect(swept, GcMarkSweep.create({}), 'test');
  GcMarkSweep.collect(packed, GcMarkSweep.create({ compact: true }), 'test');
  assert.strictEqual(swept.bytes, packed.bytes, 'the same objects survive either way');

  const sweptRuns = HeapMapView.runsOf(Array.from(swept.cells.values()), span);
  const packedRuns = HeapMapView.runsOf(Array.from(packed.cells.values()), span);

  assert.strictEqual(HeapMapView.freeBytes(sweptRuns), HeapMapView.freeBytes(packedRuns),
    'and the same number of free bytes');
  assert.ok(HeapMapView.largestHole(sweptRuns) < HeapMapView.freeBytes(sweptRuns),
    'a sweep leaves the free space in pieces');
  assert.strictEqual(HeapMapView.largestHole(packedRuns), HeapMapView.freeBytes(packedRuns),
    'a compaction leaves exactly one');
});

/* --------------------------------------------------------------- copying */

test('an old root is scanned rather than filtered out', function () {
  /* The regression for the generational defect: every root went through the
     same young filter as every other object, so the long-lived container was
     rejected and never scanned, and its young children were freed while live —
     with all three barrier settings producing the identical failure. */
  const heap = makeHeap();

  [0, 1, 2].forEach(function (id) {
    heap.cells.set(id, { id: id, size: 16, refs: [], colour: 'white',
      age: id === 0 ? 5 : 0, count: 0 });
    heap.bytes += 16;
  });
  heap.cells.get(0).refs = [1];
  heap.roots = [0];
  const state = GcCopying.create({ generational: true, promoteAfter: 2 });
  const out = GcCopying.minorCollect(heap, state, 'test');

  assert.deepStrictEqual(out.reclaimed, [2], 'only the unreachable young object goes');
  assert.ok(heap.cells.has(1), 'the young child of an old root survives');
});

test('a barrier entry survives a collection while the pointer still crosses', function () {
  const heap = makeHeap();

  [0, 1].forEach(function (id) {
    heap.cells.set(id, { id: id, size: 16, refs: [], colour: 'white',
      age: id === 0 ? 5 : 0, count: 0, address: id * 16 });
    heap.bytes += 16;
  });
  heap.roots = [0];
  const barrier = GcBarriers.create({ kind: 'remembered', promoteAfter: 2 });

  GcBarriers.store(heap, barrier, { from: 0, index: 0, to: 1 });
  HeapSim.store(heap, 0, 0, 1);
  assert.ok(GcBarriers.extraRoots(heap, barrier).roots.indexOf(0) !== -1);

  const state = GcCopying.create({ generational: true, promoteAfter: 2 });

  heap.remembered = GcBarriers.extraRoots(heap, barrier).roots;
  const out = GcCopying.minorCollect(heap, state, 'test');

  GcBarriers.refresh(heap, barrier, [0], out.promotedIds);
  assert.ok(GcBarriers.extraRoots(heap, barrier).roots.indexOf(0) !== -1,
    'the entry is still needed, so it must still be there');
});

test('copying cost tracks the live set and sweeping tracks the heap', function () {
  const rows = GcLab.heapSizeSweep(traceOf({ count: 1500 }), [4096, 8192, 16384, 32768],
    ['mark-sweep', 'copying']);
  const sweep = rows.filter(function (row) { return row.mode === 'mark-sweep'; });
  const copy = rows.filter(function (row) { return row.mode === 'copying'; });

  assert.ok(sweep[3].perCollection > sweep[0].perCollection * 4,
    'sweeping should cost several times more in a heap eight times larger');
  assert.ok(copy[3].perCollection < copy[0].perCollection * 1.3,
    'copying should barely move: ' + copy.map(function (r) {
      return r.perCollection.toFixed(1);
    }).join(', '));
  rows.forEach(function (row) { assert.ok(row.correct, row.mode + ' at ' + row.capacity); });
});

/* ------------------------------------------------------------ incremental */

test('the lost-object scenario is lost without a barrier and kept with either', function () {
  const rows = GcIncremental.BARRIERS.map(function (barrier) {
    return GcIncremental.runScenario(makeHeap, barrier.id);
  });

  assert.strictEqual(rows[0].survived, false, 'no barrier must lose the value');
  assert.strictEqual(rows[1].survived, true);
  assert.strictEqual(rows[2].survived, true);
});

test('10 000 interleavings: both barriers lose nothing and the barrier-free variant does',
  function () {
    const runs = GcIncremental.BARRIERS.map(function (barrier) {
      return GcIncremental.stress(makeHeap, HeapSim.reachable,
        { barrier: barrier.id, runs: 10000, seed: 11, objects: 12, stores: 6 });
    });

    assert.ok(runs[0].lost > 0, 'a harness every barrier passes is testing nothing');
    assert.strictEqual(runs[1].lost, 0, 'incremental update');
    assert.strictEqual(runs[2].lost, 0, 'snapshot at the beginning');
    assert.ok(runs[2].floating > runs[1].floating * 1.5,
      'SATB retains materially more: ' + runs[1].floating + ' against ' + runs[2].floating);
  });

/* ---------------------------------------------------------------- regions */

test('garbage-first never exceeds the budget and is beaten by the exact optimum', function () {
  const rows = GcRegions.adversarial();
  const greedy = GcRegions.select(rows, 100, 'garbage-first');
  const best = GcRegions.optimalSelection(rows, 100);

  assert.ok(greedy.copied <= 100, 'the budget is the pause and it is not negotiable');
  assert.ok(best.reclaimed > greedy.reclaimed,
    'the constructed set must defeat the heuristic, or it demonstrates nothing');
  assert.strictEqual(greedy.reclaimed, 73);
  assert.strictEqual(best.reclaimed, 100);
});

test('a wholly dead region costs nothing and is always taken', function () {
  const heap = HeapSim.build(traceOf({ count: 1200 }), undefined, { capacity: 65536 });
  const state = GcRegions.create({ regionBytes: 512 });

  GcRegions.partition(heap, state);
  const live = HeapSim.reachable(heap, heap.roots);
  const census = GcRegions.census(heap, live);
  const empty = census.filter(function (row) { return row.live === 0; });
  const chosen = new Set(GcRegions.select(census, 0, 'garbage-first').regions);

  assert.ok(empty.length > 0, 'the fixture should contain wholly dead regions');
  empty.forEach(function (row) {
    assert.ok(chosen.has(row.region), 'region ' + row.region + ' is free to take');
  });
});

test('evacuation frees exactly the dead objects in the collection set', function () {
  const heap = HeapSim.build(traceOf({ count: 900 }), undefined, { capacity: 65536 });
  const state = GcRegions.create({ regionBytes: 512 });

  GcRegions.partition(heap, state);
  const live = HeapSim.reachable(heap, heap.roots);
  const census = GcRegions.census(heap, live);
  const chosen = GcRegions.select(census, 512, 'garbage-first');
  const out = GcRegions.evacuate(heap, state, chosen.regions, live);

  out.freed.forEach(function (id) {
    assert.ok(!live.has(id), 'evacuation freed reachable object ' + id);
  });
  out.moved.forEach(function (id) {
    assert.ok(heap.cells.has(id), 'a survivor must still be in the heap');
  });
});

/* ----------------------------------------------------------- weak and finalise */

test('a strong cache retains its keys and a weak one does not', function () {
  const strong = GcWeak.cacheScenario(makeHeap, 'strong', { entries: 12, keep: 0.5 });
  const weak = GcWeak.cacheScenario(makeHeap, 'weak', { entries: 12, keep: 0.5 });

  assert.strictEqual(strong.reclaimed, 0);
  assert.strictEqual(weak.cleared, 6);
  assert.strictEqual(weak.reclaimed, 12, 'each dropped key takes its value with it');
  assert.ok(weak.bytes < strong.bytes);
});

test('soft references clear only under pressure', function () {
  const easy = GcWeak.cacheScenario(makeHeap, 'soft', { entries: 12, keep: 0.5 });
  const tight = GcWeak.cacheScenario(makeHeap, 'soft',
    { entries: 12, keep: 0.5, pressure: true });

  assert.strictEqual(easy.cleared, 0, 'a policy that has not fired');
  assert.strictEqual(tight.cleared, 6, 'and the same references once it has');
});

test('a finalisable object costs two cycles and its finaliser runs at most once', function () {
  const clean = GcWeak.resurrectionScenario(makeHeap, { resurrect: false });

  assert.strictEqual(clean.rows[0].reclaimed, 0, 'cycle one queues and frees nothing');
  assert.strictEqual(clean.rows[1].finalised, 1, 'cycle two runs the finaliser');
  assert.strictEqual(clean.rows[1].reclaimed, 2, 'and frees the object and its child');

  const raised = GcWeak.resurrectionScenario(makeHeap, { resurrect: true });

  assert.strictEqual(raised.twice, 0, 'a finaliser must never run twice');
  assert.strictEqual(raised.finalised, 1);
  assert.ok(raised.live >= 2, 'the resurrected object and what it holds are still alive');
});

test('the handle limit is exhausted while the heap is nearly empty', function () {
  const leaking = GcWeak.handleScenario({ close: false, limit: 16, iterations: 64,
    objectBytes: 16, heapLimit: 4096 });
  const closed = GcWeak.handleScenario({ close: true, limit: 16, iterations: 64,
    objectBytes: 16, heapLimit: 4096 });

  assert.strictEqual(leaking.failedAt, 17);
  assert.strictEqual(leaking.collections, 0, 'nothing ever triggered a collection');
  assert.ok(leaking.bytes < 4096 * 0.1, 'and the heap was nearly empty when it died');
  assert.strictEqual(closed.exhausted, false);
  assert.strictEqual(closed.peakHandles, 1);
});

/* -------------------------------------------------------------- analysis */

test('retained size is the memory freed by dropping one reference', function () {
  const heap = makeHeap();
  const sizes = { 0: 10, 1: 20, 2: 30, 3: 40 };

  Object.keys(sizes).forEach(function (key) {
    const id = Number(key);

    heap.cells.set(id, { id: id, size: sizes[key], refs: [], colour: 'white', age: 0,
      count: 0, kind: 'record' });
    heap.bytes += sizes[key];
  });
  heap.cells.get(0).refs = [1];
  heap.cells.get(1).refs = [2, 3];
  heap.roots = [0];

  const analysis = HeapAnalysis.analyse(heap);
  const byId = new Map(analysis.rows.map(function (row) { return [row.id, row]; }));

  assert.strictEqual(byId.get(1).retained, 90, '20 + 30 + 40');
  assert.strictEqual(byId.get(2).retained, 30, 'a leaf retains itself');
  assert.strictEqual(HeapAnalysis.immediateHolder(analysis, 1), 0);
});

test('the stability verdict separates a steady heap from a leaking one', function () {
  const samples = function (leak) {
    const trace = traceOf({ count: 2400, leak: leak });

    return [0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map(function (fraction) {
      return HeapSim.snapshot(trace, Math.floor(trace.events.length * fraction),
        { capacity: 65536 }).bytes;
    });
  };

  assert.strictEqual(HeapAnalysis.stability(samples(0)).stable, true);
  assert.strictEqual(HeapAnalysis.stability(samples(0.15)).stable, false);
});

test('the leak produces a retaining path far longer than the steady structure', function () {
  const deepest = function (leak) {
    const trace = traceOf({ count: 2400, leak: leak });
    const heap = HeapSim.snapshot(trace, undefined, { capacity: 65536 });
    const analysis = HeapAnalysis.analyse(heap);

    return analysis.rows.reduce(function (most, row) {
      return Math.max(most, HeapAnalysis.retainingPath(heap, row.id).length);
    }, 0);
  };

  assert.ok(deepest(0.15) > deepest(0) * 5,
    'a chain where each entry holds the previous one is what a leak looks like in a dump');
});

/* ------------------------------------------------------------- the harness */

test('every collector frees no reachable object, on a recorded and a generated trace',
  function () {
    const traces = [traceOf({ count: 1500, cycles: 0.06 })];

    traces.forEach(function (trace) {
      GcLab.compare(trace, { capacity: 8192, nursery: 1536, budget: 768,
        candidates: 32 }).forEach(function (row) {
        assert.ok(row.correct, row.mode + ' freed ' + row.wrong + ' reachable objects');
      });
    });
  });

test('the generational collector without a barrier fails the same check', function () {
  const trace = traceOf({ count: 1500 });
  const broken = GcLab.replay(trace, { mode: 'generational', capacity: 8192,
    nursery: 1536, barrier: 'none' });

  assert.ok(broken.wrong.length > 0,
    'a barrier that cannot be shown to matter has not been shown to matter');
  ['remembered', 'card'].forEach(function (kind) {
    const run = GcLab.replay(trace, { mode: 'generational', capacity: 8192,
      nursery: 1536, barrier: kind });

    assert.strictEqual(run.wrong.length, 0, kind);
  });
});

test('the pause distribution reports percentiles rather than a mean', function () {
  const run = GcLab.replay(traceOf({ count: 1500 }), { mode: 'generational',
    capacity: 8192, nursery: 1024 });
  const d = run.distribution;

  assert.ok(d.p50 <= d.p90 && d.p90 <= d.p99 && d.p99 <= d.max, 'the percentiles are ordered');
  assert.strictEqual(d.count, run.pauses.length);
  assert.strictEqual(d.buckets.reduce(function (sum, b) { return sum + b.count; }, 0), d.count,
    'every pause lands in exactly one bucket');
});

test('the card size trades store cost against scan cost', function () {
  const trace = traceOf({ count: 1500 });
  const rows = [32, 128, 512].map(function (cardBytes) {
    return GcLab.replay(trace, { mode: 'generational', capacity: 8192, nursery: 1536,
      barrier: 'card', cardBytes: cardBytes }).report;
  });

  assert.strictEqual(rows[0].cost, rows[2].cost, 'the store cost is one byte whatever the card');
  assert.ok(rows[2].scanned > rows[0].scanned,
    'and bigger cards hand the collector more to look at');
});
