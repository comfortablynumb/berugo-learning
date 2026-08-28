'use strict';

/**
 * Every figure the 31.4-31.6 content quotes, recomputed from the modules —
 * and then asserted to still appear in the prose.
 *
 * The two headline results are here and both are comparisons rather than
 * single numbers: copying's per-collection cost staying flat while
 * mark-sweep's rises with the heap, and garbage-first landing on the exact
 * knapsack optimum on a real heap and 73 per cent of it on one built to
 * defeat it. A ratio is only worth quoting once its denominator has been
 * computed, so both optima below are solved exactly.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const support = require('../support/worked-example-prose.js');

const CONTENT = path.join(__dirname, '..', '..', 'src', 'js', 'content');
['concepts-memory-generational', 'examples-memory-generational']
  .forEach(function (file) { require(path.join(CONTENT, file + '.js')); });

const ALG = path.join(__dirname, '..', '..', 'src', 'js', 'algorithms');
const MACHINES = path.join(__dirname, '..', '..', 'src', 'js', 'machines');

const HeapSim = require(path.join(MACHINES, 'heap-sim.js'));
const GcLab = require(path.join(MACHINES, 'gc-lab.js'));
const GcCopying = require(path.join(ALG, 'gc-copying.js'));
const GcIncremental = require(path.join(ALG, 'gc-incremental.js'));
const GcRegions = require(path.join(ALG, 'gc-regions.js'));

/** The trace 31.4 and 31.5 replay, at their default control settings. */
function plainTrace() {
  return HeapSim.synthetic({ count: 1500, seed: 5, retained: 64, survival: 0.15 });
}

/** 31.6 adds cycles and a higher survival rate, so counting has something to leak. */
function mixedTrace() {
  return HeapSim.synthetic({ count: 1500, seed: 5, retained: 64, survival: 0.2,
    cycles: 0.06 });
}

function makeHeap() { return HeapSim.makeHeap({}); }

/* ------------------------------------------------------------- 31.4 */

test('figures: sweeping costs 218 to 1 270 per collection while copying stays at 162 to 178',
  function () {
    const rows = GcLab.heapSizeSweep(plainTrace(), [4096, 8192, 16384, 32768],
      ['mark-sweep', 'copying']);
    const at = function (mode, capacity) {
      return rows.find(function (row) {
        return row.mode === mode && row.capacity === capacity;
      });
    };

    assert.strictEqual(support.fixed(at('mark-sweep', 4096).perCollection, 1), '218.0');
    assert.strictEqual(support.fixed(at('mark-sweep', 8192).perCollection, 1), '367.3');
    assert.strictEqual(support.fixed(at('mark-sweep', 16384).perCollection, 1), '669.0');
    assert.strictEqual(support.fixed(at('mark-sweep', 32768).perCollection, 1), '1270.0');
    assert.strictEqual(support.fixed(at('copying', 4096).perCollection, 1), '162.2');
    assert.strictEqual(support.fixed(at('copying', 8192).perCollection, 1), '163.7');
    assert.strictEqual(support.fixed(at('copying', 16384).perCollection, 1), '165.0');
    assert.strictEqual(support.fixed(at('copying', 32768).perCollection, 1), '178.0');

    const sweepRatio = at('mark-sweep', 32768).perCollection / at('mark-sweep', 4096).perCollection;
    const copyRatio = at('copying', 32768).perCollection / at('copying', 4096).perCollection;

    assert.strictEqual(support.fixed(sweepRatio, 2), '5.83');
    assert.strictEqual(support.fixed(copyRatio, 2), '1.10');
    support.quotes('generational-collection',
      ['218.0', '367.3', '669.0', '1 270.0', '162.2', '163.7', '165.0', '178.0',
        '5.83', '1.10']);
  });

