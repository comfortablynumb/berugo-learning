'use strict';

/**
 * Every derivable figure in the M02 worked examples, recomputed here from the
 * example's own setup. Editing a setup without editing the arithmetic fails
 * the build rather than teaching a wrong number.
 */

const test = require('node:test');
const assert = require('node:assert');

const registries = require('../../src/js/content/registries.js');
require('../../src/js/content/examples-linear.js');

const MemoryModel = require('../../src/js/machines/memory-model.js');
const Linear = require('../../src/js/algorithms/linear-structures.js');
const CacheLayouts = require('../../src/js/algorithms/cache-layouts.js');
const Allocators = require('../../src/js/algorithms/allocators-basic.js');
const Random = require('../../src/js/utils/random.js');
const CacheSim = require('../../src/js/machines/cache-sim.js');
const CallStack = require('../../src/js/algorithms/call-stack.js');
const TextBuffers = require('../../src/js/algorithms/text-buffers.js');

const LINE = 64;

function example(sectionId) {
  const entries = registries.ExampleRegistry.get(sectionId);
  assert.ok(entries && entries[0], 'missing worked example for ' + sectionId);
  return entries[0];
}

function stepText(entry, index) {
  return entry.steps[index].work + '\n' + (entry.steps[index].result || '');
}

/* --------------------------------------------------------------- memory layout */

test('memory-layout: the stride and padding are what the layout rules give', function () {
  const entry = example('memory-layout');
  const fields = [
    { name: 'id', type: 'i32' }, { name: 'flag', type: 'u8' },
    { name: 'score', type: 'f64' }, { name: 'rank', type: 'i16' }
  ];
  const declared = MemoryModel.layout(fields);
  const packed = MemoryModel.packed(fields);

  assert.strictEqual(declared.stride, 24);
  assert.strictEqual(declared.padding, 9);
  assert.strictEqual(packed.stride, 16);
  assert.match(stepText(entry, 0), /Stride 24 bytes; 15 used, 9 padding/);
  assert.match(stepText(entry, 3), /24 to 16 bytes/);
});

test('memory-layout: the bandwidth and line counts follow from the stride', function () {
  const entry = example('memory-layout');
  const records = 1e6;

  assert.strictEqual(records * 8, 8e6, 'bytes the query actually wants');
  assert.strictEqual(records * 24, 24e6, 'bytes an AoS scan touches');
  assert.strictEqual(Math.round(((24 - 8) / 24) * 100), 67, 'waste percentage');
  assert.strictEqual(Math.round((records * 24) / LINE), 375000, 'AoS lines');
  assert.strictEqual(Math.round((records * 8) / LINE), 125000, 'SoA lines');

  assert.match(stepText(entry, 1), /24 MB/);
  assert.match(stepText(entry, 1), /67%/);
  assert.match(stepText(entry, 2), /375,000/);
  assert.match(stepText(entry, 2), /125,000/);
});

/* -------------------------------------------------------------- dynamic arrays */

test('dynamic-arrays: the copy totals come out of a real growth simulation', function () {
  const entry = example('dynamic-arrays');
  const simulate = function (factor) {
    let capacity = 1;
    let length = 0;
    let copies = 0;
    for (let i = 0; i < 1e6; i += 1) {
      if (length === capacity) {
        copies += length;
        capacity = Math.max(capacity + 1, Math.ceil(capacity * factor));
      }
      length += 1;
    }
    return { capacity: capacity, copies: copies };
  };

  const doubling = simulate(2);
  const half = simulate(1.5);

  assert.strictEqual(doubling.copies, 1048575, '2^20 - 1');
  assert.strictEqual(doubling.capacity, 1048576);
  assert.strictEqual(Number((doubling.copies / 1e6).toFixed(2)), 1.05);
  assert.strictEqual(half.copies, 2099719);
  assert.strictEqual(half.capacity, 1049868);
  assert.strictEqual(Number((half.copies / 1e6).toFixed(2)), 2.1);

  assert.match(stepText(entry, 0), /1,048,575/);
  assert.match(stepText(entry, 1), /2,099,719/);
  assert.match(stepText(entry, 1), /2\.10/);
  assert.match(stepText(entry, 2), /1,049,868/);
  assert.match(stepText(entry, 2), /49,868/);
  assert.match(entry.answer, /2\.10 per push/);
});

