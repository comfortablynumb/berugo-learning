'use strict';

/**
 * Every figure the M37 worked examples and reference tables quote, recomputed.
 *
 * The content was written from what `tools/section-dump.js` printed, and this
 * suite is what stops it drifting afterwards. A milestone whose prose and
 * simulator disagree is worse than one with no prose: the reader has no way to
 * tell which of the two is wrong, and the numbers are the only reason to
 * believe any of it.
 *
 * Each test rebuilds the fixture the section builds, from the same modules and
 * the same settings, and asserts the number the page prints. Where a figure is
 * arithmetic done in the prose - a ratio, a cost per million accesses - the
 * arithmetic is done here too, from the measured inputs rather than from the
 * quoted output, so that a change in the model moves both together or fails.
 */

const test = require('node:test');
const assert = require('node:assert');

const Cache = require('../../src/js/machines/memory/cache.js');
const Hierarchy = require('../../src/js/machines/memory/hierarchy.js');
const Tlb = require('../../src/js/machines/memory/tlb.js');
const Dram = require('../../src/js/machines/memory/dram.js');
const Numa = require('../../src/js/machines/memory/numa.js');
const ThreeCs = require('../../src/js/algorithms/three-cs.js');
const Prefetchers = require('../../src/js/algorithms/prefetchers.js');
const Microbench = require('../../src/js/algorithms/cache-microbench.js');
const Matrix = require('../../src/js/algorithms/matrix-blocking.js');
const CacheView = require('../../src/js/viz/cache-view.js');

const SIZES = [1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144, 524288,
  1048576, 2097152, 4194304, 8388608, 16777216];
const L1 = { name: 'L1d', sets: 64, ways: 8, lineBytes: 64, hitCycles: 4 };
const SMALL = { sets: 16, ways: 4, lineBytes: 64, hitCycles: 4 };
const ORGANISATION = { sets: 64, ways: 8, lineBytes: 64, hitCycles: 4 };

function round(value, places) {
  return Number(value.toFixed(places));
}

function ladder(pattern, options) {
  return Microbench.ladder(Object.assign({ sizes: SIZES, pattern: pattern, passes: 4,
    seed: 2 }, options || {}));
}

function cyclesAt(curve, bytes) {
  return round(curve.filter(function (row) { return row.bytes === bytes; })[0].cycles, 1);
}

function walkRun(config, step, count, passes) {
  const cache = Cache.create(config);

  for (let pass = 0; pass < passes; pass += 1) {
    for (let at = 0; at < count; at += 1) Cache.access(cache, { address: at * step });
  }
  return { cache: cache, summary: Cache.summary(cache) };
}

/* ------------------------------------------------------------------- 37.1 */

test('37.1 example 1: three capacities recovered from timing alone', function () {
  const curve = ladder('chase');
  const steps = Microbench.steps(curve);

  assert.strictEqual(cyclesAt(curve, 32768), 4, '4.0 cycles up to 32 KiB');
  assert.strictEqual(cyclesAt(curve, 524288), 18, 'then 18.0 to 512 KiB');
  assert.strictEqual(cyclesAt(curve, 8388608), 63, 'then 63.0 to 8 MiB');
  assert.strictEqual(cyclesAt(curve, 16777216), 313, 'then 313.0');
  assert.deepStrictEqual(steps.map(function (step) { return step.capacity; }),
    [32768, 524288, 8388608], 'three steps, and the size BELOW each one is the capacity');
  assert.deepStrictEqual(steps.map(function (step) { return round(step.ratio, 2); }),
    [4.5, 3.5, 4.97], 'at 4.50x, 3.50x and 4.97x');
  assert.deepStrictEqual(steps.map(function (step) { return step.capacity; }),
    Hierarchy.PRESET.map(function (level) {
      return level.sets * level.ways * level.lineBytes;
    }), 'all three exact against the configuration the harness was never given');
});

test('37.1 example 1: a flat stretch is the whole cost, not the level hit time', function () {
  const preset = Hierarchy.PRESET;
  const curve = ladder('chase');

  assert.strictEqual(cyclesAt(curve, 524288),
    preset[0].hitCycles + preset[1].hitCycles, '18.0 at L2 is 4 (L1 miss) + 14 (L2 hit)');
  assert.strictEqual(cyclesAt(curve, 8388608),
    preset[0].hitCycles + preset[1].hitCycles + preset[2].hitCycles, 'and 63.0 is 4 + 14 + 45');
});

test('37.1 example 2: the ratios, and what a 5% miss rate costs', function () {
  const curve = ladder('chase');
  const hit = cyclesAt(curve, 32768);
  const dram = cyclesAt(curve, 16777216);
  const ratios = [hit, cyclesAt(curve, 524288), cyclesAt(curve, 8388608), dram]
    .map(function (cycles) { return round(cycles / hit, 1); });

  assert.deepStrictEqual(ratios, [1, 4.5, 15.8, 78.3], '1.0x, 4.5x, 15.8x and 78.3x');
  assert.strictEqual(1000000 * hit, 4000000, 'a million L1 hits is 4,000,000 cycles');
  const mixed = 0.95 * hit + 0.05 * dram;

  assert.strictEqual(round(mixed, 2), 19.45, 'a 5% miss rate averages 19.45 cycles');
  assert.strictEqual(Math.round(10 * mixed) / 10, 19.5, 'which the page prints as 19.5');
  assert.strictEqual(Math.round(1000000 * mixed), 19450000, 'so a million costs 19,450,000');
  assert.strictEqual(round((1000000 * mixed - 4000000) / 1000000, 2), 15.45,
    'and the misses are worth 15.45 instruction removals');
  assert.ok(round((1000000 * mixed - 4000000) / (1000000 * mixed), 2) >= 0.79,
    'which is about 80% of the total cycles for one access in twenty');
});