test('figures: the collection counts are 25, 7, 2 and 1 for both collectors', function () {
  const rows = GcLab.heapSizeSweep(plainTrace(), [4096, 8192, 16384, 32768],
    ['mark-sweep', 'copying']);

  [4096, 8192, 16384, 32768].forEach(function (capacity, at) {
    const pair = rows.filter(function (row) { return row.capacity === capacity; });

    assert.strictEqual(pair[0].collections, pair[1].collections,
      'the trigger is the same, so the counts must match at ' + capacity);
    assert.strictEqual(pair[0].collections, [25, 7, 2, 1][at]);
  });
  support.quotes('generational-collection', ['25 collections', '7 collections',
    '2 collections', '1 collection']);
});

test('figures: measured survival is 17.2 per cent, per window 23.0 down to 17.8', function () {
  const curve = GcCopying.survivalCurve(plainTrace(), 8);
  const mean = curve.reduce(function (sum, row) { return sum + row.rate; }, 0) / curve.length;

  assert.strictEqual(support.fixed(mean * 100, 1), '17.2');
  assert.deepStrictEqual(curve.map(function (row) {
    return support.fixed(row.rate * 100, 1);
  }), ['23.0', '16.5', '18.1', '14.9', '15.4', '18.6', '13.3', '17.8']);
  curve.forEach(function (row) {
    assert.ok(row.rateLater <= row.rate,
      'the later horizon is always the smaller number, by construction');
  });
  support.quotes('generational-collection',
    ['17.2 per cent', '23.0', '16.5', '18.1', '14.9', '15.4', '18.6']);
});

test('figures: three barriers cost 0, 786 and 262 and lose 208, 0 and 0', function () {
  const trace = plainTrace();
  const rows = ['none', 'remembered', 'card'].map(function (kind) {
    return GcLab.replay(trace, { mode: 'generational', capacity: 8192, nursery: 1536,
      barrier: kind, cardBytes: 128 });
  });

  assert.strictEqual(rows[0].report.cost, 0);
  assert.strictEqual(rows[1].report.cost, 786);
  assert.strictEqual(rows[2].report.cost, 262);
  assert.strictEqual(rows[1].report.scanned, 349);
  assert.strictEqual(rows[2].report.scanned, 655);
  assert.strictEqual(rows[0].wrong.length, 208,
    'the barrier-free variant must fail, or the barrier demonstrates nothing');
  assert.strictEqual(rows[1].wrong.length, 0);
  assert.strictEqual(rows[2].wrong.length, 0);
  assert.strictEqual(rows[2].report.recorded, 235);
  assert.strictEqual(rows[2].report.stores, 262);
  assert.strictEqual(rows[2].report.filtered, 27);

  const cardTable = Math.ceil(rows[2].span / 128);
  const rememberedTable = rows[1].report.recorded * HeapSim.WORD_BYTES;

  assert.strictEqual(cardTable, 332);
  assert.strictEqual(rememberedTable, 1880);
  support.quotes('generational-collection',
    ['786', '262', '349', '655', '208', '235', '27', '332', '1 880']);
});

test('figures: the nursery sweep runs 317 to 12 minor collections', function () {
  const rows = GcLab.sweep(plainTrace(), 'nursery', [256, 512, 1024, 1536, 2048, 4096],
    { mode: 'generational', capacity: 8192, barrier: 'card', cardBytes: 128 });

  assert.deepStrictEqual(rows.map(function (row) { return row.minor; }),
    [317, 141, 59, 37, 26, 12]);
  assert.deepStrictEqual(rows.map(function (row) { return row.p50; }),
    [23, 40, 60, 76, 88, 116]);
  assert.strictEqual(rows[0].gcWork, 8392);
  assert.strictEqual(rows[5].gcWork, 1340);
  rows.forEach(function (row) { assert.ok(row.correct); });
  support.quotes('generational-collection',
    ['317', '141', '59', '37', '26', '12', '8 392', '1 340']);
});

/* ------------------------------------------------------------- 31.5 */