test('dynamic-arrays: the freed-block argument for factor 2 is exact', function () {
  const entry = example('dynamic-arrays');

  for (let k = 1; k <= 20; k += 1) {
    let freed = 0;
    for (let i = 0; i < k; i += 1) freed += Math.pow(2, i);
    assert.strictEqual(freed, Math.pow(2, k) - 1, 'the sum of everything freed');
    assert.ok(freed < Math.pow(2, k), 'is always one short of the next request');
  }

  assert.match(stepText(entry, 3), /2\^k − 1 < 2\^k/);
});

/* ---------------------------------------------------------------- linked lists */

test('linked-lists: footprints and line counts for a million integers', function () {
  const entry = example('linked-lists');
  const n = 1e6;

  assert.strictEqual(n * 4, 4e6, 'array bytes');
  assert.strictEqual(n * 8, 8e6, 'list bytes');
  assert.strictEqual(LINE / 4, 16, 'integers per line');
  assert.strictEqual(n / 16, 62500, 'array lines');
  assert.strictEqual(n / 62500, 16, 'the scattered worst case is 16x the lines');
  assert.strictEqual((n * 80) / 1e6, 80, 'milliseconds of serialised miss latency');

  assert.match(stepText(entry, 1), /62,500/);
  assert.match(stepText(entry, 2), /1,000,000/);
  assert.match(stepText(entry, 3), /80 ms/);
});

/* ------------------------------------------------------------ stacks and frames */

test('stacks-and-frames: the frame budget and both tree shapes', function () {
  const entry = example('stacks-and-frames');
  const frames = Math.floor((1024 * 1024) / 96);

  assert.strictEqual(frames, 10922);
  assert.ok(Math.log2(1e15) < frames, 'no balanced tree that fits in memory comes close');
  assert.strictEqual(1e6 * 8, 8e6, 'the explicit stack for a million levels');

  assert.match(stepText(entry, 0), /10,922/);
  assert.match(stepText(entry, 2), /10,922/);
  assert.match(stepText(entry, 3), /8 MB/);
});

/* ------------------------------------------------------------ queues and rings */

test('queues-and-rings: the capacity, the drain time and the policy arithmetic', function () {
  const entry = example('queues-and-rings');

  const excess = 25000 - 12000;
  const burst = excess * 0.2;
  assert.strictEqual(excess, 13000);
  assert.strictEqual(burst, 2600);
  assert.strictEqual(Linear.nextPowerOfTwo(burst + 1), 4096, 'rounded up for masking');
  assert.strictEqual(4096 - 1, 4095, 'one slot distinguishes full from empty');
  assert.strictEqual(burst / (12000 - 10000), 1.3, 'seconds to drain');

  const over = 5000 - 4095;
  assert.strictEqual(over, 905, 'items a 5 000-item burst cannot hold');
  assert.strictEqual(Number((over / 2000).toFixed(2)), 0.45, 'seconds a blocking producer stalls');

  assert.match(stepText(entry, 1), /2,600/);
  assert.match(stepText(entry, 2), /4,096/);
  assert.match(stepText(entry, 3), /905/);
  assert.match(stepText(entry, 3), /0\.45 s/);
  assert.match(stepText(entry, 4), /1\.3 s/);
});

/* --------------------------------------------------------- batching pipelines */