/* ------------------------------------------------------------------- 37.2 */

test('37.2 example 1: the address splits, and every set-span apart address collides',
  function () {
    const cache = Cache.create(SMALL);
    const parts = Cache.decode(cache, 0x1234);

    assert.strictEqual(parts.offset, 52, 'offset 52 of 64');
    assert.strictEqual(parts.index, 8, 'index 8 of 16');
    assert.strictEqual(parts.tag, 4, 'tag 4');
    assert.strictEqual(SMALL.sets * SMALL.lineBytes, 1024,
      'and every address 16 x 64 = 1024 bytes apart lands in the same set');
    [1, 2, 9].forEach(function (step) {
      assert.strictEqual(Cache.decode(cache, 0x1234 + step * 1024).index, 8,
        'including the one ' + step + ' spans away');
    });
  });

test('37.2 example 1: the same 32 lines, and a hit rate that falls off a cliff', function () {
  const spread = walkRun(ORGANISATION, 64, 32, 3).summary;
  const broken = walkRun(ORGANISATION, 2048, 32, 3).summary;

  assert.strictEqual(round(100 * spread.hitRate, 1), 66.7, '66.7% at a 64-byte stride');
  assert.strictEqual(spread.misses, 32, '32 misses');
  assert.strictEqual(spread.accesses, 96, 'of 96 accesses');
  assert.strictEqual(round(100 * broken.hitRate, 1), 0, '0.0% at 2048 bytes');
  assert.strictEqual(broken.misses, 96, 'every access a miss, on the same data');
});

test('37.2 example 1: a 4 KiB cache holding 256 bytes', function () {
  const run = walkRun(SMALL, 4096, 64, 4);
  const resident = Cache.resident(run.cache);
  const spread = CacheView.spread(run.cache, resident);

  assert.strictEqual(spread.used, 1, '1 set of 16 occupied');
  assert.strictEqual(spread.sets, 16, 'out of sixteen');
  assert.strictEqual(run.summary.capacity, 4096, 'a 4 KiB cache');
  assert.strictEqual(resident.length * SMALL.lineBytes, 256, 'holding 256 bytes');
});

test('37.2 example 2: associativity is a cliff with the capacity held fixed', function () {
  const rows = [1, 8, 16].map(function (ways) {
    const sets = Math.max(1, Math.round(512 / ways));
    const run = walkRun({ sets: sets, ways: ways, lineBytes: 64 }, 4096, 16, 4);

    return { ways: ways, sets: sets, hitRate: round(100 * run.summary.hitRate, 1),
      used: CacheView.spread(run.cache, Cache.resident(run.cache)).used };
  });

  assert.deepStrictEqual(rows[0], { ways: 1, sets: 512, hitRate: 0, used: 8 },
    'direct-mapped: 0.0%, and 8 of 512 sets in use');
  assert.deepStrictEqual(rows[1], { ways: 8, sets: 64, hitRate: 0, used: 1 },
    'eight ways: still 0.0%, and now 1 of 64 sets');
  assert.deepStrictEqual(rows[2], { ways: 16, sets: 32, hitRate: 75, used: 1 },
    'sixteen ways: 75.0% - everything, all at once');
});

test('37.2 example 2: line size is a smooth trade, and this walk loses it', function () {
  const rows = [16, 64, 256].map(function (lineBytes) {
    const sets = Math.max(1, Math.round(32768 / (8 * lineBytes)));
    const cache = Cache.create({ sets: sets, ways: 8, lineBytes: lineBytes });

    for (let at = 0; at < 256; at += 1) Cache.access(cache, { address: at * 64 });
    const misses = Cache.summary(cache).misses;

    return { lineBytes: lineBytes, misses: misses, fetched: misses * lineBytes };
  });

  assert.strictEqual(rows[0].misses, 256, '16 B lines: 256 misses');
  assert.strictEqual(rows[0].fetched, 4096, 'and 4096 B fetched');
  assert.strictEqual(rows[2].misses, 64, '256 B lines: 64 misses');
  assert.strictEqual(rows[2].fetched, 16384, 'and 16384 B fetched');
  assert.strictEqual(round(rows[0].fetched / 2048, 1), 2, 'against 2048 B used: 2.0x waste');
  assert.strictEqual(round(rows[2].fetched / 2048, 1), 8, 'rising to 8.0x');
});

/* ------------------------------------------------------------------- 37.3 */

function trafficFor(trace, write, allocate) {
  const cache = Cache.create(Object.assign({}, SMALL, { write: write, allocate: allocate }));

  trace.forEach(function (entry) { Cache.access(cache, entry); });
  return Cache.summary(cache).trafficOut;
}

