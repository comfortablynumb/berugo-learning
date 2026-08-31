'use strict';

/**
 * The five M37 machines, checked against something that is not themselves.
 * The algorithms and views built on them are in `cache-algorithms.test.js`.
 *
 * Two checks carry this suite and the rest is detail.
 *
 * The first is inclusion. An inclusive hierarchy that forgets to invalidate
 * upwards still returns correct data and still reports plausible hit rates -
 * the only visible consequence is that the invariant every coherence protocol
 * in M38 is built on has quietly stopped holding. So it is asserted directly:
 * every line resident in a level is resident in every level below it, in the
 * one geometry where the rule has anything to do.
 *
 * The second is that the mechanisms which are supposed to differ actually do.
 * Four of the defects this milestone found were controls with no effect - RRIP
 * that scored identically to LRU, a row-hit counter pinned to zero, eight DRAM
 * banks that behaved like one, and a pseudo-LRU whose bits pointed at the way
 * it had just touched - and every one of them was invisible in a suite that
 * only checked totals. Each now has a test that fails if the mechanism is
 * removed.
 */

const test = require('node:test');
const assert = require('node:assert');

const Cache = require('../../src/js/machines/memory/cache.js');
const Hierarchy = require('../../src/js/machines/memory/hierarchy.js');
const Tlb = require('../../src/js/machines/memory/tlb.js');
const Dram = require('../../src/js/machines/memory/dram.js');
const Numa = require('../../src/js/machines/memory/numa.js');
const Microbench = require('../../src/js/algorithms/cache-microbench.js');
const Matrix = require('../../src/js/algorithms/matrix-blocking.js');
const DramView = require('../../src/js/viz/dram-timeline-view.js');

const SMALL = { sets: 16, ways: 4, lineBytes: 64, hitCycles: 4 };
const POLICIES = ['lru', 'plru', 'fifo', 'random', 'rrip'];

function run(cache, trace) {
  trace.forEach(function (entry) {
    Cache.access(cache, typeof entry === 'number' ? { address: entry } : entry);
  });
  return Cache.summary(cache);
}

function walk(step, count, passes, write) {
  const out = [];

  for (let pass = 0; pass < passes; pass += 1) {
    for (let at = 0; at < count; at += 1) out.push({ address: at * step, write: write });
  }
  return out;
}

function strideRun(config, step, count, passes) {
  return run(Cache.create(config), walk(step, count, passes));
}

/* ------------------------------------------------------ cache: the divisions */

test('cache decode: the three fields put the address back together', function () {
  const shapes = [SMALL, { sets: 64, ways: 8, lineBytes: 64 },
    { sets: 1, ways: 32, lineBytes: 16 }, { sets: 512, ways: 1, lineBytes: 128 }];

  shapes.forEach(function (shape) {
    const cache = Cache.create(shape);

    [0, 1, 63, 0x1234, 4096, 1048577, 16777215].forEach(function (address) {
      const parts = Cache.decode(cache, address);
      const rebuilt = (parts.tag * shape.sets + parts.index) * shape.lineBytes + parts.offset;

      assert.strictEqual(rebuilt, address, 'address ' + address + ' survives the decomposition');
      assert.ok(parts.offset < shape.lineBytes, 'the offset is within a line');
      assert.ok(parts.index < shape.sets, 'the index is within the set count');
      assert.strictEqual(parts.line, Cache.lineOf(cache, address), 'lineOf agrees');
    });
  });
});

test('cache decode: the index is the middle bits, so a set-span stride hits one set',
  function () {
    const cache = Cache.create(SMALL);
    const span = SMALL.sets * SMALL.lineBytes;
    const indexes = [0, 1, 2, 7, 40].map(function (k) {
      return Cache.decode(cache, 0x800 + k * span).index;
    });

    indexes.forEach(function (index) {
      assert.strictEqual(index, indexes[0], 'every set-span apart address shares the set');
    });
  });

test('cache probe: asking changes nothing at all', function () {
  const cache = Cache.create(SMALL);

  run(cache, walk(64, 40, 2));
  const before = JSON.stringify(Cache.summary(cache));
  const resident = JSON.stringify(Cache.resident(cache));
  const answers = [];

  for (let address = 0; address < 4096; address += 64) {
    answers.push(Cache.probe(cache, address).hit);
  }
  assert.strictEqual(JSON.stringify(Cache.summary(cache)), before, 'no counter moved');
  assert.strictEqual(JSON.stringify(Cache.resident(cache)), resident, 'no line moved');
  assert.ok(answers.some(Boolean), 'and it still answered something');
});