test('batching-pipelines: total time, memory and latency at each batch size', function () {
  const entry = example('batching-pipelines');
  const rows = 100000;
  const stages = 3;
  const workMs = (rows * stages * 0.4) / 1000;
  const overheadMs = function (batch) { return Math.ceil(rows / batch) * stages * 1; };

  assert.strictEqual(workMs, 120);
  assert.strictEqual(overheadMs(1), 300000);
  assert.strictEqual(overheadMs(500), 600);
  assert.strictEqual(overheadMs(5000), 60);
  assert.strictEqual(workMs + overheadMs(500), 720);
  assert.strictEqual(workMs + overheadMs(5000), 180);
  assert.strictEqual(workMs + overheadMs(50000), 126);
  assert.strictEqual(720 / 180, 4, 'the first ten-fold step');
  assert.strictEqual(Number((180 / 126).toFixed(1)), 1.4, 'the second');

  assert.strictEqual((2 * 5000 * 200) / 1e6, 2, 'MB in flight at batch 5 000');
  assert.strictEqual((2 * 50000 * 200) / 1e6, 20, 'MB at batch 50 000');
  assert.strictEqual(5000 * stages, 15000, 'row-stages before the first result');
  assert.strictEqual(180 - 126, 54, 'milliseconds the larger batch saves');

  assert.match(stepText(entry, 0), /120 ms/);
  assert.match(stepText(entry, 2), /720 ms/);
  assert.match(stepText(entry, 3), /2 MB peak/);
  assert.match(entry.answer, /54 ms/);
});

/* ------------------------------------------------------------ pools and arenas */

test('pools-and-arenas: the fragmentation figures match a real first-fit heap', function () {
  const entry = example('pools-and-arenas');
  const heap = Allocators.createFirstFit({ bytes: 65536 });
  const large = [];

  const pairs = Math.floor(65536 / (64 + 256));
  for (let i = 0; i < pairs; i += 1) {
    assert.ok(heap.allocate(64), 'small block ' + i);
    large.push(heap.allocate(256));
  }

  assert.strictEqual(pairs, 204);
  assert.strictEqual(pairs * 64 + pairs * 256, 65280, 'bytes in use');

  large.forEach(function (handle) { heap.free(handle); });
  const state = heap.fragmentation();

  assert.strictEqual(65536 - 65280, 256, 'the tail the pairs could not fill');
  assert.strictEqual(state.freeBytes, 204 * 256 + 256, '52 480 bytes free');
  assert.strictEqual(state.largestFree, 512, 'the last block coalesced with the tail');
  assert.strictEqual(Number(state.ratio.toFixed(3)), 0.99);
  assert.strictEqual(heap.allocate(1024), null, 'a 1 KB request fails');

  assert.match(stepText(entry, 0), /65,280/);
  assert.match(stepText(entry, 1), /52,480/);
  assert.match(stepText(entry, 2), /0\.990/);
});

/* ---------------------------------------------------------------- text buffers */

test('text-buffers: the bytes each structure moves for the stated workload', function () {
  const entry = example('text-buffers');
  const size = 1048576;
  const edits = 350;

  assert.strictEqual(edits * size, 367001600, 'a naive string copies the document each time');
  assert.strictEqual(Math.round((edits * size) / 1e6), 367, 'MB');

  const meanJump = Math.round(size / 3);          // mean |x - y| for two uniform points
  assert.strictEqual(meanJump, 349525);
  assert.strictEqual(Math.round((50 * meanJump) / 1e5) / 10, 17.5, 'MB of gap movement');

  const depth = Math.round(Math.log2(1e6 / 64));
  assert.strictEqual(depth, 14);
  assert.strictEqual(Math.round((edits * depth * 64) / 1000), 314, 'KB copied by the rope');

  assert.match(stepText(entry, 0), /367 MB/);
  assert.match(stepText(entry, 1), /349,525/);
  assert.match(stepText(entry, 3), /≈ 14/);
});

/* --------------------------------------------------------------- cache layouts */