function writeTrace(lines, times) {
  const out = [];

  for (let at = 0; at < lines * times; at += 1) {
    out.push({ address: (at % lines) * 64, write: true });
  }
  return out;
}

test('37.3 example 1: no write policy wins both workloads', function () {
  const hot = writeTrace(4, 250);
  const streaming = writeTrace(1000, 1);

  assert.strictEqual(trafficFor(hot, 'writeBack', 'writeAllocate'), 4,
    '4 transactions for 1000 writes to four lines');
  assert.strictEqual(trafficFor(hot, 'writeThrough', 'writeAllocate'), 1000,
    '1000 under write-through - a factor of 250');
  assert.strictEqual(trafficFor(streaming, 'writeBack', 'writeAllocate'), 1936,
    '1936 for a thousand streaming writes that each fetch first');
  assert.strictEqual(trafficFor(streaming, 'writeBack', 'noWriteAllocate'), 1000,
    'and 1000 when they do not - the fetch was pure waste');
  assert.strictEqual(1936 - 1000, 936, 'which is 936 lines fetched and overwritten in full');
});

function scanHits(policy, scan) {
  const cache = Cache.create({ sets: 1, ways: 8, lineBytes: 64, replacement: policy,
    seed: 3 });
  let hits = 0;

  for (let pass = 0; pass < 20; pass += 1) {
    for (let rep = 0; rep < 2; rep += 1) {
      for (let at = 0; at < 4; at += 1) {
        if (Cache.access(cache, { address: at * 64 }).hit) hits += 1;
      }
    }
    for (let at = 0; at < scan; at += 1) Cache.access(cache, { address: 100000 + at * 64 });
  }
  return hits;
}

test('37.3 example 2: scan resistance, measured until it runs out', function () {
  assert.strictEqual(scanHits('lru', 4), 156, 'a scan of 4 disturbs nothing: LRU 156 of 160');
  assert.strictEqual(scanHits('rrip', 4), 156, 'and RRIP 156');
  assert.strictEqual(scanHits('lru', 8), 80, 'a scan of 8 costs LRU half the working set');
  assert.strictEqual(scanHits('rrip', 8), 156, 'and costs RRIP nothing');
  assert.strictEqual(scanHits('lru', 12), 80, 'at 12 LRU is unchanged');
  assert.strictEqual(scanHits('rrip', 12), 84, 'and most of RRIP\'s advantage is gone');
  assert.strictEqual(scanHits('rrip', 16), 80, 'at 16 the two are identical');
  assert.strictEqual(scanHits('lru', 16), 80,
    'the counter has four values, so the protection is finite by construction');
});

test('37.3 example 2: past the bound every deterministic policy agrees, and random is worse',
  function () {
    ['lru', 'plru', 'fifo', 'rrip'].forEach(function (policy) {
      assert.strictEqual(scanHits(policy, 48), 80, policy + ' holds 80 of 160 at a scan of 48');
    });
    assert.strictEqual(scanHits('random', 48), 63,
      'and random holds 63 - worse, because it sometimes evicts between the two references');
  });

/* ------------------------------------------------------------------- 37.4 */

function naiveClassification() {
  return ThreeCs.classify(Matrix.naive({ n: 64 }).trace, L1);
}

test('37.4 example 1: 41,992 misses in three categories that sum exactly', function () {
  const found = naiveClassification();

  assert.strictEqual(found.accesses, 786432, '786,432 accesses');
  assert.strictEqual(found.misses, 41992, 'and 41,992 misses');
  assert.strictEqual(round(100 * (1 - found.hitRate), 2), 5.34, 'a 5.34% miss rate');
  assert.strictEqual(found.counts.compulsory, 1536, '1,536 compulsory');
  assert.strictEqual(found.counts.capacity, 8064, '8,064 capacity');
  assert.strictEqual(found.counts.conflict, 32392, '32,392 conflict');
  assert.strictEqual(found.counts.compulsory + found.counts.capacity + found.counts.conflict,
    41992, '1,536 + 8,064 + 32,392 = 41,992, exactly');
  assert.strictEqual(found.dominant.key, 'conflict', 'so the fix is the layout');
});

test('37.4 example 1: the shares the page prints', function () {
  const rows = {};

  naiveClassification().rows.forEach(function (row) {
    rows[row.key] = round(100 * row.share, 1);
  });
  assert.strictEqual(rows.compulsory, 3.7, 'compulsory is 3.7% of the misses');
  assert.strictEqual(rows.capacity, 19.2, 'capacity 19.2%');
  assert.strictEqual(rows.conflict, 77.1, 'and conflict 77.1% - three quarters');
});