test('cache: the counters reconcile and the sets never overflow', function () {
  POLICIES.forEach(function (policy) {
    const cache = Cache.create(Object.assign({}, SMALL, { replacement: policy }));
    const summary = run(cache, walk(64, 200, 3, true));

    assert.strictEqual(summary.hits + summary.misses, summary.accesses,
      policy + ': every access is a hit or a miss');
    assert.strictEqual(summary.readMisses + summary.writeMisses, summary.misses,
      policy + ': every miss is a read or a write');
    assert.strictEqual(summary.capacity, SMALL.sets * SMALL.ways * SMALL.lineBytes,
      policy + ': the capacity is the product of the three');
    cache.sets.forEach(function (set) {
      assert.ok(set.lines.length <= SMALL.ways, policy + ': no set holds more than its ways');
    });
  });
});

test('cache: an eviction happens exactly when a full set takes a new line', function () {
  POLICIES.forEach(function (policy) {
    const cache = Cache.create({ sets: 1, ways: 4, lineBytes: 64, replacement: policy,
      seed: 3 });
    const summary = run(cache, walk(64, 12, 1));

    assert.strictEqual(summary.misses, 12, policy + ': twelve distinct lines all miss');
    assert.strictEqual(summary.evictions, 8, policy + ': and eight of them displaced someone');
    assert.strictEqual(cache.sets[0].lines.length, 4, policy + ': four survive');
  });
});

/* ------------------------------------------------------ cache: organisation */

test('cache: a stride of one line spreads, a stride of the set span does not', function () {
  const spread = strideRun(SMALL, 64, 32, 3);
  const span = strideRun(SMALL, SMALL.sets * SMALL.lineBytes, 32, 3);

  assert.strictEqual(spread.accesses, 96, 'the same 96 accesses in both runs');
  assert.strictEqual(span.accesses, 96, 'and the same amount of data');
  assert.strictEqual(Number((100 * spread.hitRate).toFixed(1)), 66.7, '66.7% at one line');
  assert.strictEqual(span.hits, 0, 'and nothing at all at the set span');
});

test('cache: associativity is a cliff rather than a slope', function () {
  const rows = [1, 2, 4, 8, 16, 32].map(function (ways) {
    return { ways: ways,
      hitRate: strideRun({ sets: 32768 / (ways * 64), ways: ways, lineBytes: 64 },
        4096, 16, 4).hitRate };
  });

  rows.slice(0, 4).forEach(function (row) {
    assert.strictEqual(row.hitRate, 0, row.ways + ' ways is not enough for 16 lines');
  });
  assert.strictEqual(Number((100 * rows[4].hitRate).toFixed(1)), 75,
    'and 16 ways gets everything at once');
  assert.strictEqual(rows[5].hitRate, rows[4].hitRate, 'past the cliff nothing more is bought');
});

test('cache: a bigger line fetches fewer times and wastes more', function () {
  const rows = [16, 64, 256, 1024].map(function (lineBytes) {
    const summary = strideRun({ sets: Math.max(1, 32768 / (8 * lineBytes)), ways: 8,
      lineBytes: lineBytes }, 256, 256, 4);

    return { lineBytes: lineBytes, misses: summary.misses,
      fetched: summary.misses * lineBytes, used: 256 * 4 * 8 };
  });

  rows.forEach(function (row, at) {
    if (!at) return;
    assert.ok(row.misses <= rows[at - 1].misses, 'a bigger line never means more misses');
    assert.ok(row.fetched >= rows[at - 1].fetched, 'and never means fewer bytes moved');
  });
  assert.ok(rows[3].misses < rows[0].misses, 'the miss count really does fall');
  assert.ok(rows[3].fetched > 8 * rows[0].fetched,
    'while the traffic rises faster, which is the trade a sparse walk loses');
});

/* ------------------------------------------------------------ cache: policies */