test('cache-layouts: the quoted measurements are what the module actually reports', function () {
  const entry = example('cache-layouts');
  const result = CacheLayouts.compare({
    n: 65536, queries: 400, blockSize: 16, cacheLines: 512, rng: Random.seeded(7)
  });
  const byName = {};
  result.layouts.forEach(function (layout) { byName[layout.name] = layout; });

  const round = function (value, places) { return Number(value.toFixed(places)); };

  assert.strictEqual(round(byName.sorted.missesPerQuery, 2), 4.33);
  assert.strictEqual(round(byName.eytzinger.missesPerQuery, 2), 3.46);
  assert.strictEqual(round(byName.blocked.missesPerQuery, 2), 1.57);
  assert.strictEqual(round(byName.sorted.cacheLinesPerQuery, 1), 11.9);
  assert.strictEqual(round(byName.eytzinger.cacheLinesPerQuery, 1), 12.0);
  assert.strictEqual(round(byName.blocked.cacheLinesPerQuery, 1), 9.0);
  assert.strictEqual(round(byName.sorted.comparisonsPerQuery, 1), 15.0);
  assert.strictEqual(round(byName.blocked.comparisonsPerQuery, 1), 20.8);

  assert.strictEqual(round(byName.sorted.missesPerQuery / byName.blocked.missesPerQuery, 1), 2.8);
  assert.match(stepText(entry, 2), /4\.33/);
  assert.match(stepText(entry, 3), /3\.46/);
  assert.match(stepText(entry, 4), /1\.57/);
  assert.match(entry.answer, /2\.8x/);
});

test('cache-layouts: the residency derivations behind those measurements hold', function () {
  const entry = example('cache-layouts');
  const cacheLines = 512;

  let sortedLevels = 0;
  while (Math.pow(2, sortedLevels + 1) - 1 <= cacheLines) sortedLevels += 1;
  assert.strictEqual(sortedLevels, 9, 'levels 0..8 of a sorted binary search fit');

  let eytzingerLevels = 0;
  while (Math.pow(2, eytzingerLevels + 1) / 16 <= cacheLines) eytzingerLevels += 1;
  assert.strictEqual(eytzingerLevels, 13, 'levels 0..12 of an eytzinger tree fit');

  const separatorBytes = (65536 / 16) * 4;
  assert.strictEqual(separatorBytes, 16384);
  assert.ok(separatorBytes < cacheLines * LINE, 'the whole separator level is resident');

  assert.match(stepText(entry, 2), /k <= 8/);
  assert.match(stepText(entry, 3), /k <= 12/);
  assert.match(stepText(entry, 4), /16 KB/);
});

/* ==========================================================================
   The second worked example in each section: measured with the same modules
   the demos use, so the two cannot drift apart.
   ========================================================================== */

function secondExample(sectionId) {
  const entries = registries.ExampleRegistry.get(sectionId);
  assert.ok(entries && entries[1], 'missing second worked example for ' + sectionId);
  return entries[1];
}

function bodyText(entry) {
  return entry.steps.map(function (step) {
    return step.work + '\n' + (step.result || '');
  }).join('\n') + '\n' + entry.answer;
}

function quotes(entry, fragments) {
  const text = bodyText(entry);
  fragments.forEach(function (fragment) {
    assert.ok(text.indexOf(fragment) !== -1, 'the example no longer quotes "' + fragment + '"');
  });
}

const RECORD_FIELDS = [
  { name: 'id', type: 'i32' }, { name: 'flag', type: 'u8' },
  { name: 'score', type: 'f64' }, { name: 'rank', type: 'i16' }
];

test('memory-layout: AoS and SoA each win one of the two access patterns', function () {
  const entry = secondExample('memory-layout');
  const count = 50000;

  function sequential(soa) {
    const records = Linear.createRecordArray({ fields: RECORD_FIELDS, count: count, soa: soa });
    for (let i = 0; i < count; i += 1) records.set(i, 'score', i);
    return records.sumField('score');
  }

  const aos = sequential(false);
  const soa = sequential(true);

  assert.strictEqual(aos.cacheMisses, 18750);
  assert.strictEqual(aos.bytesFetched, 1200000);
  assert.strictEqual(soa.cacheMisses, 6251);
  assert.strictEqual(soa.bytesFetched, 400064);
  assert.strictEqual((aos.cacheMisses / soa.cacheMisses).toFixed(1), '3.0');
  assert.strictEqual((64 / 24).toFixed(2), '2.67', 'scores per line under AoS');
  assert.strictEqual((8 / (64 / 24)).toFixed(1), '3.0', 'the stride ratio predicts it');

  quotes(entry, ['AoS: 18,750 misses, 1,200,000 bytes fetched', 'SoA:  6,251 misses,   400,064 bytes fetched',
    '64/24 = 2.67 scores per line']);
});