test('37.4 example 2: the AMAT recursion, checked against the run', function () {
  const hierarchy = Hierarchy.create({});

  Hierarchy.replay(hierarchy, Matrix.naive({ n: 64 }).trace);
  const found = Hierarchy.summary(hierarchy);
  const levels = found.levels;

  assert.strictEqual(found.dramCycles, 250, 'AMAT(DRAM) = 250 cycles');
  assert.strictEqual(round(levels[2].amat, 2), 295, 'L3: 45 + 1.00 x 250 = 295.00');
  assert.strictEqual(round(100 * levels[1].missRate, 2), 3.61, 'L2 misses 3.61% locally');
  assert.strictEqual(round(levels[1].amat, 2), 24.66, 'so 14 + 0.0361 x 295.00 = 24.66');
  assert.strictEqual(round(100 * levels[0].missRate, 2), 5.34, 'L1 misses 5.34%');
  assert.strictEqual(round(levels[0].amat, 2), 5.32, 'so 4 + 0.0534 x 24.66 = 5.32');
  assert.strictEqual(round(found.measured, 2), 5.32, 'and the run accumulated 5.32 - they agree');
  assert.strictEqual(round(100 * levels[0].hitRate, 1), 94.7, '94.7% never leave L1');
});

/* ------------------------------------------------------------------- 37.5 */

const BLOCKING = { levels: [L1], dramCycles: 200 };

function tripsFor(kind, options) {
  const built = Matrix[kind](options);
  const hierarchy = Hierarchy.create(BLOCKING);

  Hierarchy.replay(hierarchy, built.trace);
  const summary = Hierarchy.summary(hierarchy);

  return { trips: summary.dramAccesses, cycles: round(summary.measured, 2),
    accesses: summary.accesses, three: ThreeCs.classify(built.trace, L1).counts };
}

test('37.5 example 1: three loop nests, 13.67x fewer trips to memory', function () {
  const naive = tripsFor('naive', { n: 64 });
  const interchanged = tripsFor('interchanged', { n: 64 });
  const blocked = tripsFor('blocked', { n: 64, tile: 16 });

  assert.strictEqual(naive.accesses, 786432, 'every version does 786,432 accesses');
  assert.strictEqual(interchanged.accesses, naive.accesses, 'the same arithmetic');
  assert.strictEqual(blocked.accesses, naive.accesses, 'in a different order');
  assert.strictEqual(naive.trips, 41992, 'naive: 41,992 trips');
  assert.deepStrictEqual(naive.three, { compulsory: 1536, capacity: 8064, conflict: 32392 },
    '1,536 compulsory, 8,064 capacity, 32,392 conflict');
  assert.strictEqual(interchanged.trips, 9551, 'interchanged: 9,551 trips');
  assert.strictEqual(round(naive.trips / interchanged.trips, 2), 4.4, '4.40x fewer');
  assert.strictEqual(interchanged.three.conflict, 0, 'and the conflict column is now 0');
  assert.strictEqual(interchanged.three.capacity, 8015, 'with capacity dominant at 8,015');
});

test('37.5 example 1: the tile rule, and what blocking leaves behind', function () {
  const blocked = tripsFor('blocked', { n: 64, tile: 16 });
  const naive = tripsFor('naive', { n: 64 });
  const capacity = L1.sets * L1.ways * L1.lineBytes;

  assert.strictEqual(Matrix.tileFor(capacity, 8), 36, '3 x t x t x 8 <= 32768 gives t = 36');
  assert.strictEqual(blocked.trips, 3072, 'blocked at tile 16: 3,072 trips');
  assert.deepStrictEqual(blocked.three, { compulsory: 1536, capacity: 1536, conflict: 0 },
    '1,536 compulsory, 1,536 capacity, 0 conflict');
  assert.strictEqual(round(naive.trips / blocked.trips, 2), 13.67, '41,992 to 3,072 is 13.67x');
  assert.strictEqual(naive.cycles, 14.68, 'and 14.68 cycles per access');
  assert.strictEqual(blocked.cycles, 4.78, 'down to 4.78');
});

test('37.5 example 1: the calculated tile is close, and the sweep is still worth running',
  function () {
    const calculated = tripsFor('blocked', { n: 64, tile: 36 }).trips;
    const best = [4, 8, 12, 16, 24, 32, 40, 48].map(function (tile) {
      return { tile: tile, trips: tripsFor('blocked', { n: 64, tile: tile }).trips };
    }).sort(function (left, right) { return left.trips - right.trips; })[0];

    assert.strictEqual(best.tile, 40, 'the sweep picks 40');
    assert.strictEqual(best.trips, 2998, 'at 2,998 trips');
    assert.strictEqual(calculated, 3292, 'against 3,292 at the calculated size of 36');
  });

test('37.5 example 2: padding, and where the technique stops applying', function () {
  const span = L1.sets * L1.lineBytes;
  const stride = 64 * 8;

  assert.strictEqual(span, 4096, 'the set span is 64 x 64 = 4096 B');
  assert.strictEqual(span / stride, 8, 'and the 512 B row stride divides it 8 times');
  assert.strictEqual(Matrix.layout({ n: 64, pad: 0 }).stride, stride, 'which is the stride');
  assert.strictEqual(Matrix.layout({ n: 64, pad: 1 }).stride, 520, 'padding makes it 520 B');

  const plain = tripsFor('naive', { n: 64 });
  const padded = [1, 2, 4, 8].map(function (pad) {
    return tripsFor('naive', { n: 64, pad: pad });
  });

  assert.strictEqual(plain.trips, 41992, '41,992 trips unpadded');
  assert.strictEqual(padded[0].trips, 16792, 'and 16,792 with one element of padding');
  assert.strictEqual(round(plain.trips / padded[0].trips, 2), 2.5, '2.50x fewer');
  assert.deepStrictEqual(padded.map(function (row) { return row.trips; }),
    [16792, 19856, 23982, 9151], 'and more padding is not monotonically better');
  padded.forEach(function (row, at) {
    assert.strictEqual(row.three.conflict, 0, 'every padded row has 0 conflict misses (' + at + ')');
  });
});