test('figures: 2 000 interleavings lose 15 runs with no barrier and none with either',
  function () {
    const rows = GcIncremental.BARRIERS.map(function (barrier) {
      return GcIncremental.stress(makeHeap, HeapSim.reachable,
        { barrier: barrier.id, runs: 2000, seed: 11, objects: 12, stores: 6 });
    });

    assert.strictEqual(rows[0].lost, 15);
    assert.strictEqual(rows[0].lostObjects, 20);
    assert.strictEqual(rows[1].lost, 0);
    assert.strictEqual(rows[2].lost, 0);
    assert.strictEqual(rows[1].floating, 650);
    assert.strictEqual(rows[2].floating, 1521);
    assert.strictEqual(support.fixed(rows[2].floating / rows[1].floating, 2), '2.34');
    assert.strictEqual(support.fixed((rows[0].lost / rows[0].runs) * 100, 2), '0.75');
    support.quotes('incremental-collection',
      ['15', '20', '650', '1 521', '2.34', '2 000']);
  });

test('figures: 10 000 interleavings lose 76 runs and 98 objects with no barrier', function () {
  const rows = GcIncremental.BARRIERS.map(function (barrier) {
    return GcIncremental.stress(makeHeap, HeapSim.reachable,
      { barrier: barrier.id, runs: 10000, seed: 11, objects: 12, stores: 6 });
  });

  assert.strictEqual(rows[0].lost, 76);
  assert.strictEqual(rows[0].lostObjects, 98);
  assert.strictEqual(rows[1].lost, 0);
  assert.strictEqual(rows[2].lost, 0);
  assert.strictEqual(support.fixed((rows[0].lost / rows[0].runs) * 100, 2), '0.76');
  support.quotes('incremental-collection', ['76 of 10 000', '98', '0.76 per cent']);
});

test('figures: the hand-built fixture loses the value only with no barrier', function () {
  const rows = GcIncremental.BARRIERS.map(function (barrier) {
    return GcIncremental.runScenario(makeHeap, barrier.id);
  });

  assert.strictEqual(rows[0].survived, false);
  assert.strictEqual(rows[0].reclaimed.length, 1);
  assert.strictEqual(rows[0].shaded, 2);
  assert.strictEqual(rows[1].shaded, 3);
  assert.strictEqual(rows[2].shaded, 3);
  support.quotes('incremental-collection', ['1 object reclaimed', '2 objects shaded',
    '3 shaded']);
});

test('figures: the p50 is the slice exactly and the p99 is the sweep', function () {
  const rows = GcLab.sweep(plainTrace(), 'slice', [1, 8, 64],
    { mode: 'incremental', capacity: 8192, incrementalBarrier: 'update' });

  assert.deepStrictEqual(rows.map(function (row) { return row.p50; }), [1, 8, 64]);
  assert.deepStrictEqual(rows.map(function (row) { return row.value; }), [1, 8, 64]);
  assert.deepStrictEqual(rows.map(function (row) { return row.collections; }), [504, 82, 20]);
  assert.deepStrictEqual(rows.map(function (row) { return row.p99; }), [76, 100, 121]);
  assert.deepStrictEqual(rows.map(function (row) { return row.gcWork; }), [1188, 1227, 1209]);

  const spread = (Math.max(1188, 1227, 1209) - Math.min(1188, 1227, 1209)) / 1188;

  assert.ok(spread < 0.04, 'total work is flat within a few per cent: ' + spread);
  support.quotes('incremental-collection',
    ['504 collections', '82 collections', '20 collections', '76', '100', '121',
      '1 188', '1 227', '1 209']);
});

/* ------------------------------------------------------------- 31.6 */