test('memory-layout: random whole-record reads reverse the ranking', function () {
  const entry = secondExample('memory-layout');
  const count = 50000;
  const stride = 24;
  const offsets = { id: 0, flag: 4, score: 8, rank: 16 };
  const widths = { id: 4, flag: 1, score: 8, rank: 2 };
  const columns = { id: 0, flag: 4 * count, score: 5 * count, rank: 13 * count };

  function randomWhole(soa) {
    const cache = CacheSim.create({ lines: 512, lineBytes: 64 });
    const rng = Random.seeded(11);
    for (let k = 0; k < 5000; k += 1) {
      const index = rng.int(count);
      ['id', 'flag', 'score', 'rank'].forEach(function (field) {
        cache.access(soa ? columns[field] + index * widths[field] : index * stride + offsets[field]);
      });
    }
    return cache.stats();
  }

  const aos = randomWhole(false);
  const soa = randomWhole(true);

  assert.strictEqual(aos.misses, 6034);
  assert.strictEqual((aos.misses / 5000).toFixed(2), '1.21');
  assert.strictEqual(aos.bytesFetched, 386176);
  assert.strictEqual(soa.misses, 18522);
  assert.strictEqual((soa.misses / 5000).toFixed(2), '3.70');
  assert.strictEqual(soa.bytesFetched, 1185408);
  assert.strictEqual((soa.misses / aos.misses).toFixed(1), '3.1');

  const plan = MemoryModel.layout(RECORD_FIELDS);
  assert.strictEqual(plan.stride, 24);
  assert.strictEqual(plan.padding, 9);
  assert.strictEqual((plan.padding / plan.stride * 100).toFixed(1), '37.5', 'dead bytes per AoS line');

  quotes(entry, ['AoS:  6,034 misses = 1.21 per record,   386,176 bytes',
    'SoA: 18,522 misses = 3.70 per record, 1,185,408 bytes', 'AoS carries 37.5% dead bytes']);
});

test('dynamic-arrays: the shift cost of middle inserts', function () {
  const entry = secondExample('dynamic-arrays');
  const n = 1e6;
  const operations = 100000;

  assert.strictEqual(n / 2, 500000, 'average shift');
  assert.strictEqual(operations * (n / 2), 5e10, 'total element moves');
  assert.strictEqual(operations * (n / 2) * 4 / 1e9, 200, 'GB of traffic at 4 bytes an element');
  assert.strictEqual(operations * (n / 2) / operations, 5e5, 'ratio to appending');
  assert.strictEqual(operations * (n / 2) / n, 50000, 'ratio to one compaction pass');

  quotes(entry, ['5.0 × 10¹⁰ element moves', '200 GB of memory traffic', '50,000× fewer']);
});

test('linked-lists: move-to-front costs, both structures', function () {
  const entry = secondExample('linked-lists');

  assert.strictEqual(1e6 * 5e5, 5e11, 'array element moves over a million hits');
  assert.strictEqual(1e6 * 6, 6e6, 'list pointer writes over a million hits');
  assert.strictEqual(2 + 4, 6, 'unlink plus push-front');
  assert.strictEqual(5e11 / 6e6 > 80000, true, 'five orders of magnitude apart');
  assert.strictEqual((8 + 4) / 4, 3, 'node overhead against a bare value');

  quotes(entry, ['1,000,000 hits × 500,000 = 5.0 × 10¹¹ element moves',
    '1,000,000 hits × 6 = 6.0 × 10⁶ pointer writes', '8 bytes of links per 4-byte value = 3× the memory']);
});