test('37.5 example 2: padding a version with no conflicts left is faintly harmful', function () {
  const blocked = tripsFor('blocked', { n: 64, tile: 16 });
  const both = tripsFor('blocked', { n: 64, tile: 16, pad: 1 });

  assert.strictEqual(blocked.trips, 3072, '3,072 trips blocked');
  assert.strictEqual(both.trips, 3144, 'becomes 3,144 blocked and padded');
  assert.strictEqual(blocked.three.conflict, 0, 'there were no conflicts to remove');
  assert.ok(both.three.compulsory > blocked.three.compulsory,
    'and the padding is still data that has to be touched once');
});

/* ------------------------------------------------------------------- 37.6 */

function tlbAt(bytes, options) {
  const tlb = Tlb.create(Object.assign({ entries: 64 }, options || {}));
  const found = Tlb.replay(tlb, Microbench.pointerChase({ bytes: bytes, passes: 3,
    seed: 2 }).trace);

  return { hitRate: round(100 * found.summary.hitRate, 1), perAccess: round(found.perAccess, 1),
    reach: found.summary.reach };
}

test('37.6 example 1: the knee lands on the reach, exactly', function () {
  assert.strictEqual(Tlb.reach(Tlb.create({ entries: 64 })), 262144,
    '64 x 4 KiB = 256 KiB');
  [65536, 131072, 262144].forEach(function (bytes) {
    assert.strictEqual(tlbAt(bytes).hitRate, 99.5, bytes + ' bytes: 99.5%');
  });
  assert.strictEqual(tlbAt(524288).hitRate, 49.7, '49.7% at 512 KiB');
  assert.strictEqual(tlbAt(1048576).hitRate, 24.6, 'and 24.6% at 1024 KiB');
});

test('37.6 example 1: a walk is a pointer chase, and that is what the cliff costs',
  function () {
    const tlb = Tlb.create({ entries: 64 });
    const miss = Tlb.translate(tlb, 0);

    assert.strictEqual(miss.cycles, 4 * 30 + 1, 'one miss is 4 x 30 + 1 = 121 cycles');
    const far = tlbAt(1048576);
    const near = tlbAt(65536);

    assert.strictEqual(round(0.246 * 1 + 0.754 * 121, 1), 91.5,
      '0.246 x 1 + 0.754 x 121 = 91.5 cycles per access');
    assert.strictEqual(far.perAccess, 91.5, 'which is what the run measures at 4.00x the reach');
    assert.strictEqual(near.perAccess, 1.6, 'against 1.6 below it');
    assert.strictEqual(Math.round(far.perAccess / near.perAccess), 57, 'a factor of 57');
  });

test('37.6 example 2: huge pages raise the reach and fix nothing else', function () {
  const huge = tlbAt(1048576, { hugePages: true });

  assert.strictEqual(huge.reach, 64 * 2 * 1024 * 1024, '64 x 2 MiB = 128 MiB of reach');
  assert.strictEqual(huge.reach / 262144, 512, 'against 256 KiB - 512 times as much');
  assert.strictEqual(huge.hitRate, 100, '100.0% hit rate on the 1 MiB working set');
  assert.strictEqual(huge.perAccess, 1, 'at 1.0 cycle per access, against 91.5');
  assert.strictEqual(1048576 / (L1.sets * L1.ways * L1.lineBytes), 32,
    'and the same 1 MiB still exceeds a 32 KiB L1 by 32x, which no page size changes');
});

function switchRun(asids) {
  const tlb = Tlb.create({ entries: 64 });

  Tlb.switchTo(tlb, 1);
  for (let page = 0; page < 16; page += 1) Tlb.translate(tlb, page * 4096);
  Tlb.switchTo(tlb, 2, { asids: asids });
  const survivors = tlb.entries.size;
  const before = tlb.counters.walks;
  let cycles = 0;

  Tlb.switchTo(tlb, 1, { asids: asids });
  for (let page = 0; page < 16; page += 1) {
    cycles += Tlb.translate(tlb, page * 4096).cycles;
  }
  return { survivors: survivors, walks: tlb.counters.walks - before, cycles: cycles };
}

test('37.6 example 2: identifiers are what survive a context switch', function () {
  assert.deepStrictEqual(switchRun(true), { survivors: 16, walks: 0, cycles: 16 },
    '16 entries survive and nothing is walked again');
  assert.deepStrictEqual(switchRun(false), { survivors: 0, walks: 16, cycles: 1936 },
    'against 0 survivors, 16 walks and 1,936 cycles of pure re-translation');
});

/* ------------------------------------------------------------------- 37.7 */