test('cache write policies: no combination wins both workloads', function () {
  const hot = walk(64, 4, 250, true);
  const streaming = walk(64, 1000, 1, true);
  const shape = { sets: 16, ways: 4, lineBytes: 64 };

  function traffic(trace, write, allocate) {
    return run(Cache.create(Object.assign({}, shape, { write: write, allocate: allocate })),
      trace).trafficOut;
  }
  assert.strictEqual(traffic(hot, 'writeBack', 'writeAllocate'), 4,
    'a thousand writes to four lines cost four transactions');
  assert.strictEqual(traffic(hot, 'writeThrough', 'writeAllocate'), 1000,
    'and a thousand under write-through');
  assert.strictEqual(traffic(streaming, 'writeBack', 'writeAllocate'), 1936,
    'a thousand streaming writes cost 1936 when each fetches first');
  assert.strictEqual(traffic(streaming, 'writeBack', 'noWriteAllocate'), 1000,
    'and exactly a thousand when they do not');
});

test('cache: no-write-allocate installs nothing and counts one transaction', function () {
  const cache = Cache.create(Object.assign({}, SMALL, { allocate: 'noWriteAllocate' }));
  const found = Cache.access(cache, { address: 4096, write: true });

  assert.strictEqual(found.hit, false, 'the write missed');
  assert.strictEqual(found.allocated, false, 'and nothing was brought in');
  assert.strictEqual(Cache.probe(cache, 4096).hit, false, 'the line is still absent');
  assert.strictEqual(Cache.summary(cache).trafficOut, 1, 'and it cost one transaction, not two');
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

test('cache RRIP: an install must not promote, or it degenerates into LRU', function () {
  assert.strictEqual(scanHits('lru', 8), 80, 'LRU loses the working set to a scan of eight');
  assert.strictEqual(scanHits('rrip', 8), 156, 'and RRIP keeps all of it');
  assert.ok(scanHits('rrip', 8) > scanHits('lru', 8) + 40,
    'which is the whole reason RRIP exists, and it is a wide margin rather than noise');
  assert.strictEqual(scanHits('rrip', 16), scanHits('lru', 16),
    'the protection is bounded, and past the bound the two agree');
});

test('cache: true LRU is the worst policy on a cyclic reference one line too long',
  function () {
    function cyclic(policy) {
      const cache = Cache.create({ sets: 1, ways: 8, lineBytes: 64, replacement: policy,
        seed: 3 });

      return run(cache, walk(64, 9, 20)).hits;
    }
    assert.strictEqual(cyclic('lru'), 0, 'LRU evicts the line it is about to want, every time');
    assert.ok(cyclic('random') > 0, 'and having no state at all does better');
  });

test('cache pseudo-LRU: the way just touched is not the next victim', function () {
  const cache = Cache.create({ sets: 1, ways: 8, lineBytes: 64, replacement: 'plru' });

  run(cache, walk(64, 8, 1));
  for (let at = 0; at < 8; at += 1) {
    Cache.access(cache, { address: at * 64 });
    const victim = Cache.access(cache, { address: 100000 + at * 64 }).evicted;

    assert.ok(victim, 'the set is full, so something left');
    assert.notStrictEqual(victim.tag, Cache.decode(cache, at * 64).tag,
      'and it was not the line touched a moment ago');
  }
});

test('cache invalidate: it reports what it removed and nothing else', function () {
  const cache = Cache.create(SMALL);

  run(cache, [{ address: 0 }, { address: 4096, write: true }]);
  assert.deepStrictEqual(Cache.invalidate(cache, 0), { found: true, dirty: false },
    'a clean line, removed');
  assert.deepStrictEqual(Cache.invalidate(cache, 4096), { found: true, dirty: true },
    'a dirty line, and the caller is told so it can write it out');
  assert.deepStrictEqual(Cache.invalidate(cache, 0), { found: false, dirty: false },
    'and asking twice finds nothing');
});

/* --------------------------------------------------------------- hierarchy */

function replayed(trace, options) {
  const hierarchy = Hierarchy.create(options || {});

  Hierarchy.replay(hierarchy, trace);
  return hierarchy;
}

function linesOf(cache) {
  return Cache.resident(cache).map(function (row) { return row.line; });
}

/**
 * A hierarchy whose L2 is NARROWER than its L1, which is the only shape in
 * which the inclusion rule has anything to do.
 *
 * Under the preset geometry every level's set count is a multiple of the one
 * above it and the ways are equal, so an L2 victim is never a line L1 still
 * holds and the enforcement never fires. That is worth knowing before trusting
 * a run: the default configuration cannot exercise the mechanism at all, and a
 * test written against it passes whether the rule is implemented or deleted.
 */
const NARROW = [
  { name: 'L1d', sets: 64, ways: 8, lineBytes: 64, hitCycles: 4 },
  { name: 'L2', sets: 1024, ways: 4, lineBytes: 64, hitCycles: 14 },
  { name: 'L3', sets: 8192, ways: 16, lineBytes: 64, hitCycles: 45 }
];

function conflictTrace(lines, passes) {
  const out = [];

  for (let pass = 0; pass < passes; pass += 1) {
    for (let at = 0; at < lines; at += 1) out.push({ address: at * 1024 * 64 });
  }
  return out;
}

test('hierarchy: the preset geometry makes inclusion free, and says so', function () {
  const hierarchy = replayed(Microbench.pointerChase({ bytes: 1048576, passes: 2 }).trace,
    { inclusion: 'inclusive' });

  assert.strictEqual(hierarchy.counters.inclusionEvictions, 0,
    'no line was ever forced out of a level above, because none ever needed to be');
});

test('hierarchy: an inclusive hierarchy really is inclusive, and it costs something',
  function () {
    const hierarchy = Hierarchy.create({ levels: NARROW, inclusion: 'inclusive' });

    Hierarchy.replay(hierarchy, conflictTrace(8, 6));
    for (let at = 1; at < hierarchy.levels.length; at += 1) {
      const below = new Set(linesOf(hierarchy.levels[at]));

      linesOf(hierarchy.levels[at - 1]).forEach(function (line) {
        assert.ok(below.has(line), 'line ' + line + ' is in level ' + at + ' as well');
      });
    }
    assert.strictEqual(hierarchy.counters.inclusionEvictions, 44,
      'and forty-four lines were thrown out of L1 to keep it true');
  });

test('hierarchy: without the rule the property is simply not there', function () {
  const loose = Hierarchy.create({ levels: NARROW, inclusion: 'nonInclusive' });

  Hierarchy.replay(loose, conflictTrace(8, 6));
  const below = new Set(linesOf(loose.levels[1]));
  const orphans = linesOf(loose.levels[0]).filter(function (line) {
    return !below.has(line);
  });

  assert.strictEqual(loose.counters.inclusionEvictions, 0, 'nothing was forced out above');
  assert.strictEqual(orphans.length, 4,
    'so L1 holds four lines L2 has already dropped - exactly what inclusion forbids');
});

test('hierarchy AMAT: the recursion agrees with the cycles the run accumulated', function () {
  const traces = [Microbench.pointerChase({ bytes: 262144, passes: 3 }).trace,
    Microbench.stream({ bytes: 1048576, passes: 2 }).trace,
    Matrix.naive({ n: 24 }).trace];

  traces.forEach(function (trace) {
    const summary = Hierarchy.summary(replayed(trace));

    assert.ok(Math.abs(summary.amat - summary.measured) / summary.measured < 0.05,
      'predicted ' + summary.amat.toFixed(2) + ' against measured '
        + summary.measured.toFixed(2));
    assert.ok(summary.amat >= Hierarchy.PRESET[0].hitCycles, 'and never below an L1 hit');
  });
});

test('hierarchy: the distribution accounts for every access exactly once', function () {
  const hierarchy = replayed(Matrix.naive({ n: 24 }).trace);
  const rows = Hierarchy.distribution(hierarchy);
  const served = rows.reduce(function (sum, row) { return sum + row.served; }, 0);
  const share = rows.reduce(function (sum, row) { return sum + row.share; }, 0);

  assert.strictEqual(served, hierarchy.counters.accesses, 'every access was served somewhere');
  assert.ok(Math.abs(share - 1) < 1e-9, 'and the shares are a distribution');
});

/* --------------------------------------------------------------------- TLB */

test('tlb reach: entries times page size, and huge pages move only that', function () {
  const small = Tlb.create({ entries: 64 });
  const huge = Tlb.create({ entries: 64, hugePages: true });

  assert.strictEqual(Tlb.reach(small), 64 * 4096, '64 entries over 4 KiB pages reach 256 KiB');
  assert.strictEqual(Tlb.reach(huge), 64 * 2 * 1024 * 1024, 'and 128 MiB over huge ones');
  assert.strictEqual(Tlb.reach(huge) / Tlb.reach(small), 512, 'which is 512x for free');
  assert.strictEqual(Tlb.summary(small).entries, 64, 'the buffer itself did not change size');
});

test('tlb: the knee in the hit rate lands on the reach, not near it', function () {
  const reach = 64 * 4096;
  const rows = [reach / 4, reach / 2, reach, reach * 2, reach * 4].map(function (bytes) {
    const tlb = Tlb.create({ entries: 64 });

    return { bytes: bytes,
      hitRate: Tlb.replay(tlb, Microbench.pointerChase({ bytes: bytes, passes: 3,
        seed: 2 }).trace).summary.hitRate };
  });

  rows.slice(0, 3).forEach(function (row) {
    assert.ok(row.hitRate > 0.9, row.bytes + ' bytes fits, so almost everything hits');
  });
  assert.ok(rows[3].hitRate < 0.6, 'one step past the reach and half of it is gone');
  assert.ok(rows[4].hitRate < rows[3].hitRate, 'and it keeps falling');
});

test('tlb walk: a miss costs the whole dependent chain, not one extra access', function () {
  const tlb = Tlb.create({ entries: 4, levels: 4, walkCycles: 30, hitCycles: 1 });
  const miss = Tlb.translate(tlb, 0);
  const hit = Tlb.translate(tlb, 8);

  assert.strictEqual(miss.hit, false, 'the first touch of a page misses');
  assert.strictEqual(miss.cycles, 1 + 4 * 30, 'and pays four dependent memory accesses');
  assert.strictEqual(hit.hit, true, 'the second hits');
  assert.strictEqual(hit.cycles, 1, 'for one cycle');
  assert.strictEqual(Tlb.summary(tlb).walkAccesses, 4, 'one walk, four levels');
});

test('tlb: an address space cannot see another one, which is a protection claim', function () {
  const tlb = Tlb.create({ entries: 16 });
  const mine = Tlb.translate(tlb, 4096).frame;

  Tlb.switchTo(tlb, 1);
  const theirs = Tlb.translate(tlb, 4096).frame;

  assert.notStrictEqual(mine, theirs, 'the same virtual page resolves differently per space');
  assert.deepStrictEqual(Tlb.visible(tlb), ['1:1'], 'and only this space is visible');
  Tlb.switchTo(tlb, 0);
  assert.strictEqual(Tlb.translate(tlb, 4096).frame, mine, 'switching back finds the old frame');
  assert.strictEqual(Tlb.summary(tlb).flushes, 0, 'and no flush was needed to stay correct');
});

test('tlb: without identifiers every switch costs the whole buffer', function () {
  const kept = Tlb.create({ entries: 64 });
  const flushed = Tlb.create({ entries: 64 });
  const pages = [];

  for (let page = 0; page < 16; page += 1) pages.push(page * 4096);
  [kept, flushed].forEach(function (tlb) {
    pages.forEach(function (address) { Tlb.translate(tlb, address); });
  });
  Tlb.switchTo(kept, 1, { asids: true });
  Tlb.switchTo(kept, 0, { asids: true });
  Tlb.switchTo(flushed, 1, { asids: false });
  Tlb.switchTo(flushed, 0, { asids: false });
  const after = pages.map(function (address) { return Tlb.translate(kept, address).hit; });
  const gone = pages.map(function (address) { return Tlb.translate(flushed, address).hit; });

  assert.ok(after.every(Boolean), 'sixteen entries survived the switch');
  assert.ok(gone.every(function (hit) { return !hit; }), 'and sixteen did not');
  assert.strictEqual(Tlb.summary(flushed).walks, 32, 'so every page is walked a second time');
});

test('tlb: a strict walk faults on a page nobody mapped', function () {
  const tlb = Tlb.create({ entries: 8 });
  const found = Tlb.translate(tlb, 40960, { strict: true });

  assert.strictEqual(found.fault, true, 'an unmapped page faults rather than inventing a frame');
  Tlb.map(tlb, 10, 77);
  assert.strictEqual(Tlb.translate(tlb, 40960, { strict: true }).frame, 77,
    'and the mapping is what the walk finds once it exists');
});

/* -------------------------------------------------------------------- DRAM */

function dramRun(options, trace) {
  const dram = Dram.create(options);

  return { dram: dram, summary: Dram.replay(dram, trace) };
}

function twoStreams(count) {
  const out = [];

  for (let at = 0; at < count; at += 1) {
    out.push({ address: at * 64 });
    out.push({ address: 4 * 1024 * 1024 + at * 64 });
  }
  return out;
}

test('dram: the outcomes are counted, and they account for every request', function () {
  const found = dramRun({}, walk(64, 512, 1)).summary;

  assert.strictEqual(found.rowHits + found.rowMisses + found.rowConflicts, found.served,
    'every served request was one of the three');
  assert.strictEqual(found.served, found.requests, 'and every request was served');
  assert.ok(found.rowHits > 0, 'a sequential walk hits open rows, so the rate is not zero');
  assert.strictEqual(found.rowHitRate, found.rowHits / found.served, 'the rate is the ratio');
});

test('dram: the three outcomes cost what the timing says they do', function () {
  const dram = Dram.create({});

  assert.strictEqual(Dram.costOf(dram, 'rowHit'), 15, 'a hit is a column access');
  assert.strictEqual(Dram.costOf(dram, 'rowMiss'), 30, 'a miss activates first');
  assert.strictEqual(Dram.costOf(dram, 'rowConflict'), 45, 'and a conflict closes first');
  assert.strictEqual(Dram.outcomeFor({ open: null }, 3), 'rowMiss', 'no row open is a miss');
  assert.strictEqual(Dram.outcomeFor({ open: 3 }, 3), 'rowHit', 'the same row is a hit');
  assert.strictEqual(Dram.outcomeFor({ open: 2 }, 3), 'rowConflict', 'another row is a conflict');
});

test('dram interleaving: which address bits pick the bank decides who can overlap',
  function () {
    const spread = Dram.create({ interleave: 'bankFirst', banks: 8 });
    const packed = Dram.create({ interleave: 'rowFirst', banks: 8 });
    const banks = [0, 64, 128, 192].map(function (address) {
      return Dram.locate(spread, address).bank;
    });
    const same = [0, 64, 128, 192].map(function (address) {
      return Dram.locate(packed, address).bank;
    });

    assert.strictEqual(new Set(banks).size, 4, 'bank-first puts four lines in four banks');
    assert.strictEqual(new Set(same).size, 1, 'row-first puts them all in one');
  });

test('dram FR-FCFS: reordering finds row hits arrival order hid', function () {
  const trace = twoStreams(512);
  const fcfs = dramRun({ policy: 'fcfs', queue: 16 }, trace).summary;
  const frfcfs = dramRun({ policy: 'frfcfs', queue: 16 }, trace).summary;

  assert.strictEqual(fcfs.rowHits, 0, 'in arrival order every request conflicts');
  assert.ok(frfcfs.rowHitRate > 0.4, 'and reordering finds hits in nearly half of them');
  assert.ok(frfcfs.throughput > 1.8 * fcfs.throughput, 'which is worth most of a doubling');
  const shallow = dramRun({ policy: 'frfcfs', queue: 2 }, trace).summary;

  assert.ok(frfcfs.worstWait > 4 * shallow.worstWait,
    'and it is paid for in the tail: the deeper the queue, the longer somebody waits');
});

test('dram: a policy with nothing to reorder is the same algorithm', function () {
  const trace = twoStreams(256);
  const fcfs = dramRun({ policy: 'fcfs', queue: 1 }, trace).summary;
  const frfcfs = dramRun({ policy: 'frfcfs', queue: 1 }, trace).summary;

  assert.strictEqual(frfcfs.rowHits, fcfs.rowHits, 'the same outcomes at a queue depth of one');
  assert.strictEqual(frfcfs.throughput, fcfs.throughput, 'and the same throughput');
});

test('dram: banks overlap, and the bus is what stops them helping forever', function () {
  const trace = twoStreams(512);
  const rows = [1, 2, 4, 8, 16].map(function (banks) {
    return { banks: banks, found: dramRun({ banks: banks, queue: 16 }, trace).summary };
  });

  assert.ok(rows[1].found.throughput > rows[0].found.throughput,
    'a second bank can activate while the first transfers');
  assert.ok(rows[3].found.throughput > rows[0].found.throughput * 1.1,
    'and eight is worth more than a tenth');
  assert.strictEqual(rows[4].found.throughput.toFixed(1), rows[3].found.throughput.toFixed(1),
    'sixteen buys nothing: the shared bus is the constraint now');
  assert.ok(rows[3].found.elapsed < rows[0].found.elapsed,
    'the wall clock is what moved, which a single-clock model cannot show');
});

test('dram view: the timeline says the same thing the counters do', function () {
  const found = dramRun({ banks: 8, queue: 16 }, twoStreams(128));
  const rows = DramView.banks(found.dram);
  const requests = rows.reduce(function (sum, row) { return sum + row.requests; }, 0);
  const hits = rows.reduce(function (sum, row) { return sum + row.hits; }, 0);

  assert.strictEqual(requests, found.summary.served, 'every served request is on the timeline');
  assert.strictEqual(hits, found.summary.rowHits, 'and the row hits agree');
  assert.strictEqual(rows.length, 8, 'one row per bank');
});

/* -------------------------------------------------------------------- NUMA */

test('numa first touch: the page lands on the node that wrote it first', function () {
  const numa = Numa.create({ nodes: 4, policy: 'firstTouch' });

  assert.strictEqual(Numa.access(numa, { address: 0, node: 2 }).home, 2, 'node 2 touched it');
  assert.strictEqual(Numa.access(numa, { address: 8, node: 3 }).home, 2,
    'and node 3 arriving later does not move it');
  assert.strictEqual(Numa.access(numa, { address: 8, node: 3 }).local, false,
    'so node 3 is remote for the rest of the run');
});

test('numa interleave: placement ignores who touched it, and nobody is starved', function () {
  const numa = Numa.create({ nodes: 4, policy: 'interleave' });

  for (let page = 0; page < 8; page += 1) {
    assert.strictEqual(Numa.access(numa, { address: page * 4096, node: 0 }).home,
      page % 4, 'page ' + page + ' is placed round-robin whoever asked');
  }
  assert.deepStrictEqual(Numa.summary(numa).spread, { 0: 2, 1: 2, 2: 2, 3: 2 },
    'so the pages are spread evenly');
});

test('numa: the classic parallel-for mistake, and the one-line fix', function () {
  const wrong = Numa.parallelFor(Numa.create({ nodes: 2 }), { pages: 64, initialiser: 0 });
  const right = Numa.parallelFor(Numa.create({ nodes: 2 }), { pages: 64, initialiser: null });

  assert.strictEqual(wrong.steady.locality, 0.5, 'half the workers are on the wrong node');
  assert.strictEqual(wrong.steady.average, 110, 'which averages 110 cycles an access');
  assert.strictEqual(right.steady.locality, 1, 'and touching your own chunk first fixes it');
  assert.strictEqual(right.steady.average, 80, 'at the local cost, exactly');
  assert.deepStrictEqual(wrong.spread, { 0: 64 }, 'every page on the initialiser node');
  assert.deepStrictEqual(right.spread, { 0: 32, 1: 32 }, 'against an even split');
});

test('numa: interleaving is not a fix for a placement mistake', function () {
  const spread = Numa.parallelFor(Numa.create({ nodes: 2, policy: 'interleave' }),
    { pages: 64, initialiser: 0 });

  assert.strictEqual(spread.steady.locality, 0.5,
    'a policy cannot know which thread was going to read which half');
  assert.strictEqual(spread.steady.average, 110, 'so it costs exactly what the mistake did');
});

test('numa migration: the refusal is the hard half', function () {
  const handoff = Numa.handoff(Numa.create({ nodes: 2, migrate: true }),
    { pages: 16, rounds: 40 });
  const shared = Numa.alternating(Numa.create({ nodes: 2, migrate: true }),
    { pages: 8, rounds: 20 });
  const idle = Numa.handoff(Numa.create({ nodes: 2, migrate: false }),
    { pages: 16, rounds: 40 });

  assert.strictEqual(idle.steady.locality, 0, 'without migration the user is always remote');
  assert.strictEqual(handoff.migrations, 16, 'with it, one move per page');
  assert.strictEqual(handoff.steady.locality, 0.8, 'and four fifths of the accesses go local');
  assert.strictEqual(shared.migrations, 0, 'and a page two nodes share is never moved');
  assert.strictEqual(shared.locality, 0.5, 'which is the best available on that pattern');
});

test('numa: the latency matrix is local on the diagonal', function () {
  const rows = Numa.matrix(Numa.create({ nodes: 3, localCycles: 80, remoteCycles: 140 }));

  rows.forEach(function (row, at) {
    row.costs.forEach(function (cost, to) {
      assert.strictEqual(cost, at === to ? 80 : 140, 'node ' + at + ' to ' + to);
    });
  });
});