test('stacks-and-frames: what each traversal keeps live', function () {
  const entry = secondExample('stacks-and-frames');

  const balanced = CallStack.compare({ count: 4095, shape: 'balanced', maxDepth: 20000 });
  const degenerate = CallStack.compare({ count: 4095, shape: 'degenerate', maxDepth: 20000 });

  assert.strictEqual(balanced.recursive.peakDepth, 12);
  assert.strictEqual(balanced.recursive.peakBytes, 1152);
  assert.strictEqual(balanced.iterative.peakBytes, 96);
  assert.strictEqual(balanced.recursive.peakBytes / balanced.iterative.peakBytes, 12);
  assert.strictEqual(balanced.sameOrder, true);

  assert.strictEqual(degenerate.recursive.peakDepth, 4095);
  assert.strictEqual(degenerate.recursive.peakBytes, 393120);
  assert.strictEqual(degenerate.iterative.peakDepth, 1, 'a right spine accumulates nothing');
  assert.strictEqual(degenerate.iterative.peakBytes, 8);
  assert.strictEqual(degenerate.recursive.peakBytes / degenerate.iterative.peakBytes, 49140);
  assert.strictEqual(degenerate.sameOrder, true);

  assert.strictEqual(Math.floor(1048576 / 96), 10922);
  assert.strictEqual(Math.floor(1048576 / 8), 131072);
  assert.strictEqual(Math.ceil(Math.log2(4096)), 12, 'balanced depth at 4 095 nodes');
  assert.strictEqual(Math.ceil(Math.log2(1e9)), 30, 'and at a billion');

  const guarded = CallStack.recursiveInOrder(CallStack.buildTree({ count: 4095, shape: 'degenerate' }),
    { maxDepth: 1000 });
  assert.strictEqual(guarded.overflowed, true);
  assert.strictEqual(guarded.peakDepth, 1000, 'the guard fires where it was set');

  quotes(entry, ['12 × 96 B = 1,152 B', '4,095 × 96 B = 393,120 B', 'peak stack = 1 entry = 8 bytes',
    'ratio to recursion: 49,140×', '1 MiB / 96 B    = 10,922 frames']);
});

test('queues-and-rings: Little\'s law and the 1/(1 - rho) term', function () {
  const entry = secondExample('queues-and-rings');
  const mu = 12000;

  function queue(lambda) {
    const rho = lambda / mu;
    const length = rho / (1 - rho);
    return { rho: rho, length: length, waitMs: length / lambda * 1000 };
  }

  const design = queue(10000);
  const stressed = queue(11400);

  assert.strictEqual(design.rho.toFixed(3), '0.833');
  assert.strictEqual(design.length.toFixed(2), '5.00');
  assert.strictEqual(design.waitMs.toFixed(2), '0.50');

  assert.strictEqual(stressed.rho.toFixed(3), '0.950');
  assert.strictEqual(stressed.length.toFixed(2), '19.00');
  assert.strictEqual(stressed.waitMs.toFixed(2), '1.67');
  assert.strictEqual((stressed.length / design.length).toFixed(1), '3.8');
  assert.strictEqual((stressed.waitMs / design.waitMs).toFixed(1), '3.3');
  assert.strictEqual(((11400 / 10000 - 1) * 100).toFixed(0), '14', 'the extra load');

  const saturated = queue(0.99 * mu);
  assert.strictEqual(Math.round(saturated.length), 99);
  assert.strictEqual(saturated.waitMs.toFixed(1), '8.3');
  assert.strictEqual(Math.round(saturated.length / design.length), 20);
  assert.strictEqual(Math.round(saturated.waitMs / design.waitMs), 17);
  assert.strictEqual(Math.round((0.99 / 0.833 - 1) * 100), 19, 'for 19% more throughput');
  assert.strictEqual(Math.round(2048 / saturated.length), 21, 'the ring against the 99% queue');

  quotes(entry, ['L = 0.833/0.167 = 5.00 items', 'W = 1.67 ms', 'ρ = 0.99 ⇒ L = 99 items, W = 8.3 ms']);
});