function prefetchRows(trace, settings) {
  const rows = {};

  Prefetchers.compare(trace, { cache: SMALL,
    prefetcher: Object.assign({ degree: 1, distance: 4, confidence: 2 }, settings || {}) })
    .forEach(function (row) { rows[row.kind] = row; });
  return rows;
}

function stridedTrace() {
  return Microbench.strided({ step: 192, count: 256, passes: 2 }).trace;
}

function randomTrace() {
  return Microbench.randomAccess({ bytes: 1048576, count: 4096, seed: 5 }).trace;
}

test('37.7 example 1: three prefetchers, and only one worth having', function () {
  const rows = prefetchRows(stridedTrace());

  assert.strictEqual(rows.none.demandMisses, 512, 'the baseline takes 512 misses');
  assert.strictEqual(rows.none.traffic, 512, 'for 512 lines of traffic');
  assert.strictEqual(rows.nextLine.demandMisses, 512, 'next-line removes none of them');
  assert.strictEqual(rows.nextLine.prefetched, 512, 'having issued 512 prefetches');
  assert.strictEqual(round(100 * rows.nextLine.accuracy, 0), 0, 'at 0% accuracy');
  assert.strictEqual(round(100 * rows.nextLine.coverage, 0), 0, 'and 0% coverage');
  assert.strictEqual(rows.stride.demandMisses, 8, 'stride leaves 8 misses');
  assert.strictEqual(rows.stride.prefetched, 506, 'for 506 prefetches');
  assert.strictEqual(round(100 * rows.stride.accuracy, 0), 100, 'at 100% accuracy');
  assert.strictEqual(round(100 * rows.stride.coverage, 0), 98, '98% coverage');
  assert.strictEqual(rows.stride.traffic, 514, 'and 514 lines of traffic');
});

test('37.7 example 1: the best coverage on the page is a net loss', function () {
  const rows = prefetchRows(stridedTrace());

  assert.strictEqual(rows.stream.demandMisses, 4, 'stream leaves 4 misses');
  assert.strictEqual(rows.stream.prefetched, 1532, 'for 1,532 prefetches');
  assert.strictEqual(round(100 * rows.stream.coverage, 0), 99, '99% coverage');
  assert.strictEqual(round(100 * rows.stream.accuracy, 0), 33, 'at 33% accuracy');
  assert.strictEqual(rows.stream.traffic, 1536, 'and 1,536 lines of traffic');
  assert.strictEqual(rows.stream.traffic - rows.stride.traffic, 1022,
    '1,022 extra lines against the stride design');
  assert.strictEqual(rows.stride.demandMisses - rows.stream.demandMisses, 4,
    'to remove four more misses');
  assert.strictEqual(rows.stride.covered, 504, 'while stride removed 504 misses');
  assert.strictEqual(rows.stride.traffic - rows.none.traffic, 2, 'for 2 extra lines');
  assert.match(Prefetchers.verdict(rows.stream, rows.none), /net loss/, 'which is a net loss');
});

test('37.7 example 2: the confidence counter, and a prefetcher right to do nothing',
  function () {
    const noise = [1, 2, 3].map(function (confidence) {
      return prefetchRows(randomTrace(), { confidence: confidence }).stride;
    });
    const real = [1, 2, 3].map(function (confidence) {
      return prefetchRows(stridedTrace(), { confidence: confidence }).stride;
    });

    noise.forEach(function (row, at) {
      assert.strictEqual(row.prefetched, 0,
        'at threshold ' + (at + 1) + ' the random pattern issues nothing at all');
      assert.strictEqual(round(100 * row.coverage, 0), 0, 'and covers 0%');
    });
    assert.deepStrictEqual(real.map(function (row) { return row.prefetched; }),
      [508, 506, 504], '508, 506 and 504 issued on the strided fixture');
    assert.deepStrictEqual(real.map(function (row) { return round(100 * row.coverage, 0); }),
      [99, 98, 98], 'at 99%, 98% and 98% coverage');
  });

test('37.7 example 2: a design with no confidence mechanism fires on the noise', function () {
  const nextLine = prefetchRows(randomTrace()).nextLine;

  assert.strictEqual(nextLine.prefetched, 4073, '4,073 lines issued on the random fixture');
  assert.strictEqual(nextLine.usedPrefetches, 4, 'of which four are ever used');
});

/* ------------------------------------------------------------------- 37.8 */

function dramStream(name, settings) {
  if (name === 'sequential') return Microbench.stream({ bytes: 65536, passes: 1 }).trace;
  const out = [];

  for (let at = 0; at < 512; at += 1) {
    out.push({ address: at * 64 });
    out.push({ address: (1 << 20) + at * 64 });
  }
  return out;
}

function dramRun(name, settings) {
  const dram = Dram.create(settings);

  return Dram.replay(dram, dramStream(name, settings));
}