test('figures: eight designs, and the three column winners are three designs', function () {
  const rows = GcLab.compare(mixedTrace(), { capacity: 8192, nursery: 1638, budget: 768,
    policy: 'garbage-first', candidates: 32 });
  const byMode = {};

  rows.forEach(function (row) { byMode[row.mode] = row; });
  assert.strictEqual(rows.length, 8);
  assert.strictEqual(byMode['mark-sweep'].p50, 371);
  assert.strictEqual(byMode['mark-sweep'].p99, 382);
  assert.strictEqual(support.fixed(byMode['mark-sweep'].throughput, 3), '0.667');
  assert.strictEqual(byMode['mark-compact'].p50, 460);
  assert.strictEqual(byMode['mark-compact'].p99, 471);
  assert.strictEqual(support.fixed(byMode['mark-compact'].throughput, 3), '0.621');
  assert.strictEqual(byMode.copying.p50, 178);
  assert.strictEqual(byMode.copying.p99, 186);
  assert.strictEqual(support.fixed(byMode.copying.throughput, 3), '0.816');
  assert.strictEqual(byMode.incremental.p50, 8);
  assert.strictEqual(byMode.incremental.p99, 101);
  rows.forEach(function (row) { assert.ok(row.correct); });

  const fastest = rows.reduce(function (top, row) { return row.p99 < top.p99 ? row : top; });
  const busiest = rows.reduce(function (top, row) {
    return row.throughput > top.throughput ? row : top;
  });
  const smallest = rows.reduce(function (top, row) { return row.peak < top.peak ? row : top; });

  assert.strictEqual(fastest.mode, 'refcount');
  assert.strictEqual(busiest.mode, 'copying');
  assert.strictEqual(smallest.mode, 'refcount-cycles');
  support.quotes('modern-collectors',
    ['371', '382', '0.667', '460', '471', '0.621', '178', '186', '0.816', '8', '101']);
});

test('figures: mark-compact costs 24 per cent more per collection than mark-sweep', function () {
  const rows = GcLab.compare(mixedTrace(), { capacity: 8192, nursery: 1638, budget: 768,
    candidates: 32 }, ['mark-sweep', 'mark-compact']);
  const extra = (rows[1].p50 / rows[0].p50 - 1) * 100;

  assert.strictEqual(Math.round(extra), 24);
  support.quotes('modern-collectors', ['24 per cent more']);
});

test('figures: garbage-first is exact on the real heap and 73 per cent on the built one',
  function () {
    const heap = HeapSim.build(mixedTrace(), undefined, { capacity: 65536 });
    const state = GcRegions.create({ regionBytes: 512, budget: 768 });

    GcRegions.partition(heap, state);
    const live = HeapSim.reachable(heap, heap.roots);
    const census = GcRegions.census(heap, live);
    const real = GcRegions.gap(census, 768, 'garbage-first');
    const realEmpty = GcRegions.gap(census, 768, 'emptiest-first');

    assert.strictEqual(real.reclaimed, 37760);
    assert.strictEqual(real.optimal, 37776);
    assert.strictEqual(support.fixed(real.ratio * 100, 1), '100.0');
    assert.strictEqual(realEmpty.reclaimed, 37320);
    assert.strictEqual(support.fixed(realEmpty.ratio * 100, 1), '98.8');

    const hard = GcRegions.adversarial();
    const hardGreedy = GcRegions.gap(hard, 100, 'garbage-first');
    const hardEmpty = GcRegions.gap(hard, 100, 'emptiest-first');

    assert.strictEqual(hardGreedy.reclaimed, 73);
    assert.strictEqual(hardGreedy.optimal, 100);
    assert.strictEqual(support.fixed(hardGreedy.ratio * 100, 1), '73.0');
    assert.strictEqual(hardEmpty.reclaimed, 62);
    assert.strictEqual(support.fixed(hardEmpty.ratio * 100, 1), '62.0');
    support.quotes('modern-collectors',
      ['37 760', '37 776', '100.0 per cent', '98.8', '73', '100', '73.0 per cent', '62.0']);
  });

test('figures: the region census is 90 regions with the best mixed ones at 31.00 down to 29.50',
  function () {
    const heap = HeapSim.build(mixedTrace(), undefined, { capacity: 65536 });
    const state = GcRegions.create({ regionBytes: 512 });

    GcRegions.partition(heap, state);
    const census = GcRegions.census(heap, HeapSim.reachable(heap, heap.roots));
    const mixed = census.filter(function (row) { return row.live > 0; })
      .sort(function (a, b) { return b.ratio - a.ratio; }).slice(0, 4);

    assert.strictEqual(census.length, 90);
    assert.deepStrictEqual(mixed.map(function (row) {
      return support.fixed(row.ratio, 2);
    }), ['31.00', '30.50', '30.00', '29.50']);
    support.quotes('modern-collectors', ['90 regions', '31.0', '30.5', '30.0', '29.5']);
  });