test('batching-pipelines: throughput and latency from the same two terms', function () {
  const entry = secondExample('batching-pipelines');
  const rows = 100000;
  const perRow = 0.4e-6;
  const stages = 3;
  const commit = 1e-3;

  function run(batch) {
    return {
      total: rows * perRow * stages + (rows / batch) * commit * stages,
      first: (batch * perRow * stages + commit * stages) * 1000
    };
  }

  assert.strictEqual(run(1).total.toFixed(2), '300.12');
  assert.strictEqual(run(1).first.toFixed(2), '3.00');
  assert.strictEqual(run(100).total.toFixed(2), '3.12');
  assert.strictEqual(run(100).first.toFixed(2), '3.12');
  assert.strictEqual(run(1000).total.toFixed(2), '0.42');
  assert.strictEqual(run(1000).first.toFixed(2), '4.20');
  assert.strictEqual(run(10000).total.toFixed(2), '0.15');
  assert.strictEqual(run(10000).first.toFixed(2), '15.00');

  const floor = rows * perRow * stages;
  assert.strictEqual(floor.toFixed(2), '0.12', 'the row work alone');
  assert.strictEqual((run(1000).total / floor).toFixed(1), '3.5');
  assert.strictEqual((run(10000).total / floor).toFixed(2), '1.25');
  assert.strictEqual((run(100000).total / floor).toFixed(2), '1.03');
  assert.strictEqual(run(100000).first.toFixed(0), '123', 'and 123 ms to the first row');
  assert.strictEqual(Math.round(run(1).total / run(10000).total), 2001, 'throughput gain');

  quotes(entry, ['batch      1: total 300.12 s', 'batch 10,000: total   0.15 s',
    'row work alone = 100,000 × 0.4 µs × 3 = 0.12 s']);
});

test('pools-and-arenas: first-fit fragments where an arena cannot', function () {
  const entry = secondExample('pools-and-arenas');
  const sizes = [24, 40, 56, 88];

  const heap = Allocators.createFirstFit({ bytes: 65536 });
  const rng = Random.seeded(3);
  let liveBytes = 0;
  let failedAt = -1;

  for (let request = 0; request < 200 && failedAt < 0; request += 1) {
    const live = [];
    for (let i = 0; i < 20; i += 1) {
      const size = rng.pick(sizes);
      const handle = heap.allocate(size);
      if (!handle) { failedAt = request; break; }
      live.push({ handle: handle, size: size });
    }
    if (failedAt >= 0) break;
    live.forEach(function (entry2, i) {
      if (i % 2 === 0) heap.free(entry2.handle); else liveBytes += entry2.size;
    });
  }

  assert.strictEqual(failedAt, 122);
  assert.strictEqual(liveBytes, 62736);
  assert.strictEqual(heap.stats().allocations, 2450);
  assert.strictEqual(heap.stats().frees, 1220);

  const free = heap.blocks().filter(function (block) { return block.free; });
  assert.strictEqual(free.length, 190);
  assert.strictEqual(free.reduce(function (sum, block) { return sum + block.bytes; }, 0), 2208);
  assert.strictEqual(Math.max.apply(null, free.map(function (block) { return block.bytes; })), 48);
  assert.ok(48 >= 24 && 48 < 88, 'a small request still fits and a large one does not');

  const arena = Allocators.createBumpAllocator({ bytes: 65536 });
  const arenaRng = Random.seeded(3);
  for (let request = 0; request < 200; request += 1) {
    for (let i = 0; i < 20; i += 1) arena.allocate(arenaRng.pick(sizes));
    arena.reset();
  }
  assert.strictEqual(arena.stats().allocations, 4000);
  assert.strictEqual(arena.stats().resets, 200);
  assert.strictEqual(arena.stats().failed, 0);
  assert.strictEqual(arena.stats().peak, 1280);

  quotes(entry, ['request 122 fails to allocate', 'live at failure: 62,736 of 65,536 bytes',
    'free blocks: 190', 'largest free block: 48 bytes', 'peak in use: 1,280 bytes']);
});