test('37.8 example 1: reordering doubles the throughput without new hardware', function () {
  const fcfs = dramRun('twoStreams', { policy: 'fcfs', queue: 16 });
  const frfcfs = dramRun('twoStreams', { policy: 'frfcfs', queue: 16 });

  assert.strictEqual(round(100 * fcfs.rowHitRate, 1), 0, 'FCFS: 0.0% row hits');
  assert.strictEqual(round(fcfs.throughput, 1), 31.4, 'at 31.4 lines per thousand cycles');
  assert.strictEqual(round(100 * frfcfs.rowHitRate, 1), 48.4, 'FR-FCFS: 48.4% row hits');
  assert.strictEqual(frfcfs.rowHits, 496, '496 of the requests');
  assert.strictEqual(frfcfs.requests, 1024, 'out of 1,024');
  assert.strictEqual(round(frfcfs.throughput, 1), 64.5, 'and 64.5 throughput');
  assert.strictEqual(round(frfcfs.throughput / fcfs.throughput, 2), 2.05, '2.05x');
});

test('37.8 example 1: a policy needs something to reorder', function () {
  const fcfs = dramRun('twoStreams', { policy: 'fcfs', queue: 1 });
  const frfcfs = dramRun('twoStreams', { policy: 'frfcfs', queue: 1 });

  assert.strictEqual(round(100 * fcfs.rowHitRate, 1), 0, 'both 0.0% row hits at a depth of 1');
  assert.strictEqual(round(100 * frfcfs.rowHitRate, 1), 0, 'the same algorithm');
  assert.strictEqual(round(fcfs.throughput, 1), 22.3, 'and 22.3 throughput');
  assert.strictEqual(round(frfcfs.throughput, 1), 22.3, 'identical');
});

test('37.8 example 1: what the depth buys and what it costs', function () {
  const rows = [1, 2, 4, 8, 16].map(function (queue) {
    return dramRun('twoStreams', { policy: 'frfcfs', queue: queue });
  });

  assert.deepStrictEqual(rows.map(function (row) { return round(row.throughput, 1); }),
    [22.3, 32.9, 51.9, 64.3, 64.5], 'throughput 22.3, 32.9, 51.9, 64.3, 64.5');
  assert.deepStrictEqual(rows.map(function (row) { return row.worstWait; }),
    [45, 90, 150, 270, 510], 'and the worst wait 45, 90, 150, 270, 510');
});

test('37.8 example 2: banks hide activation and cannot hide the transfer', function () {
  const rows = [1, 2, 4, 8, 16].map(function (banks) {
    return dramRun('twoStreams', { banks: banks, queue: 16 });
  });

  assert.strictEqual(round(100 * rows[0].rowHitRate, 1), 92.2, 'one bank: 92.2% row hits');
  assert.strictEqual(rows[0].elapsed, 17745, '17,745 cycles elapsed');
  assert.strictEqual(round(rows[0].throughput, 1), 57.7, 'and 57.7 throughput');
  assert.strictEqual(rows[1].elapsed, 16905, 'two banks: 16,905 cycles');
  assert.strictEqual(round(rows[1].throughput, 1), 60.6, 'and 60.6');
  assert.deepStrictEqual(rows.slice(2).map(function (row) { return round(row.throughput, 1); }),
    [64.2, 64.5, 64.5], 'four, eight and sixteen: 64.2, 64.5, then no change at all');
  assert.deepStrictEqual([2, 3].map(function (at) {
    return round(rows[at].throughput / rows[0].throughput, 2);
  }), [1.11, 1.12], 'which is 1.11x and 1.12x against one bank');
  assert.strictEqual(round(100 * rows[3].rowHitRate, 1), 48.4,
    'and the row-hit rate falls from 92.2% to 48.4% on the way, which is the job');
});

test('37.8 example 2: which address bits pick the bank is worth 5% on a sequential stream',
  function () {
    const spread = dramRun('sequential', { interleave: 'bankFirst', queue: 16 });
    const packed = dramRun('sequential', { interleave: 'rowFirst', queue: 16 });

    assert.strictEqual(round(spread.throughput, 1), 66.2, 'bank-first 66.2');
    assert.strictEqual(round(packed.throughput, 1), 63.2, 'against row-first 63.2');
  });

/* ------------------------------------------------------------------- 37.9 */

test('37.9 example 1: the parallel-for that nobody wrote wrong, costing 1.38x', function () {
  const wrong = Numa.parallelFor(Numa.create({ nodes: 2 }), { pages: 64, initialiser: 0 });
  const right = Numa.parallelFor(Numa.create({ nodes: 2 }), { pages: 64, initialiser: null });

  assert.deepStrictEqual(wrong.spread, { 0: 64 }, 'all 64 pages placed on node 0');
  assert.strictEqual(round(100 * wrong.steady.locality, 1), 50, '50.0% locality');
  assert.strictEqual(wrong.steady.local, 128, '128 of the 256 worker accesses local');
  assert.strictEqual(wrong.steady.accesses, 256, 'out of 256');
  assert.strictEqual(round(wrong.steady.average, 1), 110,
    '0.5 x 80 + 0.5 x 140 = 110.0 cycles');
  assert.deepStrictEqual(right.spread, { 0: 32, 1: 32 }, '32 pages on each node when fixed');
  assert.strictEqual(round(100 * right.steady.locality, 1), 100, '100.0% locality');
  assert.strictEqual(round(right.steady.average, 1), 80, 'at 80.0 cycles per access');
  assert.strictEqual(round(wrong.steady.average / right.steady.average, 2), 1.38, '1.38x');
});