test('text-buffers: moving the edits inverts the ranking', function () {
  const entry = secondExample('text-buffers');
  const initial = 'x'.repeat(100000);

  function run(scattered) {
    const rng = Random.seeded(7);
    const script = [];
    for (let i = 0; i < 300; i += 1) {
      script.push({ op: 'insert', at: scattered ? rng.int(100000) : 50000 + i, text: 'a' });
    }
    return TextBuffers.compare({ initial: initial, script: script });
  }

  const focused = run(false);
  const scattered = run(true);

  assert.strictEqual(focused.agree, true);
  assert.strictEqual(scattered.agree, true);

  assert.strictEqual(focused.gap.moved, 100000);
  assert.strictEqual(focused.piece.moved, 0);
  assert.strictEqual(focused.piece.pieces, 302);
  assert.strictEqual(focused.rope.copied, 15100014);
  assert.strictEqual(focused.rope.rebuilds, 10);

  assert.strictEqual(scattered.gap.moved, 9529894);
  assert.strictEqual(scattered.piece.moved, 0);
  assert.strictEqual(scattered.piece.pieces, 599);
  assert.strictEqual(scattered.rope.copied, 1091224);

  assert.strictEqual(Math.round(scattered.gap.moved / focused.gap.moved), 95, 'the gap buffer gets worse');
  assert.strictEqual(Math.round(focused.rope.copied / scattered.rope.copied), 14, 'the rope gets better');
  assert.strictEqual(Math.round(focused.rope.copied / 100000), 151, 'the rope copies the file 151 times');

  quotes(entry, ['gap buffer:  100,000 characters moved', 'rope:      15,100,014 characters copied',
    'gap buffer:   9,529,894 characters moved   (95× worse than before)',
    'rope:         1,091,224 copied, 0 rebuilds     (14× better than before)', '599 pieces']);
});

test('cache-layouts: the crossover is the cache size', function () {
  const entry = secondExample('cache-layouts');

  function misses(n) {
    const result = CacheLayouts.compare({ n: n, queries: 500, rng: Random.seeded(4) });
    const out = {};
    result.layouts.forEach(function (layout) { out[layout.name] = layout; });
    return out;
  }

  const small = misses(1024);
  const half = misses(4096);
  const twice = misses(16384);
  const large = misses(65536);

  assert.strictEqual(small.sorted.missesPerQuery.toFixed(3), '0.128');
  assert.strictEqual(small.eytzinger.missesPerQuery.toFixed(3), '0.128');
  assert.strictEqual(small.blocked.missesPerQuery.toFixed(3), '0.136');
  assert.ok(small.blocked.missesPerQuery > small.sorted.missesPerQuery,
    'inside the cache the blocked layout is slightly worse');

  assert.strictEqual(half.sorted.missesPerQuery.toFixed(3), '0.504');
  assert.strictEqual(half.eytzinger.missesPerQuery.toFixed(3), '0.464');
  assert.strictEqual(half.blocked.missesPerQuery.toFixed(3), '0.456');

  assert.strictEqual(twice.sorted.missesPerQuery.toFixed(3), '1.926');
  assert.strictEqual(twice.eytzinger.missesPerQuery.toFixed(3), '1.370');
  assert.strictEqual(twice.blocked.missesPerQuery.toFixed(3), '0.924');
  assert.strictEqual((twice.sorted.missesPerQuery / twice.blocked.missesPerQuery).toFixed(1), '2.1');

  assert.strictEqual(large.sorted.missesPerQuery.toFixed(3), '4.472');
  assert.strictEqual(large.eytzinger.missesPerQuery.toFixed(3), '3.452');
  assert.strictEqual(large.blocked.missesPerQuery.toFixed(3), '1.478');
  assert.strictEqual((large.sorted.missesPerQuery / large.blocked.missesPerQuery).toFixed(1), '3.0');

  assert.strictEqual(large.sorted.comparisonsPerQuery.toFixed(2), '15.03');
  assert.strictEqual(large.blocked.comparisonsPerQuery.toFixed(2), '20.86');
  assert.strictEqual(Math.round((20.86 / 15.03 - 1) * 100), 39, '39% more comparisons');
  assert.strictEqual(1024 * 4, 4096, 'n = 1024 is 4 KiB against a 32 KiB cache');

  quotes(entry, ['sorted 0.128 · eytzinger 0.128 · blocked 0.136 misses/query',
    'n = 16,384 (64 KiB): 1.926 · 1.370 · 0.924',
    'n = 65,536 (256 KiB): sorted 4.472 · eytzinger 3.452 · blocked 1.478',
    'sorted 15.03 · eytzinger 15.03 · blocked 20.86']);
});