test('37.9 example 1: interleaving is not the fix', function () {
  const spread = Numa.parallelFor(Numa.create({ nodes: 2, policy: 'interleave' }),
    { pages: 64, initialiser: 0 });

  assert.strictEqual(round(100 * spread.steady.locality, 1), 50, 'the same 50.0% locality');
  assert.strictEqual(round(spread.steady.average, 1), 110, 'and the same 110.0 cycles');
});

test('37.9 example 2: migration has to know when not to move', function () {
  const idle = Numa.handoff(Numa.create({ nodes: 2 }), { pages: 16, rounds: 40 });
  const moving = Numa.handoff(Numa.create({ nodes: 2, migrate: true }),
    { pages: 16, rounds: 40 });
  const sharedIdle = Numa.alternating(Numa.create({ nodes: 2 }), { pages: 8, rounds: 20 });
  const shared = Numa.alternating(Numa.create({ nodes: 2, migrate: true }),
    { pages: 8, rounds: 20 });

  assert.strictEqual(round(100 * idle.steady.locality, 1), 0, 'a handoff is 0.0% local');
  assert.strictEqual(round(100 * moving.steady.locality, 1), 80, 'migration makes it 80.0%');
  assert.strictEqual(moving.migrations, 16, 'with 16 migrations - one per page');
  assert.strictEqual(round(100 * sharedIdle.locality, 1), 50, 'alternating is 50.0% either way');
  assert.strictEqual(round(100 * shared.locality, 1), 50, 'and migration does not change it');
  assert.strictEqual(shared.migrations, 0, 'because it correctly refuses to move anything');
  assert.strictEqual(Numa.DEFAULTS.migrateAfter, 8,
    'the run counter resets on every access from the other node, so it never reaches 8');
});

/* ------------------------------------------------------------------ 37.10 */

test('37.10 example 1: four numbers about the machine, from a timer', function () {
  const steps = Microbench.steps(ladder('chase'));

  assert.deepStrictEqual(steps.map(function (step) {
    return [step.capacity, round(step.ratio, 2)];
  }), [[32768, 4.5], [524288, 3.5], [8388608, 4.97]],
  'steps at 32 KiB (4.50x), 512 KiB (3.50x) and 8 MiB (4.97x)');

  const assoc = Microbench.discoverAssociativity({ stride: 64 * 64, limit: 32 });

  assert.strictEqual(assoc.associativity, 8, 'the associativity is 8 - exact');
  assert.strictEqual(assoc.failedAt, 9, 'and k = 9 is where it broke');
});

test('37.10 example 1: the conflict set, and the line size', function () {
  const levels = [Object.assign({}, Hierarchy.PRESET[0], { ways: 8, sets: 64 })];
  const missed = [8, 9].map(function (lines) {
    const hierarchy = Hierarchy.create({ levels: levels });
    let count = 0;

    for (let pass = 0; pass < 4; pass += 1) {
      for (let at = 0; at < lines; at += 1) {
        if (Hierarchy.access(hierarchy, { address: at * 64 * 64 }).level > 0 && pass > 0) {
          count += 1;
        }
      }
    }
    return count;
  });

  assert.strictEqual(missed[0], 0, 'k = 1 through 8 all hit');
  assert.strictEqual(missed[1], 27, 'and k = 9 misses 27 times');

  const strides = [8, 16, 32, 64, 128].map(function (stride) {
    const cache = Cache.create(ORGANISATION);

    for (let at = 0; at < 262144 / stride; at += 1) {
      Cache.access(cache, { address: at * stride });
    }
    return Cache.summary(cache).misses;
  });

  assert.deepStrictEqual(strides, [4096, 4096, 4096, 4096, 2048],
    '4,096 misses at 8, 16, 32 and 64 B; 2,048 at 128 B - the knee is the 64-byte line');
});

test('37.10 example 2: each confounder produces a plausible curve and a wrong answer',
  function () {
    const ordered = ladder('ordered');
    const stream = ladder('stream');
    const cold = ladder('chase', { warm: false });

    assert.strictEqual(Microbench.steps(ordered).length, 0, 'an ordered chase finds no steps');
    assert.strictEqual(cyclesAt(ordered, 16777216), 4,
      'flat at 4.0 cycles even at 16 MiB: "it all fits in L1"');
    assert.strictEqual(Microbench.steps(stream).length, 0, 'a sequential walk finds none');
    assert.strictEqual(cyclesAt(stream, 16777216), 1, 'flat at 1.0');
    assert.ok(cyclesAt(stream, 16777216) < Hierarchy.PRESET[0].hitCycles,
      'below the L1 hit latency, which no latency can be - the one confounder that announces '
        + 'itself');
    assert.deepStrictEqual([cyclesAt(cold, 1024), cyclesAt(cold, 65536),
      cyclesAt(cold, 1048576), cyclesAt(cold, 16777216)], [81.3, 91.8, 125.5, 313],
    'including the first pass lifts every point to 81.3, 91.8, 125.5, 313.0');
    assert.strictEqual(Microbench.steps(cold).length, 2,
      'and only 2 of the 3 steps still clear the threshold');
  });
